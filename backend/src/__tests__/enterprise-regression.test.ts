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
  assert.match(source, /institutionId/);
  assert.match(source, /deletedAt.*IS NULL/);
  assert.match(source, /users.read/);
  assert.match(source, /courses.read/);
  assert.match(source, /notices.read/);
});

test("enterprise lifecycle: durable outbox has bounded retry processing", () => {
  const source = read("src/services/domainEvent.service.ts");
  assert.match(source, /attempts.*< 10/);
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

test("enterprise finance: refund processing locks the payment before balance mutation", () => {
  const source = read("src/services/feeBilling.service.ts");
  assert.match(source, /SELECT "id", "invoiceId", "amount", "refundedAmount"/);
  assert.match(source, /fee_payments[\s\S]*FOR UPDATE/);
  assert.match(source, /INSERT INTO "fee_refunds"/);
});

test("enterprise library: stock and waiver mutations are conditional or row-locked", () => {
  const source = read("src/services/library.service.ts");
  assert.match(source, /availableCopies: \{ gt: 0 \}/);
  assert.match(source, /library_fines[\s\S]*FOR UPDATE/);
  assert.match(source, /fee_invoices[\s\S]*FOR UPDATE/);
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

test("enterprise mutation boundary: idempotency supports legacy clients without a header and uses server-generated record ids", () => {
  const source = read("src/middleware/idempotency.ts");
  assert.match(source, /suppliedKey = req\.header/);
  assert.match(source, /suppliedKey \|\|/);
  assert.match(source, /randomUUID/);
  assert.doesNotMatch(source, /gen_random_uuid/);
  assert.doesNotMatch(source, /X-Idempotency-Key is required/);
});

test("enterprise frontend: mutating raw fetch calls are restricted to authentication/public compatibility paths", () => {
  const frontendRoot = path.resolve(root, "../frontend/src");
  const allowed = new Set([
    path.resolve(frontendRoot, "lib/auth.ts"),
    path.resolve(frontendRoot, "lib/api.ts"),
    path.resolve(frontendRoot, "app/login/page.tsx"),
  ]);
  const files: string[] = [];

  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
    }
  };

  walk(frontendRoot);

  const violations: string[] = [];
  for (const file of files) {
    if (allowed.has(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const hasFetch = source.includes("fetch(");
    const hasMutationMethod = [
      'method: "POST"',
      'method: "PUT"',
      'method: "PATCH"',
      'method: "DELETE"',
    ].some((marker) => source.includes(marker));

    if (hasFetch && hasMutationMethod) {
      violations.push(path.relative(frontendRoot, file));
    }
  }

  assert.deepEqual(
    violations,
    [],
    "Raw frontend mutation fetches bypass the shared authenticated client: " +
      violations.join(", "),
  );
});

test("enterprise mutation boundary: idempotency runs after CORS and body parsing", () => {
  const source = read("src/app.ts");
  const corsIndex = source.indexOf("app.use(\n    cors");
  const jsonIndex = source.indexOf("express.json");
  const idempotencyIndex = source.indexOf("app.use(idempotency)");

  assert.ok(corsIndex >= 0);
  assert.ok(jsonIndex >= 0);
  assert.ok(idempotencyIndex > jsonIndex);
  assert.ok(idempotencyIndex > corsIndex);
});
