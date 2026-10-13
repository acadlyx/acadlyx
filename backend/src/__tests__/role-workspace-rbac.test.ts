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


test("Director workspace KPI queries derive department filters from assigned active campuses", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/services/managementWorkspace.service.ts"), "utf8");
  const accessScope = fs.readFileSync(path.resolve(process.cwd(), "src/services/accessScope.service.ts"), "utf8");

  assert.match(source, /getWorkspaceType\(actor: AuthenticatedUser\): string \{\s*return getEffectiveWorkspaceRole\(actor\)/);
  assert.match(source, /if \(workspaceType === "DIRECTOR"\)/);
  assert.match(source, /const campusIds = await getDirectorCampusIds\(institutionId, actor\.id\)/);
  assert.match(source, /No campus scope is assigned to this director/);
  assert.match(source, /const departmentRows = await prisma\.department\.findMany\(\{\s*where: \{ institutionId, campusId: \{ in: campusIds \}, isActive: true \}/);
  assert.match(source, /const departmentIds = departmentRows\.map\(\(row\) => row\.id\)/);
  assert.match(source, /const departmentScope = \{ in: departmentIds \}/);
  assert.match(source, /studentEnrollments:\s*\{\s*some:\s*\{\s*institutionId,\s*status: "ACTIVE"/);
  assert.match(source, /courseOffering: scopedOffering/);
  assert.match(source, /student: scopedStudent/);

  const directorCampusScope = accessScope.slice(
    accessScope.indexOf("export async function getDirectorCampusIds("),
    accessScope.indexOf("export async function getDirectorDepartmentIds("),
  );
  assert.match(directorCampusScope, /scope: "DIRECTOR"/);
  assert.match(directorCampusScope, /campus: \{ institutionId, isActive: true \}/);
});
