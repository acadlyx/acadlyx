import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
} from "../config/rbac";

test("every role permission exists in the canonical permission catalog", () => {
  const catalog = new Set(PERMISSIONS.map((permission) => permission.key));

  for (const role of SYSTEM_ROLE_NAMES) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      assert.ok(
        catalog.has(permission),
        `${role} references unknown permission ${permission}`,
      );
    }
  }
});

test("critical examination, result and user-lifecycle permissions are assigned intentionally", () => {
  const has = (role: string, permission: string) =>
    (ROLE_PERMISSIONS[role] ?? []).includes(permission);

  assert.equal(has("EXAMINATION", "exams.read"), true);
  assert.equal(has("EXAMINATION", "exams.manage"), true);
  assert.equal(has("EXAMINATION", "exams.approve"), true);
  assert.equal(has("EXAMINATION", "marks.read"), true);
  assert.equal(has("EXAMINATION", "marks.enter"), true);
  assert.equal(has("EXAMINATION", "results.read"), true);

  assert.equal(has("STUDENT", "exams.read"), true);
  assert.equal(has("STUDENT", "results.read"), true);
  assert.equal(has("FACULTY", "exams.read"), true);
  assert.equal(has("FACULTY", "marks.read"), true);
  assert.equal(has("FACULTY", "marks.enter"), true);
  assert.equal(has("HOD", "exams.read"), true);
  assert.equal(has("HOD", "results.read"), true);

  assert.equal(has("INSTITUTION_ADMIN", "users.read"), true);
  assert.equal(has("INSTITUTION_ADMIN", "users.update"), true);
  assert.equal(has("INSTITUTION_ADMIN", "users.delete"), true);
});

test("institution administration does not receive examination write authority by default", () => {
  const permissions = new Set(ROLE_PERMISSIONS.INSTITUTION_ADMIN ?? []);

  assert.equal(permissions.has("exams.manage"), false);
  assert.equal(permissions.has("exams.approve"), false);
});
