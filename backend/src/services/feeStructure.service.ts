import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { hasFeeActionPermission } from "./feeAuthorization";
import { getAuthorizedDepartmentIds, isInstitutionWideFinance, getEffectiveWorkspaceRole } from "./accessScope.service";

const STRUCTURE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "ACTIVE",
  "REJECTED",
  "ARCHIVED",
] as const;

type FeeStructureStatus =
  (typeof STRUCTURE_STATUSES)[number];

function assertEffectiveFeeWorkspaceRole(
  actor: AuthenticatedUser,
  allowedRoles: readonly string[],
  message: string,
): void {
  if (!allowedRoles.includes(getEffectiveWorkspaceRole(actor))) {
    throw new AppError(message, 403);
  }
}

function assertCanManageFees(actor: AuthenticatedUser): void {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["CHAIRMAN", "MANAGEMENT", "ACCOUNTS"],
    "Fee-structure management is not available in the active workspace",
  );
  if (!hasFeeActionPermission(actor.permissions, "manageFeeStructures")) {
    throw new AppError("You are not authorized to manage fee structures", 403);
  }
}

function normalizeCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function normalizeName(
  value: string
): string {
  return value.trim().replace(/\s+/g, " ");
}

function assertFinitePositive(
  value: number,
  field: string
): void {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new AppError(
      `${field} must be greater than zero`,
      400
    );
  }
}

async function assertInstitutionReference(
  institutionId: string,
  table:
    | "academic_years"
    | "programs"
    | "semesters",
  id: string,
  label: string
): Promise<void> {
  const rows =
    await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT "id"
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE "id" = ${id}
          AND "institutionId" = ${institutionId}
        LIMIT 1
      `
    );

  if (rows.length === 0) {
    throw new AppError(
      `${label} was not found in this institution`,
      404
    );
  }
}

async function assertFeeHeadExists(
  institutionId: string,
  feeHeadId: string
): Promise<void> {
  const rows =
    await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT "id"
        FROM "fee_heads"
        WHERE "id" = ${feeHeadId}
          AND "institutionId" = ${institutionId}
        LIMIT 1
      `
    );

  if (rows.length === 0) {
    throw new AppError(
      "Fee head was not found in this institution",
      404
    );
  }
}

export async function listFeeHeads(
  institutionId: string,
  actor: AuthenticatedUser,
  includeInactive = false
) {
  const activeRole = getEffectiveWorkspaceRole(actor);
  // Permissions are accumulated across legacy multi-role bindings, but an
  // unscoped fee-head directory must not become visible merely because a
  // narrower Student/Faculty/Parent workspace also has an Accounts grant.
  // Finance leadership may read shared fee-head names when their explicit
  // read permission exists; platform authority is handled separately.
  const mayReadSharedFeeHeads = [
    "CHAIRMAN", "MANAGEMENT", "ACCOUNTS",
  ].includes(activeRole);
  if (
    !mayReadSharedFeeHeads ||
    !hasFeeActionPermission(actor.permissions, "readFeeStructures")
  ) {
    throw new AppError(
      "Not authorized to view fee heads",
      403
    );
  }

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;
        institutionId: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      includeInactive
        ? Prisma.sql`
            SELECT
              "id",
              "institutionId",
              "name",
              "code",
              "description",
              "isActive",
              "createdAt",
              "updatedAt"
            FROM "fee_heads"
            WHERE "institutionId" = ${institutionId}
            ORDER BY "isActive" DESC, "name" ASC
          `
        : Prisma.sql`
            SELECT
              "id",
              "institutionId",
              "name",
              "code",
              "description",
              "isActive",
              "createdAt",
              "updatedAt"
            FROM "fee_heads"
            WHERE "institutionId" = ${institutionId}
              AND "isActive" = TRUE
            ORDER BY "name" ASC
          `
    );

  return rows;
}

export async function createFeeHead(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    code: string;
    description?: string;
  }
) {
  assertCanManageFees(actor);
  if (!isInstitutionWideFinance(actor)) {
    throw new AppError("Only Accounts or institution-wide administrators may manage shared fee heads", 403);
  }

  const name = normalizeName(input.name);
  const code = normalizeCode(input.code);

  if (!name) {
    throw new AppError(
      "Fee head name is required",
      400
    );
  }

  if (!code) {
    throw new AppError(
      "Fee head code is required",
      400
    );
  }

  if (!/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(code)) {
    throw new AppError(
      "Fee head code must contain 2-50 letters, numbers, underscores or hyphens",
      400
    );
  }

  const existing =
    await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT "id"
        FROM "fee_heads"
        WHERE "institutionId" = ${institutionId}
          AND "code" = ${code}
        LIMIT 1
      `
    );

  if (existing.length > 0) {
    throw new AppError(
      `A fee head with code ${code} already exists`,
      409
    );
  }

  const id = randomUUID();

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;
        institutionId: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      Prisma.sql`
        INSERT INTO "fee_heads" (
          "id",
          "institutionId",
          "name",
          "code",
          "description"
        )
        VALUES (
          ${id},
          ${institutionId},
          ${name},
          ${code},
          ${input.description?.trim() || null}
        )
        RETURNING
          "id",
          "institutionId",
          "name",
          "code",
          "description",
          "isActive",
          "createdAt",
          "updatedAt"
      `
    );

  const feeHead = rows[0];

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-head.create",
    entityType: "FeeHead",
    entityId: id,
    metadata: {
      name,
      code,
    },
  });

  return feeHead;
}

export async function updateFeeHead(
  institutionId: string,
  actor: AuthenticatedUser,
  feeHeadId: string,
  input: {
    name?: string;
    code?: string;
    description?: string | null;
    isActive?: boolean;
  }
) {
  assertCanManageFees(actor);
  if (!isInstitutionWideFinance(actor)) {
    throw new AppError("Only Accounts or institution-wide administrators may manage shared fee heads", 403);
  }

  const existing =
    await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
      }>
    >(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "code",
          "description",
          "isActive"
        FROM "fee_heads"
        WHERE "id" = ${feeHeadId}
          AND "institutionId" = ${institutionId}
        LIMIT 1
      `
    );

  if (existing.length === 0) {
    throw new AppError(
      "Fee head not found",
      404
    );
  }

  const current = existing[0];

  const name =
    input.name === undefined
      ? current.name
      : normalizeName(input.name);

  const code =
    input.code === undefined
      ? current.code
      : normalizeCode(input.code);

  if (!name) {
    throw new AppError(
      "Fee head name cannot be empty",
      400
    );
  }

  if (
    !/^[A-Z0-9][A-Z0-9_-]{1,49}$/.test(code)
  ) {
    throw new AppError(
      "Fee head code must contain 2-50 letters, numbers, underscores or hyphens",
      400
    );
  }

  if (code !== current.code) {
    const duplicate =
      await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT "id"
          FROM "fee_heads"
          WHERE "institutionId" = ${institutionId}
            AND "code" = ${code}
            AND "id" <> ${feeHeadId}
          LIMIT 1
        `
      );

    if (duplicate.length > 0) {
      throw new AppError(
        `A fee head with code ${code} already exists`,
        409
      );
    }
  }

  const description =
    input.description === undefined
      ? current.description
      : input.description?.trim() || null;

  const isActive =
    input.isActive === undefined
      ? current.isActive
      : input.isActive;

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;
        institutionId: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      Prisma.sql`
        UPDATE "fee_heads"
        SET
          "name" = ${name},
          "code" = ${code},
          "description" = ${description},
          "isActive" = ${isActive}
        WHERE "id" = ${feeHeadId}
          AND "institutionId" = ${institutionId}
        RETURNING
          "id",
          "institutionId",
          "name",
          "code",
          "description",
          "isActive",
          "createdAt",
          "updatedAt"
      `
    );

  const feeHead = rows[0];

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-head.update",
    entityType: "FeeHead",
    entityId: feeHeadId,
    metadata: {
      name,
      code,
      isActive,
    },
  });

  return feeHead;
}

/**
 * Director fee visibility and decisions are campus-scoped. A fee structure
 * must identify a program whose department belongs to a campus explicitly
 * assigned through CampusAccess. Unscoped structures remain institution-wide
 * and are intentionally not exposed to campus directors.
 */
async function assertFeeStructureInActorScope(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string,
): Promise<void> {
  if (isInstitutionWideFinance(actor)) return;

  const rows = await prisma.$queryRaw<Array<{
    programId: string | null;
    semesterId: string | null;
    programDepartmentId: string | null;
    semesterDepartmentId: string | null;
  }>>(Prisma.sql`
    SELECT fs."programId", fs."semesterId",
      direct_program."departmentId" AS "programDepartmentId",
      semester_program."departmentId" AS "semesterDepartmentId"
    FROM "fee_structures" fs
    LEFT JOIN "programs" direct_program
      ON direct_program."id" = fs."programId"
      AND direct_program."institutionId" = fs."institutionId"
    LEFT JOIN "semesters" semester_scope
      ON semester_scope."id" = fs."semesterId"
      AND semester_scope."institutionId" = fs."institutionId"
    LEFT JOIN "programs" semester_program
      ON semester_program."id" = semester_scope."programId"
      AND semester_program."institutionId" = fs."institutionId"
    WHERE fs."id" = ${structureId}
      AND fs."institutionId" = ${institutionId}
    LIMIT 1
  `);
  const row = rows[0];
  const allowedDepartmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
  if (
    !row ||
    (!row.programId && !row.semesterId) ||
    (row.programId && (!row.programDepartmentId || !allowedDepartmentIds.includes(row.programDepartmentId))) ||
    (row.semesterId && (!row.semesterDepartmentId || !allowedDepartmentIds.includes(row.semesterDepartmentId)))
  ) {
    throw new AppError("Fee structure not found in your campus scope", 404);
  }
}

/**
 * A scoped workspace may create/submit/assign fee structures only when every
 * selected program and semester resolves to one of its allowed departments.
 * Institution-wide structures are deliberately unavailable to Directors,
 * Deans and HODs because they cannot be assigned to a specific data scope.
 */
async function assertFeeStructureContextInActorScope(
  institutionId: string,
  actor: AuthenticatedUser,
  programId?: string,
  semesterId?: string,
): Promise<void> {
  if (isInstitutionWideFinance(actor)) return;
  if (!programId && !semesterId) {
    throw new AppError("A fee structure must target a program or semester within your assigned scope", 403);
  }

  const allowedDepartmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
  if (!allowedDepartmentIds.length) {
    throw new AppError("No department scope is assigned to this account", 403);
  }

  if (programId) {
    const programs = await prisma.$queryRaw<Array<{ departmentId: string }>>(Prisma.sql`
      SELECT "departmentId" FROM "programs"
      WHERE "id" = ${programId} AND "institutionId" = ${institutionId} LIMIT 1
    `);
    if (!programs[0] || !allowedDepartmentIds.includes(programs[0].departmentId)) {
      throw new AppError("The selected program is outside your assigned campus/department scope", 403);
    }
  }

  if (semesterId) {
    const semesters = await prisma.$queryRaw<Array<{ departmentId: string }>>(Prisma.sql`
      SELECT p."departmentId"
      FROM "semesters" sem
      JOIN "programs" p ON p."id" = sem."programId" AND p."institutionId" = sem."institutionId"
      WHERE sem."id" = ${semesterId} AND sem."institutionId" = ${institutionId}
      LIMIT 1
    `);
    if (!semesters[0] || !allowedDepartmentIds.includes(semesters[0].departmentId)) {
      throw new AppError("The selected semester is outside your assigned campus/department scope", 403);
    }
  }
}

export async function listFeeStructures(
  institutionId: string,
  actor: AuthenticatedUser,
  input?: {
    status?: FeeStructureStatus;
    academicYearId?: string;
    programId?: string;
    semesterId?: string;
  }
) {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["CHAIRMAN", "MANAGEMENT", "ACCOUNTS", "DIRECTOR"],
    "Fee-structure administration is not available in the active workspace",
  );
  if (!hasFeeActionPermission(actor.permissions, "readFeeStructures")) {
    throw new AppError("Not authorized to view fee structures", 403);
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`fs."institutionId" = ${institutionId}`,
  ];

  if (!isInstitutionWideFinance(actor)) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    if (departmentIds.length === 0) return [];
    conditions.push(Prisma.sql`(
      (fs."programId" IS NOT NULL AND fs."programId" IN (
        SELECT p."id" FROM "programs" p
        WHERE p."institutionId" = ${institutionId}
          AND p."departmentId" IN (${Prisma.join(departmentIds)})
      ))
      OR (fs."programId" IS NULL AND fs."semesterId" IN (
        SELECT sem."id" FROM "semesters" sem
        JOIN "programs" p ON p."id" = sem."programId" AND p."institutionId" = sem."institutionId"
        WHERE sem."institutionId" = ${institutionId}
          AND p."departmentId" IN (${Prisma.join(departmentIds)})
      ))
    ) AND (fs."semesterId" IS NULL OR fs."semesterId" IN (
      SELECT sem."id" FROM "semesters" sem
      JOIN "programs" p ON p."id" = sem."programId" AND p."institutionId" = sem."institutionId"
      WHERE sem."institutionId" = ${institutionId}
        AND p."departmentId" IN (${Prisma.join(departmentIds)})
    ))`);
  }

  if (input?.status) {
    conditions.push(
      Prisma.sql`fs."status" = ${input.status}`
    );
  }

  if (input?.academicYearId) {
    conditions.push(
      Prisma.sql`fs."academicYearId" = ${input.academicYearId}`
    );
  }

  if (input?.programId) {
    conditions.push(
      Prisma.sql`fs."programId" = ${input.programId}`
    );
  }

  if (input?.semesterId) {
    conditions.push(
      Prisma.sql`fs."semesterId" = ${input.semesterId}`
    );
  }

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;
        institutionId: string;
        name: string;
        academicYearId: string | null;
        programId: string | null;
        semesterId: string | null;
        status: string;
        currency: string;
        notes: string | null;
        createdById: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      Prisma.sql`
        SELECT
          fs."id",
          fs."institutionId",
          fs."name",
          fs."academicYearId",
          fs."programId",
          fs."semesterId",
          fs."status",
          fs."currency",
          fs."notes",
          fs."createdById",
          fs."createdAt",
          fs."updatedAt"
        FROM "fee_structures" fs
        WHERE ${Prisma.join(
          conditions,
          " AND "
        )}
        ORDER BY fs."createdAt" DESC
      `
    );

  if (rows.length === 0) {
    return [];
  }

  const structureIds =
    rows.map((row) => row.id);

  const items =
    await prisma.$queryRaw<
      Array<{
        id: string;
        feeStructureId: string;
        feeHeadId: string;
        feeHeadName: string;
        feeHeadCode: string;
        amount: number;
        dueDays: number | null;
        installmentNumber: number;
      }>
    >(
      Prisma.sql`
        SELECT
          fsi."id",
          fsi."feeStructureId",
          fsi."feeHeadId",
          fh."name" AS "feeHeadName",
          fh."code" AS "feeHeadCode",
          fsi."amount"::double precision AS "amount",
          fsi."dueDays",
          fsi."installmentNumber"
        FROM "fee_structure_items" fsi
        INNER JOIN "fee_heads" fh
          ON fh."id" = fsi."feeHeadId"
        WHERE fsi."feeStructureId" IN (${Prisma.join(
          structureIds
        )})
        ORDER BY
          fsi."installmentNumber" ASC,
          fh."name" ASC
      `
    );

  return rows.map((structure) => {
    const structureItems =
      items.filter(
        (item) =>
          item.feeStructureId ===
          structure.id
      );

    const totalAmount =
      structureItems.reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

    return {
      ...structure,
      totalAmount,
      items: structureItems,
    };
  });
}

export async function createFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    academicYearId?: string;
    programId?: string;
    semesterId?: string;
    status?: FeeStructureStatus;
    currency?: string;
    notes?: string;
    items: Array<{
      feeHeadId: string;
      amount: number;
      dueDays?: number;
      installmentNumber?: number;
    }>;
  }
) {
  assertCanManageFees(actor);

  const name = normalizeName(input.name);

  if (!name) {
    throw new AppError(
      "Fee structure name is required",
      400
    );
  }

  if (
    input.items.length === 0
  ) {
    throw new AppError(
      "At least one fee structure item is required",
      400
    );
  }

  // Creation is never an approval operation; every new structure starts as DRAFT.
  await assertFeeStructureContextInActorScope(institutionId, actor, input.programId, input.semesterId);
  const status: FeeStructureStatus = "DRAFT";

  if (
    !STRUCTURE_STATUSES.includes(status)
  ) {
    throw new AppError(
      "Invalid fee structure status",
      400
    );
  }

  const currency =
    (
      input.currency ||
      "INR"
    )
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new AppError(
      "Currency must be a valid three-letter ISO-style code",
      400
    );
  }

  if (input.academicYearId) {
    await assertInstitutionReference(
      institutionId,
      "academic_years",
      input.academicYearId,
      "Academic year"
    );
  }

  if (input.programId) {
    await assertInstitutionReference(
      institutionId,
      "programs",
      input.programId,
      "Program"
    );
  }

  if (input.semesterId) {
    await assertInstitutionReference(
      institutionId,
      "semesters",
      input.semesterId,
      "Semester"
    );
  }

  if (
    input.semesterId &&
    !input.programId
  ) {
    throw new AppError(
      "programId is required when semesterId is supplied",
      400
    );
  }

  if (input.programId && input.semesterId) {
    const semesterContext = await prisma.semester.findFirst({
      where: {
        id: input.semesterId,
        institutionId,
        programId: input.programId,
        ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      },
      select: { id: true },
    });
    if (!semesterContext) {
      throw new AppError(
        "Semester must belong to the selected program and academic year",
        400
      );
    }
  }

  const seen =
    new Set<string>();

  for (const item of input.items) {
    await assertFeeHeadExists(
      institutionId,
      item.feeHeadId
    );

    assertFinitePositive(
      item.amount,
      "Fee amount"
    );

    const installment =
      item.installmentNumber ?? 1;

    if (
      !Number.isInteger(installment) ||
      installment < 1 ||
      installment > 100
    ) {
      throw new AppError(
        "installmentNumber must be an integer between 1 and 100",
        400
      );
    }

    if (
      item.dueDays !== undefined &&
      (
        !Number.isInteger(item.dueDays) ||
        item.dueDays < 0 ||
        item.dueDays > 3650
      )
    ) {
      throw new AppError(
        "dueDays must be an integer between 0 and 3650",
        400
      );
    }

    const key =
      `${item.feeHeadId}:${installment}`;

    if (seen.has(key)) {
      throw new AppError(
        "A fee head cannot appear more than once in the same installment",
        400
      );
    }

    seen.add(key);
  }

  const structureId =
    randomUUID();

  try {
    const created =
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "fee_structures" (
                "id",
                "institutionId",
                "name",
                "academicYearId",
                "programId",
                "semesterId",
                "status",
                "currency",
                "notes",
                "createdById"
              )
              VALUES (
                ${structureId},
                ${institutionId},
                ${name},
                ${input.academicYearId ?? null},
                ${input.programId ?? null},
                ${input.semesterId ?? null},
                ${status},
                ${currency},
                ${input.notes?.trim() || null},
                ${actor.id}
              )
            `
          );

          for (const item of input.items) {
            await tx.$executeRaw(
              Prisma.sql`
                INSERT INTO "fee_structure_items" (
                  "id",
                  "feeStructureId",
                  "feeHeadId",
                  "amount",
                  "dueDays",
                  "installmentNumber"
                )
                VALUES (
                  ${randomUUID()},
                  ${structureId},
                  ${item.feeHeadId},
                  ${item.amount},
                  ${item.dueDays ?? null},
                  ${item.installmentNumber ?? 1}
                )
              `
            );
          }

          return structureId;
        }
      );

    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "fee-structure.create",
      entityType: "FeeStructure",
      entityId: created,
      metadata: {
        name,
        status,
        currency,
        itemCount: input.items.length,
      },
    });

    const structures =
      await listFeeStructures(
        institutionId,
        actor,
        { }
      );

    return (
      structures.find(
        (item) =>
          item.id === created
      ) ?? null
    );
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "Duplicate fee structure item detected",
        409
      );
    }

    throw error;
  }
}

export async function submitFeeStructureForApproval(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string
) {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["CHAIRMAN", "MANAGEMENT", "ACCOUNTS"],
    "Fee-structure submission is not available in the active workspace",
  );
  if (!actor.permissions.includes("fees.structure.manage")) {
    throw new AppError("Fee structure management is not authorized", 403);
  }
  await assertFeeStructureInActorScope(institutionId, actor, structureId);
  const changed = await prisma.$executeRaw(Prisma.sql`
    UPDATE "fee_structures"
    SET "status" = 'PENDING_APPROVAL', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${structureId}
      AND "institutionId" = ${institutionId}
      AND "createdById" = ${actor.id}
      AND "status" = 'DRAFT'
  `);
  if (changed !== 1) {
    const rows = await prisma.$queryRaw<Array<{ status: string; createdById: string }>>(Prisma.sql`
      SELECT "status", "createdById" FROM "fee_structures"
      WHERE "id" = ${structureId} AND "institutionId" = ${institutionId} LIMIT 1
    `);
    if (!rows[0]) throw new AppError("Fee structure not found", 404);
    if (rows[0].createdById !== actor.id) throw new AppError("Only the draft creator can submit this fee structure", 403);
    throw new AppError("Only a DRAFT fee structure can be submitted for approval", 409);
  }
  await recordAuditLog({
    institutionId, userId: actor.id, action: "fee-structure.submit-for-approval",
    entityType: "FeeStructure", entityId: structureId,
    metadata: { fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL" },
  });
  return (await listFeeStructures(institutionId, actor, {})).find(x => x.id === structureId) ?? null;
}

export async function publishFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string
) {
  if (getEffectiveWorkspaceRole(actor) !== "CHAIRMAN" || !actor.permissions.includes("fees.structure.publish")) {
    throw new AppError("Direct fee-structure publication is reserved for the Chairman workspace", 403);
  }
  await assertFeeStructureInActorScope(institutionId, actor, structureId);
  const changed = await prisma.$transaction(async (tx) => {
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE "fee_structures"
      SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${structureId}
        AND "institutionId" = ${institutionId}
        AND "status" = 'DRAFT'
    `);
    if (count !== 1) return count;
    await tx.auditLog.create({
      data: {
        institutionId, userId: actor.id, action: "fee-structure.publish-direct",
        entityType: "FeeStructure", entityId: structureId,
        metadata: { fromStatus: "DRAFT", toStatus: "ACTIVE", workflow: "CHAIRMAN_DIRECT_PUBLISH" },
      },
    });
    return count;
  });
  if (changed !== 1) {
    const rows = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT "status" FROM "fee_structures"
      WHERE "id" = ${structureId} AND "institutionId" = ${institutionId} LIMIT 1
    `);
    if (!rows[0]) throw new AppError("Fee structure not found", 404);
    throw new AppError("Only a DRAFT fee structure can be published directly", 409);
  }
  return (await listFeeStructures(institutionId, actor, {})).find(x => x.id === structureId) ?? null;
}

export async function approveFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string
) {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["CHAIRMAN", "MANAGEMENT", "DIRECTOR"],
    "Fee-structure approval is not available in the active workspace",
  );
  if (!actor.permissions.includes("fees.structure.approve")) {
    throw new AppError("Fee structure approval is not authorized", 403);
  }
  await assertFeeStructureInActorScope(institutionId, actor, structureId);
  // A creator cannot approve their own submission, even if they hold both permissions.
  const changed = await prisma.$transaction(async (tx) => {
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE "fee_structures"
      SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${structureId}
        AND "institutionId" = ${institutionId}
        AND "status" = 'PENDING_APPROVAL'
        AND "createdById" <> ${actor.id}
    `);
    if (count !== 1) return count;
    await tx.auditLog.create({
      data: {
        institutionId, userId: actor.id, action: "fee-structure.approve",
        entityType: "FeeStructure", entityId: structureId,
        metadata: { fromStatus: "PENDING_APPROVAL", toStatus: "ACTIVE" },
      },
    });
    return count;
  });
  if (changed !== 1) {
    const rows = await prisma.$queryRaw<Array<{ status: string; createdById: string }>>(Prisma.sql`
      SELECT "status", "createdById" FROM "fee_structures"
      WHERE "id" = ${structureId} AND "institutionId" = ${institutionId} LIMIT 1
    `);
    if (!rows[0]) throw new AppError("Fee structure not found", 404);
    if (rows[0].createdById === actor.id) throw new AppError("The fee structure creator cannot approve their own submission", 403);
    throw new AppError("Only a pending fee structure can be approved", 409);
  }
  return (await listFeeStructures(institutionId, actor, {})).find(x => x.id === structureId) ?? null;
}

export async function rejectFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string,
  reason: string
) {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["CHAIRMAN", "MANAGEMENT", "DIRECTOR"],
    "Fee-structure rejection is not available in the active workspace",
  );
  if (!actor.permissions.includes("fees.structure.approve")) {
    throw new AppError("Fee structure rejection is not authorized", 403);
  }
  await assertFeeStructureInActorScope(institutionId, actor, structureId);
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 1000) {
    throw new AppError("A rejection reason between 3 and 1000 characters is required", 422);
  }
  const changed = await prisma.$transaction(async (tx) => {
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE "fee_structures"
      SET "status" = 'REJECTED', "notes" = CONCAT(COALESCE("notes", ''), CHR(10), '[Approval rejection] ', ${normalizedReason}), "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${structureId}
        AND "institutionId" = ${institutionId}
        AND "status" = 'PENDING_APPROVAL'
        AND "createdById" <> ${actor.id}
    `);
    if (count !== 1) return count;
    await tx.auditLog.create({
      data: {
        institutionId, userId: actor.id, action: "fee-structure.reject",
        entityType: "FeeStructure", entityId: structureId,
        metadata: { fromStatus: "PENDING_APPROVAL", toStatus: "REJECTED", reason: normalizedReason },
      },
    });
    return count;
  });
  if (changed !== 1) {
    const rows = await prisma.$queryRaw<Array<{ status: string; createdById: string }>>(Prisma.sql`
      SELECT "status", "createdById" FROM "fee_structures"
      WHERE "id" = ${structureId} AND "institutionId" = ${institutionId} LIMIT 1
    `);
    if (!rows[0]) throw new AppError("Fee structure not found", 404);
    if (rows[0].createdById === actor.id) throw new AppError("The fee structure creator cannot reject their own submission", 403);
    throw new AppError("Only a pending fee structure can be rejected", 409);
  }
  return (await listFeeStructures(institutionId, actor, {})).find(x => x.id === structureId) ?? null;
}


export async function assignFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string,
  requestedStudentIds?: string[]
) {
  assertEffectiveFeeWorkspaceRole(
    actor,
    ["ACCOUNTS"],
    "Fee assignment is only available in the Accounts workspace",
  );
  if (!actor.permissions.includes("fees.assign")) {
    throw new AppError("Fee assignment is not authorized", 403);
  }

  const structure = await prisma.$queryRaw<Array<{
    id: string; status: string; academicYearId: string | null; programId: string | null; semesterId: string | null;
  }>>(Prisma.sql`
    SELECT "id","status","academicYearId","programId","semesterId"
    FROM "fee_structures" WHERE "id"=${structureId} AND "institutionId"=${institutionId} LIMIT 1
  `);
  if (!structure[0]) throw new AppError("Fee structure not found", 404);
  await assertFeeStructureInActorScope(institutionId, actor, structureId);
  if (structure[0].status !== "ACTIVE") throw new AppError("Only an ACTIVE fee structure can be assigned", 409);

  const items = await prisma.$queryRaw<Array<{ feeHeadId: string; feeHeadName: string; amount: number; dueDays: number | null; installmentNumber: number }>>(Prisma.sql`
    SELECT fsi."feeHeadId", fh."name" AS "feeHeadName", fsi."amount"::double precision AS "amount",
           fsi."dueDays", fsi."installmentNumber"
    FROM "fee_structure_items" fsi
    JOIN "fee_heads" fh ON fh."id"=fsi."feeHeadId"
    WHERE fsi."feeStructureId"=${structureId}
    ORDER BY fsi."installmentNumber", fh."name"
  `);
  if (!items.length) throw new AppError("Fee structure has no billable items", 409);

  let studentIds: string[];
  if (requestedStudentIds?.length) {
    studentIds = [...new Set(requestedStudentIds)];
    const count = await prisma.user.count({
      where: { institutionId, id: { in: studentIds }, isActive: true, userRoles: { some: { role: { name: "STUDENT" } } } },
    });
    if (count !== studentIds.length) throw new AppError("One or more students are not valid members of this institution", 400);
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        institutionId, userId: { in: studentIds }, status: "ACTIVE",
        ...(structure[0].academicYearId ? { academicYearId: structure[0].academicYearId } : {}),
        ...(structure[0].programId ? { programId: structure[0].programId } : {}),
        ...(structure[0].semesterId ? { semesterId: structure[0].semesterId } : {}),
      },
      select: { userId: true }, distinct: ["userId"],
    });
    const enrolled = new Set(enrollments.map(x => x.userId));
    studentIds = studentIds.filter(id => enrolled.has(id));
  } else {
    if (!structure[0].academicYearId && !structure[0].programId && !structure[0].semesterId) {
      throw new AppError("Fee structure requires academic context or an explicit student selection before assignment", 400);
    }
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        institutionId, status: "ACTIVE",
        ...(structure[0].academicYearId ? { academicYearId: structure[0].academicYearId } : {}),
        ...(structure[0].programId ? { programId: structure[0].programId } : {}),
        ...(structure[0].semesterId ? { semesterId: structure[0].semesterId } : {}),
      },
      select: { userId: true }, distinct: ["userId"],
    });
    studentIds = enrollments.map(x => x.userId);
  }
  if (!studentIds.length) return { structureId, generated: 0, skipped: 0 };

  const groups = new Map<number, typeof items>();
  for (const item of items) groups.set(item.installmentNumber, [...(groups.get(item.installmentNumber) ?? []), item]);

  let generated = 0;
  let skipped = 0;
  await prisma.$transaction(async tx => {
    for (const studentId of studentIds) {
      for (const [installment, installmentItems] of groups) {
        const eventKey = `FEE_STRUCTURE_ASSIGNMENT:${structureId}:${studentId}:${installment}`;
        const existing = await tx.feeInvoice.findFirst({ where: { institutionId, sourceEventKey: eventKey }, select: { id: true } });
        if (existing) { skipped++; continue; }
        const gross = installmentItems.reduce((sum, item) => sum + Number(item.amount), 0);
        const dueDays = installmentItems.reduce<number | null>((max, item) => item.dueDays == null ? max : Math.max(max ?? 0, item.dueDays), null);
        const dueDate = dueDays == null ? null : new Date(Date.now() + dueDays * 86400000);
        const invoice = await tx.feeInvoice.create({
          data: {
            institutionId, studentId, title: `Fee structure — Installment ${installment}`,
            amount: gross, grossAmount: gross, dueDate, status: "PENDING",
            feeStructureId: structureId, academicYearId: structure[0].academicYearId, semesterId: structure[0].semesterId,
            installmentNumber: installment, sourceModule: "FEES", sourceType: "FEE_STRUCTURE_ASSIGNMENT",
            sourceEntityId: structureId, sourceEventKey: eventKey,
            items: { create: installmentItems.map(item => ({ feeHeadId: item.feeHeadId, description: item.feeHeadName, amount: item.amount })) },
          },
        });
        await tx.feeTransaction.create({
          data: { institutionId, studentId, invoiceId: invoice.id, amount: gross, type: "INVOICE", reference: eventKey, createdById: actor.id, metadata: { sourceModule: "FEES", feeStructureId: structureId, installmentNumber: installment } },
        });
        generated++;
      }
    }
  });

  await recordAuditLog({
    institutionId, userId: actor.id, action: "fee-structure.assign", entityType: "FeeStructure", entityId: structureId,
    metadata: { generated, skipped, studentCount: studentIds.length },
  });
  return { structureId, generated, skipped, studentCount: studentIds.length };
}

export async function updateFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string,
  input: {
    name?: string;
    status?: FeeStructureStatus;
    currency?: string;
    notes?: string | null;
    items?: Array<{
      feeHeadId: string;
      amount: number;
      dueDays?: number;
      installmentNumber?: number;
    }>;
  }
) {
  assertCanManageFees(actor);

  const existing =
    await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        status: string;
        currency: string;
        notes: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "status",
          "currency",
          "notes"
        FROM "fee_structures"
        WHERE "id" = ${structureId}
          AND "institutionId" = ${institutionId}
        LIMIT 1
      `
    );

  if (existing.length === 0) {
    throw new AppError(
      "Fee structure not found",
      404
    );
  }

  const current =
    existing[0];

  await assertFeeStructureInActorScope(institutionId, actor, structureId);

  if (current.status !== "DRAFT" && current.status !== "REJECTED") {
    throw new AppError(
      "Only DRAFT or REJECTED fee structures can be edited; submitted or approved structures are immutable",
      409
    );
  }

  const name =
    input.name === undefined
      ? current.name
      : normalizeName(input.name);

  if (!name) {
    throw new AppError(
      "Fee structure name cannot be empty",
      400
    );
  }

  // Editing a rejected submission returns it to DRAFT so it must be
  // submitted and approved again before any fee assignment can occur.
  const status: FeeStructureStatus = current.status === "REJECTED"
    ? "DRAFT"
    : input.status ?? (current.status as FeeStructureStatus);

  if (input.status === "ACTIVE") {
    throw new AppError("Fee structures must be activated through the explicit approval workflow", 409);
  }

  if (
    !STRUCTURE_STATUSES.includes(status)
  ) {
    throw new AppError(
      "Invalid fee structure status",
      400
    );
  }

  const currency =
    input.currency === undefined
      ? current.currency
      : input.currency
          .trim()
          .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new AppError(
      "Currency must be a valid three-letter ISO-style code",
      400
    );
  }

  if (
    input.items !== undefined
  ) {
    if (
      input.items.length === 0
    ) {
      throw new AppError(
        "A fee structure must contain at least one item",
        400
      );
    }

    const seen =
      new Set<string>();

    for (const item of input.items) {
      await assertFeeHeadExists(
        institutionId,
        item.feeHeadId
      );

      assertFinitePositive(
        item.amount,
        "Fee amount"
      );

      const installment =
        item.installmentNumber ?? 1;

      if (
        !Number.isInteger(
          installment
        ) ||
        installment < 1 ||
        installment > 100
      ) {
        throw new AppError(
          "installmentNumber must be an integer between 1 and 100",
          400
        );
      }

      if (
        item.dueDays !== undefined &&
        (
          !Number.isInteger(
            item.dueDays
          ) ||
          item.dueDays < 0 ||
          item.dueDays > 3650
        )
      ) {
        throw new AppError(
          "dueDays must be an integer between 0 and 3650",
          400
        );
      }

      const key =
        `${item.feeHeadId}:${installment}`;

      if (seen.has(key)) {
        throw new AppError(
          "A fee head cannot appear more than once in the same installment",
          400
        );
      }

      seen.add(key);
    }
  }

  await prisma.$transaction(
    async (tx) => {
      const changed = await tx.$executeRaw(
        Prisma.sql`
          UPDATE "fee_structures"
          SET
            "name" = ${name},
            "status" = ${status},
            "currency" = ${currency},
            "notes" = ${
              input.notes === undefined
                ? current.status === "REJECTED"
                  ? current.notes?.split("\n[Approval rejection] ")[0] ?? null
                  : current.notes
                : input.notes?.trim() || null
            }
          WHERE "id" = ${structureId}
            AND "institutionId" = ${institutionId}
            AND "status" = ${current.status}
        `
      );
      if (changed !== 1) {
        throw new AppError("Fee structure status changed while editing; reload and try again", 409);
      }

      if (
        input.items !== undefined
      ) {
        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "fee_structure_items"
            WHERE "feeStructureId" = ${structureId}
          `
        );

        for (const item of input.items) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "fee_structure_items" (
                "id",
                "feeStructureId",
                "feeHeadId",
                "amount",
                "dueDays",
                "installmentNumber"
              )
              VALUES (
                ${randomUUID()},
                ${structureId},
                ${item.feeHeadId},
                ${item.amount},
                ${item.dueDays ?? null},
                ${item.installmentNumber ?? 1}
              )
            `
          );
        }
      }
    }
  );

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fee-structure.update",
    entityType: "FeeStructure",
    entityId: structureId,
    metadata: {
      name,
      status,
      itemsReplaced:
        input.items !== undefined,
    },
  });

  const structures =
    await listFeeStructures(
      institutionId,
      actor
    );

  return (
    structures.find(
      (item) =>
        item.id === structureId
    ) ?? null
  );
}
