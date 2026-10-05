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
  assert.match(schema.slice(modelStart, modelEnd), /reference\\s+String\\?/);
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
