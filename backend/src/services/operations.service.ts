import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import {
  andWhere,
  assertTenantReference,
  countRows,
  requireTenantRow,
} from "../utils/sqlScope";
import { getManagedDepartmentIds, isInstitutionWide } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

/**
 * Institution operations.
 *
 * Deliberately narrow: an asset register, a facility register and a
 * maintenance queue — what a campus actually needs to run the estate.
 * It is not a procurement, depreciation or vendor-management system;
 * that would be corporate ERP scope creep.
 */

const OPS_MANAGER_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "STAFF",
];

const ASSET_STATUSES = ["IN_USE", "IN_STORE", "UNDER_REPAIR", "RETIRED", "LOST"] as const;
const MAINTENANCE_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;

function assertCanManageOperations(actor: AuthenticatedUser): void {
  if (actor.roles.some((role) => OPS_MANAGER_ROLES.includes(role))) return;
  if (actor.permissions.includes("operations.manage")) return;
  throw new AppError(
    "You are not authorized to manage institution operations",
    403
  );
}

// ==========================================================
// ASSET CATEGORIES
// ==========================================================

export async function listAssetCategories(institutionId: string) {
  return prisma.$queryRaw<
    Array<{ id: string; name: string; code: string; isActive: boolean; assetCount: number }>
  >(Prisma.sql`
    SELECT c."id", c."name", c."code", c."isActive",
           (SELECT COUNT(*) FROM "assets" a WHERE a."assetCategoryId" = c."id")::int AS "assetCount"
    FROM "asset_categories" c
    WHERE c."institutionId" = ${institutionId}
    ORDER BY c."name" ASC
  `);
}

export async function createAssetCategory(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { name: string; code: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageOperations(actor);
  const id = randomUUID();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");

  await prisma.$executeRaw`
    INSERT INTO "asset_categories" ("id", "institutionId", "name", "code")
    VALUES (${id}, ${institutionId}, ${input.name.trim()}, ${code})
    ON CONFLICT ("institutionId", "code") DO NOTHING
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.asset_category_created",
    entityType: "AssetCategory",
    entityId: id,
    metadata: { code },
    ...meta,
  });

  return listAssetCategories(institutionId);
}

// ==========================================================
// ASSETS
// ==========================================================

export async function listAssets(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    search?: string;
    status?: string;
    assetCategoryId?: string;
    departmentId?: string;
  }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."institutionId" = ${institutionId}`,
  ];

  // An HOD sees only their own department's register.
  if (!isInstitutionWide(actor) && actor.roles.includes("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.length === 0) return { items: [], total: 0 };
    conditions.push(Prisma.sql`a."departmentId" IN (${Prisma.join(managed)})`);
  }

  if (filters.status) conditions.push(Prisma.sql`a."status" = ${filters.status}`);
  if (filters.assetCategoryId) {
    conditions.push(Prisma.sql`a."assetCategoryId" = ${filters.assetCategoryId}`);
  }
  if (filters.departmentId) {
    conditions.push(Prisma.sql`a."departmentId" = ${filters.departmentId}`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(a."name" ILIKE ${like} OR a."assetTag" ILIKE ${like} OR a."serialNumber" ILIKE ${like})`
    );
  }
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        assetTag: string;
        status: string;
        condition: string;
        quantity: number;
        categoryName: string | null;
        departmentName: string | null;
        assignedToName: string | null;
      }>
    >(Prisma.sql`
      SELECT a."id", a."name", a."assetTag", a."serialNumber", a."status",
             a."condition", a."quantity", a."unitCost", a."location",
             a."purchaseDate", a."warrantyEndsAt",
             c."name" AS "categoryName", d."name" AS "departmentName",
             CASE WHEN u."id" IS NULL THEN NULL
                  ELSE u."firstName" || ' ' || u."lastName" END AS "assignedToName"
      FROM "assets" a
      LEFT JOIN "asset_categories" c ON c."id" = a."assetCategoryId"
      LEFT JOIN "departments" d ON d."id" = a."departmentId"
      LEFT JOIN "users" u ON u."id" = a."assignedToId"
      ${where}
      ORDER BY a."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "assets" a ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createAsset(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    assetTag: string;
    assetCategoryId?: string;
    campusId?: string;
    departmentId?: string;
    serialNumber?: string;
    location?: string;
    quantity?: number;
    unitCost?: number;
    purchaseDate?: Date;
    warrantyEndsAt?: Date;
    condition?: string;
    status?: string;
    assignedToId?: string;
    notes?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageOperations(actor);

  for (const [table, id, label] of [
    ["asset_categories", input.assetCategoryId, "Asset category"],
    ["campuses", input.campusId, "Campus"],
    ["departments", input.departmentId, "Department"],
  ] as const) {
    if (id) await assertTenantReference(prisma, table, institutionId, id, label);
  }
  if (input.assignedToId) {
    const holder = await prisma.user.count({
      where: { id: input.assignedToId, institutionId },
    });
    if (holder === 0) {
      throw new AppError("Assignee is not a user in this institution", 404);
    }
  }
  if (input.status && !(ASSET_STATUSES as readonly string[]).includes(input.status)) {
    throw new AppError(
      `status must be one of: ${ASSET_STATUSES.join(", ")}`,
      400
    );
  }

  const id = randomUUID();
  const assetTag = input.assetTag.trim().toUpperCase();

  try {
    await prisma.$executeRaw`
      INSERT INTO "assets"
        ("id", "institutionId", "assetCategoryId", "campusId", "departmentId",
         "name", "assetTag", "serialNumber", "location", "quantity", "unitCost",
         "purchaseDate", "warrantyEndsAt", "condition", "status", "assignedToId",
         "notes", "createdById")
      VALUES
        (${id}, ${institutionId}, ${input.assetCategoryId ?? null},
         ${input.campusId ?? null}, ${input.departmentId ?? null},
         ${input.name.trim()}, ${assetTag}, ${input.serialNumber ?? null},
         ${input.location ?? null}, ${input.quantity ?? 1}, ${input.unitCost ?? null},
         ${input.purchaseDate ?? null}, ${input.warrantyEndsAt ?? null},
         ${input.condition ?? "GOOD"}, ${input.status ?? "IN_USE"},
         ${input.assignedToId ?? null}, ${input.notes ?? null}, ${actor.id})
    `;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new AppError("An asset with this tag already exists", 409);
    }
    throw error;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.asset_created",
    entityType: "Asset",
    entityId: id,
    metadata: { assetTag, name: input.name },
    ...meta,
  });

  return requireTenantRow(prisma, "assets", institutionId, id, "Asset");
}

export async function updateAsset(
  institutionId: string,
  actor: AuthenticatedUser,
  assetId: string,
  input: {
    name?: string;
    location?: string;
    quantity?: number;
    condition?: string;
    status?: string;
    departmentId?: string;
    assignedToId?: string | null;
    notes?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageOperations(actor);
  const before = await requireTenantRow<{ id: string; status: string }>(
    prisma,
    "assets",
    institutionId,
    assetId,
    "Asset"
  );

  if (input.status && !(ASSET_STATUSES as readonly string[]).includes(input.status)) {
    throw new AppError(
      `status must be one of: ${ASSET_STATUSES.join(", ")}`,
      400
    );
  }
  if (input.departmentId) {
    await assertTenantReference(
      prisma,
      "departments",
      institutionId,
      input.departmentId,
      "Department"
    );
  }
  if (input.assignedToId) {
    const holder = await prisma.user.count({
      where: { id: input.assignedToId, institutionId },
    });
    if (holder === 0) {
      throw new AppError("Assignee is not a user in this institution", 404);
    }
  }

  await prisma.$executeRaw`
    UPDATE "assets"
    SET "name" = COALESCE(${input.name ?? null}, "name"),
        "location" = COALESCE(${input.location ?? null}, "location"),
        "quantity" = COALESCE(${input.quantity ?? null}, "quantity"),
        "condition" = COALESCE(${input.condition ?? null}, "condition"),
        "status" = COALESCE(${input.status ?? null}, "status"),
        "departmentId" = COALESCE(${input.departmentId ?? null}, "departmentId"),
        "assignedToId" = ${input.assignedToId === undefined ? Prisma.sql`"assignedToId"` : Prisma.sql`${input.assignedToId}`},
        "notes" = COALESCE(${input.notes ?? null}, "notes")
    WHERE "id" = ${assetId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.asset_updated",
    entityType: "Asset",
    entityId: assetId,
    metadata: { previousStatus: before.status, changed: Object.keys(input) },
    ...meta,
  });

  return requireTenantRow(prisma, "assets", institutionId, assetId, "Asset");
}

// ==========================================================
// FACILITIES
// ==========================================================

export async function listFacilities(
  institutionId: string,
  filters: { includeInactive?: boolean; facilityType?: string; search?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`f."institutionId" = ${institutionId}`,
  ];
  if (!filters.includeInactive) conditions.push(Prisma.sql`f."isActive" = TRUE`);
  if (filters.facilityType) {
    conditions.push(Prisma.sql`f."facilityType" = ${filters.facilityType}`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(Prisma.sql`(f."name" ILIKE ${like} OR f."code" ILIKE ${like})`);
  }

  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      facilityType: string;
      capacity: number | null;
      openRequests: number;
    }>
  >(Prisma.sql`
    SELECT f."id", f."name", f."code", f."facilityType", f."capacity",
           f."location", f."isActive",
           (SELECT COUNT(*) FROM "maintenance_requests" m
             WHERE m."facilityId" = f."id"
               AND m."status" NOT IN ('CLOSED', 'REJECTED'))::int AS "openRequests"
    FROM "facilities" f
    ${andWhere(conditions)}
    ORDER BY f."name" ASC
    LIMIT 300
  `);
}

export async function createFacility(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    code: string;
    facilityType?: string;
    capacity?: number;
    campusId?: string;
    location?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageOperations(actor);
  if (input.campusId) {
    await assertTenantReference(
      prisma,
      "campuses",
      institutionId,
      input.campusId,
      "Campus"
    );
  }

  const id = randomUUID();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");

  try {
    await prisma.$executeRaw`
      INSERT INTO "facilities"
        ("id", "institutionId", "campusId", "name", "code", "facilityType",
         "capacity", "location")
      VALUES
        (${id}, ${institutionId}, ${input.campusId ?? null}, ${input.name.trim()},
         ${code}, ${input.facilityType ?? "CLASSROOM"}, ${input.capacity ?? null},
         ${input.location ?? null})
    `;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new AppError("A facility with this code already exists", 409);
    }
    throw error;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.facility_created",
    entityType: "Facility",
    entityId: id,
    metadata: { code, facilityType: input.facilityType ?? "CLASSROOM" },
    ...meta,
  });

  return requireTenantRow(prisma, "facilities", institutionId, id, "Facility");
}

export async function updateFacility(
  institutionId: string,
  actor: AuthenticatedUser,
  facilityId: string,
  input: {
    name?: string;
    facilityType?: string;
    capacity?: number;
    location?: string;
    isActive?: boolean;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageOperations(actor);
  await requireTenantRow(prisma, "facilities", institutionId, facilityId, "Facility");

  await prisma.$executeRaw`
    UPDATE "facilities"
    SET "name" = COALESCE(${input.name ?? null}, "name"),
        "facilityType" = COALESCE(${input.facilityType ?? null}, "facilityType"),
        "capacity" = COALESCE(${input.capacity ?? null}, "capacity"),
        "location" = COALESCE(${input.location ?? null}, "location"),
        "isActive" = COALESCE(${input.isActive ?? null}, "isActive")
    WHERE "id" = ${facilityId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.facility_updated",
    entityType: "Facility",
    entityId: facilityId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return requireTenantRow(prisma, "facilities", institutionId, facilityId, "Facility");
}

// ==========================================================
// MAINTENANCE
// ==========================================================

/** Anyone in the tenant may report a fault; only ops staff may triage. */
export async function createMaintenanceRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    facilityId?: string;
    assetId?: string;
    title: string;
    description: string;
    priority?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (!input.facilityId && !input.assetId) {
    throw new AppError(
      "A maintenance request must name a facility or an asset",
      400
    );
  }
  if (input.facilityId) {
    await assertTenantReference(
      prisma,
      "facilities",
      institutionId,
      input.facilityId,
      "Facility"
    );
  }
  if (input.assetId) {
    await assertTenantReference(prisma, "assets", institutionId, input.assetId, "Asset");
  }

  const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(input.priority ?? "")
    ? input.priority!
    : "MEDIUM";

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "maintenance_requests"
      ("id", "institutionId", "facilityId", "assetId", "title", "description",
       "priority", "status", "raisedById")
    VALUES
      (${id}, ${institutionId}, ${input.facilityId ?? null}, ${input.assetId ?? null},
       ${input.title.trim()}, ${input.description.trim()}, ${priority}, 'OPEN',
       ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.maintenance_raised",
    entityType: "MaintenanceRequest",
    entityId: id,
    metadata: { priority, facilityId: input.facilityId, assetId: input.assetId },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "maintenance_requests",
    institutionId,
    id,
    "Maintenance request"
  );
}

export async function listMaintenanceRequests(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; priority?: string; mine?: boolean; assignedToMe?: boolean }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`m."institutionId" = ${institutionId}`,
  ];

  const canTriage =
    actor.roles.some((role) => OPS_MANAGER_ROLES.includes(role)) ||
    actor.permissions.includes("operations.manage");

  if (filters.mine || !canTriage) {
    conditions.push(
      Prisma.sql`(m."raisedById" = ${actor.id} OR m."assignedToId" = ${actor.id})`
    );
  } else if (filters.assignedToMe) {
    conditions.push(Prisma.sql`m."assignedToId" = ${actor.id}`);
  }

  if (filters.status) conditions.push(Prisma.sql`m."status" = ${filters.status}`);
  if (filters.priority) conditions.push(Prisma.sql`m."priority" = ${filters.priority}`);
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        priority: string;
        status: string;
        createdAt: Date;
        facilityName: string | null;
        assetName: string | null;
        raisedByName: string;
        assignedToName: string | null;
      }>
    >(Prisma.sql`
      SELECT m."id", m."title", m."description", m."priority", m."status",
             m."createdAt", m."resolvedAt", m."resolutionNote",
             f."name" AS "facilityName", a."name" AS "assetName",
             r."firstName" || ' ' || r."lastName" AS "raisedByName",
             CASE WHEN t."id" IS NULL THEN NULL
                  ELSE t."firstName" || ' ' || t."lastName" END AS "assignedToName"
      FROM "maintenance_requests" m
      LEFT JOIN "facilities" f ON f."id" = m."facilityId"
      LEFT JOIN "assets" a ON a."id" = m."assetId"
      JOIN "users" r ON r."id" = m."raisedById"
      LEFT JOIN "users" t ON t."id" = m."assignedToId"
      ${where}
      ORDER BY
        CASE m."priority" WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2
                          WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        m."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "maintenance_requests" m ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function updateMaintenanceRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  requestId: string,
  input: { status?: string; assignedToId?: string; resolutionNote?: string; priority?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const request = await requireTenantRow<{
    id: string;
    status: string;
    assignedToId: string | null;
    raisedById: string;
  }>(prisma, "maintenance_requests", institutionId, requestId, "Maintenance request");

  const canTriage =
    actor.roles.some((role) => OPS_MANAGER_ROLES.includes(role)) ||
    actor.permissions.includes("operations.manage");

  // The assignee may progress their own job; everything else is triage.
  if (!canTriage && request.assignedToId !== actor.id) {
    throw new AppError(
      "You are not authorized to update this maintenance request",
      403
    );
  }
  if (!canTriage && (input.assignedToId || input.priority)) {
    throw new AppError(
      "Only operations staff may reassign or reprioritise a request",
      403
    );
  }

  if (input.status && !(MAINTENANCE_STATUSES as readonly string[]).includes(input.status)) {
    throw new AppError(
      `status must be one of: ${MAINTENANCE_STATUSES.join(", ")}`,
      400
    );
  }
  if (input.assignedToId) {
    const assignee = await prisma.user.count({
      where: { id: input.assignedToId, institutionId, isActive: true },
    });
    if (assignee === 0) {
      throw new AppError("Assignee is not an active user in this institution", 404);
    }
  }

  const status =
    input.status ?? (input.assignedToId && request.status === "OPEN" ? "ASSIGNED" : undefined);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "maintenance_requests"
      SET "status" = COALESCE(${status ?? null}, "status"),
          "assignedToId" = COALESCE(${input.assignedToId ?? null}, "assignedToId"),
          "priority" = COALESCE(${input.priority ?? null}, "priority"),
          "resolutionNote" = COALESCE(${input.resolutionNote ?? null}, "resolutionNote"),
          "resolvedAt" = CASE WHEN ${status ?? null} = 'RESOLVED'
            THEN CURRENT_TIMESTAMP ELSE "resolvedAt" END,
          "closedAt" = CASE WHEN ${status ?? null} IN ('CLOSED', 'REJECTED')
            THEN CURRENT_TIMESTAMP ELSE "closedAt" END
      WHERE "id" = ${requestId} AND "institutionId" = ${institutionId}
    `;

    if (input.assignedToId && input.assignedToId !== request.assignedToId) {
      await tx.notification.create({
        data: {
          institutionId,
          userId: input.assignedToId,
          title: "Maintenance request assigned",
          body: "A maintenance request has been assigned to you.",
        },
      });
    }
    if (status === "RESOLVED" || status === "CLOSED") {
      await tx.notification.create({
        data: {
          institutionId,
          userId: request.raisedById,
          title: "Maintenance request updated",
          body: `Your maintenance request is now ${status}.`,
        },
      });
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "operations.maintenance_updated",
    entityType: "MaintenanceRequest",
    entityId: requestId,
    metadata: { from: request.status, to: status, assignedToId: input.assignedToId },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "maintenance_requests",
    institutionId,
    requestId,
    "Maintenance request"
  );
}

/** Headline numbers for the operations dashboard. */
export async function getOperationsSummary(institutionId: string) {
  const [assets, facilities, maintenance] = await Promise.all([
    prisma.$queryRaw<
      Array<{ total: number; inUse: number; underRepair: number; value: number | null }>
    >(Prisma.sql`
      SELECT COUNT(*)::int AS "total",
             COUNT(*) FILTER (WHERE "status" = 'IN_USE')::int AS "inUse",
             COUNT(*) FILTER (WHERE "status" = 'UNDER_REPAIR')::int AS "underRepair",
             SUM(COALESCE("unitCost", 0) * "quantity")::float AS "value"
      FROM "assets" WHERE "institutionId" = ${institutionId}
    `),
    countRows(
      prisma,
      "facilities",
      Prisma.sql`WHERE "institutionId" = ${institutionId} AND "isActive" = TRUE`
    ),
    prisma.$queryRaw<
      Array<{ open: number; urgent: number; resolvedThisMonth: number }>
    >(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE "status" NOT IN ('CLOSED','REJECTED'))::int AS "open",
             COUNT(*) FILTER (WHERE "priority" = 'URGENT'
               AND "status" NOT IN ('CLOSED','REJECTED'))::int AS "urgent",
             COUNT(*) FILTER (WHERE "resolvedAt" >= DATE_TRUNC('month', CURRENT_DATE))::int AS "resolvedThisMonth"
      FROM "maintenance_requests" WHERE "institutionId" = ${institutionId}
    `),
  ]);

  return {
    assets: {
      total: assets[0]?.total ?? 0,
      inUse: assets[0]?.inUse ?? 0,
      underRepair: assets[0]?.underRepair ?? 0,
      bookValue: assets[0]?.value ?? 0,
    },
    facilities: { active: facilities },
    maintenance: {
      open: maintenance[0]?.open ?? 0,
      urgent: maintenance[0]?.urgent ?? 0,
      resolvedThisMonth: maintenance[0]?.resolvedThisMonth ?? 0,
    },
  };
}
