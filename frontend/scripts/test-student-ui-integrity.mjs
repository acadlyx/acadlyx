import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const sharedHeader = read("src/components/dashboard/DashboardPageHeader.tsx");
const selfService = read("src/components/student/StudentSelfServiceModule.tsx");
const examinations = read("src/components/student/StudentExaminationsModule.tsx");
const expandable = read("src/components/ui/ExpandableList.tsx");
const examApi = read("src/lib/examinationsApi.ts");
const examRoutes = read("../backend/src/routes/examination.routes.ts");
const examService = read("../backend/src/services/examination.service.ts");
const rbac = read("../backend/src/config/rbac.ts");
const adminAcademic = read("src/components/dashboard/AdminAcademicDataPage.tsx");
const campusWorkspace = read("src/app/admin/campuses/[campusId]/page.tsx");
const departmentService = read("../backend/src/services/department.service.ts");
const departmentValidator = read("../backend/src/validators/department.validators.ts");

assert.match(sharedHeader, /text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl/);
assert.match(selfService, /DashboardPageHeader/);
assert.match(examinations, /DashboardPageHeader/);
for (const module of ["library", "registration", "leave"]) {
  assert.match(selfService, new RegExp(`case "${module}":[\\s\\S]*?return <`));
}
assert.match(examinations, /view==="performance"/);
assert.match(examinations, /view==="results"/);
assert.match(examinations, /requestSequence/);
assert.match(examinations, /if \(sequence === requestSequence\.current\) setRows\(result\)/);
assert.match(examinations, /Retry/);
assert.match(examinations, /ExpandableList items=\{items\}/);
assert.match(examinations, /ExpandableList items=\{tickets\}/);
assert.match(examinations, /items=\{rows\}/);
assert.match(examApi, /authedFetch<Envelope<StudentExamPerformanceRow\[\]>>\(\s*"\/examinations\/my\/performance"/);
assert.match(examApi, /authedFetch<Envelope<StudentExamPerformanceRow\[\]>>\(\s*"\/examinations\/my\/results"/);
assert.match(examApi, /if \(!Array\.isArray\(res\.data\)\) throw new Error/);
assert.match(examRoutes, /"\/my\/performance",[\s\S]*?authorize\("exams\.read"\)[\s\S]*?getStudentExamPerformance\([\s\S]*?actor, actor\.id/);
assert.match(examRoutes, /"\/my\/results",[\s\S]*?authorize\("results\.read"\)[\s\S]*?getStudentPublishedResults\([\s\S]*?actor, actor\.id/);
assert.match(examService, /m\."status" IN \('APPROVED','PUBLISHED'\)/);
assert.match(examService, /rp\."status"='PUBLISHED'/);
assert.match(examService, /m\."institutionId"=\$\{institutionId\} AND m\."studentId"=\$\{studentId\}/);
assert.match(rbac, /STUDENT:\s*\[[\s\S]*?"exams\.read"[\s\S]*?"results\.read"[\s\S]*?\n\s*\],/);
assert.match(expandable, /initialCount = 3/);
assert.match(expandable, /Math\.min\(items\.length, count \+ batchSize\)/);
assert.match(expandable, /Show more/);
assert.match(expandable, /Show less/);
assert.match(selfService, /<ExpandableList[\s\S]*?label="loans"/);
assert.match(selfService, /<ExpandableList[\s\S]*?label="books"/);
assert.match(selfService, /<ExpandableList[\s\S]*?label="registrations"/);
assert.match(selfService, /<ExpandableList[\s\S]*?label="eligible courses"/);
assert.match(selfService, /<ExpandableList[\s\S]*?label="leave requests"/);
assert.match(adminAcademic, /module === "campuses"[\s\S]*?Open campus workspace/);
assert.match(adminAcademic, /module === "departments" && campusId[\s\S]*?campusId=\$\{encodeURIComponent\(campusId\)\}/);
assert.match(campusWorkspace, /\/departments\?page=1&pageSize=100&campusId=/);
assert.match(campusWorkspace, /departments\.map\(\(department\)/);
assert.match(campusWorkspace, /\/admin\/departments\/\$\{encodeURIComponent\(department\.id\)\}/);
assert.match(departmentValidator, /listDepartmentsQuerySchema[\s\S]*?campusId: optionalUuid/);
assert.match(departmentService, /filters\.campusId \? \{ campusId: filters\.campusId \} : \{\}/);

process.stdout.write("Student UI, performance data-flow and compact-list source checks passed.\n");
