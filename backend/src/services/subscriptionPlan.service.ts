import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { TENANT_FEATURES, TenantFeature, isTenantFeature } from "../config/features";
import { recordAuditLog } from "./audit.service";
import { getTenantEntitlements } from "./entitlement.service";

/**
 * Subscription plans and tenant lifecycle.
 *
 * entitlement.service answers "may this tenant use feature X right
 * now?" on every request. This module owns the layer above it: the
 * catalogue of plans a tenant can be on, and the state machine that
 * moves a tenant between TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED
 * and EXPIRED.
 *
 * Applying a plan rewrites the tenant's entitlement rows and quotas
 * from the plan definition in one transaction, so enforcement and
 * billing intent can never drift apart.
 */

const TENANT_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

/**
 * Permitted transitions. Reactivation from CANCELLED/EXPIRED is allowed
 * (institutions do come back) but always lands on ACTIVE or TRIAL, never
 * silently back into a mid-lifecycle state.
 */
const TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  TRIAL: ["ACTIVE", "EXPIRED", "CANCELLED"],
  ACTIVE: ["PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"],
  PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCELLED: ["ACTIVE", "TRIAL"],
  EXPIRED: ["ACTIVE", "TRIAL"],
};

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  studentLimit: number | null;
  userLimit: number | null;
  facultyLimit: number | null;
  storageLimitMb: number | null;
  features: unknown;
  isActive: boolean;
  sortOrder: number;
}

function assertPlatformAdmin(actor: AuthenticatedUser): void {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  throw new AppError(
    "Only a platform administrator may manage subscription plans",
    403
  );
}

function planFeatures(plan: PlanRow): TenantFeature[] {
  const raw = Array.isArray(plan.features) ? plan.features : [];
  return raw.filter(
    (value): value is TenantFeature =>
      typeof value === "string" && isTenantFeature(value)
  );
}

export async function listPlans(includeInactive = false) {
  return prisma.$queryRaw<PlanRow[]>(Prisma.sql`
    SELECT * FROM "subscription_plans"
    ${includeInactive ? Prisma.empty : Prisma.sql`WHERE "isActive" = TRUE`}
    ORDER BY "sortOrder" ASC, "name" ASC
  `);
}

export async function upsertPlan(
  actor: AuthenticatedUser,
  input: {
    code: string;
    name: string;
    description?: string;
    monthlyPrice?: number;
    annualPrice?: number;
    currency?: string;
    trialDays?: number;
    studentLimit?: number | null;
    userLimit?: number | null;
    facultyLimit?: number | null;
    storageLimitMb?: number | null;
    features: string[];
    isActive?: boolean;
    sortOrder?: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertPlatformAdmin(actor);

  const unknown = input.features.filter((feature) => !isTenantFeature(feature));
  if (unknown.length > 0) {
    throw new AppError(
      `Unknown feature key(s): ${unknown.join(", ")}`,
      400
    );
  }

  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "subscription_plans"
      ("id", "code", "name", "description", "monthlyPrice", "annualPrice",
       "currency", "trialDays", "studentLimit", "userLimit", "facultyLimit",
       "storageLimitMb", "features", "isActive", "sortOrder")
    VALUES
      (${id}, ${code}, ${input.name.trim()}, ${input.description ?? null},
       ${input.monthlyPrice ?? 0}, ${input.annualPrice ?? 0},
       ${input.currency ?? "INR"}, ${input.trialDays ?? 0},
       ${input.studentLimit ?? null}, ${input.userLimit ?? null},
       ${input.facultyLimit ?? null}, ${input.storageLimitMb ?? null},
       ${JSON.stringify(input.features)}::jsonb, ${input.isActive ?? true},
       ${input.sortOrder ?? 0})
    ON CONFLICT ("code") DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "monthlyPrice" = EXCLUDED."monthlyPrice",
      "annualPrice" = EXCLUDED."annualPrice",
      "currency" = EXCLUDED."currency",
      "trialDays" = EXCLUDED."trialDays",
      "studentLimit" = EXCLUDED."studentLimit",
      "userLimit" = EXCLUDED."userLimit",
      "facultyLimit" = EXCLUDED."facultyLimit",
      "storageLimitMb" = EXCLUDED."storageLimitMb",
      "features" = EXCLUDED."features",
      "isActive" = EXCLUDED."isActive",
      "sortOrder" = EXCLUDED."sortOrder"
  `;

  await recordAuditLog({
    userId: actor.id,
    action: "saas.plan_saved",
    entityType: "SubscriptionPlan",
    entityId: code,
    metadata: { features: input.features.length },
    ...meta,
  });

  return listPlans(true);
}

async function loadPlanByCode(code: string): Promise<PlanRow> {
  const rows = await prisma.$queryRaw<PlanRow[]>(Prisma.sql`
    SELECT * FROM "subscription_plans" WHERE "code" = ${code} LIMIT 1
  `);
  if (rows.length === 0) {
    throw new AppError("Subscription plan was not found", 404);
  }
  return rows[0];
}

/**
 * Moves a tenant onto a plan.
 *
 * Every feature in the catalogue is written explicitly — enabled when
 * the plan includes it, disabled when it does not — so downgrading
 * actually removes access rather than leaving stale entitlements behind.
 */
export async function assignPlan(
  actor: AuthenticatedUser,
  input: {
    institutionId: string;
    planCode: string;
    status?: TenantStatus;
    startTrial?: boolean;
    expiresAt?: Date | null;
    renewsAt?: Date | null;
    reason: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertPlatformAdmin(actor);

  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { id: true, name: true },
  });
  if (!institution) {
    throw new AppError("Institution was not found", 404);
  }

  const plan = await loadPlanByCode(input.planCode.toUpperCase());
  const enabled = new Set(planFeatures(plan));

  const before = await prisma.tenantSubscription.findUnique({
    where: { institutionId: input.institutionId },
    select: { status: true, plan: true },
  });

  const trialEndsAt =
    input.startTrial && plan.trialDays > 0
      ? new Date(Date.now() + plan.trialDays * 86_400_000)
      : null;

  const status: TenantStatus =
    input.status ?? (trialEndsAt ? "TRIAL" : "ACTIVE");

  await prisma.$transaction(async (tx) => {
    const subscription = await tx.tenantSubscription.upsert({
      where: { institutionId: input.institutionId },
      create: {
        institutionId: input.institutionId,
        plan: plan.code,
        planId: plan.id,
        status,
        trialEndsAt,
        expiresAt: input.expiresAt ?? null,
        renewsAt: input.renewsAt ?? null,
        studentLimit: plan.studentLimit,
        userLimit: plan.userLimit,
        facultyLimit: plan.facultyLimit,
        storageLimitMb: plan.storageLimitMb,
      },
      update: {
        plan: plan.code,
        planId: plan.id,
        status,
        trialEndsAt,
        expiresAt: input.expiresAt ?? null,
        renewsAt: input.renewsAt ?? null,
        studentLimit: plan.studentLimit,
        userLimit: plan.userLimit,
        facultyLimit: plan.facultyLimit,
        storageLimitMb: plan.storageLimitMb,
        cancelledAt: null,
        cancellationReason: null,
      },
    });

    for (const featureKey of TENANT_FEATURES) {
      await tx.tenantFeatureEntitlement.upsert({
        where: {
          institutionId_featureKey: {
            institutionId: input.institutionId,
            featureKey,
          },
        },
        create: {
          institutionId: input.institutionId,
          subscriptionId: subscription.id,
          featureKey,
          isEnabled: enabled.has(featureKey),
        },
        update: { isEnabled: enabled.has(featureKey) },
      });
    }

    await tx.$executeRaw`
      INSERT INTO "tenant_lifecycle_events"
        ("id", "institutionId", "eventType", "fromStatus", "toStatus",
         "planCode", "reason", "actorId")
      VALUES
        (${randomUUID()}, ${input.institutionId}, 'PLAN_ASSIGNED',
         ${before?.status ?? null}, ${status}, ${plan.code},
         ${input.reason}, ${actor.id})
    `;
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    userId: actor.id,
    action: "saas.plan_assigned",
    entityType: "TenantSubscription",
    entityId: input.institutionId,
    metadata: {
      previousPlan: before?.plan ?? null,
      plan: plan.code,
      status,
      reason: input.reason,
    },
    ...meta,
  });

  return getTenantEntitlements(input.institutionId);
}

/** Lifecycle transition without changing the plan. */
export async function changeTenantStatus(
  actor: AuthenticatedUser,
  input: { institutionId: string; status: TenantStatus; reason: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertPlatformAdmin(actor);

  if (!(TENANT_STATUSES as readonly string[]).includes(input.status)) {
    throw new AppError(
      `status must be one of: ${TENANT_STATUSES.join(", ")}`,
      400
    );
  }

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { institutionId: input.institutionId },
  });
  if (!subscription) {
    throw new AppError(
      "This institution has no subscription record yet",
      404
    );
  }

  const current = subscription.status as TenantStatus;
  if (current === input.status) {
    throw new AppError(`The tenant is already ${input.status}`, 409);
  }
  const allowed = TRANSITIONS[current] ?? [];
  if (!allowed.includes(input.status)) {
    throw new AppError(
      `A tenant cannot move from ${current} to ${input.status}`,
      409
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.update({
      where: { institutionId: input.institutionId },
      data: {
        status: input.status,
        cancelledAt: input.status === "CANCELLED" ? new Date() : null,
        cancellationReason:
          input.status === "CANCELLED" ? input.reason : null,
        expiresAt:
          input.status === "EXPIRED" ? new Date() : subscription.expiresAt,
      },
    });

    await tx.$executeRaw`
      INSERT INTO "tenant_lifecycle_events"
        ("id", "institutionId", "eventType", "fromStatus", "toStatus",
         "planCode", "reason", "actorId")
      VALUES
        (${randomUUID()}, ${input.institutionId}, 'STATUS_CHANGED',
         ${current}, ${input.status}, ${subscription.plan},
         ${input.reason}, ${actor.id})
    `;
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    userId: actor.id,
    action: "saas.tenant_status_changed",
    entityType: "TenantSubscription",
    entityId: input.institutionId,
    metadata: { from: current, to: input.status, reason: input.reason },
    ...meta,
  });

  return getTenantEntitlements(input.institutionId);
}

export async function getTenantLifecycle(
  actor: AuthenticatedUser,
  institutionId: string
) {
  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    actor.institutionId !== institutionId
  ) {
    throw new AppError("Cross-institution access is not permitted", 403);
  }

  const [entitlements, events] = await Promise.all([
    getTenantEntitlements(institutionId),
    prisma.$queryRaw<
      Array<{
        id: string;
        eventType: string;
        fromStatus: string | null;
        toStatus: string | null;
        planCode: string | null;
        reason: string | null;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT "id", "eventType", "fromStatus", "toStatus", "planCode",
             "reason", "createdAt"
      FROM "tenant_lifecycle_events"
      WHERE "institutionId" = ${institutionId}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `),
  ]);

  return { ...entitlements, events };
}

/**
 * Sweeps expired trials and past-due subscriptions into their terminal
 * state. Idempotent, so it is safe to call from a scheduler or from the
 * platform console.
 */
export async function expireLapsedTenants(
  actor: AuthenticatedUser,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertPlatformAdmin(actor);
  const now = new Date();

  const lapsed = await prisma.tenantSubscription.findMany({
    where: {
      OR: [
        { status: "TRIAL", trialEndsAt: { lt: now } },
        { status: { in: ["ACTIVE", "PAST_DUE"] }, expiresAt: { lt: now } },
      ],
    },
    select: { institutionId: true, status: true, plan: true },
  });

  for (const subscription of lapsed) {
    await prisma.$transaction(async (tx) => {
      await tx.tenantSubscription.update({
        where: { institutionId: subscription.institutionId },
        data: { status: "EXPIRED" },
      });
      await tx.$executeRaw`
        INSERT INTO "tenant_lifecycle_events"
          ("id", "institutionId", "eventType", "fromStatus", "toStatus",
           "planCode", "reason", "actorId")
        VALUES
          (${randomUUID()}, ${subscription.institutionId}, 'AUTO_EXPIRED',
           ${subscription.status}, 'EXPIRED', ${subscription.plan},
           'Subscription period elapsed', ${actor.id})
      `;
    });
  }

  await recordAuditLog({
    userId: actor.id,
    action: "saas.tenants_expired",
    metadata: { expired: lapsed.length },
    ...meta,
  });

  return { expired: lapsed.length };
}
