import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const frontend = join(process.cwd(), "../frontend/src/app");
const intelligenceServicePath = join(process.cwd(), "src/services/intelligence.service.ts");
const intelligenceControllerPath = join(process.cwd(), "src/controllers/intelligence.controller.ts");

test("Chairman operations is an independent workspace page", () => {
  const page = readFileSync(join(frontend, "chairman/operations/page.tsx"), "utf8");
  assert.ok(!page.includes('from "@/app/operations/page"'), "Chairman must not alias the generic operations page");
  assert.ok(page.includes('allowedRoles={["CHAIRMAN"]}'), "Chairman route must retain its role boundary");
  for (const route of [
    "/chairman/intelligence",
    "/chairman/fees/structures",
    "/chairman/fees",
    "/chairman/examinations",
    "/chairman/students",
    "/chairman/placements",
    "/chairman/reports",
  ]) {
    assert.ok(page.includes(`href: "${route}"`), `expected dedicated Chairman destination: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Director operations remains inside Director-specific routes", () => {
  const page = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  assert.ok(page.includes('allowedRoles={["DIRECTOR"]}'), "Director route must retain its role boundary");
  assert.ok(!page.includes('href: "/students"'), "Director operations must not navigate to unscoped global students");
  assert.ok(!page.includes('href: "/admissions"'), "Director operations must not navigate to unscoped global admissions");
  for (const route of [
    "/director/students",
    "/director/examinations",
    "/director/obe",
    "/director/fees",
    "/director/fee-approvals",
    "/director/placements",
    "/director/reports",
  ]) {
    assert.ok(page.includes(`href: "${route}"`), `expected dedicated Director destination: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Executive dashboards stay sidebar-centric and every leadership destination resolves", () => {
  const chairman = readFileSync(join(frontend, "../components/dashboard/ChairmanDashboard.tsx"), "utf8");
  const director = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  const routes = [
    "/chairman/examinations/operations", "/chairman/intelligence", "/chairman/fees/structures",
    "/chairman/notices", "/chairman/notifications", "/chairman/events-gallery", "/chairman/students",
    "/director/examinations/operations", "/director/intelligence", "/director/students", "/director/notices",
    "/director/notifications", "/director/events-gallery", "/director/admissions",
    "/director/fee-approvals",
  ];
  for (const route of routes) {
    assert.ok(navigation.includes(route), `sidebar route missing: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must resolve: ${route}`);
  }
  assert.ok(!chairman.includes("/chairman/examinations/operations"), "Chairman dashboard should rely on the sidebar, not duplicate action cards");
  assert.ok(!director.includes("/director/examinations/operations"), "Director dashboard should rely on the sidebar, not duplicate action cards");
  assert.ok(!director.includes('["Campus students","/students"]'), "Director must not route to the global student page");
  assert.ok(!director.includes('["Admissions","/admissions"]'), "Director must not route to global admissions");
  assert.ok(!navigation.includes('label: "Institutional CMS"'), "leadership sidebars must not expose Institutional CMS");
  assert.ok(!navigation.includes('href: "/calendar"'), "Director must not be routed into the unscoped generic calendar");
});

test("Executive dashboards distinguish unavailable metrics from zero", () => {
  const chairman = readFileSync(join(frontend, "../components/dashboard/ChairmanDashboard.tsx"), "utf8");
  const director = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  for (const [name, source] of [["Chairman", chairman], ["Director", director]] as const) {
    assert.ok(source.includes("setUnavailable(true)"), `${name} dashboard must track unavailable data`);
    assert.ok(source.includes("value === undefined"), `${name} dashboard must not render missing metrics as zero`);
    assert.ok(source.includes("Retry"), `${name} dashboard must offer a retry after load failure`);
    assert.ok(!source.includes("setError(err.message)"), `${name} dashboard must not expose raw server errors`);
  }
});

test("Chairman legacy fee-approval route redirects to the direct publication workflow", () => {
  const page = readFileSync(join(frontend, "chairman/fee-approvals/page.tsx"), "utf8");
  assert.ok(page.includes('redirect("/chairman/fees/structures")'));
});

test("Director fee approvals have a dedicated page and backend campus-scope enforcement", () => {
  const page = readFileSync(join(frontend, "director/fee-approvals/page.tsx"), "utf8");
  const operations = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  const dashboard = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");

  assert.ok(page.includes('allowedRoles={["DIRECTOR"]}'), "approval page must be Director-only");
  assert.ok(page.includes("assigned campus scope"), "page must explain the campus boundary");
  assert.ok(operations.includes('href: "/director/fee-approvals"'), "Director may retain campus fee approval workflow");
  assert.ok(!dashboard.includes('["Campus fee approvals", "/director/fee-approvals"]'), "Director dashboard should not duplicate approval workflow shortcuts");
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.read"'));
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.approve"'));
  assert.ok(feeService.includes("getDirectorDepartmentIds"), "fee service must derive Director scope from server-side campus assignments");
  assert.ok(feeService.includes('fs."programId" IN ('), "Director fee listing must be filtered to programs in assigned campus departments");
  assert.ok(feeService.includes('JOIN "programs" p ON p."id" = sem."programId"') && feeService.includes('p."departmentId" IN ('), "semester-only fee structures must be resolved through the owning program in assigned departments");
  assert.ok(feeService.includes("assertFeeStructureInActorScope(institutionId, actor, structureId)"), "approval and rejection mutations must validate record scope");
});

test("Chairman and Director intelligence routes are separate and role-scoped", () => {
  const chairman = readFileSync(join(frontend, "chairman/intelligence/page.tsx"), "utf8");
  const director = readFileSync(join(frontend, "director/intelligence/page.tsx"), "utf8");
  const directorOps = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  const directorDashboard = readFileSync(join(process.cwd(), "../frontend/src/components/dashboard/DirectorDashboard.tsx"), "utf8");
  assert.ok(chairman.includes('allowedRoles={["CHAIRMAN"]}'));
  assert.ok(director.includes('allowedRoles={["DIRECTOR"]}'));
  assert.ok(!chairman.includes('from "@/app/intelligence/page"'), "Chairman must not alias the generic intelligence page");
  assert.ok(!director.includes('from "@/app/intelligence/page"'), "Director must not alias the generic intelligence page");
  assert.ok(directorOps.includes('href: "/director/intelligence"'));
  assert.ok(!directorDashboard.includes('["Campus intelligence", "/director/intelligence"]'), "Director dashboard should not duplicate sidebar destinations");
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.ok(navigation.includes('href: "/director/intelligence"'), "Director intelligence must be reachable from the sidebar");
});

test("intelligence aggregate queries preserve all assigned departments without widening scope", () => {
  const service = readFileSync(intelligenceServicePath, "utf8");
  const controller = readFileSync(intelligenceControllerPath, "utf8");
  assert.ok(service.includes("departmentIds?: string[]"), "intelligence aggregate accepts a multi-department scope");
  assert.ok(service.includes("const scopedDepartmentIds = filters.departmentId ? [filters.departmentId] : filters.departmentIds"));
  assert.ok(service.includes("departmentId: { in: scopedDepartmentIds }"), "student and offering aggregates use the authorized department set");
  assert.ok(controller.includes("const departmentIds = allowed && !departmentId ? allowed : undefined"));
  assert.ok(controller.includes("departmentId ? [departmentId] : allowed"), "risk records retain the same assigned scope");
  assert.ok(controller.includes("allowed.includes(program.departmentId)"), "program filters outside the assigned set are rejected");
  assert.ok(controller.includes("allowed.includes(semesterProgram.departmentId)"), "semester-only filters outside the assigned set are rejected");
});

test("Chairman and Director fee and examination landing routes do not alias generic operational pages", () => {
  const chairmanFees = readFileSync(join(frontend, "chairman/fees/page.tsx"), "utf8");
  const directorFees = readFileSync(join(frontend, "director/fees/page.tsx"), "utf8");
  const chairmanExams = readFileSync(join(frontend, "chairman/examinations/page.tsx"), "utf8");
  const directorExams = readFileSync(join(frontend, "director/examinations/page.tsx"), "utf8");
  assert.ok(chairmanFees.includes('allowedRoles={["CHAIRMAN"]}'));
  assert.ok(directorFees.includes('allowedRoles={["DIRECTOR"]}'));
  assert.ok(chairmanFees.includes('href="/chairman/fees/structures"'), "Chairman finance view must link to the dedicated publication workflow");
  const chairmanStructures = readFileSync(join(frontend, "chairman/fees/structures/page.tsx"), "utf8");
  assert.ok(chairmanStructures.includes('view="fee-structures"'), "Chairman publication page must use the canonical finance structure view");
  assert.ok(directorFees.includes("listFeeStructures"), "Director finance view must use the server-scoped fee structure API");
  assert.ok(!chairmanFees.includes('from "@/app/fees/page"'));
  assert.ok(!directorFees.includes('from "@/app/fees/page"'));
  assert.ok(chairmanExams.includes('allowedRoles={["CHAIRMAN"]}'));
  assert.ok(directorExams.includes('allowedRoles={["DIRECTOR"]}'));
  assert.ok(!chairmanExams.includes('from "@/app/examination/page"'));
  assert.ok(!directorExams.includes('from "@/app/examination/page"'));
  assert.ok(chairmanExams.includes('authedFetch<{ data: Workspace }>("/erp/me/workspace")'));
  assert.ok(directorExams.includes('authedFetch<{ data: Workspace }>("/erp/me/workspace")'));
});


test("Director examination writes and decisions enforce assigned campus scope", () => {
  const service = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const routes = readFileSync(join(process.cwd(), "src/routes/examination.routes.ts"), "utf8");
  assert.ok(service.includes("assertDirectorSessionTargetsInScope"), "Director session creation and scoped edits validate target IDs");
  assert.ok(service.includes("assertDirectorCanAccessSession"), "session reads and session-level mutations check Director campus scope");
  assert.ok(service.includes("assertExamApprovalScope"), "schedule approvals re-check the resource scope after role permission");
  assert.ok(service.includes("await assertExamApprovalScope(institutionId, actor, schedule)"), "approval actions check the target schedule");
  assert.ok(service.includes('AND "status" = ${request.status}'), "revaluation transitions use compare-and-set semantics");
  assert.ok(service.includes("This correction request was decided concurrently"), "mark-correction decisions detect races");
  assert.ok(service.includes("This incident was decided concurrently"), "incident decisions detect races");
  assert.ok(service.includes("getDirectorCampusIds(institutionId, actor.id)"), "Director campus assignments come from CampusAccess");
  assert.ok(routes.includes("requireAuthenticatedUser(req),\n      pagination,"), "incident list receives the authenticated actor for scope filtering");
});

test("Director examination review queues cannot list institution-wide records", () => {
  const service = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const listSessions = service.slice(service.indexOf("function listExamSessions("), service.indexOf("export async function getExamSession("));
  const listRevaluations = service.slice(service.indexOf("export async function listRevaluationRequests("), service.indexOf("export async function decideRevaluation("));
  const listIncidents = service.slice(service.indexOf("export async function listExamIncidents("), service.indexOf("export async function decideExamIncident("));
  const listCorrections = service.slice(service.indexOf("export async function listExamMarkCorrectionRequests("));
  const directorSessionBranch = listSessions.slice(listSessions.indexOf('roles.includes("DIRECTOR")'));
  assert.ok(directorSessionBranch.includes('("campusIds" <> \'[]\'::jsonb AND "campusIds" ?| ARRAY['));
  assert.ok(!directorSessionBranch.includes('"departmentIds" = \'[]\'::jsonb OR'), "an empty target list must not make a Director session visible");
  assert.ok(listRevaluations.includes('actor.roles.includes("DIRECTOR")') && listRevaluations.includes("getDirectorDepartmentIds"));
  assert.ok(listIncidents.includes('actor.roles.includes("DIRECTOR")') && listIncidents.includes("getDirectorDepartmentIds"));
  assert.ok(listCorrections.includes('actor.roles.includes("DIRECTOR")') && listCorrections.includes("getDirectorDepartmentIds"));
  assert.ok(listCorrections.includes("assertExamApprover(actor)"), "scoped Directors must be allowed to review correction decisions");
  assert.ok(listRevaluations.includes('!actor.roles.includes("DIRECTOR")'), "Director queues must not fall into the student self-only filter");
});

test("verification workflow runs for the isolated branch and migrates PostgreSQL before backend tests", () => {
  const workflow = readFileSync(join(process.cwd(), "../.github/workflows/erp-verification.yml"), "utf8");
  assert.ok(workflow.includes("chairman-director-enterprise-workspaces-2026-10-11"));
  assert.ok(workflow.includes("image: postgres:16"));
  assert.ok(workflow.includes("npx prisma migrate deploy"));
  assert.ok(workflow.indexOf("npx prisma migrate deploy") < workflow.indexOf("npm test"));
});


test("Chairman and Director examination operations are separate full-lifecycle workspaces", () => {
  const chairman = readFileSync(join(process.cwd(), "../frontend/src/app/chairman/examinations/operations/page.tsx"), "utf8");
  const director = readFileSync(join(process.cwd(), "../frontend/src/app/director/examinations/operations/page.tsx"), "utf8");
  const chairmanOperations = readFileSync(join(frontend, "chairman/operations/page.tsx"), "utf8");
  const directorOperations = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  for (const [name, source, role] of [["Chairman", chairman, "CHAIRMAN"], ["Director", director, "DIRECTOR"]] as const) {
    assert.ok(source.includes(`allowedRoles={["${role}"]}`), `${name} examination operations must be role-isolated`);
    for (const workflow of ["createExamSession", "createExamSchedule", "getMarksSheet", "approveMarks", "lockSchedule", "publishResults", "listRevaluations", "decideRevaluation", "decideIncident"]) {
      assert.ok(source.includes(workflow), `${name} operations must retain ${workflow}`);
    }
    assert.ok(source.includes("decideRevaluationItem"), `${name} must wire revaluation decision controls to the API`);
    assert.ok(source.includes("decideIncidentItem"), `${name} must wire incident decision controls to the API`);
    assert.ok(source.includes("Complete revaluation"));
    assert.ok(source.includes("Uphold incident"));
    assert.ok(source.includes("Dismiss incident"));
  }
  assert.ok(chairmanOperations.includes('href: "/chairman/examinations/operations"'));
  assert.ok(directorOperations.includes('href: "/director/examinations/operations"'));
});

test("Director export and attendance reporting enforce campus-derived department filters", () => {
  const exporter = readFileSync(join(process.cwd(), "src/services/export.service.ts"), "utf8");
  const attendance = readFileSync(join(process.cwd(), "src/services/attendanceReport.service.ts"), "utf8");
  assert.ok(exporter.includes("DIRECTOR_SCOPED_FINANCE_EXPORT_TYPES"));
  assert.ok(exporter.includes('"marks", "attendance", "notices"'), "attendance must be explicitly enabled for scoped export roles");
  assert.ok(exporter.includes('fs."programId" IS NOT NULL AND fs."programId" IN'));
  assert.ok(exporter.includes('fs."programId" IS NULL AND fs."semesterId" IN'), "semester-linked fee structures must also be exported within campus scope");
  assert.ok(exporter.includes("scopedStudentFilter"), "invoice-related export/download datasets must filter by scoped student enrollment");
  assert.ok(exporter.includes('attendanceSession: {\n          institutionId,\n          ...(scope.institutionWide ? {} : {'), "attendance export must filter the course offering to the assigned department");
  assert.ok(exporter.includes('results: { where: scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }'), "exam export must not include result rows for students outside the Director scope");
  assert.ok(exporter.includes('student: { AND: [scopedStudentFilter.student] }, courseOffering:'), "marks and submission exports must scope both the student and academic offering");
  assert.ok(attendance.includes("getDirectorDepartmentIds(institutionId, actor.id)"));
  assert.ok(attendance.includes('label: "Assigned campus scope"'));
  assert.ok(attendance.includes('"__NO_AUTHORIZED_SCOPE__"'), "an empty Director assignment must not broaden attendance reporting");
});


test("Fee and examination decisions persist state transitions with audit history atomically", () => {
  const fees = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const exams = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  for (const action of ["approveFeeStructure", "rejectFeeStructure"]) {
    const start = fees.indexOf(`export async function ${action}(`);
    const end = fees.indexOf("\nexport async function ", start + 1);
    const body = fees.slice(start, end < 0 ? undefined : end);
    assert.ok(body.includes("prisma.$transaction"), `${action} must transact the decision`);
    assert.ok(body.includes("tx.auditLog.create"), `${action} must atomically write an audit row`);
  }
  for (const action of ["approveExamMarks", "lockExamSchedule", "publishExamResults", "decideRevaluation", "decideExamIncident", "decideExamMarkCorrection"]) {
    const start = exams.indexOf(`export async function ${action}(`);
    const end = exams.indexOf("\nexport async function ", start + 1);
    const body = exams.slice(start, end < 0 ? undefined : end);
    assert.ok(body.includes("tx.auditLog.create"), `${action} must persist an audit row in the transaction`);
  }
  assert.ok(exams.includes('FOR UPDATE'), "mark and schedule decisions must serialize competing writes");
  const revaluationStart = exams.indexOf("export async function decideRevaluation(");
  const incidentStart = exams.indexOf("export async function decideExamIncident(");
  const revaluationDecision = exams.slice(revaluationStart, exams.indexOf("\nexport async function ", revaluationStart + 1));
  const incidentDecision = exams.slice(incidentStart, exams.indexOf("\nexport async function ", incidentStart + 1));
  assert.ok(revaluationDecision.includes("assertExamApprover(actor)"), "Director and Chairman approvals must be admitted to the scoped revaluation decision path");
  assert.ok(incidentDecision.includes("assertExamApprover(actor)"), "Director and Chairman approvals must be admitted to the scoped incident decision path");
});


test("Chairman and Director student profile links stay inside their workspaces", () => {
  const chairmanList = readFileSync(join(frontend, "chairman/students/page.tsx"), "utf8");
  const directorList = readFileSync(join(frontend, "director/students/page.tsx"), "utf8");
  const chairmanProfile = readFileSync(join(frontend, "chairman/students/[id]/page.tsx"), "utf8");
  const directorProfile = readFileSync(join(frontend, "director/students/[id]/page.tsx"), "utf8");
  assert.ok(chairmanList.includes('detailBasePath="/chairman/students"'));
  assert.ok(directorList.includes('detailBasePath="/director/students"'));
  assert.ok(chairmanProfile.includes('allowedRoles={["CHAIRMAN"]}'));
  assert.ok(directorProfile.includes('allowedRoles={["DIRECTOR"]}'));
  assert.ok(!chairmanProfile.includes('href="/students"'));
  assert.ok(!directorProfile.includes('href="/students"'));
  assert.ok(existsSync(join(frontend, "chairman/students/[id]/page.tsx")));
  assert.ok(existsSync(join(frontend, "director/students/[id]/page.tsx")));
});


test("Every literal Chairman/Director dashboard and operations destination resolves to a page", () => {
  const sources = [
    "../frontend/src/components/dashboard/ChairmanDashboard.tsx",
    "../frontend/src/components/dashboard/DirectorDashboard.tsx",
    "../frontend/src/app/chairman/operations/page.tsx",
    "../frontend/src/app/director/operations/page.tsx",
    "../frontend/src/app/chairman/examinations/page.tsx",
    "../frontend/src/app/director/examinations/page.tsx",
  ];
  for (const relative of sources) {
    const source = readFileSync(join(process.cwd(), relative), "utf8");
    const routes = [...source.matchAll(/["'](\/(?:chairman|director)\/[a-z0-9/_-]+)["']/g)]
      .map((match) => match[1])
      .filter((route, index, all) => all.indexOf(route) === index);
    for (const route of routes) {
      assert.ok(
        existsSync(join(frontend, route.slice(1), "page.tsx")),
        `${relative} contains a route destination without a page: ${route}`,
      );
    }
  }
});


test("Director student list and profile responses filter nested enrollments to assigned departments", () => {
  const service = readFileSync(join(process.cwd(), "src/services/studentAdmin.service.ts"), "utf8");
  assert.ok(service.includes("const scopedStudentListInclude = directorDepartmentIds"));
  assert.ok(service.includes("include: scopedStudentListInclude"));
  assert.ok(service.includes("if (actor?.roles.includes(\"DIRECTOR\"))"));
  assert.ok(service.includes('in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"]'));
});


test("Chairman receives approval-only examination permissions without Examination Cell management", () => {
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");
  const chairmanStart = rbac.indexOf("CHAIRMAN: [");
  const chairmanEnd = rbac.indexOf("\n  MANAGEMENT: [", chairmanStart);
  const chairman = rbac.slice(chairmanStart, chairmanEnd);
  assert.ok(chairman.includes('"exams.approve"'));
  assert.ok(chairman.includes('"exams.revaluate"'));
  assert.ok(!chairman.includes('"exams.manage"'), "Chairman approvals must not grant operational scheduling/marks-entry authority");
});


test("Director examination read and decision queues derive campus scope from the offering program", () => {
  const exams = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const directorReadScope = exams.slice(exams.indexOf('if (actor.roles.includes("DIRECTOR"))', exams.indexOf("async function assertCanReadSchedule")), exams.indexOf("async function assertCanActOnSchedule"));
  assert.ok(directorReadScope.includes("prisma.semester.findFirst"));
  assert.ok(directorReadScope.includes("program: { institutionId, departmentId: { in: ids } }"));
  const sessions = exams.slice(exams.indexOf("export async function listExamSessions("), exams.indexOf("export async function getExamSession("));
  assert.ok(sessions.includes('JOIN "programs" p ON p."id"=sem."programId"'));
  assert.ok(sessions.includes('outside_program."departmentId" NOT IN'));
  const revaluations = exams.slice(exams.indexOf("export async function listRevaluationRequests("), exams.indexOf("export async function decideRevaluation("));
  assert.ok(revaluations.includes('JOIN "programs" scoped_program'));
  const incidents = exams.slice(exams.indexOf("export async function listExamIncidents("), exams.indexOf("export async function decideExamIncident("));
  assert.ok(incidents.includes('JOIN "programs" scoped_program'));
  const corrections = exams.slice(exams.indexOf("export async function listExamMarkCorrectionRequests("));
  assert.ok(corrections.includes('JOIN "programs" p ON p."id" = sem."programId"'));
});


test("institutional intelligence combines program and semester filters with department scope", () => {
  const service = readFileSync(join(process.cwd(), "src/services/intelligence.service.ts"), "utf8");
  const start = service.indexOf("export async function getInstitutionInsights");
  const end = service.indexOf("export async function getAtRiskStudents", start);
  const body = service.slice(start, end);
  assert.ok(body.includes("const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {"));
  assert.ok(body.includes("AND: ["));
  assert.ok(body.includes("semester: { program: { departmentId: { in: scopedDepartmentIds } } }"));
  assert.ok(body.includes("const facultyOfferingFilter: Prisma.CourseOfferingWhereInput = courseOfferingFilter"));
  assert.ok(!body.includes("course: { departmentId: { in: scopedDepartmentIds } }"), "report scope must follow the offering's program, not an independently assigned course department");
});


test("Literal Chairman/Director page links and router destinations resolve to route files", () => {
  const roleRoots = [join(frontend, "chairman"), join(frontend, "director")];
  const pageFiles: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name === "page.tsx") pageFiles.push(full);
    }
  };
  roleRoots.forEach(visit);
  const failures: string[] = [];
  for (const file of pageFiles) {
    const source = readFileSync(file, "utf8");
    const routePattern = /(?:href\s*=\s*|href\s*:\s*|router\.(?:push|replace)\(\s*)["'`]((?:\/chairman|\/director)\/[^"'`$?#]*)/g;
    for (const match of source.matchAll(routePattern)) {
      const route = match[1].replace(/\/$/, "");
      if (!route || route.includes("${")) continue;
      const pagePath = join(frontend, route.slice(1), "page.tsx");
      if (!existsSync(pagePath)) failures.push(file.replace(frontend, "frontend/src/app") + " -> " + route);
    }
  }
  assert.deepEqual(failures, [], "every literal role-workspace destination must resolve to a page");
});


test("Examination mark correction decisions enforce maker-checker and atomic audit", () => {
  const exams = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const start = exams.indexOf("export async function decideExamMarkCorrection(");
  const end = exams.indexOf("export async function listExamMarkCorrectionRequests(", start);
  const body = exams.slice(start, end);
  assert.ok(body.includes("requestedById:string"));
  assert.ok(body.includes("req.requestedById === actor.id"));
  assert.ok(body.includes("The requester cannot decide their own mark correction"));
  assert.ok(body.includes("tx.auditLog.create"));
  assert.ok(body.includes("status") && body.includes("PENDING"));
});


test("Chairman can publish fee drafts directly with explicit permission and audit", () => {
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const routes = readFileSync(join(process.cwd(), "src/routes/erp.routes.ts"), "utf8");
  const api = readFileSync(join(frontend, "../lib/erpApi.ts"), "utf8");
  const finance = readFileSync(join(frontend, "../components/accounts/FinancePage.tsx"), "utf8");
  assert.ok(rbac.includes('"fees.structure.publish"'));
  const chairman = rbac.slice(rbac.indexOf("CHAIRMAN:"), rbac.indexOf("MANAGEMENT:"));
  const director = rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:"));
  assert.ok(chairman.includes('"fees.structure.publish"'));
  assert.ok(!director.includes('"fees.structure.publish"'), "direct publication must not be granted to Directors");
  assert.ok(service.includes('action: "fee-structure.publish-direct"'));
  assert.ok(service.includes('actor.roles.includes("CHAIRMAN")'));
  assert.ok(routes.includes('"/fee-structures/:id/publish"'), "direct publication endpoint must be explicitly routed");
  assert.ok(api.includes('export async function publishFeeStructure'));
  assert.ok(finance.includes('can("fees.structure.publish")&&x.status==="DRAFT"'));
});

test("Chairman and Director have dedicated notice, notification and events routes", () => {
  for (const role of ["chairman", "director"]) {
    for (const section of ["notices", "notifications", "events-gallery"]) {
      assert.ok(existsSync(join(frontend, role, section, "page.tsx")), `missing dedicated ${role} route: ${section}`);
    }
  }
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.ok(!navigation.includes('label: "Institutional CMS"'));
  assert.ok(navigation.includes('href: "/chairman/events-gallery"'));
  assert.ok(navigation.includes('href: "/director/events-gallery"'));
});

test("Leadership workspace scope follows the resolved workspace role, not a secondary Director role", () => {
  const service = readFileSync(join(process.cwd(), "src/services/managementWorkspace.service.ts"), "utf8");
  assert.ok(service.includes('const isDirector = getWorkspaceType(actor) === "DIRECTOR"'));
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  assert.ok(feeService.includes('if (!actor.roles.includes("DIRECTOR") || actor.roles.includes("CHAIRMAN")) return;'));
});


test("Director Events & Gallery listing and mutations stay within assigned campus departments", () => {
  const service = readFileSync(join(process.cwd(), "src/services/events.service.ts"), "utf8");
  assert.ok(service.includes("getDirectorDepartmentIds"), "event service must resolve Director scope from CampusAccess");
  assert.ok(service.includes("function isDirectorScope"), "event scope must not depend on a secondary Director role when Chairman is active");
  assert.ok(service.includes("assertDirectorDepartment(institutionId, actor, input.departmentId)"), "Director-created events must be department-scoped");
  assert.ok(service.includes("assertDirectorEvent(institutionId, actor, existing.departmentId, existing.publicationStatus, true)"), "event updates must enforce the existing event's scope");
  assert.ok(service.includes("await assertDirectorEvent(institutionId, actor, media.event.departmentId, media.event.publicationStatus, true)"), "gallery media removal must enforce event scope");
  for (const role of ["chairman", "director"]) {
    const page = readFileSync(join(frontend, role, "events-gallery/page.tsx"), "utf8");
    assert.ok(page.includes(`workspaceBasePath="/${role}/events-gallery"`), `${role} event buttons must stay in the role-specific route tree`);
  }
});


test("Director notices and admissions enforce assigned campus scope at the service boundary", () => {
  const erp = readFileSync(join(process.cwd(), "src/services/erp.service.ts"), "utf8");
  const admissions = readFileSync(join(process.cwd(), "src/services/admission.service.ts"), "utf8");
  const admissionRoutes = readFileSync(join(process.cwd(), "src/routes/admission.routes.ts"), "utf8");
  assert.ok(erp.includes("assertDirectorNoticeDepartment"), "notice create/update/delete must validate Director department scope");
  assert.ok(erp.includes("const isDirectorWorkspace = roles.includes(\"DIRECTOR\") && !roles.includes(\"CHAIRMAN\")"), "notice listing must resolve Director workspace scope");
  assert.ok(admissions.includes("getDirectorDepartmentIds"), "admissions must derive Director scope from CampusAccess");
  assert.ok(admissions.includes("assertProgramScope(institutionId, actor, existing.programId)"), "status mutations must be scoped to the application program");
  assert.ok(admissionRoutes.includes("requireAuthenticatedUser(req),\n      pagination"), "admission list API must receive the authenticated actor for scoping");
  assert.ok(admissionRoutes.includes("service.getApplication(requireInstitution(req), requireAuthenticatedUser(req), req.params.id)"), "admission detail API must receive the authenticated actor for scoping");
});
