import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const workspace = read("src/services/workspaceContext.service.ts");
const myWork = read("src/services/myWork.service.ts");
const directory = read("src/services/directory.service.ts");

test("workspace context uses the backend effective workspace role for routing and student behavior", () => {
  assert.match(workspace, /getEffectiveWorkspaceRole\(actor\)/);
  assert.match(workspace, /workspaceBasePath\(activeRole\)/);
  assert.match(workspace, /if \(activeRole === "STUDENT"\)/);
  assert.doesNotMatch(workspace, /workspaceBasePath\(roles\)/);
  assert.doesNotMatch(workspace, /if \(roles\.includes\("STUDENT"\)\)/);
});

test("workspace context derives Director departments from CampusAccess and Dean/HOD from assigned departments", () => {
  assert.match(workspace, /activeRole === "DIRECTOR" && isDirectorScoped\(actor\)/);
  assert.match(workspace, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(workspace, /activeRole === "DEAN" \|\| activeRole === "HOD"/);
  assert.match(workspace, /getManagedDepartmentIds\(institutionId, actor\.id\)/);
});

test("all academic context selectors inherit the authorized department set", () => {
  const programStart = workspace.indexOf("const programsPromise = prisma.program.findMany(");
  const yearStart = workspace.indexOf("const academicYearsPromise = prisma.academicYear.findMany(");
  const semesterStart = workspace.indexOf("const semestersPromise = prisma.semester.findMany(");
  const batchStart = workspace.indexOf("const batchesPromise = input.programId");
  assert.ok(programStart >= 0 && yearStart > programStart && semesterStart > yearStart && batchStart > semesterStart);
  const programQuery = workspace.slice(programStart, yearStart);
  const yearQuery = workspace.slice(yearStart, semesterStart);
  const semesterQuery = workspace.slice(semesterStart, batchStart);
  const batchQuery = workspace.slice(batchStart, workspace.indexOf("const [sections, batches]", batchStart));
  assert.match(programQuery, /allowed !== null.*departmentId: \{ in: allowed \}/s);
  assert.match(yearQuery, /allowed !== null.*program: \{ departmentId: \{ in: allowed \} \}/s);
  assert.match(semesterQuery, /allowed !== null.*program: \{ departmentId: \{ in: allowed \} \}/s);
  assert.match(batchQuery, /allowed !== null.*program: \{ departmentId: \{ in: allowed \} \}/s);
});

test("My Work branches use a single active role rather than unioning secondary role bindings", () => {
  assert.match(myWork, /const activeRole = getEffectiveWorkspaceRole\(actor\)/);
  assert.doesNotMatch(myWork, /actor\.roles\[0\]/);
  assert.doesNotMatch(myWork, /actor\.roles\.some/);
  assert.match(myWork, /activeRole === "FACULTY"/);
  assert.match(myWork, /activeRole === "STUDENT"/);
  assert.match(myWork, /activeRole === "ACCOUNTS"/);
});

test("Director/Dean/HOD My Work metrics are department-scoped", () => {
  assert.match(myWork, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(myWork, /getManagedDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(myWork, /studentEnrollmentScope/);
  assert.match(myWork, /facultyOfferingScope/);
  assert.match(myWork, /financialStudentScope/);
  assert.match(myWork, /const canReadFinance = isInstitutionWideFinance\(actor\)/);
});

test("user directory lookups enforce active workspace scope even when a secondary role supplies users.read", () => {
  const start = directory.indexOf("export async function searchUsers(");
  const end = directory.indexOf("\n/**\n * Course offerings within", start);
  assert.ok(start >= 0 && end > start);
  const searchUsers = directory.slice(start, end);
  assert.match(searchUsers, /getEffectiveWorkspaceRole\(actor\)/);
  assert.match(searchUsers, /if \(!isInstitutionWide\(actor\)\)/);
  assert.match(searchUsers, /activeRole === "DIRECTOR"/);
  assert.match(searchUsers, /getDirectorDepartmentIds\(institutionId, actor\.id\)/);
  assert.match(searchUsers, /activeRole === "DEAN" \|\| activeRole === "HOD"/);
  assert.match(searchUsers, /activeRole === "HR" \|\| activeRole === "EXAMINATION"/);
  assert.match(searchUsers, /employee_profiles/);
  assert.match(searchUsers, /return \[\]/);
});
