import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "src/services/finance.service.ts"), "utf8");

test("finance workspace serializes invoice payment balance checks with an invoice row lock", () => {
  const payment = source.slice(source.indexOf("export async function payment("), source.indexOf("export async function listPayments("));
  assert.match(payment, /SELECT "id" FROM "fee_invoices"[^\n]*FOR UPDATE/);
  assert.ok(payment.indexOf("FOR UPDATE") < payment.indexOf("const fresh=await tx.feeInvoice.findFirst"));
  assert.match(payment, /Payment exceeds outstanding balance/);
});

test("refund requests reserve refundable balance while holding invoice and payment locks", () => {
  const request = source.slice(source.indexOf("export async function requestRefund("), source.indexOf("export async function approveRefund("));
  assert.match(request, /SELECT "id" FROM "fee_invoices"[^\n]*FOR UPDATE/);
  assert.match(request, /SELECT "id" FROM "fee_payments"[^\n]*FOR UPDATE/);
  assert.ok(request.indexOf("FOR UPDATE") < request.indexOf("feeRefund.aggregate"));
  assert.ok(request.indexOf("feeRefund.aggregate") < request.indexOf("feeRefund.create"));
});

test("refund processing claims an approved refund exactly once inside its transaction", () => {
  const process = source.slice(source.indexOf("export async function processRefund("), source.indexOf("export async function transactions("));
  assert.match(process, /updateMany\(\{where:\{id,institutionId,status:"APPROVED"\},data:\{status:"PROCESSING"\}\}\)/);
  assert.match(process, /if\(claimed.count!==1\)/);
  assert.match(process, /type:"REFUND",reference:id/);
});

test("payment idempotency is rechecked under the invoice lock and rejects key reuse across invoices or payloads", () => {
  const payment = source.slice(source.indexOf("export async function payment("), source.indexOf("export async function listPayments("));
  const lock = payment.indexOf("FOR UPDATE");
  const replay = payment.indexOf("const duplicate=await tx.feePayment.findFirst");
  const write = payment.indexOf("tx.feePayment.create");
  assert.ok(lock >= 0 && replay > lock && write > replay, "replay must be checked after locking and before creating a payment");
  assert.match(payment, /Idempotency key is required/);
  assert.match(payment, /Idempotency key was already used for a different invoice/);
  assert.match(payment, /Idempotency key was reused with a different payment payload/);
  assert.match(payment, /if\(result\.created\)await audit/);
});
