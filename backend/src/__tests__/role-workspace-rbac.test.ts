import assert from "node:assert/strict";
import test from "node:test";
import {
  SYSTEM_ROLE_NAMES,
  normalizeRoleName,
  ROLE_PERMISSIONS,
} from "../config/rbac";

test("MANAGEMENT is a distinct canonical role", () => {
  assert.ok(SYSTEM_ROLE_NAMES.includes("MANAGEMENT"));
  assert.equal(normalizeRoleName("MANAGEMENT"), "MANAGEMENT");
  assert.notEqual(normalizeRoleName("MANAGEMENT"), "CHAIRMAN");
});

test("STAFF is not silently promoted to ACCOUNTS", () => {
  assert.notEqual(normalizeRoleName("STAFF"), "ACCOUNTS");
});

test("management authority is independently represented", () => {
  assert.ok(Array.isArray(ROLE_PERMISSIONS.MANAGEMENT));
  assert.ok(ROLE_PERMISSIONS.MANAGEMENT.includes("reports.read"));
});
