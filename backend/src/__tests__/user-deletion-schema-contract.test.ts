import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(__dirname, "../../..");

test("permanent deletion SQL matches the deployed migration columns and identifier types", () => {
  const service = fs.readFileSync(
    path.join(ROOT, "backend", "src", "services", "userDeletion.service.ts"),
    "utf8",
  );
  const migration = fs.readFileSync(
    path.join(ROOT, "backend", "prisma", "migrations", "20261002103900_user_permanent_deletion_workflow", "migration.sql"),
    "utf8",
  );

  for (const column of [
    "target_name",
    "target_email",
    "target_role",
    "requester_name",
    "requester_email",
    "requester_role",
    "approver_name",
    "approver_email",
    "approver_role",
  ]) {
    assert.match(migration, new RegExp(`"${column}"`), `migration must define ${column}`);
    assert.match(service, new RegExp(`\\b${column}\\b`), `service must use ${column}`);
  }

  assert.doesNotMatch(
    service,
    /\b(?:target|requester|approver)_(?:first|last)_name\b/,
    "service must not query name columns absent from the deployed table",
  );
  assert.doesNotMatch(
    service,
    /\$\{(?:target\.id|target\.institutionId|actorRecord\.id|actorRecord\.institutionId|actor\.id)\}::uuid/,
    "text identifiers must not be compared or inserted as UUID-typed values",
  );
});
