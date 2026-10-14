import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Regression contract for the previously confirmed Director scope bypass.
 * The director-specific branch must be evaluated before the broad management
 * role shortcut, and it must require CampusAccess-derived department IDs plus
 * a current active enrollment. Runtime/database integration tests are still
 * required for the actual relationship semantics.
 */
test("Director student scope is derived from CampusAccess before any broad-role shortcut", () => {
  const source = readFileSync(join(process.cwd(), "src/services/erp.service.ts"), "utf8");
  const scopeStart = source.indexOf("async function assertStudentScope(");
  const nextFunction = source.indexOf("\nasync function ", scopeStart + 10);
  assert.notEqual(scopeStart, -1, "assertStudentScope must exist");
  assert.notEqual(nextFunction, -1, "assertStudentScope must have a clear function boundary");
  const scope = source.slice(scopeStart, nextFunction);

  assert.ok(scope.includes("getEffectiveWorkspaceRole(actor)"), "scope decisions must use the effective active role");
  assert.ok(scope.includes("actor.institutionId !== institutionId"), "student access must be tenant-bound");
  assert.ok(scope.indexOf("if (isInstitutionWide(actor)) return;") < scope.indexOf('effectiveRole === "DIRECTOR"'), "Chairman can retain institution-wide scope, but a Director+secondary admin cannot bypass the scoped branch");
  assert.ok(scope.includes('effectiveRole === "DIRECTOR" && isDirectorScoped(actor)'), "Director scope must be an explicit active-role branch");
  assert.ok(scope.includes("getDirectorDepartmentIds(institutionId, actor.id)"), "department scope must derive from assigned campuses");
  assert.ok(scope.includes('status: "ACTIVE"'), "only active enrollment grants the student relationship");
  assert.ok(scope.includes("program: { departmentId: { in: departmentIds } }"), "student enrollment must belong to an authorized department");
  assert.doesNotMatch(scope, /hasAnyRole\(actor, MANAGEMENT_ROLES\)/, "a union of broad management roles must not bypass resource scope");
});
