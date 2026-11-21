import assert from "node:assert/strict";
import test from "node:test";
import { getEffectivePermissions } from "../config/rbac";
import {
  getEffectiveWorkspaceRole,
  isInstitutionWide,
  isInstitutionWideFinance,
  isInstitutionWideForRole,
} from "../services/accessScope.service";

function grants(role: string): Set<string> {
  return new Set(getEffectivePermissions([role]));
}

test("Institution Admin does not inherit finance, assignment, or examination operations", () => {
  const permissions = grants("INSTITUTION_ADMIN");
  const prohibited = [
    "fees.read",
    "fees.manage",
    "fees.assign",
    "fees.structure.read",
    "fees.structure.manage",
    "fees.structure.approve",
    "fees.structure.publish",
    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",
    "marks.enter",
    "results.read",
  ];

  for (const permission of prohibited) {
    assert.equal(permissions.has(permission), false, `Institution Admin unexpectedly received ${permission}`);
  }
  assert.equal(isInstitutionWideFinance({ roles: ["INSTITUTION_ADMIN"] }), false);
  assert.equal(isInstitutionWideForRole({ roles: ["INSTITUTION_ADMIN"] }, "EXAMINATION"), false);
  // Admission administration is an intentionally separate capability.
  assert.equal(isInstitutionWideForRole({ roles: ["INSTITUTION_ADMIN"] }, "ADMISSIONS"), true);
});

test("Super Admin remains platform-only rather than an operational tenant owner", () => {
  const permissions = grants("SUPER_ADMIN");
  assert.equal(permissions.has("institutions.manage"), true);
  assert.equal(permissions.has("plans.manage"), true);
  for (const permission of [
    "students.create", "students.update", "fees.manage", "fees.pay",
    "fees.refund", "fees.approve", "exams.manage", "exams.approve",
    "assignments.create", "library.manage", "operations.manage",
  ]) {
    assert.equal(permissions.has(permission), false, `Super Admin unexpectedly received ${permission}`);
  }
  assert.equal(isInstitutionWide({ roles: ["SUPER_ADMIN"] }), false, "Platform authority must not become tenant-wide record scope");
  assert.equal(isInstitutionWideFinance({ roles: ["SUPER_ADMIN"] }), false, "Super Admin must not enter generic tenant finance scope");
  assert.equal(isInstitutionWideForRole({ roles: ["SUPER_ADMIN"] }, "ACCOUNTS"), false);
  assert.equal(isInstitutionWideForRole({ roles: ["SUPER_ADMIN"] }, "ADMISSIONS"), false);
  assert.equal(isInstitutionWideForRole({ roles: ["SUPER_ADMIN"] }, "EXAMINATION"), false);
});

test("multi-role workspace priority preserves narrow scopes with explicit Chairman precedence", () => {
  assert.equal(getEffectiveWorkspaceRole({ roles: ["INSTITUTION_ADMIN", "DIRECTOR"] }), "DIRECTOR");
  assert.equal(getEffectiveWorkspaceRole({ roles: ["ACCOUNTS", "STUDENT"] }), "STUDENT");
  assert.equal(getEffectiveWorkspaceRole({ roles: ["DEAN", "HOD", "INSTITUTION_ADMIN"] }), "DEAN");
  assert.equal(getEffectiveWorkspaceRole({ roles: ["CHAIRMAN", "DIRECTOR"] }), "CHAIRMAN");
});
