import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { stat, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (process.env.ACADLYX_RECOVERY_CONFIRM_DISPOSABLE !== "YES") {
  throw new Error("Refusing to run unless ACADLYX_RECOVERY_CONFIRM_DISPOSABLE=YES");
}
const sourceUrl = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(sourceUrl.hostname)) {
  throw new Error(`Refusing to back up a non-local database host: ${sourceUrl.hostname}`);
}
const restoreName = process.env.ACADLYX_RESTORE_DATABASE ?? "acadlyx_restore_ci";
const dumpPath = process.env.ACADLYX_BACKUP_PATH ?? "/tmp/acadlyx-recovery-test.dump";
const reportPath = process.env.ACADLYX_RECOVERY_OUTPUT ?? "recovery-results.json";
const sourceDatabaseName = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ""));
const pgEnv = {
  ...process.env,
  PGHOST: sourceUrl.hostname,
  PGPORT: sourceUrl.port || "5432",
  PGUSER: decodeURIComponent(sourceUrl.username),
  PGPASSWORD: decodeURIComponent(sourceUrl.password),
};
const prisma = new PrismaClient();
let restored: PrismaClient | null = null;
let institutionId: string | null = null;

function pg(command: string, args: string[]): void {
  execFileSync(command, args, { env: pgEnv, stdio: "pipe" });
}

async function cleanupSource(): Promise<void> {
  if (!institutionId) return;
  await prisma.$transaction(async tx => {
    await tx.feeRefund.deleteMany({ where: { institutionId: institutionId! } });
    await tx.feeReceipt.deleteMany({ where: { institutionId: institutionId! } });
    await tx.feeTransaction.deleteMany({ where: { institutionId: institutionId! } });
    await tx.libraryFine.deleteMany({ where: { institutionId: institutionId! } });
    await tx.feePayment.deleteMany({ where: { institutionId: institutionId! } });
    await tx.feeInvoice.deleteMany({ where: { institutionId: institutionId! } });
    await tx.libraryIssue.deleteMany({ where: { institutionId: institutionId! } });
    await tx.libraryBookCopy.deleteMany({ where: { institutionId: institutionId! } });
    await tx.libraryBook.deleteMany({ where: { institutionId: institutionId! } });
    await tx.user.deleteMany({ where: { institutionId: institutionId! } });
    await tx.institution.deleteMany({ where: { id: institutionId! } });
  });
}

async function main(): Promise<void> {
  const suffix = randomUUID();
  const refundReference = `recovery-refund-${suffix}`;
  let snapshotAt = "";
  const institution = await prisma.institution.create({
    data: { name: "ACADLYX Disposable Restore Fixture", slug: `recovery-${suffix}` },
  });
  institutionId = institution.id;

  const [student, actor] = await Promise.all([
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `recovery-student-${suffix}@integration.invalid`,
        idNumber: `REC-STU-${suffix}`,
        passwordHash: "recovery-fixture-not-a-login",
        firstName: "Recovery",
        lastName: "Student",
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `recovery-accounts-${suffix}@integration.invalid`,
        idNumber: `REC-ACC-${suffix}`,
        passwordHash: "recovery-fixture-not-a-login",
        firstName: "Recovery",
        lastName: "Accounts",
      },
    }),
  ]);

  const tuitionInvoice = await prisma.feeInvoice.create({
    data: {
      institutionId: institution.id,
      studentId: student.id,
      title: "Recovery fixture tuition invoice",
      invoiceNumber: `REC-TUITION-${suffix}`,
      amount: 1200,
      paidAmount: 1000,
      refundedAmount: 0,
      discountAmount: 0,
      status: "PARTIALLY_PAID",
    },
  });
  const payment = await prisma.feePayment.create({
    data: {
      institutionId: institution.id,
      invoiceId: tuitionInvoice.id,
      amount: 1000,
      method: "OFFLINE",
      status: "SUCCESS",
      idempotencyKey: `recovery-payment-${suffix}`,
    },
  });
  await prisma.feeReceipt.create({
    data: {
      institutionId: institution.id,
      paymentId: payment.id,
      invoiceId: tuitionInvoice.id,
      studentId: student.id,
      receiptNumber: `REC-RCPT-${suffix}`,
      issuedById: actor.id,
    },
  });
  await prisma.feeTransaction.create({
    data: {
      institutionId: institution.id,
      studentId: student.id,
      invoiceId: tuitionInvoice.id,
      paymentId: payment.id,
      amount: 1000,
      type: "PAYMENT",
      reference: `recovery-payment-${suffix}`,
      createdById: actor.id,
    },
  });
  await prisma.feeRefund.create({
    data: {
      institutionId: institution.id,
      paymentId: payment.id,
      feePaymentId: payment.id,
      invoiceId: tuitionInvoice.id,
      studentId: student.id,
      amount: 100,
      reason: "Recovery fixture pending refund",
      status: "REQUESTED",
      requestedById: actor.id,
      reference: refundReference,
    },
  });

  const book = await prisma.libraryBook.create({
    data: { institutionId: institution.id, title: "Recovery fixture book", author: "Recovery Author", totalCopies: 1, availableCopies: 1 },
  });
  const copy = await prisma.libraryBookCopy.create({
    data: { institutionId: institution.id, bookId: book.id, accessionNumber: `REC-BOOK-${suffix}`, status: "AVAILABLE" },
  });
  const issue = await prisma.libraryIssue.create({
    data: {
      institutionId: institution.id,
      bookId: book.id,
      borrowerId: student.id,
      issuedById: actor.id,
      copyId: copy.id,
      dueDate: new Date(Date.now() - 86_400_000),
      returnedAt: new Date(),
      status: "RETURNED",
      fineAmount: 25,
    },
  });
  const libraryInvoice = await prisma.feeInvoice.create({
    data: {
      institutionId: institution.id,
      studentId: student.id,
      title: "Recovery fixture library fine",
      invoiceNumber: `REC-LIB-${suffix}`,
      amount: 25,
      grossAmount: 25,
      paidAmount: 0,
      refundedAmount: 0,
      discountAmount: 0,
      status: "PENDING",
      sourceModule: "LIBRARY",
      sourceType: "LIBRARY_FINE",
      sourceEntityId: issue.id,
      sourceEventKey: `LIBRARY_FINANCIAL_CHARGE:${issue.id}:OVERDUE`,
      libraryIssueId: issue.id,
    },
  });
  await prisma.libraryFine.create({
    data: {
      institutionId: institution.id,
      issueId: issue.id,
      studentId: student.id,
      type: "OVERDUE",
      originalAmount: 25,
      waivedAmount: 0,
      reason: "Recovery fixture overdue fine",
      status: "OUTSTANDING",
      financialInvoiceId: libraryInvoice.id,
    },
  });

  snapshotAt = new Date().toISOString();
  const dumpStarted = performance.now();
  pg("pg_dump", [
    "--format=custom", "--no-owner", "--no-privileges",
    "--file", dumpPath, "--dbname", sourceDatabaseName,
  ]);
  const dumpMs = Number((performance.now() - dumpStarted).toFixed(2));
  const dumpInfo = await stat(dumpPath);
  assert.ok(dumpInfo.size > 0, "Backup artifact must be non-empty");
  pg("pg_restore", ["--list", dumpPath]);

  const restoreStarted = performance.now();
  pg("dropdb", ["--if-exists", "--host", sourceUrl.hostname, "--port", sourceUrl.port || "5432", "--username", pgEnv.PGUSER, restoreName]);
  pg("createdb", ["--host", sourceUrl.hostname, "--port", sourceUrl.port || "5432", "--username", pgEnv.PGUSER, "--owner", pgEnv.PGUSER, restoreName]);

  const restoreUrl = new URL(databaseUrl);
  restoreUrl.pathname = `/${restoreName}`;
  restored = new PrismaClient({ datasources: { db: { url: restoreUrl.toString() } } });
  pg("pg_restore", ["--no-owner", "--no-privileges", "--dbname", restoreName, dumpPath]);
  const restoredInstitution = await restored.institution.findUniqueOrThrow({ where: { id: institution.id } });
  assert.equal(restoredInstitution.slug, institution.slug);

  const [users, invoices, payments, receipts, refunds, transactions, books, issues, fines, invoiceTotals, restoredRefund] = await Promise.all([
    restored.user.count({ where: { institutionId: institution.id } }),
    restored.feeInvoice.count({ where: { institutionId: institution.id } }),
    restored.feePayment.count({ where: { institutionId: institution.id } }),
    restored.feeReceipt.count({ where: { institutionId: institution.id } }),
    restored.feeRefund.count({ where: { institutionId: institution.id } }),
    restored.feeTransaction.count({ where: { institutionId: institution.id } }),
    restored.libraryBook.count({ where: { institutionId: institution.id } }),
    restored.libraryIssue.count({ where: { institutionId: institution.id } }),
    restored.libraryFine.count({ where: { institutionId: institution.id } }),
    restored.feeInvoice.aggregate({ where: { institutionId: institution.id }, _sum: { amount: true, paidAmount: true } }),
    restored.feeRefund.findFirstOrThrow({ where: { reference: refundReference } }),
  ]);
  assert.equal(users, 2);
  assert.equal(invoices, 2);
  assert.equal(payments, 1);
  assert.equal(receipts, 1);
  assert.equal(refunds, 1);
  assert.equal(transactions, 1);
  assert.equal(books, 1);
  assert.equal(issues, 1);
  assert.equal(fines, 1);
  assert.equal(restoredRefund.paymentId, restoredRefund.feePaymentId);
  assert.equal(Number(invoiceTotals._sum.amount), 1225);
  assert.equal(Number(invoiceTotals._sum.paidAmount), 1000);
  const restoreMs = Number((performance.now() - restoreStarted).toFixed(2));

  const report = {
    environment: "isolated-postgresql16-ci",
    snapshotAt,
    backupBytes: dumpInfo.size,
    backupDurationMs: dumpMs,
    restoreAndVerifyDurationMs: restoreMs,
    rtoTargetMs: 300_000,
    rtoTargetMet: restoreMs <= 300_000,
    rpoTargetMinutes: 15,
    measuredRpoMinutes: null,
    rpoNote: "This isolated snapshot test does not simulate writes lost between snapshots; production RPO remains unverified.",
    restoredCounts: { users, invoices, payments, receipts, refunds, transactions, books, issues, fines },
    financialReconciliation: { invoiceTotal: Number(invoiceTotals._sum.amount), paidTotal: Number(invoiceTotals._sum.paidAmount), refundPaymentReferenceAligned: restoredRefund.paymentId === restoredRefund.feePaymentId },
    passed: restoreMs <= 300_000 && users === 2 && invoices === 2 && payments === 1 && receipts === 1 && refunds === 1 && transactions === 1 && books === 1 && issues === 1 && fines === 1,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  assert.equal(report.passed, true, "Restore and reconciliation acceptance must pass");
  assert.equal(report.rtoTargetMet, true, "Measured isolated restore must meet the 5-minute target");
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await restored?.$disconnect();
  try { await cleanupSource(); } catch (error) {
    process.stderr.write(`Source fixture cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
  try {
    pg("dropdb", ["--if-exists", "--host", sourceUrl.hostname, "--port", sourceUrl.port || "5432", "--username", pgEnv.PGUSER, restoreName]);
  } catch (error) {
    process.stderr.write(`Restore database cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
});
