import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/services/workspaceContext.service.ts"), "utf8");

test("workspace context resolves the canonical active role, not an incidental secondary role", () => {
  assert.match(source, /const activeRole = getEffectiveWorkspaceRole\(actor\)/);
  assert.match(source, /if \(activeRole === "STUDENT"\)/);
  assert.match(source, /role: activeRole/);
  assert.match(source, /workspaceBasePath\(activeRole\)/);
});

test("workspace selector authorization keeps department, campus and academic hierarchy validation server-side", () => {
  for (const message of [
    "Campus not found in your authorized institution scope",
    "This department is outside your authorized scope",
    "Department not found in your authorized institution scope",
    "Program is not valid for the selected department or authorized scope",
    "Semester is not valid for the selected academic context",
    "Section is not valid for the selected semester",
    "Batch is not valid for the selected program",
  ]) assert.ok(source.includes(message), "Missing context isolation guard: " + message);
});
