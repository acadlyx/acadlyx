import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("provider webhook posts only captured payments to the settlement pipeline", () => {
  const source = readFileSync(join(process.cwd(), "src/services/payments/gateway.ts"), "utf8");
  const start = source.indexOf("async parseWebhook(");
  const end = source.indexOf("\n  }\n}", start);
  assert.ok(start >= 0 && end > start);
  const parse = source.slice(start, end);
  assert.match(parse, /body\.event !== "payment\.captured"/);
  assert.doesNotMatch(parse, /payment\.authorized/);
  assert.match(parse, /payment\.status !== "captured"/);
  assert.match(parse, /order\.amount !== payment\.amount/);
  assert.match(parse, /order\.currency !== payment\.currency/);
  assert.match(parse, /invoiceId: order\.notes\?\.invoiceId/);
  assert.match(parse, /institutionId: order\.notes\?\.institutionId/);
});
