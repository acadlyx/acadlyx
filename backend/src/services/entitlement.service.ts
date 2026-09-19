import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { TENANT_FEATURES, TenantFeature } from "../config/features";
import { recordAuditLog } from "./audit.service";

const unavailableStatuses = new Set(["EXPIRED", "SUSPENDED", "CANCELLED"]);

export async function provisionTenantEntitlements(
  tx: Prisma.TransactionClient,
  institutionId: string
) {
  const subscription = await tx.tenantSubscription.upsert({
    where: { institutionId },
    update: {},
    create: { institutionId },
  });
  await tx.tenantFeatureEntitlement.createMany({
    data: TENANT_FEATURES.map((featureKey) => ({
      institutionId, subscriptionId: subscription.id, featureKey, isEnabled: true,
    })),
    skipDuplicates: true,
  });
  return subscription;
}

export async function assertTenantFeature(institutionId: string, feature: TenantFeature) {
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { institutionId }, include: { entitlements: { where: { featureKey: feature } } },
  });
  // Existing tenants created before the migration are provisioned lazily once,
  // so there is no insecure or surprising "missing row means disabled" gap.
  if (!subscription) {
    await prisma.$transaction((tx) => provisionTenantEntitlements(tx, institutionId));
    return assertTenantFeature(institutionId, feature);
  }
  if (unavailableStatuses.has(subscription.status) || (subscription.expiresAt && subscription.expiresAt < new Date())) {
    throw new AppError("This tenant subscription is not active", 402);
  }
  const entitlement = subscription.entitlements[0];
  if (!entitlement || !entitlement.isEnabled) {
    throw new AppError(`The ${feature} feature is not enabled for this tenant`, 403);
  }
  return entitlement;
}

export async function assertTenantQuota(institutionId: string, kind: "users" | "students" | "faculty") {
  const subscription = await prisma.tenantSubscription.findUnique({ where: { institutionId } });
  if (!subscription) return; // provisioned on tenant creation; legacy tenants are reconciled by feature access.
  const limit = kind === "users" ? subscription.userLimit : kind === "students" ? subscription.studentLimit : subscription.facultyLimit;
  if (limit === null) return;
  const role = kind === "students" ? "STUDENT" : "FACULTY";
  const used = kind === "users" ? await prisma.user.count({ where: { institutionId } }) : await prisma.user.count({ where: { institutionId, userRoles: { some: { role: { name: role } } } } });
  if (used >= limit) throw new AppError(`Tenant ${kind} limit of ${limit} has been reached`, 403);
}

export async function getTenantEntitlements(institutionId: string) {
  await prisma.$transaction((tx) => provisionTenantEntitlements(tx, institutionId));
  const subscription = await prisma.tenantSubscription.findUniqueOrThrow({
    where: { institutionId }, include: { entitlements: { orderBy: { featureKey: "asc" } } },
  });
  const [users, students, faculty] = await Promise.all([
    prisma.user.count({ where: { institutionId } }),
    prisma.user.count({ where: { institutionId, userRoles: { some: { role: { name: "STUDENT" } } } } }),
    prisma.user.count({ where: { institutionId, userRoles: { some: { role: { name: "FACULTY" } } } } }),
  ]);
  return { ...subscription, usage: { users, students, faculty, storageMb: null } };
}

export async function updateTenantEntitlements(input: {
  institutionId: string; actorId: string; reason: string; plan?: string; status?: string;
  trialEndsAt?: Date | null; expiresAt?: Date | null; renewsAt?: Date | null;
  studentLimit?: number | null; userLimit?: number | null; facultyLimit?: number | null; storageLimitMb?: number | null;
  features?: Array<{ featureKey: TenantFeature; isEnabled: boolean; limitValue?: number | null; override?: Prisma.InputJsonValue | null }>;
}) {
  const before = await getTenantEntitlements(input.institutionId);
  const updated = await prisma.$transaction(async (tx) => {
    const subscription = await tx.tenantSubscription.update({
      where: { institutionId: input.institutionId },
      data: {
        ...(input.plan !== undefined ? { plan: input.plan } : {}), ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.trialEndsAt !== undefined ? { trialEndsAt: input.trialEndsAt } : {}), ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        ...(input.renewsAt !== undefined ? { renewsAt: input.renewsAt } : {}), ...(input.studentLimit !== undefined ? { studentLimit: input.studentLimit } : {}),
        ...(input.userLimit !== undefined ? { userLimit: input.userLimit } : {}), ...(input.facultyLimit !== undefined ? { facultyLimit: input.facultyLimit } : {}), ...(input.storageLimitMb !== undefined ? { storageLimitMb: input.storageLimitMb } : {}),
      },
    });
    for (const feature of input.features || []) {
      await tx.tenantFeatureEntitlement.update({
        where: { institutionId_featureKey: { institutionId: input.institutionId, featureKey: feature.featureKey } },
        data: { isEnabled: feature.isEnabled, limitValue: feature.limitValue, override: feature.override === null ? Prisma.JsonNull : feature.override },
      });
    }
    return subscription;
  });
  await recordAuditLog({ institutionId: input.institutionId, userId: input.actorId, action: "tenant.entitlements_updated", entityType: "TenantSubscription", entityId: updated.id, metadata: { reason: input.reason, previous: before, changed: input } });
  return getTenantEntitlements(input.institutionId);
}
