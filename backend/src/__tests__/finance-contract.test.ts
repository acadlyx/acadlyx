import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("finance schema exposes the fields used by concession workflows", () => {
  const schema = read("prisma/schema.prisma");
  const modelStart = schema.indexOf("model FeeConcession {");
  const modelEnd = schema.indexOf("\n}\n\nmodel FeeRefund", modelStart);
  assert.ok(modelStart >= 0 && modelEnd > modelStart);
  const model = schema.slice(modelStart, modelEnd);

  for (const field of [
    "invoiceId       String?",
    "feeStructureId  String?",
    "academicYearId  String?",
    "name            String?",
    "concessionType  String?",
    "requestedById   String?",
  ]) {
    assert.ok(model.includes(field), `Missing FeeConcession field: ${field}`);
  }
});

test("finance schema exposes the refund settlement reference", () => {
  const schema = read("prisma/schema.prisma");
  const modelStart = schema.indexOf("model FeeRefund {");
  const modelEnd = schema.indexOf("\n}\n\nmodel FeeTransaction", modelStart);
  assert.ok(modelStart >= 0 && modelEnd > modelStart);
  assert.match(schema.slice(modelStart, modelEnd), /reference\s+String\?/);
});

test("billing SQL uses canonical refund paymentId while preserving the API feePaymentId input", () => {
  const service = read("src/services/feeBilling.service.ts");
  const requestStart = service.indexOf("export async function requestRefund(");
  const requestEnd = service.indexOf("\n/**\n * Approving a refund", requestStart);
  assert.ok(requestStart >= 0 && requestEnd > requestStart);
  const request = service.slice(requestStart, requestEnd);

  assert.match(request, /feePaymentId: string/);
  assert.match(request, /"paymentId"/);
  assert.doesNotMatch(request, /"feePaymentId"/);
});

test("billing concession creation persists both legacy and canonical type/requester fields", () => {
  const service = read("src/services/feeBilling.service.ts");
  const start = service.indexOf("export async function createConcession(");
  const end = service.indexOf("\nexport async function decideConcession", start);
  assert.ok(start >= 0 && end > start);
  const source = service.slice(start, end);

  assert.match(source, /"concessionType", "type"/);
  assert.match(source, /"createdById", "requestedById"/);
  assert.match(source, /input\.amount \?\? 0/);
});

test("Director finance scope uses the canonical explicit CampusAccess helper", () => {
  const service = read("src/services/finance.service.ts");
  const sharedScope = read("src/services/accessScope.service.ts");
  assert.match(service, /import \{ getDirectorCampusIds \} from "\.\/accessScope\.service";/);
  assert.match(service, /if\(r\.includes\("DIRECTOR"\)\) return \{institutionId,campusIds:await getDirectorCampusIds\(institutionId,a\.id\)\};/);
  assert.doesNotMatch(service, /if\(r\.includes\("DIRECTOR"\)\)[^\n]*departmentAccess\.findMany/);
  assert.ok(service.indexOf('if(r.includes("DIRECTOR"))') < service.indexOf('if(r.includes("ACCOUNTS")||r.includes("CHAIRMAN")||has(a,"fees.manage")'), "Director scope must precede broad permission fallbacks");
  assert.ok(service.indexOf('if(r.includes("HOD")||r.includes("DEAN"))') < service.indexOf('if(r.includes("ACCOUNTS")||r.includes("CHAIRMAN")||has(a,"fees.manage")'), "department scope must precede broad permission fallbacks");
  assert.match(sharedScope, /export async function getDirectorCampusIds\(institutionId: string, userId: string\): Promise<string\[]>/);
  assert.match(sharedScope, /campus: \{ institutionId, isActive: true \}/);
});

test("Director financial records and payment aggregates retain institution and campus predicates", () => {
  const service = read("src/services/finance.service.ts");
  assert.match(service, /function invoiceWhere\(s:Scope\)[\s\S]*?campusId:\{in:s\.campusIds\}/);
  assert.match(service, /function paymentWhere\(s:Scope\):Prisma\.FeePaymentWhereInput\{return\{institutionId:s\.institutionId/);
  assert.match(service, /function studentFinancialFilter\(s:Scope\):Record<string,any>/);
});

test("refund decisions use an atomic state transition claim before financial posting", () => {
  const service = read("src/services/feeBilling.service.ts");
  const start = service.indexOf("export async function decideRefund(");
  const end = service.indexOf("\nexport async function listRefunds(", start);
  assert.ok(start >= 0 && end > start);
  const decide = service.slice(start, end);
  assert.match(decide, /const validTransition\s*=/);
  assert.match(decide, /refund\.status === "REQUESTED"[^;]*input\.status === "APPROVED"[^;]*input\.status === "REJECTED"/s);
  assert.match(decide, /const claimed = await tx\.\$executeRaw[\s\S]*?AND "status" = \$\{refund\.status\}[\s\S]*?if \(claimed !== 1\)/);
  assert.match(decide, /FROM "fee_payments"[\s\S]*?FOR UPDATE/);
  assert.match(decide, /FROM "fee_invoices"[\s\S]*?FOR UPDATE/);
});

test("settled payment processing locks the invoice and rejects amounts over the outstanding balance", () => {
  const service = read("src/services/feeBilling.service.ts");
  const start = service.indexOf("async function settlePayment(");
  const end = service.indexOf("\n/** Counter / offline collection. */", start);
  assert.ok(start >= 0 && end > start);
  const settle = service.slice(start, end);
  assert.match(settle, /FROM "fee_invoices"[\s\S]*?FOR UPDATE/);
  assert.match(settle, /input\.amount > outstanding \+ 0\.009/);
  assert.match(settle, /"providerPaymentId" = \$\{input\.providerPaymentId\}/);
});

test("concession approval is claimed only while the concession remains pending", () => {
  const service = read("src/services/feeBilling.service.ts");
  const start = service.indexOf("export async function decideConcession(");
  const end = service.indexOf("\n/** Total approved concession", start);
  assert.ok(start >= 0 && end > start);
  const decide = service.slice(start, end);
  assert.match(decide, /UPDATE "fee_concessions"[\s\S]*?AND "status" = 'PENDING'/);
  assert.match(decide, /if \(claimed !== 1\)[\s\S]*?new AppError\("Concession state changed/);
});
