import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS, ROLE_PERMISSIONS } from "../config/rbac";

test("fee-structure access is granted only through canonical scoped permissions", () => {
  const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));
  assert.ok(permissionKeys.has("fees.structure.read"));
  assert.ok(permissionKeys.has("fees.structure.manage"));
  assert.ok(permissionKeys.has("fees.structure.approve"));

  for (const role of ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "ACCOUNTS"] as const) {
    assert.ok(
      ROLE_PERMISSIONS[role].includes("fees.structure.read"),
      `${role} must be able to read fee structures`,
    );
    assert.ok(
      ROLE_PERMISSIONS[role].includes("fees.structure.manage"),
      `${role} must receive fee-structure write access only through the existing role policy`,
    );
  }

  for (const role of ["STUDENT", "PARENT", "FACULTY", "HOD"] as const) {
    assert.ok(
      !ROLE_PERMISSIONS[role].includes("fees.structure.read"),
      `${role} must not gain access to institutional fee-structure administration`,
    );
    assert.ok(
      !ROLE_PERMISSIONS[role].includes("fees.structure.manage"),
      `${role} must not gain fee-structure write authority`,
    );
  }
});

test("fee-structure permissions do not imply unrelated financial authority", () => {
  for (const role of ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT"] as const) {
    const grants = ROLE_PERMISSIONS[role];
    assert.ok(grants.includes("fees.structure.manage"));
    assert.ok(!grants.includes("fees.payment.record"));
    assert.ok(!grants.includes("fees.refund.process"));
    assert.ok(!grants.includes("fees.concession.approve"));
  }
});
