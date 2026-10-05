import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { TENANT_FEATURES, TenantFeature } from "../config/features";
import { recordAuditLog } from "./audit.service";

const unavailableStatuses = new Set(["EXPIRED", "SUSPENDED", "CANCELLED"]);
const FEATURE_DEPENDENCIES: Partial<Record<TenantFeature, readonly TenantFeature[]>> = {
  attendance: ["academics", "students"],
  timetable: ["academics", "faculty"],
  assignments: ["academics", "students", "faculty"],
  exams: ["academics", "students"],
  results: ["academics", "students"],
  registration: ["academics", "students"],
  obe: ["academics"],
  placements: ["students"],
  library: ["students"],
  leave: ["students"],
  certificates: ["students"],
};

function normalizeFeatureChanges(current: Array<{ featureKey: string; isEnabled: boolean }>, changes: Array<{ featureKey: TenantFeature; isEnabled: boolean }> | undefined) {
  const enabled = new Map(current.map((item) => [item.featureKey as TenantFeature, item.isEnabled]));
  for (const change of changes ?? []) enabled.set(change.featureKey, change.isEnabled);
  return enabled;
}

function assertFeatureDependencyIntegrity(current: Array<{ featureKey: string; isEnabled: boolean }>, changes: Array<{ featureKey: TenantFeature; isEnabled: boolean }> | undefined) {
  const enabled = normalizeFeatureChanges(current, changes);
  for (const [feature, dependencies] of Object.entries(FEATURE_DEPENDENCIES) as Array<[TenantFeature, readonly TenantFeature[]]>) {
    if (!enabled.get(feature)) continue;
    const missing = dependencies.filter((dependency) => !enabled.get(dependency));
    if (missing.length) throw new AppError("Cannot disable " + missing.join(", ") + " while " + feature + " is enabled. Disable dependent modules first.", 409);
  }
}


export async function provisionTenantEntitlements(
  tx: Prisma.TransactionClient,
  institutionId: string
) {
  const existingSubscription = await tx.tenantSubscription.findUnique({
    where: { institutionId },
    select: { id: true },
  });
  const subscription = await tx.tenantSubscription.upsert({
    where: { institutionId },
    update: {},
    create: { institutionId },
  });
  await tx.tenantFeatureEntitlement.createMany({
    data: TENANT_FEATURES.map((featureKey) => ({
      institutionId,
      subscriptionId: subscription.id,
      featureKey,
      // New institutions start with the catalog enabled. Newly introduced
      // modules must not be silently granted to an existing institution.
      isEnabled: !existingSubscription,
    })),
    skipDuplicates: true,
  });

  // OBE always has an explicit configurable baseline policy. This is not
  // presented as an AKTU-mandated formula; institutions should review and
  // adjust it before using official attainment reports.
  const existingObePolicy = await tx.obeAttainmentPolicy.findFirst({
    where: { institutionId, isDefault: true, isActive: true },
    select: { id: true },
  });
  if (!existingObePolicy) {
    await tx.obeAttainmentPolicy.create({
      data: {
        institutionId,
        name: "ACADLYX Default OBE Policy — Review Before Official Reporting",
        scopeType: "INSTITUTION",
        directWeight: 1,
        indirectWeight: 0,
        level1Threshold: 60,
        level2Threshold: 70,
        level3Threshold: 80,
        minimumPassingPercentage: 50,
        isDefault: true,
        isActive: true,
        formulaVersion: "v1",
      },
    });
  }

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
  let entitlement = subscription.entitlements[0];
  if (!entitlement) {
    // A feature added after this tenant was provisioned has no row yet.
    // Provision the missing default rows once (idempotent), then re-read.
    await prisma.$transaction((tx) => provisionTenantEntitlements(tx, institutionId));
    entitlement = (await prisma.tenantFeatureEntitlement.findUnique({
      where: { institutionId_featureKey: { institutionId, featureKey: feature } },
    })) as typeof entitlement;
  }
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
  assertFeatureDependencyIntegrity(before.entitlements, input.features);
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
