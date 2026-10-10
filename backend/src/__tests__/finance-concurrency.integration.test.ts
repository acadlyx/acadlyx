import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { invoices, payment as recordPayment, processRefund, requestConcession, requestRefund } from "../services/finance.service";
import { returnBook as returnLibraryBook } from "../services/library.service";
import type { AuthenticatedUser } from "../types/auth";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

type Fixture = {
  institutionId: string;
  studentId: string;
  invoiceId: string;
  actor: AuthenticatedUser;
};

async function fixture(): Promise<Fixture> {
  const suffix = `${Date.now()}-${randomUUID()}`;
  const institution = await prisma.institution.create({
    data: { name: "Finance concurrency integration", slug: `finance-concurrency-${suffix}` },
  });
  try {
    const [student, actor] = await Promise.all([
      prisma.user.create({
        data: {
          institutionId: institution.id,
          email: `student-${suffix}@integration.invalid`,
          idNumber: `STU-${suffix}`,
          passwordHash: "integration-test-only",
          firstName: "Integration",
          lastName: "Student",
        },
      }),
      prisma.user.create({
        data: {
          institutionId: institution.id,
          email: `accounts-${suffix}@integration.invalid`,
          idNumber: `ACC-${suffix}`,
          passwordHash: "integration-test-only",
          firstName: "Integration",
          lastName: "Accounts",
        },
      }),
    ]);
    const invoice = await prisma.feeInvoice.create({
      data: {
        institutionId: institution.id,
        studentId: student.id,
        title: "Concurrency test invoice",
        amount: 1000,
        paidAmount: 0,
        refundedAmount: 0,
        discountAmount: 0,
        status: "PENDING",
      },
    });
    return {
      institutionId: institution.id,
      studentId: student.id,
      invoiceId: invoice.id,
      actor: {
        id: actor.id,
        institutionId: institution.id,
        email: actor.email,
        roles: ["ACCOUNTS"],
        permissions: [
          "fees.read",
          "fees.invoice.read",
          "fees.payment.record",
          "fees.concession.manage",
          "fees.concession.approve",
          "fees.refund.request",
          "fees.refund.approve",
          "fees.refund.process",
        ],
      },
    };
  } catch (error) {
    await cleanup(institution.id);
    throw error;
  }
}

async function cleanup(institutionId: string): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.feeRefund.deleteMany({ where: { institutionId } });
    await tx.feeReceipt.deleteMany({ where: { institutionId } });
    await tx.feeConcession.deleteMany({ where: { institutionId } });
    await tx.feeTransaction.deleteMany({ where: { institutionId } });
    await tx.feePayment.deleteMany({ where: { institutionId } });
    await tx.feeInvoice.deleteMany({ where: { institutionId } });
    await tx.libraryFine.deleteMany({ where: { institutionId } });
    await tx.libraryIssue.deleteMany({ where: { institutionId } });
    await tx.libraryBookCopy.deleteMany({ where: { institutionId } });
    await tx.libraryBook.deleteMany({ where: { institutionId } });
    await tx.tenantFeatureEntitlement.deleteMany({ where: { institutionId } });
    await tx.tenantSubscription.deleteMany({ where: { institutionId } });
    await tx.institution.deleteMany({ where: { id: institutionId } });
  });
}



test("PostgreSQL: simultaneous library returns create one fine and one linked financial invoice", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const subscription = await prisma.tenantSubscription.create({
      data: { institutionId: f.institutionId, userLimit: 20, plan: "STANDARD", status: "ACTIVE" },
    });
    await prisma.tenantFeatureEntitlement.create({
      data: { institutionId: f.institutionId, subscriptionId: subscription.id, featureKey: "fees", isEnabled: true },
    });
    const book = await prisma.libraryBook.create({
      data: {
        institutionId: f.institutionId, title: "Concurrency Test Book", author: "Integration Author",
        totalCopies: 1, availableCopies: 0, defaultReplacementValue: 100,
      },
    });
    const copy = await prisma.libraryBookCopy.create({
      data: { institutionId: f.institutionId, bookId: book.id, accessionNumber: `ACC-${randomUUID()}`, status: "ISSUED" },
    });
    const issue = await prisma.libraryIssue.create({
      data: {
        institutionId: f.institutionId, bookId: book.id, borrowerId: f.studentId, issuedById: f.actor.id,
        copyId: copy.id, dueDate: new Date(Date.now() - 3 * 86_400_000), status: "ISSUED",
        finePerDay: 5, fineCap: 100, gracePeriodDays: 0,
      },
    });
    const input = { condition: "RETURNED" as const, waiveFine: false };
    const results = await Promise.allSettled([
      returnLibraryBook(f.institutionId, f.actor, issue.id, input, {}),
      returnLibraryBook(f.institutionId, f.actor, issue.id, input, {}),
    ]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(results.filter(x => x.status === "rejected").length, 1);
    const [persistedIssue, fines, invoices] = await Promise.all([
      prisma.libraryIssue.findUniqueOrThrow({ where: { id: issue.id } }),
      prisma.libraryFine.findMany({ where: { institutionId: f.institutionId, issueId: issue.id } }),
      prisma.feeInvoice.findMany({ where: { institutionId: f.institutionId, sourceEventKey: { startsWith: `LIBRARY_FINANCIAL_CHARGE:${issue.id}:` } } }),
    ]);
    assert.equal(persistedIssue.status, "RETURNED");
    assert.equal(fines.length, 1);
    assert.ok(Number(fines[0].originalAmount) > 0);
    assert.equal(invoices.length, 1);
    assert.equal(fines[0].financialInvoiceId, invoices[0].id);
    assert.equal(invoices[0].libraryIssueId, issue.id);
    assert.equal(invoices[0].amount, Number(fines[0].originalAmount));
  } finally {
    await cleanup(f.institutionId);
  }
});

test("PostgreSQL: a faculty permission cannot turn into institution-wide financial scope", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const faculty = {
      ...f.actor,
      roles: ["FACULTY"],
      permissions: ["fees.read", "fees.reports.export"],
    };
    await assert.rejects(() => invoices(f.institutionId, faculty, { page: 1, pageSize: 10 }));
  } finally {
    await cleanup(f.institutionId);
  }
});

test("PostgreSQL: competing payments cannot over-settle one invoice", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const results = await Promise.allSettled([
      recordPayment(f.institutionId, f.actor, f.invoiceId, {
        amount: 700, method: "OFFLINE", reference: "race-a", idempotencyKey: "race-a",
      }),
      recordPayment(f.institutionId, f.actor, f.invoiceId, {
        amount: 700, method: "OFFLINE", reference: "race-b", idempotencyKey: "race-b",
      }),
    ]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(results.filter(x => x.status === "rejected").length, 1);

    const [invoice, payments, ledger, receipts] = await Promise.all([
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
      prisma.feePayment.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
      prisma.feeTransaction.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId, type: "PAYMENT" } }),
      prisma.feeReceipt.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
    ]);
    assert.equal(payments.length, 1);
    assert.equal(ledger.length, 1);
    assert.equal(receipts.length, 1);
    assert.equal(invoice.paidAmount, 700);
    assert.equal(invoice.status, "PARTIALLY_PAID");
    assert.equal(payments.reduce((sum, p) => sum + p.amount, 0), invoice.paidAmount);
  } finally {
    await cleanup(f.institutionId);
  }
});

test("PostgreSQL: concurrent retries with one idempotency key create one payment, receipt, and ledger row", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const input = { amount: 400, method: "OFFLINE", reference: "retry-safe", idempotencyKey: "same-key" };
    const results = await Promise.allSettled([
      recordPayment(f.institutionId, f.actor, f.invoiceId, input),
      recordPayment(f.institutionId, f.actor, f.invoiceId, input),
    ]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 2);
    const [invoice, payments, ledger, receipts] = await Promise.all([
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
      prisma.feePayment.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
      prisma.feeTransaction.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId, type: "PAYMENT" } }),
      prisma.feeReceipt.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
    ]);
    assert.equal(payments.length, 1);
    assert.equal(ledger.length, 1);
    assert.equal(receipts.length, 1);
    assert.equal(invoice.paidAmount, 400);
    assert.equal(payments[0].idempotencyKey, "same-key");
  } finally {
    await cleanup(f.institutionId);
  }
});


test("PostgreSQL: concurrent refund reservations cannot exceed one payment's refundable balance", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    await recordPayment(f.institutionId, f.actor, f.invoiceId, {
      amount: 1000, method: "OFFLINE", reference: "refund-race-payment", idempotencyKey: "refund-race-payment",
    });
    const payment = await prisma.feePayment.findFirstOrThrow({
      where: { institutionId: f.institutionId, invoiceId: f.invoiceId },
    });
    const results = await Promise.allSettled([
      requestRefund(f.institutionId, f.actor, payment.id, { amount: 700, reason: "concurrent refund A" }),
      requestRefund(f.institutionId, f.actor, payment.id, { amount: 700, reason: "concurrent refund B" }),
    ]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(results.filter(x => x.status === "rejected").length, 1);
    const [refunds, persistedPayment, invoice] = await Promise.all([
      prisma.feeRefund.findMany({ where: { institutionId: f.institutionId, paymentId: payment.id } }),
      prisma.feePayment.findUniqueOrThrow({ where: { id: payment.id } }),
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
    ]);
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].amount.toString(), "700");
    assert.equal(persistedPayment.refundedAmount, 0);
    assert.equal(invoice.paidAmount, 1000);
  } finally {
    await cleanup(f.institutionId);
  }
});


test("PostgreSQL: a failure after invoice and payment writes rolls back every financial record", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => prisma.$transaction(async tx => {
      await tx.feeInvoice.update({ where: { id: f.invoiceId }, data: { paidAmount: 500, status: "PARTIALLY_PAID" } });
      await tx.feePayment.create({
        data: {
          institutionId: f.institutionId,
          invoiceId: f.invoiceId,
          amount: 500,
          method: "OFFLINE",
          status: "SUCCESS",
          idempotencyKey: "forced-rollback",
        },
      });
      throw new Error("injected failure after related financial writes");
    }));
    const [invoice, payments, ledger, receipts] = await Promise.all([
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
      prisma.feePayment.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
      prisma.feeTransaction.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
      prisma.feeReceipt.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
    ]);
    assert.equal(invoice.paidAmount, 0);
    assert.equal(invoice.status, "PENDING");
    assert.equal(payments.length, 0);
    assert.equal(ledger.length, 0);
    assert.equal(receipts.length, 0);
  } finally {
    await cleanup(f.institutionId);
  }
});

test("PostgreSQL: processed refunds are not subtracted twice from the remaining refundable balance", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    await recordPayment(f.institutionId, f.actor, f.invoiceId, {
      amount: 1000, method: "OFFLINE", reference: "partial-refund-payment", idempotencyKey: "partial-refund-payment",
    });
    const payment = await prisma.feePayment.findFirstOrThrow({
      where: { institutionId: f.institutionId, invoiceId: f.invoiceId },
    });
    const first = await requestRefund(f.institutionId, f.actor, payment.id, { amount: 600, reason: "first partial refund" });
    await processRefund(f.institutionId, f.actor, first.id);
    const second = await requestRefund(f.institutionId, f.actor, payment.id, { amount: 400, reason: "remaining balance refund" });
    assert.equal(second.amount.toString(), "400");
    const [refunds, persistedPayment, invoice, ledger] = await Promise.all([
      prisma.feeRefund.findMany({ where: { institutionId: f.institutionId, paymentId: payment.id } }),
      prisma.feePayment.findUniqueOrThrow({ where: { id: payment.id } }),
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
      prisma.feeTransaction.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId, type: "REFUND" } }),
    ]);
    assert.equal(refunds.length, 2);
    assert.equal(refunds.filter(x => x.status === "PROCESSED").length, 1);
    assert.equal(persistedPayment.refundedAmount, 600);
    assert.equal(invoice.refundedAmount, 600);
    assert.equal(invoice.paidAmount, 400);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount.toString(), "-600");
  } finally {
    await cleanup(f.institutionId);
  }
});

test("PostgreSQL: competing approved concessions serialize and cannot double-apply", { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const results = await Promise.allSettled([
      requestConcession(f.institutionId, f.actor, f.invoiceId, { amount: 700, reason: "concurrency test A", type: "WAIVER" }),
      requestConcession(f.institutionId, f.actor, f.invoiceId, { amount: 700, reason: "concurrency test B", type: "WAIVER" }),
    ]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(results.filter(x => x.status === "rejected").length, 1);
    const [invoice, concessions, ledger] = await Promise.all([
      prisma.feeInvoice.findUniqueOrThrow({ where: { id: f.invoiceId } }),
      prisma.feeConcession.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId } }),
      prisma.feeTransaction.findMany({ where: { institutionId: f.institutionId, invoiceId: f.invoiceId, type: "CONCESSION" } }),
    ]);
    assert.equal(invoice.amount, 300);
    assert.equal(concessions.length, 1);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amount.toString(), "-700");
  } finally {
    await cleanup(f.institutionId);
  }
});
