import assert from "node:assert/strict";
import test from "node:test";

import { ROLE_PERMISSIONS } from "../config/rbac";

test("placement role matrix separates operational authority from institutional read access", () => {
  assert.ok(ROLE_PERMISSIONS.PLACEMENT.includes("placements.manage"));
  assert.ok(ROLE_PERMISSIONS.STUDENT.includes("placements.apply"));
  assert.ok(ROLE_PERMISSIONS.STUDENT.includes("placements.read"));
  assert.ok(ROLE_PERMISSIONS.PARENT.includes("placements.read"));

  for (const role of ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "REGISTRAR", "DEAN", "HOD", "FACULTY"] as const) {
    assert.ok(ROLE_PERMISSIONS[role].includes("placements.read"), `${role} must have scoped placement visibility`);
    assert.ok(!ROLE_PERMISSIONS[role].includes("placements.manage"), `${role} must not inherit Placement Team operational authority`);
  }
});
