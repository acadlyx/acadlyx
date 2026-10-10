import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { recordPayment, requestConcession } from "../services/finance.service";
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
        ],
      },
    };
  } catch (error) {
    await prisma.institution.delete({ where: { id: institution.id } });
    throw error;
  }
}

async function cleanup(institutionId: string): Promise<void> {
  await prisma.institution.deleteMany({ where: { id: institutionId } });
}

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
