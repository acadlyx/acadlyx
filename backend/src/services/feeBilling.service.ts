import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { round2 } from "../utils/http";
import { PaginationParams } from "../utils/pagination";
import {
  andWhere,
  assertTenantReference,
  countRows,
  nextSequenceNumber,
  requireTenantRow,
} from "../utils/sqlScope";
import { assertCanViewStudent, isInstitutionWide } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";
import { assertFeeApprovalAuthority } from "./workflowAuthority.service";
import { getPaymentGateway, paymentCurrency } from "./payments/gateway";

/**
 * Fee billing.
 *
 * feeStructure.service owns configuration (heads, structures, items).
 * This module owns money movement: turning a structure into dated
 * installment invoices, applying approved concessions and late fees,
 * accepting payments online or at the counter, issuing receipts,
 * refunding, and reconciling against a provider statement.
 *
 * Invariants:
 *  - An invoice's `amount` is always the net payable after concession.
 *  - `paidAmount` never exceeds `amount + lateFeeAmount`.
 *  - Money-moving writes always run inside a transaction with the
 *    invoice row locked, so two simultaneous payments cannot overpay.
 *  - Receipt and invoice numbers are gap-free per tenant per year.
 */

const BILLING_ROLES = [
  "DIRECTOR",
  "ACCOUNTS",
];

function assertCanManageFees(actor: AuthenticatedUser): void {
  if (actor.roles.some((role) => BILLING_ROLES.includes(role))) return;
  if (actor.permissions.includes("fees.manage")) return;
  throw new AppError("You are not authorized to manage fees", 403);
}

function assertCanApproveMoney(actor: AuthenticatedUser): void {
  assertFeeApprovalAuthority(actor);
}

interface InvoiceRow {
  id: string;
  institutionId: string;
  studentId: string;
  title: string;
  amount: number;
  grossAmount: number | null;
  discountAmount: number;
  lateFeeAmount: number;
  paidAmount: number;
  refundedAmount: number;
  dueDate: Date | null;
  status: string;
  invoiceNumber: string | null;
  installmentNumber: number;
  currency: string;
  cancelledAt: Date | null;
}

/** Outstanding on an invoice, never negative. */
function outstandingOf(invoice: InvoiceRow): number {
  return round2(
    Math.max(
      0,
      invoice.amount + invoice.lateFeeAmount - invoice.paidAmount
    )
  );
}

function statusFor(invoice: InvoiceRow): string {
  if (invoice.cancelledAt) return "CANCELLED";
  const outstanding = outstandingOf(invoice);
  if (outstanding <= 0.009) return "PAID";
  if (invoice.paidAmount > 0) return "PARTIALLY_PAID";
  if (invoice.dueDate && invoice.dueDate < new Date()) return "OVERDUE";
  return "PENDING";
}

// ==========================================================
// CONCESSIONS / SCHOLARSHIPS
// ==========================================================

export async function listConcessions(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { studentId?: string; status?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`c."institutionId" = ${institutionId}`,
  ];
  if (filters.studentId) {
    await assertCanViewStudent(institutionId, actor, filters.studentId);
    conditions.push(Prisma.sql`c."studentId" = ${filters.studentId}`);
  } else {
    assertCanManageFees(actor);
  }
  if (filters.status) conditions.push(Prisma.sql`c."status" = ${filters.status}`);
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        concessionType: string;
        amount: number | null;
        percentage: number | null;
        status: string;
        studentName: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT c."id", c."name", c."concessionType", c."amount", c."percentage",
             c."status", c."reason", c."createdAt", c."approvedAt",
             u."firstName" || ' ' || u."lastName" AS "studentName"
      FROM "fee_concessions" c
      JOIN "users" u ON u."id" = c."studentId"
      ${where}
      ORDER BY c."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "fee_concessions" c ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createConcession(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    studentId: string;
    name: string;
    concessionType: string;
    amount?: number;
    percentage?: number;
    feeStructureId?: string;
    academicYearId?: string;
    reason?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);
  await assertCanViewStudent(institutionId, actor, input.studentId);

  if (!input.amount && !input.percentage) {
    throw new AppError("Provide either an amount or a percentage", 400);
  }
  if (input.amount && input.percentage) {
    throw new AppError(
      "A concession is either a flat amount or a percentage, not both",
      400
    );
  }
  if (input.percentage && (input.percentage <= 0 || input.percentage > 100)) {
    throw new AppError("percentage must be between 0 and 100", 400);
  }
  if (input.feeStructureId) {
    await assertTenantReference(
      prisma,
      "fee_structures",
      institutionId,
      input.feeStructureId,
      "Fee structure"
    );
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "fee_concessions"
      ("id", "institutionId", "studentId", "feeStructureId", "academicYearId",
       "name", "concessionType", "amount", "percentage", "status", "reason",
       "requestedById")
    VALUES
      (${id}, ${institutionId}, ${input.studentId}, ${input.feeStructureId ?? null},
       ${input.academicYearId ?? null}, ${input.name.trim()},
       ${input.concessionType}, ${input.amount ?? null}, ${input.percentage ?? null},
       'PENDING', ${input.reason ?? null}, ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.concession_created",
    entityType: "FeeConcession",
    entityId: id,
    metadata: {
      studentId: input.studentId,
      amount: input.amount,
      percentage: input.percentage,
    },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "fee_concessions",
    institutionId,
    id,
    "Concession"
  );
}

export async function decideConcession(
  institutionId: string,
  actor: AuthenticatedUser,
  concessionId: string,
  status: "APPROVED" | "REJECTED",
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanApproveMoney(actor);
  const concession = await requireTenantRow<{
    id: string;
    status: string;
    studentId: string;
    requestedById: string;
  }>(prisma, "fee_concessions", institutionId, concessionId, "Concession");

  if (concession.status !== "PENDING") {
    throw new AppError("This concession has already been decided", 409);
  }
  if (concession.requestedById === actor.id && !isInstitutionWide(actor)) {
    throw new AppError(
      "A concession cannot be approved by the person who raised it",
      403
    );
  }

  await prisma.$executeRaw`
    UPDATE "fee_concessions"
    SET "status" = ${status}, "approvedById" = ${actor.id},
        "approvedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${concessionId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `fees.concession_${status.toLowerCase()}`,
    entityType: "FeeConcession",
    entityId: concessionId,
    metadata: { studentId: concession.studentId },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "fee_concessions",
    institutionId,
    concessionId,
    "Concession"
  );
}

/** Total approved concession applicable to one structure for one student. */
async function concessionFor(
  client: Prisma.TransactionClient,
  institutionId: string,
  studentId: string,
  feeStructureId: string,
  gross: number
): Promise<number> {
  const rows = await client.$queryRaw<
    Array<{ amount: number | null; percentage: number | null }>
  >(Prisma.sql`
    SELECT "amount", "percentage" FROM "fee_concessions"
    WHERE "institutionId" = ${institutionId}
      AND "studentId" = ${studentId}
      AND "status" = 'APPROVED'
      AND ("feeStructureId" IS NULL OR "feeStructureId" = ${feeStructureId})
  `);

  let discount = 0;
  for (const row of rows) {
    if (row.amount) discount += row.amount;
    else if (row.percentage) discount += (gross * row.percentage) / 100;
  }
  return round2(Math.min(discount, gross));
}

// ==========================================================
// INVOICE GENERATION
// ==========================================================

/**
 * Turns an ACTIVE fee structure into one invoice per installment for
 * every student in scope, applying approved concessions proportionally
 * across installments. Re-running skips students who already have an
 * invoice for that structure and installment, so it is safe to repeat
 * after a late admission.
 */
export async function generateInvoicesFromStructure(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    feeStructureId: string;
    studentIds?: string[];
    firstDueDate: Date;
    installmentGapDays?: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);

  const structure = await requireTenantRow<{
    id: string;
    name: string;
    status: string;
    programId: string | null;
    academicYearId: string | null;
    semesterId: string | null;
    currency: string;
  }>(prisma, "fee_structures", institutionId, input.feeStructureId, "Fee structure");

  if (structure.status !== "ACTIVE") {
    throw new AppError(
      "Only an ACTIVE fee structure can be invoiced",
      409
    );
  }

  const items = await prisma.$queryRaw<
    Array<{ installmentNumber: number; amount: number; dueDays: number | null }>
  >(Prisma.sql`
    SELECT "installmentNumber", SUM("amount")::float AS "amount",
           MAX("dueDays") AS "dueDays"
    FROM "fee_structure_items"
    WHERE "feeStructureId" = ${input.feeStructureId}
    GROUP BY "installmentNumber"
    ORDER BY "installmentNumber" ASC
  `);
  if (items.length === 0) {
    throw new AppError("This fee structure has no items", 409);
  }
  const gross = round2(items.reduce((sum, item) => sum + item.amount, 0));

  // Resolve the student population: explicit list, or everyone actively
  // enrolled under the structure's program/year.
  let studentIds = input.studentIds ?? [];
  if (studentIds.length === 0) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`e."institutionId" = ${institutionId}`,
      Prisma.sql`e."status" = 'ACTIVE'`,
    ];
    if (structure.programId) {
      conditions.push(Prisma.sql`e."programId" = ${structure.programId}`);
    }
    if (structure.academicYearId) {
      conditions.push(Prisma.sql`e."academicYearId" = ${structure.academicYearId}`);
    }
    const rows = await prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`
      SELECT DISTINCT e."userId" FROM "student_enrollments" e
      ${andWhere(conditions)}
      LIMIT 5000
    `);
    studentIds = rows.map((row) => row.userId);
  } else {
    const valid = await prisma.user.count({
      where: { institutionId, id: { in: studentIds } },
    });
    if (valid !== new Set(studentIds).size) {
      throw new AppError(
        "One or more students are not in this institution",
        404
      );
    }
  }

  if (studentIds.length === 0) {
    throw new AppError(
      "No active students match this fee structure's scope",
      409
    );
  }

  const gap = input.installmentGapDays ?? 90;
  const year = input.firstDueDate.getUTCFullYear();
  const prefix = `INV${year}-`;
  let created = 0;
  let skipped = 0;

  // One transaction per student keeps the numbering lock short while
  // still making each student's full installment plan atomic.
  for (const studentId of studentIds) {
    await prisma.$transaction(async (tx) => {
      const existing = await countRows(
        tx,
        "fee_invoices",
        Prisma.sql`WHERE "institutionId" = ${institutionId}
          AND "studentId" = ${studentId}
          AND "feeStructureId" = ${input.feeStructureId}
          AND "cancelledAt" IS NULL`
      );
      if (existing > 0) {
        skipped += 1;
        return;
      }

      const discount = await concessionFor(
        tx,
        institutionId,
        studentId,
        input.feeStructureId,
        gross
      );

      for (const item of items) {
        const share = gross > 0 ? item.amount / gross : 0;
        const itemDiscount = round2(discount * share);
        const net = round2(item.amount - itemDiscount);

        const dueDate = new Date(input.firstDueDate);
        if (item.dueDays !== null) {
          dueDate.setUTCDate(dueDate.getUTCDate() + item.dueDays);
        } else {
          dueDate.setUTCDate(
            dueDate.getUTCDate() + gap * (item.installmentNumber - 1)
          );
        }

        const invoiceNumber = await nextSequenceNumber(tx, {
          table: "fee_invoices",
          column: "invoiceNumber",
          institutionId,
          prefix,
        });

        await tx.$executeRaw`
          INSERT INTO "fee_invoices"
            ("id", "institutionId", "studentId", "title", "amount", "dueDate",
             "status", "invoiceNumber", "feeStructureId", "academicYearId",
             "semesterId", "installmentNumber", "grossAmount", "discountAmount",
             "currency", "createdById")
          VALUES
            (${randomUUID()}, ${institutionId}, ${studentId},
             ${`${structure.name} — Installment ${item.installmentNumber}`},
             ${net}, ${dueDate}, 'PENDING', ${invoiceNumber},
             ${input.feeStructureId}, ${structure.academicYearId},
             ${structure.semesterId}, ${item.installmentNumber}, ${item.amount},
             ${itemDiscount}, ${structure.currency ?? paymentCurrency()}, ${actor.id})
        `;
        created += 1;
      }

      await tx.notification.create({
        data: {
          institutionId,
          userId: studentId,
          title: "Fee invoice issued",
          body: `${structure.name} has been invoiced to your account.`,
        },
      });
    });
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.invoices_generated",
    entityType: "FeeStructure",
    entityId: input.feeStructureId,
    metadata: {
      students: studentIds.length,
      invoicesCreated: created,
      studentsSkipped: skipped,
    },
    ...meta,
  });

  return { students: studentIds.length, created, skipped };
}

// ==========================================================
// LATE FEES
// ==========================================================

export async function listLateFeeRules(institutionId: string) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      graceDays: number;
      chargeType: string;
      chargeValue: number;
      perDay: boolean;
      maxAmount: number | null;
      isActive: boolean;
    }>
  >(Prisma.sql`
    SELECT "id", "name", "graceDays", "chargeType", "chargeValue", "perDay",
           "maxAmount", "isActive"
    FROM "late_fee_rules"
    WHERE "institutionId" = ${institutionId}
    ORDER BY "createdAt" DESC
  `);
}

export async function createLateFeeRule(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    graceDays?: number;
    chargeType: "FLAT" | "PERCENT";
    chargeValue: number;
    perDay?: boolean;
    maxAmount?: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);
  if (input.chargeType === "PERCENT" && input.chargeValue > 100) {
    throw new AppError("A percentage late fee cannot exceed 100", 400);
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "late_fee_rules"
      ("id", "institutionId", "name", "graceDays", "chargeType", "chargeValue",
       "perDay", "maxAmount", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.name.trim()}, ${input.graceDays ?? 0},
       ${input.chargeType}, ${input.chargeValue}, ${input.perDay ?? false},
       ${input.maxAmount ?? null}, ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.late_fee_rule_created",
    entityType: "LateFeeRule",
    entityId: id,
    metadata: { chargeType: input.chargeType, chargeValue: input.chargeValue },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "late_fee_rules",
    institutionId,
    id,
    "Late fee rule"
  );
}

/**
 * Applies the active late fee rule to every overdue, unpaid invoice.
 * Recomputes rather than accumulates, so running it twice in a day does
 * not double-charge a student.
 */
export async function applyLateFees(
  institutionId: string,
  actor: AuthenticatedUser,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);

  const rules = await prisma.$queryRaw<
    Array<{
      id: string;
      graceDays: number;
      chargeType: string;
      chargeValue: number;
      perDay: boolean;
      maxAmount: number | null;
    }>
  >(Prisma.sql`
    SELECT "id", "graceDays", "chargeType", "chargeValue", "perDay", "maxAmount"
    FROM "late_fee_rules"
    WHERE "institutionId" = ${institutionId} AND "isActive" = TRUE
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);
  if (rules.length === 0) {
    throw new AppError("No active late fee rule is configured", 409);
  }
  const rule = rules[0];

  const overdue = await prisma.$queryRaw<
    Array<{ id: string; amount: number; paidAmount: number; overdueDays: number }>
  >(Prisma.sql`
    SELECT "id", "amount", "paidAmount",
           GREATEST(0, DATE_PART('day', CURRENT_TIMESTAMP - "dueDate")::int - ${rule.graceDays}) AS "overdueDays"
    FROM "fee_invoices"
    WHERE "institutionId" = ${institutionId}
      AND "cancelledAt" IS NULL
      AND "dueDate" IS NOT NULL
      AND "dueDate" < CURRENT_TIMESTAMP
      AND "paidAmount" < "amount"
    LIMIT 5000
  `);

  let updated = 0;
  let charged = 0;

  await prisma.$transaction(async (tx) => {
    for (const invoice of overdue) {
      if (invoice.overdueDays <= 0) continue;

      const base =
        rule.chargeType === "PERCENT"
          ? (invoice.amount * rule.chargeValue) / 100
          : rule.chargeValue;
      let fee = rule.perDay ? base * invoice.overdueDays : base;
      if (rule.maxAmount !== null) fee = Math.min(fee, rule.maxAmount);
      fee = round2(fee);

      await tx.$executeRaw`
        UPDATE "fee_invoices"
        SET "lateFeeAmount" = ${fee},
            "status" = CASE WHEN "paidAmount" > 0 THEN 'PARTIALLY_PAID' ELSE 'OVERDUE' END
        WHERE "id" = ${invoice.id} AND "institutionId" = ${institutionId}
      `;
      updated += 1;
      charged += fee;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.late_fees_applied",
    entityType: "Institution",
    entityId: institutionId,
    metadata: { ruleId: rule.id, invoicesUpdated: updated, totalCharged: round2(charged) },
    ...meta,
  });

  return { invoicesUpdated: updated, totalCharged: round2(charged) };
}

// ==========================================================
// INVOICES
// ==========================================================

export async function listInvoices(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { studentId?: string; status?: string; overdueOnly?: boolean; search?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`i."institutionId" = ${institutionId}`,
  ];

  if (filters.studentId) {
    await assertCanViewStudent(institutionId, actor, filters.studentId);
    conditions.push(Prisma.sql`i."studentId" = ${filters.studentId}`);
  } else if (!actor.permissions.includes("fees.manage") && !isInstitutionWide(actor)) {
    // Students and parents without billing rights only see their own.
    conditions.push(Prisma.sql`i."studentId" = ${actor.id}`);
  }

  if (filters.status) conditions.push(Prisma.sql`i."status" = ${filters.status}`);
  if (filters.overdueOnly) {
    conditions.push(
      Prisma.sql`i."dueDate" < CURRENT_TIMESTAMP AND i."paidAmount" < i."amount" AND i."cancelledAt" IS NULL`
    );
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(i."title" ILIKE ${like} OR i."invoiceNumber" ILIKE ${like}
        OR u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like})`
    );
  }
  const where = andWhere(conditions);

  const [items, totalRows, totals] = await Promise.all([
    prisma.$queryRaw<
      Array<InvoiceRow & { studentName: string; outstanding: number }>
    >(Prisma.sql`
      SELECT i.*, u."firstName" || ' ' || u."lastName" AS "studentName",
             GREATEST(0, i."amount" + i."lateFeeAmount" - i."paidAmount")::float AS "outstanding"
      FROM "fee_invoices" i
      JOIN "users" u ON u."id" = i."studentId"
      ${where}
      ORDER BY i."dueDate" ASC NULLS LAST, i."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "fee_invoices" i JOIN "users" u ON u."id" = i."studentId" ${where}
    `),
    prisma.$queryRaw<
      Array<{ billed: number | null; collected: number | null; outstanding: number | null }>
    >(Prisma.sql`
      SELECT SUM(i."amount" + i."lateFeeAmount")::float AS "billed",
             SUM(i."paidAmount")::float AS "collected",
             SUM(GREATEST(0, i."amount" + i."lateFeeAmount" - i."paidAmount"))::float AS "outstanding"
      FROM "fee_invoices" i JOIN "users" u ON u."id" = i."studentId" ${where}
    `),
  ]);

  return {
    items,
    total: Number(totalRows[0]?.count ?? 0),
    summary: {
      billed: round2(totals[0]?.billed ?? 0),
      collected: round2(totals[0]?.collected ?? 0),
      outstanding: round2(totals[0]?.outstanding ?? 0),
    },
  };
}

export async function getInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  invoiceId: string
) {
  const invoice = await requireTenantRow<InvoiceRow>(
    prisma,
    "fee_invoices",
    institutionId,
    invoiceId,
    "Invoice"
  );
  await assertCanViewStudent(institutionId, actor, invoice.studentId);

  const payments = await prisma.$queryRaw<
    Array<{
      id: string;
      amount: number;
      method: string;
      status: string;
      reference: string | null;
      receiptNumber: string | null;
      paidAt: Date;
      refundedAmount: number;
    }>
  >(Prisma.sql`
    SELECT "id", "amount", "method", "status", "reference", "receiptNumber",
           "paidAt", "refundedAmount", "provider", "providerPaymentId"
    FROM "fee_payments"
    WHERE "invoiceId" = ${invoiceId} AND "institutionId" = ${institutionId}
    ORDER BY "paidAt" DESC
  `);

  return {
    ...invoice,
    outstanding: outstandingOf(invoice),
    computedStatus: statusFor(invoice),
    payments,
  };
}

export async function cancelInvoice(
  institutionId: string,
  actor: AuthenticatedUser,
  invoiceId: string,
  reason: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanApproveMoney(actor);
  const invoice = await requireTenantRow<InvoiceRow>(
    prisma,
    "fee_invoices",
    institutionId,
    invoiceId,
    "Invoice"
  );

  if (invoice.paidAmount > 0) {
    throw new AppError(
      "An invoice with payments cannot be cancelled. Refund the payments first.",
      409
    );
  }
  if (invoice.cancelledAt) {
    throw new AppError("This invoice is already cancelled", 409);
  }

  await prisma.$executeRaw`
    UPDATE "fee_invoices"
    SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP,
        "notes" = ${reason}
    WHERE "id" = ${invoiceId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.invoice_cancelled",
    entityType: "FeeInvoice",
    entityId: invoiceId,
    metadata: { reason, amount: invoice.amount },
    ...meta,
  });

  return getInvoice(institutionId, actor, invoiceId);
}

// ==========================================================
// PAYMENTS + RECEIPTS
// ==========================================================

/**
 * Records a settled payment against an invoice and issues its receipt.
 * Shared by counter collection and by the verified gateway callback, so
 * both paths produce identical, numbered, auditable records.
 */
async function settlePayment(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    invoiceId: string;
    amount: number;
    method: string;
    reference?: string;
    provider?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    providerSignature?: string;
    notes?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the invoice row so two concurrent payments serialise.
    const rows = await tx.$queryRaw<InvoiceRow[]>(Prisma.sql`
      SELECT * FROM "fee_invoices"
      WHERE "id" = ${input.invoiceId} AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const invoice = rows[0];
    if (!invoice) {
      throw new AppError("Invoice was not found in this institution", 404);
    }
    if (invoice.cancelledAt) {
      throw new AppError("This invoice has been cancelled", 409);
    }

    const outstanding = outstandingOf(invoice);
    if (outstanding <= 0) {
      throw new AppError("This invoice is already settled", 409);
    }
    if (input.amount > outstanding + 0.009) {
      throw new AppError(
        `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`,
        400
      );
    }

    const year = new Date().getUTCFullYear();
    const receiptNumber = await nextSequenceNumber(tx, {
      table: "fee_payments",
      column: "receiptNumber",
      institutionId,
      prefix: `RCPT${year}-`,
    });

    const paymentId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "fee_payments"
        ("id", "institutionId", "invoiceId", "amount", "reference", "method",
         "status", "provider", "providerOrderId", "providerPaymentId",
         "providerSignature", "receiptNumber", "recordedById", "userId", "notes")
      VALUES
        (${paymentId}, ${institutionId}, ${input.invoiceId}, ${input.amount},
         ${input.reference ?? null}, ${input.method}, 'SUCCESS',
         ${input.provider ?? null}, ${input.providerOrderId ?? null},
         ${input.providerPaymentId ?? null}, ${input.providerSignature ?? null},
         ${receiptNumber}, ${actor.id}, ${invoice.studentId}, ${input.notes ?? null})
    `;

    const paidAmount = round2(invoice.paidAmount + input.amount);
    const nextStatus =
      paidAmount >= round2(invoice.amount + invoice.lateFeeAmount) - 0.009
        ? "PAID"
        : "PARTIALLY_PAID";

    await tx.$executeRaw`
      UPDATE "fee_invoices"
      SET "paidAmount" = ${paidAmount}, "status" = ${nextStatus}
      WHERE "id" = ${input.invoiceId} AND "institutionId" = ${institutionId}
    `;

    await tx.notification.create({
      data: {
        institutionId,
        userId: invoice.studentId,
        title: "Payment received",
        body: `Receipt ${receiptNumber} for ${input.amount.toFixed(2)} has been issued.`,
      },
    });

    return { paymentId, receiptNumber, paidAmount, status: nextStatus, invoice };
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.payment_recorded",
    entityType: "FeePayment",
    entityId: result.paymentId,
    metadata: {
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method,
      receiptNumber: result.receiptNumber,
      provider: input.provider,
    },
    ...meta,
  });

  return {
    paymentId: result.paymentId,
    receiptNumber: result.receiptNumber,
    invoiceStatus: result.status,
    paidAmount: result.paidAmount,
  };
}

/** Counter / offline collection. */
export async function recordOfflinePayment(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    invoiceId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);
  if (!["CASH", "CHEQUE", "NEFT", "DD", "UPI", "CARD", "OFFLINE"].includes(input.method)) {
    throw new AppError("Unsupported offline payment method", 400);
  }
  return settlePayment(institutionId, actor, { ...input }, meta);
}

/** Starts a hosted checkout for the authenticated student's own invoice. */
export async function createPaymentOrder(
  institutionId: string,
  actor: AuthenticatedUser,
  invoiceId: string
) {
  const invoice = await requireTenantRow<InvoiceRow>(
    prisma,
    "fee_invoices",
    institutionId,
    invoiceId,
    "Invoice"
  );
  await assertCanViewStudent(institutionId, actor, invoice.studentId);

  const outstanding = outstandingOf(invoice);
  if (outstanding <= 0) {
    throw new AppError("This invoice is already settled", 409);
  }

  const gateway = getPaymentGateway();
  const order = await gateway.createOrder({
    amount: outstanding,
    currency: invoice.currency || paymentCurrency(),
    reference: invoice.invoiceNumber ?? invoice.id,
    notes: { invoiceId: invoice.id, institutionId },
  });

  return { ...order, invoiceId: invoice.id, outstanding };
}

/** Confirms a hosted checkout. The signature is verified server-side. */
export async function confirmPaymentOrder(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    invoiceId: string;
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const invoice = await requireTenantRow<InvoiceRow>(
    prisma,
    "fee_invoices",
    institutionId,
    input.invoiceId,
    "Invoice"
  );
  await assertCanViewStudent(institutionId, actor, invoice.studentId);

  const gateway = getPaymentGateway();
  const verification = await gateway.verifyCallback({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
    amount: input.amount,
  });

  if (!verification.verified) {
    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "fees.payment_verification_failed",
      entityType: "FeeInvoice",
      entityId: input.invoiceId,
      metadata: { orderId: input.orderId, paymentId: input.paymentId },
      ...meta,
    });
    throw new AppError("Payment signature verification failed", 400);
  }

  return settlePayment(
    institutionId,
    actor,
    {
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: "ONLINE",
      provider: verification.provider,
      providerOrderId: verification.orderId,
      providerPaymentId: verification.paymentId,
      providerSignature: input.signature,
    },
    meta
  );
}

export async function getReceipt(
  institutionId: string,
  actor: AuthenticatedUser,
  paymentId: string
) {
  const payment = await requireTenantRow<{
    id: string;
    invoiceId: string;
    amount: number;
    receiptNumber: string | null;
    method: string;
    paidAt: Date;
    reference: string | null;
    userId: string | null;
  }>(prisma, "fee_payments", institutionId, paymentId, "Payment");

  const invoice = await requireTenantRow<InvoiceRow>(
    prisma,
    "fee_invoices",
    institutionId,
    payment.invoiceId,
    "Invoice"
  );
  await assertCanViewStudent(institutionId, actor, invoice.studentId);

  const student = await prisma.user.findUniqueOrThrow({
    where: { id: invoice.studentId },
    select: { firstName: true, lastName: true, email: true },
  });
  const institution = await prisma.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { name: true, slug: true },
  });

  return {
    receiptNumber: payment.receiptNumber,
    issuedAt: payment.paidAt,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    institution,
    student: {
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
    },
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      amount: invoice.amount,
      lateFeeAmount: invoice.lateFeeAmount,
      paidAmount: invoice.paidAmount,
      outstanding: outstandingOf(invoice),
    },
  };
}

// ==========================================================
// REFUNDS
// ==========================================================

export async function requestRefund(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { feePaymentId: string; amount: number; reason: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);
  const payment = await requireTenantRow<{
    id: string;
    amount: number;
    refundedAmount: number;
    status: string;
  }>(prisma, "fee_payments", institutionId, input.feePaymentId, "Payment");

  const refundable = round2(payment.amount - payment.refundedAmount);
  if (input.amount > refundable) {
    throw new AppError(
      `Refund exceeds the refundable balance of ${refundable.toFixed(2)}`,
      400
    );
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "fee_refunds"
      ("id", "institutionId", "feePaymentId", "amount", "reason", "status",
       "requestedById")
    VALUES
      (${id}, ${institutionId}, ${input.feePaymentId}, ${input.amount},
       ${input.reason.trim()}, 'REQUESTED', ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.refund_requested",
    entityType: "FeeRefund",
    entityId: id,
    metadata: { feePaymentId: input.feePaymentId, amount: input.amount },
    ...meta,
  });

  return requireTenantRow(prisma, "fee_refunds", institutionId, id, "Refund");
}

/**
 * Approving a refund reverses the money on the payment and the invoice
 * in one transaction, so the ledger can never show a refund that the
 * invoice balance does not reflect.
 */
export async function decideRefund(
  institutionId: string,
  actor: AuthenticatedUser,
  refundId: string,
  input: { status: "APPROVED" | "REJECTED" | "PROCESSED"; reference?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanApproveMoney(actor);

  const refund = await requireTenantRow<{
    id: string;
    feePaymentId: string;
    amount: number;
    status: string;
    requestedById: string;
  }>(prisma, "fee_refunds", institutionId, refundId, "Refund");

  if (["PROCESSED", "REJECTED"].includes(refund.status)) {
    throw new AppError("This refund has already been finalised", 409);
  }
  if (refund.requestedById === actor.id && !isInstitutionWide(actor)) {
    throw new AppError(
      "A refund cannot be approved by the person who raised it",
      403
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "fee_refunds"
      SET "status" = ${input.status}, "approvedById" = ${actor.id},
          "reference" = ${input.reference ?? null},
          "processedAt" = CASE WHEN ${input.status} = 'PROCESSED'
            THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE "id" = ${refundId} AND "institutionId" = ${institutionId}
    `;

    if (input.status !== "PROCESSED") return;

    const payments = await tx.$queryRaw<
      Array<{ id: string; invoiceId: string; amount: number; refundedAmount: number }>
    >(Prisma.sql`
      SELECT "id", "invoiceId", "amount", "refundedAmount"
      FROM "fee_payments"
      WHERE "id" = ${refund.feePaymentId} AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const payment = payments[0];
    if (!payment) throw new AppError("Payment was not found", 404);

    const newRefunded = round2(payment.refundedAmount + refund.amount);
    if (newRefunded > payment.amount + 0.009) {
      throw new AppError("Refund exceeds the original payment", 409);
    }

    await tx.$executeRaw`
      UPDATE "fee_payments"
      SET "refundedAmount" = ${newRefunded},
          "status" = ${newRefunded >= payment.amount - 0.009 ? "REFUNDED" : "PARTIALLY_REFUNDED"}
      WHERE "id" = ${payment.id}
    `;

    const invoices = await tx.$queryRaw<InvoiceRow[]>(Prisma.sql`
      SELECT * FROM "fee_invoices"
      WHERE "id" = ${payment.invoiceId} AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const invoice = invoices[0];
    if (!invoice) throw new AppError("Invoice was not found", 404);

    const paidAmount = round2(Math.max(0, invoice.paidAmount - refund.amount));
    const refundedAmount = round2(invoice.refundedAmount + refund.amount);

    await tx.$executeRaw`
      UPDATE "fee_invoices"
      SET "paidAmount" = ${paidAmount}, "refundedAmount" = ${refundedAmount},
          "status" = ${paidAmount <= 0 ? "PENDING" : "PARTIALLY_PAID"}
      WHERE "id" = ${invoice.id}
    `;

    await tx.notification.create({
      data: {
        institutionId,
        userId: invoice.studentId,
        title: "Refund processed",
        body: `A refund of ${refund.amount.toFixed(2)} has been processed.`,
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `fees.refund_${input.status.toLowerCase()}`,
    entityType: "FeeRefund",
    entityId: refundId,
    metadata: { amount: refund.amount, reference: input.reference },
    ...meta,
  });

  return requireTenantRow(prisma, "fee_refunds", institutionId, refundId, "Refund");
}

export async function listRefunds(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string }
) {
  assertCanManageFees(actor);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`r."institutionId" = ${institutionId}`,
  ];
  if (filters.status) conditions.push(Prisma.sql`r."status" = ${filters.status}`);
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        amount: number;
        reason: string;
        status: string;
        createdAt: Date;
        receiptNumber: string | null;
        studentName: string;
      }>
    >(Prisma.sql`
      SELECT r."id", r."amount", r."reason", r."status", r."reference",
             r."createdAt", r."processedAt", p."receiptNumber",
             u."firstName" || ' ' || u."lastName" AS "studentName"
      FROM "fee_refunds" r
      JOIN "fee_payments" p ON p."id" = r."feePaymentId"
      JOIN "fee_invoices" i ON i."id" = p."invoiceId"
      JOIN "users" u ON u."id" = i."studentId"
      ${where}
      ORDER BY r."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "fee_refunds" r ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

// ==========================================================
// RECONCILIATION
// ==========================================================

/**
 * Loads a provider statement and matches each line against recorded
 * payments by provider payment id, then by receipt/reference. Unmatched
 * lines are kept so finance can investigate rather than being dropped.
 */
export async function createReconciliation(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    provider: string;
    statementReference: string;
    periodStart: Date;
    periodEnd: Date;
    entries: Array<{ externalReference: string; amount: number; valueDate?: Date }>;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManageFees(actor);
  if (input.entries.length === 0) {
    throw new AppError("A statement needs at least one entry", 400);
  }

  const id = randomUUID();
  let matched = 0;
  let unmatched = 0;
  const statementTotal = round2(
    input.entries.reduce((sum, entry) => sum + entry.amount, 0)
  );

  await prisma.$transaction(async (tx) => {
    const systemRows = await tx.$queryRaw<{ total: number | null }[]>(Prisma.sql`
      SELECT SUM("amount")::float AS "total" FROM "fee_payments"
      WHERE "institutionId" = ${institutionId}
        AND "status" IN ('SUCCESS', 'PARTIALLY_REFUNDED')
        AND "paidAt" BETWEEN ${input.periodStart} AND ${input.periodEnd}
    `);

    await tx.$executeRaw`
      INSERT INTO "payment_reconciliations"
        ("id", "institutionId", "provider", "statementReference", "periodStart",
         "periodEnd", "statementTotal", "systemTotal", "status", "createdById")
      VALUES
        (${id}, ${institutionId}, ${input.provider}, ${input.statementReference},
         ${input.periodStart}, ${input.periodEnd}, ${statementTotal},
         ${round2(systemRows[0]?.total ?? 0)}, 'OPEN', ${actor.id})
    `;

    for (const entry of input.entries) {
      const candidates = await tx.$queryRaw<
        Array<{ id: string; amount: number }>
      >(Prisma.sql`
        SELECT "id", "amount" FROM "fee_payments"
        WHERE "institutionId" = ${institutionId}
          AND "reconciledAt" IS NULL
          AND ("providerPaymentId" = ${entry.externalReference}
               OR "receiptNumber" = ${entry.externalReference}
               OR "reference" = ${entry.externalReference})
        LIMIT 1
      `);

      const candidate = candidates[0];
      const isMatch =
        Boolean(candidate) &&
        Math.abs((candidate?.amount ?? 0) - entry.amount) < 0.01;

      await tx.$executeRaw`
        INSERT INTO "payment_reconciliation_entries"
          ("id", "institutionId", "reconciliationId", "feePaymentId",
           "externalReference", "amount", "valueDate", "matchStatus", "note")
        VALUES
          (${randomUUID()}, ${institutionId}, ${id},
           ${isMatch ? candidate!.id : null}, ${entry.externalReference},
           ${entry.amount}, ${entry.valueDate ?? null},
           ${isMatch ? "MATCHED" : candidate ? "AMOUNT_MISMATCH" : "UNMATCHED"},
           ${candidate && !isMatch
             ? `System amount ${candidate.amount.toFixed(2)} differs from statement`
             : null})
      `;

      if (isMatch) {
        await tx.$executeRaw`
          UPDATE "fee_payments" SET "reconciledAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${candidate!.id}
        `;
        matched += 1;
      } else {
        unmatched += 1;
      }
    }

    await tx.$executeRaw`
      UPDATE "payment_reconciliations"
      SET "matchedCount" = ${matched}, "unmatchedCount" = ${unmatched},
          "status" = ${unmatched === 0 ? "BALANCED" : "OPEN"},
          "closedAt" = ${unmatched === 0 ? new Date() : null}
      WHERE "id" = ${id}
    `;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "fees.reconciliation_created",
    entityType: "PaymentReconciliation",
    entityId: id,
    metadata: { provider: input.provider, matched, unmatched, statementTotal },
    ...meta,
  });

  return { id, matched, unmatched, statementTotal };
}

export async function getReconciliation(
  institutionId: string,
  actor: AuthenticatedUser,
  reconciliationId: string
) {
  assertCanManageFees(actor);
  const reconciliation = await requireTenantRow(
    prisma,
    "payment_reconciliations",
    institutionId,
    reconciliationId,
    "Reconciliation"
  );

  const entries = await prisma.$queryRaw<
    Array<{
      id: string;
      externalReference: string;
      amount: number;
      matchStatus: string;
      note: string | null;
      receiptNumber: string | null;
    }>
  >(Prisma.sql`
    SELECT e."id", e."externalReference", e."amount", e."matchStatus",
           e."note", e."valueDate", p."receiptNumber"
    FROM "payment_reconciliation_entries" e
    LEFT JOIN "fee_payments" p ON p."id" = e."feePaymentId"
    WHERE e."reconciliationId" = ${reconciliationId}
      AND e."institutionId" = ${institutionId}
    ORDER BY e."matchStatus" ASC, e."createdAt" ASC
  `);

  return { ...reconciliation, entries };
}

export async function listReconciliations(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams
) {
  assertCanManageFees(actor);
  const where = Prisma.sql`WHERE "institutionId" = ${institutionId}`;

  const [items, total] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        provider: string;
        statementReference: string;
        matchedCount: number;
        unmatchedCount: number;
        status: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT "id", "provider", "statementReference", "periodStart", "periodEnd",
             "statementTotal", "systemTotal", "matchedCount", "unmatchedCount",
             "status", "createdAt"
      FROM "payment_reconciliations"
      ${where}
      ORDER BY "createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    countRows(prisma, "payment_reconciliations", where),
  ]);

  return { items, total };
}

// ==========================================================
// STUDENT-FACING SUMMARY
// ==========================================================

export async function getStudentFeeSummary(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);

  const invoices = await prisma.$queryRaw<
    Array<InvoiceRow & { outstanding: number }>
  >(Prisma.sql`
    SELECT *, GREATEST(0, "amount" + "lateFeeAmount" - "paidAmount")::float AS "outstanding"
    FROM "fee_invoices"
    WHERE "institutionId" = ${institutionId}
      AND "studentId" = ${studentId}
      AND "cancelledAt" IS NULL
    ORDER BY "dueDate" ASC NULLS LAST
  `);

  const payments = await prisma.$queryRaw<
    Array<{
      id: string;
      amount: number;
      method: string;
      receiptNumber: string | null;
      paidAt: Date;
      invoiceTitle: string;
    }>
  >(Prisma.sql`
    SELECT p."id", p."amount", p."method", p."receiptNumber", p."paidAt",
           p."status", i."title" AS "invoiceTitle"
    FROM "fee_payments" p
    JOIN "fee_invoices" i ON i."id" = p."invoiceId"
    WHERE p."institutionId" = ${institutionId} AND i."studentId" = ${studentId}
    ORDER BY p."paidAt" DESC
    LIMIT 100
  `);

  const billed = round2(
    invoices.reduce((sum, invoice) => sum + invoice.amount + invoice.lateFeeAmount, 0)
  );
  const paid = round2(invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0));

  return {
    studentId,
    summary: {
      billed,
      paid,
      outstanding: round2(Math.max(0, billed - paid)),
      overdueCount: invoices.filter(
        (invoice) =>
          invoice.dueDate &&
          invoice.dueDate < new Date() &&
          invoice.outstanding > 0
      ).length,
    },
    invoices,
    payments,
  };
}
