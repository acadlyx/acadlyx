import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const marker = "legacy-refund-compat-migration-fixture";

async function seed(): Promise<void> {
  const existing = await prisma.feeRefund.findFirst({ where: { reference: marker }, select: { id: true } });
  if (existing) throw new Error("Legacy migration fixture already exists in this disposable database");

  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: "Legacy refund migration fixture", slug: "legacy-refund-compat-fixture" },
  });
  const [student, actor] = await Promise.all([
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `legacy-student-${suffix}@integration.invalid`,
        idNumber: `LEGACY-STU-${suffix}`,
        passwordHash: "migration-fixture-not-a-login",
        firstName: "Legacy",
        lastName: "Student",
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `legacy-accounts-${suffix}@integration.invalid`,
        idNumber: `LEGACY-ACC-${suffix}`,
        passwordHash: "migration-fixture-not-a-login",
        firstName: "Legacy",
        lastName: "Accounts",
      },
    }),
  ]);
  const invoice = await prisma.feeInvoice.create({
    data: {
      institutionId: institution.id,
      studentId: student.id,
      title: "Legacy refund migration invoice",
      amount: 100,
      paidAmount: 100,
      refundedAmount: 0,
      discountAmount: 0,
      status: "PAID",
    },
  });
  const payment = await prisma.feePayment.create({
    data: {
      institutionId: institution.id,
      invoiceId: invoice.id,
      amount: 100,
      method: "OFFLINE",
      status: "SUCCESS",
      idempotencyKey: `legacy-migration-${suffix}`,
    },
  });

  // Reproduce the legacy shape: the old required feePaymentId is populated,
  // while the canonical paymentId added by a later migration is still null.
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "fee_refunds"
      ("id", "institutionId", "feePaymentId", "paymentId", "invoiceId", "studentId",
       "amount", "reason", "status", "requestedById", "reference", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${institution.id}, ${payment.id}, NULL, ${invoice.id}, ${student.id},
       25.00, 'Legacy migration backfill fixture', 'REQUESTED', ${actor.id}, ${marker}, NOW(), NOW())
  `);
  process.stdout.write(`Seeded legacy refund fixture for institution ${institution.id}\n`);
}

async function verifyAndCleanup(): Promise<void> {
  const row = await prisma.feeRefund.findFirst({
    where: { reference: marker },
    select: { institutionId: true, paymentId: true, feePaymentId: true, invoiceId: true, studentId: true },
  });
  assert.ok(row, "Legacy refund fixture must survive the schema upgrade");
  assert.ok(row.paymentId, "Migration must backfill canonical paymentId from legacy feePaymentId");
  assert.equal(row.paymentId, row.feePaymentId, "Canonical and legacy payment references must remain aligned");

  try {
    await prisma.$transaction(async tx => {
      await tx.feeRefund.deleteMany({ where: { reference: marker, institutionId: row.institutionId } });
      await tx.feeReceipt.deleteMany({ where: { institutionId: row.institutionId } });
      await tx.feeTransaction.deleteMany({ where: { institutionId: row.institutionId } });
      await tx.feePayment.deleteMany({ where: { institutionId: row.institutionId } });
      await tx.feeInvoice.deleteMany({ where: { institutionId: row.institutionId } });
      await tx.user.deleteMany({ where: { institutionId: row.institutionId } });
      await tx.institution.deleteMany({ where: { id: row.institutionId } });
    });
  } finally {
    process.stdout.write("Legacy refund migration backfill verified; fixture cleanup attempted.\n");
  }
}

async function main(): Promise<void> {
  const stage = process.argv[2];
  if (stage === "seed") await seed();
  else if (stage === "verify") await verifyAndCleanup();
  else throw new Error("Expected stage: seed or verify");
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
