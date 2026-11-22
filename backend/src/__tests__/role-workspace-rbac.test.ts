import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  SYSTEM_ROLE_NAMES,
  normalizeRoleName,
  ROLE_PERMISSIONS,
  PLATFORM_ROLES,
  INSTITUTION_ROLES,
  isPlatformRole,
  getRolePermissions,
} from "../config/rbac";
import { getEffectiveWorkspaceRole } from "../services/accessScope.service";

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


test("people import department scope follows the active workspace, not a secondary HOD role", () => {
  const actor = { roles: ["DIRECTOR", "HOD"] } as any;
  assert.equal(getEffectiveWorkspaceRole(actor), "DIRECTOR");

  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/services/peopleImport.service.ts"),
    "utf8",
  );
  assert.match(source, /getEffectiveWorkspaceRole\(actor\) === "HOD"/);
  assert.doesNotMatch(source, /getCanonicalRoleNames/);
});


test("CMS is a platform-scoped role rather than an institution role", () => {
  assert.ok(PLATFORM_ROLES.includes("CMS"));
  assert.equal(INSTITUTION_ROLES.includes("CMS"), false);
  assert.equal(isPlatformRole("CMS"), true);
  assert.equal(isPlatformRole("SUPER_ADMIN"), true);
  assert.equal(isPlatformRole("INSTITUTION_ADMIN"), false);
  assert.equal(getEffectiveWorkspaceRole({ roles: ["CMS"] }), "CMS");
  assert.deepEqual(ROLE_PERMISSIONS.CMS, ["site.manage"]);
  assert.deepEqual(getRolePermissions("CMS"), ["site.manage"]);
});


test("platform website CMS route is not gated by tenant CMS entitlement", () => {
  const routes = fs.readFileSync(path.resolve(process.cwd(), "src/routes/siteContent.routes.ts"), "utf8");
  const service = fs.readFileSync(path.resolve(process.cwd(), "src/services/siteContent.service.ts"), "utf8");
  assert.doesNotMatch(routes, /requireFeature\("cms"\)/);
  assert.match(service, /platformSiteContent\.findUnique/);
  assert.match(service, /platformSiteContent\.upsert/);
  assert.match(service, /actor\.institutionId !== null/);
});
