import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { hasFeeActionPermission } from "./feeAuthorization";

const STRUCTURE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

type FeeStructureStatus =
  (typeof STRUCTURE_STATUSES)[number];

function assertCanManageFees(
  actor: AuthenticatedUser
): void {
  if (!hasFeeActionPermission(actor.permissions, "manageFeeStructures")) {
    throw new AppError(
      "You are not authorized to manage fee structures",
      403
    );
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
  if (
    !actor.roles.includes("SUPER_ADMIN") &&
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
  if (
    !actor.roles.includes("SUPER_ADMIN") &&
    !actor.permissions.includes("fees.structure.read")
  ) {
    throw new AppError(
      "Not authorized to view fee structures",
      403
    );
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`fs."institutionId" = ${institutionId}`,
  ];

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

  const status =
    input.status ?? "DRAFT";

  if (status === "ACTIVE" && !actor.permissions.includes("fees.structure.approve")) {
    throw new AppError("Only an authorized fee approver may activate a fee structure", 403);
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

export async function approveFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string
) {
  if (!actor.permissions.includes("fees.structure.approve")) {
    throw new AppError("Fee structure approval is not authorized", 403);
  }
  const rows = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
    SELECT "id","status" FROM "fee_structures"
    WHERE "id"=${structureId} AND "institutionId"=${institutionId} LIMIT 1
  `);
  if (!rows[0]) throw new AppError("Fee structure not found", 404);
  if (rows[0].status === "ARCHIVED") throw new AppError("Archived fee structures cannot be approved", 409);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "fee_structures" SET "status"='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${structureId} AND "institutionId"=${institutionId}
  `);
  await recordAuditLog({ institutionId, userId: actor.id, action: "fee-structure.approve", entityType: "FeeStructure", entityId: structureId });
  return (await listFeeStructures(institutionId, actor, {})).find(x => x.id === structureId) ?? null;
}



export async function assignFeeStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  structureId: string,
  requestedStudentIds?: string[]
) {
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

  if (
    current.status === "ARCHIVED"
  ) {
    throw new AppError(
      "Archived fee structures cannot be modified",
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

  const status =
    input.status ??
    (current.status as FeeStructureStatus);

  if (status === "ACTIVE" && current.status !== "ACTIVE" && !actor.permissions.includes("fees.structure.approve")) {
    throw new AppError("Only an authorized fee approver may activate a fee structure", 403);
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
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "fee_structures"
          SET
            "name" = ${name},
            "status" = ${status},
            "currency" = ${currency},
            "notes" = ${
              input.notes === undefined
                ? current.notes
                : input.notes?.trim() || null
            }
          WHERE "id" = ${structureId}
            AND "institutionId" = ${institutionId}
        `
      );

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
