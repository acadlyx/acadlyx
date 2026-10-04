import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("enterprise security: mutation boundary has durable audit and idempotency middleware", () => {
  const app = read("src/app.ts");
  assert.match(app, /mutationAudit/);
  assert.match(app, /idempotency/);
});

test("enterprise security: global search is tenant and lifecycle scoped", () => {
  const source = read("src/services/globalSearch.service.ts");
  assert.match(source, /"institutionId"=${institutionId}/);
  assert.match(source, /"deletedAt" IS NULL/);
  assert.match(source, /users.read/);
  assert.match(source, /courses.read/);
  assert.match(source, /notices.read/);
});

test("enterprise lifecycle: durable outbox has bounded retry processing", () => {
  const source = read("src/services/domainEvent.service.ts");
  assert.match(source, /attempts" < 10/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /processedAt/);
});

test("enterprise concurrency: registration writes are transactional and capacity scoped", () => {
  const source = read("src/services/registration.service.ts");
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /courseRegistration\.count/);
  assert.match(source, /courseOfferingId/);
});

test("enterprise recovery: imports expose atomic rollback semantics", () => {
  const source = read("src/services/import.service.ts");
  assert.match(source, /mode === "atomic"/);
  assert.match(source, /rolledBack/);
  assert.match(source, /prisma\.\$transaction/);
});

test("enterprise observability: readiness exposes background-job health", () => {
  const source = read("src/controllers/health.controller.ts");
  assert.match(source, /domainEventOutbox/);
  assert.match(source, /pending/);
  assert.match(source, /healthy/);
});

test("enterprise UI: central API prevents stale in-flight GETs after mutation invalidation", () => {
  const source = read("../frontend/src/lib/api.ts");
  assert.match(source, /cacheGeneration/);
  assert.match(source, /requestGeneration === cacheGeneration/);
});
