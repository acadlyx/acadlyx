import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
  type PermissionKey,
} from "../config/rbac";

test("RBAC permission catalogue has unique keys", () => {
  const keys = PERMISSIONS.map((permission) => permission.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("every canonical role has a permission matrix entry", () => {
  for (const role of SYSTEM_ROLE_NAMES) {
    assert.ok(Array.isArray(ROLE_PERMISSIONS[role]), `missing permission matrix for ${role}`);
  }
});

test("every role permission exists in the canonical permission catalogue", () => {
  const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions as PermissionKey[]) {
      assert.ok(permissionKeys.has(permission), `${role} references unknown permission ${permission}`);
    }
  }
});

test("no role contains duplicate permissions", () => {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    assert.equal(
      new Set(permissions).size,
      permissions.length,
      `${role} contains duplicate permissions`,
    );
  }
});
