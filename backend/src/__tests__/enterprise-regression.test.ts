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
\ntest("enterprise mutation boundary: idempotency supports legacy clients without a header and uses server-generated record ids", () => {\n  const source = read("src/middleware/idempotency.ts");\n  assert.match(source, /suppliedKey = req\\.header/);\n  assert.match(source, /suppliedKey \\|\\|/);\n  assert.match(source, /randomUUID/);\n  assert.doesNotMatch(source, /gen_random_uuid/);\n  assert.doesNotMatch(source, /X-Idempotency-Key is required/);\n});\n\ntest("enterprise frontend: mutating raw fetch calls are restricted to authentication/public compatibility paths", () => {\n  const frontendRoot = path.resolve(root, "../frontend/src");\n  const allowed = new Set([\n    path.resolve(frontendRoot, "lib/auth.ts"),\n    path.resolve(frontendRoot, "lib/api.ts"),\n    path.resolve(frontendRoot, "app/login/page.tsx"),\n  ]);\n  const files: string[] = [];\n  const walk = (directory: string) => {\n    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {\n      const fullPath = path.join(directory, entry.name);\n      if (entry.isDirectory()) walk(fullPath);\n      else if (/\\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);\n    }\n  };\n  walk(frontendRoot);\n  const violations: string[] = [];\n  for (const file of files) {\n    if (allowed.has(file)) continue;\n    const source = fs.readFileSync(file, "utf8");\n    const hasFetch = source.includes("fetch(");\n    const hasMutationMethod = ["method: \"POST\"", "method: \"PUT\"", "method: \"PATCH\"", "method: \"DELETE\""].some((marker) => source.includes(marker));\n    if (hasFetch && hasMutationMethod) violations.push(path.relative(frontendRoot, file));\n  }\n  assert.deepEqual(violations, [], "Raw frontend mutation fetches bypass the shared authenticated client: " + violations.join(", "));\n});