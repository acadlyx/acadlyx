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
test("Director student scope is enforced before management-role access", () => {
  const source = readFileSync(join(process.cwd(), "src/services/erp.service.ts"), "utf8");
  const scopeStart = source.indexOf("async function assertStudentScope(");
  const nextFunction = source.indexOf("\nasync function ", scopeStart + 10);
  assert.notEqual(scopeStart, -1, "assertStudentScope must exist");
  assert.notEqual(nextFunction, -1, "assertStudentScope must have a clear function boundary");
  const scope = source.slice(scopeStart, nextFunction);
  const directorBranch = scope.indexOf('actorRoles.includes("DIRECTOR")');
  const managementShortcut = scope.indexOf("hasAnyRole(actor, MANAGEMENT_ROLES)");
  assert.notEqual(directorBranch, -1, "Director requires a dedicated scope branch");
  assert.notEqual(managementShortcut, -1, "other management roles retain a separately reviewed path");
  assert.ok(directorBranch < managementShortcut, "Director scope must run before the management shortcut");
  assert.ok(scope.includes("getDirectorDepartmentIds(institutionId, actor.id)"), "department scope must derive from assigned campuses");
  assert.ok(scope.includes('status: "ACTIVE"'), "only active enrollment grants the student relationship");
  assert.ok(scope.includes("program: { departmentId: { in: departmentIds } }"), "student enrollment must belong to a scoped department");
  assert.ok(scope.includes("actor.institutionId !== institutionId"), "Director access must be tenant-bound");
});
