import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const billing = read("src/services/feeBilling.service.ts");
const finance = read("src/services/finance.service.ts");
const routes = read("src/routes/finance.routes.ts");
const controller = read("src/controllers/finance.controller.ts");
const ui = read("../frontend/src/app/fees/page.tsx");

test("legacy billing administration is owned by the active Accounts workspace", () => {
  const start = billing.indexOf("function assertCanManageFees(");
  const end = billing.indexOf("\nfunction assertCanReadBillingDesk", start);
  assert.ok(start >= 0 && end > start);
  const guard = billing.slice(start, end);
  assert.match(guard, /getEffectiveWorkspaceRole\(actor\) === "ACCOUNTS"/);
  assert.match(guard, /isInstitutionWideFinance\(actor\)/);
  assert.doesNotMatch(guard, /actor\.roles\.some/);
});

test("Director concession and refund lists are filtered by active enrollment in assigned campuses", () => {
  const start = billing.indexOf("async function addBillingStudentScopeCondition(");
  const end = billing.indexOf("\nfunction assertCanApproveMoney", start);
  assert.ok(start >= 0 && end > start);
  const helper = billing.slice(start, end);
  assert.match(helper, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(helper, /"studentId"/);
  assert.match(helper, /e\."status" = 'ACTIVE'/);
  assert.match(helper, /p\."departmentId" IN/);
  assert.match(billing, /addBillingStudentScopeCondition\(conditions, "c"/);
  assert.match(billing, /addBillingStudentScopeCondition\(conditions, "r"/);
});

test("invoice browsing uses active workspace role and preserves Parent linked-child scope", () => {
  const start = billing.indexOf("export async function listInvoices(");
  const end = billing.indexOf("\nexport async function getInvoice(", start);
  assert.ok(start >= 0 && end > start);
  const list = billing.slice(start, end);
  assert.match(list, /getEffectiveWorkspaceRole\(actor\)/);
  assert.match(list, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(list, /getManagedDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(list, /parentStudentLink\.findMany/);
  assert.match(list, /e\."status" = 'ACTIVE'/);
  assert.match(list, /studentId.*actor\.id/s);
});

test("invoice cancellation shares the payment row lock and checks student scope before writing", () => {
  const start = billing.indexOf("export async function cancelInvoice(");
  const end = billing.indexOf("\n// ==========================================================\n// PAYMENTS + RECEIPTS", start);
  assert.ok(start >= 0 && end > start);
  const cancel = billing.slice(start, end);
  assert.match(cancel, /prisma\.\$transaction/);
  assert.match(cancel, /FROM "fee_invoices"[\s\S]*?FOR UPDATE/);
  assert.match(cancel, /assertCanViewFinancialStudent\(institutionId, actor, current\.studentId\)/);
  assert.match(cancel, /"paidAmount" = 0/);
  assert.match(cancel, /"cancelledAt" IS NULL/);
});

test("explicit invoice assignment requires a current eligible enrollment", () => {
  const start = billing.indexOf("export async function generateInvoicesFromStructure(");
  const end = billing.indexOf("\n// ==========================================================\n// LATE FEES", start);
  assert.ok(start >= 0 && end > start);
  const assign = billing.slice(start, end);
  assert.match(assign, /prisma\.studentEnrollment\.findMany/);
  assert.match(assign, /status: "ACTIVE"/);
  assert.match(assign, /Every selected student must have an active enrollment/);
  assert.match(assign, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
});

test("legacy billing refund decision cannot mark funds processed or write the ledger", () => {
  const start = billing.indexOf("export async function decideRefund(");
  const end = billing.indexOf("\n// ==========================================================\n// RECONCILIATION", start);
  assert.ok(start >= 0 && end > start);
  const decide = billing.slice(start, end);
  assert.match(decide, /assertCanViewFinancialStudent\(institutionId, actor, refund\.studentId\)/);
  assert.match(decide, /input\.status === "PROCESSED"/);
  assert.match(decide, /Refund settlement must use the Finance settlement workflow/);
  assert.doesNotMatch(decide, /UPDATE "fee_payments"/);
  assert.doesNotMatch(decide, /UPDATE "fee_invoices"/);
});

test("Finance refunds require separate approval and reference-backed Accounts settlement", () => {
  const requestStart = finance.indexOf("export async function requestRefund(");
  const approveStart = finance.indexOf("export async function approveRefund(");
  const processStart = finance.indexOf("export async function processRefund(");
  const processEnd = finance.indexOf("\nexport async function transactions(", processStart);
  assert.ok(requestStart >= 0 && approveStart > requestStart && processStart > approveStart && processEnd > processStart);
  const request = finance.slice(requestStart, approveStart);
  const approve = finance.slice(approveStart, processStart);
  const process = finance.slice(processStart, processEnd);
  assert.match(request, /status:"REQUESTED",requestedById:a\.id,approvedById:null/);
  assert.match(approve, /candidate\.requestedById===a\.id/);
  assert.match(process, /getEffectiveWorkspaceRole\(a\) !== "ACCOUNTS"/);
  assert.match(process, /externalSettlementReference/);
  assert.match(process, /Online provider refunds are not enabled/);
  assert.match(process, /reference:externalReference/);
  assert.match(routes, /validateBody\(financeRefundProcessSchema\)/);
  assert.match(controller, /finance\.processRefund\(requireInstitution\(req\),a\(req\),req\.params\.id,req\.body\)/);
});

test("refund UI separates approval from settlement and never calls legacy PROCESSED", () => {
  assert.match(ui, /status: "APPROVED"/);
  assert.match(ui, /financeProcessRefund\(String\(refund\.id\), reference\.trim\(\)\)/);
  assert.doesNotMatch(ui, /status: "PROCESSED"/);
});
