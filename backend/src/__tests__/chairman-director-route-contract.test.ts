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
    "/chairman/fee-approvals",
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
    "/director/imports",
  ]) {
    assert.ok(page.includes(`href: "${route}"`), `expected dedicated Director destination: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Executive dashboard shortcuts stay in the correct workspace", () => {
  const chairman = readFileSync(join(frontend, "../components/dashboard/ChairmanDashboard.tsx"), "utf8");
  const director = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  for (const route of ["/chairman/intelligence", "/chairman/reports", "/chairman/fees", "/chairman/examinations", "/chairman/fee-approvals"]) {
    assert.ok(chairman.includes(route), `Chairman dashboard should link to ${route}`);
  }
  for (const route of ["/director/operations", "/director/students", "/director/fees", "/director/placements"]) {
    assert.ok(director.includes(route), `Director dashboard should link to ${route}`);
  }
  assert.ok(!director.includes('["Campus students","/students"]'), "Director shortcut must not route to the global student page");
  assert.ok(!director.includes('["Admissions","/admissions"]'), "Director shortcut must not route to global admissions");
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

test("Chairman fee approval UI prevents duplicate mutations and avoids raw API errors", () => {
  const page = readFileSync(join(frontend, "chairman/fee-approvals/page.tsx"), "utf8");
  assert.ok(page.includes("const [busyId, setBusyId] = useState<string | null>(null)"));
  assert.ok(page.includes("if (busyId) return;"), "approval handlers must ignore duplicate actions while busy");
  assert.ok(page.includes("disabled={busyId !== null || loading}"), "approval controls must be disabled while processing");
  assert.ok(page.includes("reason.trim().length < 3"), "rejection must validate a meaningful reason in the UI");
  assert.ok(page.includes("catch { setError("), "API failures must use controlled user-facing messages");
  assert.ok(!page.includes("setError(e instanceof Error ? e.message"), "raw API exception messages must not be displayed");
  assert.ok(page.includes('allowedRoles={["CHAIRMAN"]}'), "fee approval page must retain Chairman role boundary");
});


test("Director fee approvals have a dedicated page and backend campus-scope enforcement", () => {
  const page = readFileSync(join(frontend, "director/fee-approvals/page.tsx"), "utf8");
  const operations = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  const dashboard = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");

  assert.ok(page.includes('allowedRoles={["DIRECTOR"]}'), "approval page must be Director-only");
  assert.ok(page.includes("assigned campus scope"), "page must explain the campus boundary");
  assert.ok(operations.includes('href: "/director/fee-approvals"'), "operations page must link to the dedicated approval page");
  assert.ok(dashboard.includes('["Campus fee approvals", "/director/fee-approvals"]'), "dashboard must link to the dedicated approval page");
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.read"'));
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.approve"'));
  assert.ok(feeService.includes("getDirectorDepartmentIds"), "fee service must derive Director scope from server-side campus assignments");
  assert.ok(feeService.includes('fs."programId" IN ('), "Director fee listing must be filtered to programs in assigned campus departments");
  assert.ok(feeService.includes('semester_program."departmentId"'), "semester-only fee structures must be resolved through their owning program");
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
  assert.ok(directorDashboard.includes('["Campus intelligence", "/director/intelligence"]'));
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
  assert.ok(chairmanFees.includes("listFeeStructures"), "Chairman finance view must use canonical fee structure data");
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
