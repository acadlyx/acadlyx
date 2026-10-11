import fs from "node:fs";
import path from "node:path";
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


test("Director workspace KPI queries are scoped through CampusAccess-derived departments", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/services/managementWorkspace.service.ts"), "utf8");
  assert.match(source, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(source, /No campus scope is assigned to this director/);
  assert.match(source, /studentEnrollments/);
  assert.match(source, /courseOffering: scopedOffering/);
  assert.match(source, /student: scopedStudent/);
  assert.match(source, /...(isDirector \? scopedUser : {})/);
});
