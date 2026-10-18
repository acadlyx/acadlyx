import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isDirectorScoped } from "../services/accessScope.service";

const frontend = join(process.cwd(), "../frontend/src/app");
const intelligenceServicePath = join(process.cwd(), "src/services/intelligence.service.ts");
const intelligenceControllerPath = join(process.cwd(), "src/controllers/intelligence.controller.ts");

test("Director scope is not applied when the actor also has institution-wide Chairman authority", () => {
  assert.equal(isDirectorScoped({ roles: ["DIRECTOR"] }), true);
  assert.equal(isDirectorScoped({ roles: ["CHAIRMAN", "DIRECTOR"] }), false);
  assert.equal(isDirectorScoped({ roles: ["CHAIRMAN"] }), false);
  assert.equal(isDirectorScoped({ roles: ["DIRECTOR", "INSTITUTION_ADMIN"] }), true);
});

test("Chairman legacy operations route redirects to the Chairman workspace", () => {
  const page = readFileSync(join(frontend, "chairman/operations/page.tsx"), "utf8");
  assert.ok(page.includes('redirect("/chairman")'), "legacy operations URL must redirect to the role-specific dashboard");
  assert.ok(!page.includes('from "@/app/operations/page"'), "Chairman must not alias the generic operations page");
  for (const route of ["/chairman/intelligence", "/chairman/fees/structures", "/chairman/fees", "/chairman/examinations", "/chairman/students", "/chairman/placements", "/chairman/reports"]) {
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Director legacy operations route redirects to the Director workspace", () => {
  const page = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  assert.ok(
    page.includes('redirect("/director")') || (page.includes('router.replace("/director")') && page.includes('useEffect') || page.includes('window.location.replace("/director")') && page.includes('useEffect')),
    "legacy operations URL must redirect to the role-specific dashboard while preserving the sessionStorage-backed browser session",
  );
  assert.ok(!page.includes('href: "/students"'), "legacy route must not expose unscoped global students");
  assert.ok(!page.includes('href: "/admissions"'), "legacy route must not expose unscoped global admissions");
  for (const route of ["/director/students", "/director/examinations", "/director/obe", "/director/fees", "/director/fee-approvals", "/director/placements", "/director/reports"]) {
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
  assert.match(navigation, /label: "Institutional CMS",[\s\S]*?href: "\/admin\/institutional-cms",[\s\S]*?roles: \["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"\],[\s\S]*?permissions: \["institutional-cms.read"\]/, "Institutional CMS must be restricted to authorized institutional roles");
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

test("Director fee approvals have a dedicated page and backend program/semester scope enforcement", () => {
  const page = readFileSync(join(frontend, "director/fee-approvals/page.tsx"), "utf8");
  const dashboard = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  const queue = readFileSync(join(frontend, "../components/accounts/FeeStructureApprovalQueue.tsx"), "utf8");
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");

  // Role enforcement belongs to the shared queue, which is used by Director
  // and Management with different scope contracts. Keep the role prop and
  // the component's effective-role/permission guard in sync.
  assert.ok(page.includes('role="DIRECTOR"'), "approval page must configure the shared queue for the Director workspace");
  assert.ok(page.includes('scope="campus"'), "Director approval page must be campus-scoped");
  assert.ok(page.includes("assigned campus scope"), "page must explain the campus boundary");
  assert.ok(queue.includes("allowedRoles={[role]}"), "the shared approval queue must bind its shell to the configured role");
  assert.ok(queue.includes("getPrimaryRole(user.roles) !== role"), "the shared queue must deny secondary-role access when the effective role differs");
  assert.ok(queue.includes('!user.permissions.includes("fees.structure.approve")'), "approvals require the explicit permission");
  assert.ok(queue.includes('!user.permissions.includes("fees.structure.read")'), "the queue also requires read permission");
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.ok(navigation.includes('href: "/director/fee-approvals"'), "Director may retain campus fee approval workflow in the sidebar");
  assert.ok(!dashboard.includes('["Campus fee approvals", "/director/fee-approvals"]'), "Director dashboard should not duplicate approval workflow shortcuts");
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.read"'));
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.approve"'));

  const structureScope = feeService.slice(
    feeService.indexOf("async function assertFeeStructureInActorScope"),
    feeService.indexOf("async function assertFeeStructureContextInActorScope"),
  );
  const contextScope = feeService.slice(
    feeService.indexOf("async function assertFeeStructureContextInActorScope"),
    feeService.indexOf("export async function listFeeStructures"),
  );
  assert.ok(feeService.includes("getAuthorizedDepartmentIds"), "shared scope resolver must derive departments from CampusAccess for Directors");
  assert.ok(structureScope.includes('fs."programId"') && structureScope.includes('fs."semesterId"'), "existing structures must be checked using either program or semester ownership");
  assert.ok(structureScope.includes('semester_program."departmentId"'), "semester-only structures must be resolved through their owning program");
  assert.ok(contextScope.includes('FROM "programs"'), "creation must check selected program scope");
  assert.ok(contextScope.includes('FROM "semesters" sem'), "creation must check selected semester scope");
  assert.ok(contextScope.includes("allowedDepartmentIds.includes"), "both program and semester must belong to allowed department scope");
  assert.ok(feeService.includes("assertFeeStructureInActorScope(institutionId, actor, structureId)"), "approval and rejection mutations must validate record scope");
});

test("Chairman and Director intelligence routes are separate and role-scoped", () => {
  const chairman = readFileSync(join(frontend, "chairman/intelligence/page.tsx"), "utf8");
  const director = readFileSync(join(frontend, "director/intelligence/page.tsx"), "utf8");
  const directorDashboard = readFileSync(join(process.cwd(), "../frontend/src/components/dashboard/DirectorDashboard.tsx"), "utf8");
  assert.ok(chairman.includes('allowedRoles={["CHAIRMAN"]}'));
  assert.ok(director.includes('allowedRoles={["DIRECTOR"]}'));
  assert.ok(!chairman.includes('from "@/app/intelligence/page"'), "Chairman must not alias the generic intelligence page");
  assert.ok(!director.includes('from "@/app/intelligence/page"'), "Director must not alias the generic intelligence page");
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.ok(navigation.includes('href: "/director/intelligence"'), "Director intelligence remains reachable from the scoped sidebar");
  assert.ok(!directorDashboard.includes('["Campus intelligence", "/director/intelligence"]'), "Director dashboard should not duplicate sidebar destinations");
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

test("Director and scoped academic examination queues enforce active workspace and target scope", () => {
  const service = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const listSessions = service.slice(service.indexOf("export async function listExamSessions("), service.indexOf("export async function getExamSession("));
  const listRevaluations = service.slice(service.indexOf("export async function listRevaluationRequests("), service.indexOf("export async function decideRevaluation("));
  const listIncidents = service.slice(service.indexOf("export async function listExamIncidents("), service.indexOf("export async function decideExamIncident("));
  const listCorrections = service.slice(service.indexOf("export async function listExamMarkCorrectionRequests("));

  assert.ok(listSessions.includes("assertExamReadWorkspace(actor)"), "session list must resolve an active examination-capable workspace");
  assert.ok(listSessions.includes('workspace === "DIRECTOR"'), "Director session visibility must be explicit");
  assert.ok(listSessions.includes("getDirectorCampusIds(institutionId, actor.id)"), "Director session scope must use CampusAccess");
  assert.ok(listSessions.includes('outside_program."departmentId" NOT IN'), "a mixed-scope session must not leak schedules from other departments");
  assert.ok(listRevaluations.includes("assertExamReadWorkspace(actor)"), "revaluation lists must resolve the active workspace");
  assert.ok(listRevaluations.includes('["DIRECTOR","DEAN","HOD"].includes(workspace)'), "academic leads need scoped review queues");
  assert.ok(listRevaluations.includes("getDirectorDepartmentIds(institutionId,actor.id)"), "Director revaluation queue must derive assigned departments");
  assert.ok(listRevaluations.includes('JOIN "programs" scoped_program'), "revaluation rows must be scoped through offering -> semester -> program");
  assert.ok(listIncidents.includes("assertExamReadWorkspace(actor)"), "incident queue must not trust a secondary examination permission");
  assert.ok(listIncidents.includes('["DIRECTOR", "DEAN", "HOD"].includes(workspace)'), "leadership incident queue must use active role scope");
  assert.ok(listIncidents.includes("scoped_program.\"departmentId\" IN"), "incident visibility must be tied to assigned academic departments");
  assert.ok(listCorrections.includes("assertExamApprover(actor)"), "correction queue must require the configured examination approval role");
  assert.ok(listCorrections.includes("getDirectorDepartmentIds"), "Director correction queue must derive CampusAccess scope");
  assert.ok(listCorrections.includes('JOIN "programs"'), "correction queue must filter via the course offering's program");
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
  assert.ok(chairmanOperations.includes('redirect("/chairman")'), "legacy Chairman operations URL redirects to its workspace");
  assert.ok(directorOperations.includes('redirect("/director")') || (directorOperations.includes('router.replace("/director")') && directorOperations.includes("useEffect") || directorOperations.includes('window.location.replace("/director")') && directorOperations.includes("useEffect")), "legacy Director operations URL redirects to its workspace without losing the browser session");
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.ok(navigation.includes('href: "/chairman/examinations/operations"'), "Chairman exam operations remain reachable from the sidebar");
  assert.ok(navigation.includes('href: "/director/examinations/operations"'), "Director exam operations remain reachable from the sidebar");
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


test("Student list and profile queries combine requested filters with server-derived enrollment scope", () => {
  const service = readFileSync(join(process.cwd(), "src/services/studentAdmin.service.ts"), "utf8");
  const listStart = service.indexOf("export async function listStudents(");
  const listEnd = service.indexOf("export async function getStudent(", listStart);
  const list = service.slice(listStart, listEnd);
  const profileStart = service.indexOf("export async function getStudent(");
  const profileEnd = service.indexOf("export async function createStudent(", profileStart);
  const profile = service.slice(profileStart, profileEnd);

  assert.ok(list.includes("getStudentWhereScope(institutionId, actor)"), "list must derive scope from the canonical helper");
  assert.ok(list.includes("const serverEnrollmentPredicate"), "server enrollment scope must be preserved");
  assert.ok(list.includes("enrollmentPredicates.push(serverEnrollmentPredicate)"), "server scope must be combined with user filters");
  assert.ok(list.includes("where: { AND: enrollmentPredicates }"), "included enrollment rows must be filtered by all scope predicates");
  assert.ok(list.includes("studentEnrollments: { some: { AND: enrollmentPredicates } }"), "the list itself must not be widened by query filters");
  assert.ok(list.includes("include: scopedStudentListInclude"));
  assert.ok(profile.includes("await assertStudentReadAccess(institutionId, userId, actor)"), "profile reads must authorize the target student");
  assert.ok(profile.includes("await getStudentWhereScope(institutionId, actor)"), "profile nested enrollment history must use the same resolved scope");
  assert.ok(profile.includes("AND: [enrollmentScope]"), "profile must hide enrollment history outside the allowed scope");
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


test("Examination reads and decisions derive campus scope through assigned departments and offerings", () => {
  const exams = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const readStart = exams.indexOf("async function assertCanReadSchedule(");
  const readEnd = exams.indexOf("async function assertCanActOnSchedule(", readStart);
  const directorReadScope = exams.slice(readStart, readEnd);
  assert.ok(directorReadScope.includes('activeRole === "DIRECTOR"'));
  assert.ok(directorReadScope.includes("getDirectorDepartmentIds(institutionId, actor.id)"));
  assert.ok(directorReadScope.includes("program: { institutionId, departmentId: { in: ids } }"));

  const sessions = exams.slice(exams.indexOf("export async function listExamSessions("), exams.indexOf("export async function getExamSession("));
  assert.ok(sessions.includes("assertExamReadWorkspace(actor)"));
  assert.ok(sessions.includes('outside_program."departmentId" NOT IN'));
  assert.ok(sessions.includes('scoped_program."departmentId" IN'));

  const revaluations = exams.slice(exams.indexOf("export async function listRevaluationRequests("), exams.indexOf("export async function decideRevaluation("));
  assert.ok(revaluations.includes('["DIRECTOR","DEAN","HOD"].includes(workspace)'));
  assert.ok(revaluations.includes('JOIN "programs" scoped_program'));

  const incidents = exams.slice(exams.indexOf("export async function listExamIncidents("), exams.indexOf("export async function decideExamIncident("));
  assert.ok(incidents.includes("assertExamReadWorkspace(actor)"));
  assert.ok(incidents.includes('JOIN "programs" scoped_program'));
  assert.ok(incidents.includes('scoped_program."departmentId" IN'));

  const corrections = exams.slice(exams.indexOf("export async function listExamMarkCorrectionRequests("));
  assert.ok(corrections.includes("assertExamApprover(actor)"));
  assert.ok(corrections.includes("getDirectorDepartmentIds"));
  assert.ok(corrections.includes('JOIN "programs"'));
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


test("Admin create and edit forms expose role-appropriate persistent scope assignments", () => {
  const manager = readFileSync(join(frontend, "../components/admin/AdminPeopleManager.tsx"), "utf8");
  const editPage = readFileSync(join(frontend, "admin/users/[userId]/edit/page.tsx"), "utf8");
  const userService = readFileSync(join(process.cwd(), "src/services/user.service.ts"), "utf8");
  for (const role of ["DIRECTOR", "CHAIRMAN", "HOD"]) {
    assert.ok(manager.includes(`createRole === "${role}"`) || manager.includes(`(editRole || selected.roles[0]?.name) === "${role}"`), `modal form must show ${role} scope guidance`);
    assert.ok(editPage.includes(`selectedRole === "${role}"`), `direct edit form must expose ${role} scope behavior`);
  }
  assert.ok(editPage.includes('name="campusIds"'), "Director edit must persist selected campus assignments");
  assert.ok(editPage.includes('name="departmentId"'), "HOD edit must persist its department assignment");
  assert.ok(editPage.includes("role,") && editPage.includes("departmentIds,") && editPage.includes("campusIds,"), "edit payload must persist role and scope together");
  assert.ok(editPage.includes("Saving removes Director campus and HOD department assignments"), "changing roles must explain scope cleanup");
  assert.ok(userService.includes("await syncCampusAccess(tx, id, existing.institutionId, resolvedTargetRoleName, input.campusIds)"));
  assert.ok(userService.includes("await syncDepartmentAccess("), "scope changes must pass through backend validation and transactional persistence");
});

test("Chairman can publish fee drafts directly with active-role permission and audit", () => {
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
  assert.ok(service.includes('getEffectiveWorkspaceRole(actor) !== "CHAIRMAN"'), "a secondary Chairman binding must not authorize direct publication");
  assert.ok(service.includes('!actor.permissions.includes("fees.structure.publish")'), "direct publication also requires the explicit permission");
  assert.ok(routes.includes('"/fee-structures/:id/publish"'), "direct publication endpoint must be explicitly routed");
  assert.ok(api.includes("export async function publishFeeStructure"));
  assert.ok(finance.includes('can("fees.structure.publish")&&x.status==="DRAFT"'));
  assert.ok(finance.includes("chairmanDirectPublishOnly"), "Chairman finance actions must use the direct-publish workflow");
  assert.ok(finance.includes('!chairmanDirectPublishOnly&&can("fees.structure.manage")'), "Chairman must never fall back to a separate approval submission");
});

test("Chairman and Director have dedicated notice, notification and events routes", () => {
  for (const role of ["chairman", "director"]) {
    for (const section of ["notices", "notifications", "events-gallery"]) {
      assert.ok(existsSync(join(frontend, role, section, "page.tsx")), `missing dedicated ${role} route: ${section}`);
    }
  }
  const navigation = readFileSync(join(frontend, "../lib/navigation.ts"), "utf8");
  assert.match(navigation, /label: "Institutional CMS",[\s\S]*?href: "\/admin\/institutional-cms",[\s\S]*?roles: \["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"\],[\s\S]*?permissions: \["institutional-cms.read"\]/, "Institutional CMS must be restricted to authorized institutional roles");
  assert.ok(navigation.includes('href: "/chairman/events-gallery"'));
  assert.ok(navigation.includes('href: "/director/events-gallery"'));
});

test("Leadership and fee structure scope follow the resolved workspace role, not secondary bindings", () => {
  const service = readFileSync(join(process.cwd(), "src/services/managementWorkspace.service.ts"), "utf8");
  assert.ok(service.includes("return getEffectiveWorkspaceRole(actor)"), "leadership selection must use the central effective-role resolver");
  assert.ok(service.includes('const isDirector = workspaceType === "DIRECTOR"'), "the workspace must branch on the resolved role");
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  assert.ok(feeService.includes("assertFeeStructureInActorScope"), "fee structure record access must use the common resource-scope guard");
  assert.ok(feeService.includes("getAuthorizedDepartmentIds"), "fee structure scope must resolve campus/department assignments on the backend");
  assert.ok(feeService.includes("getEffectiveWorkspaceRole(actor) !== \"CHAIRMAN\""), "secondary Chairman bindings must not bypass the direct-publication guard");
});

test("Chairman institution-wide role wins over secondary Director bindings in leadership data paths", () => {
  const accessScope = readFileSync(join(process.cwd(), "src/services/accessScope.service.ts"), "utf8");
  const finance = readFileSync(join(process.cwd(), "src/services/finance.service.ts"), "utf8");
  const students = readFileSync(join(process.cwd(), "src/services/studentAdmin.service.ts"), "utf8");
  const exams = readFileSync(join(process.cwd(), "src/services/examination.service.ts"), "utf8");
  const attendance = readFileSync(join(process.cwd(), "src/services/attendanceReport.service.ts"), "utf8");
  const attendanceSessions = readFileSync(join(process.cwd(), "src/services/attendanceSession.service.ts"), "utf8");
  const intelligence = readFileSync(join(process.cwd(), "src/controllers/intelligence.controller.ts"), "utf8");
  const exports = readFileSync(join(process.cwd(), "src/services/export.service.ts"), "utf8");
  const calendar = readFileSync(join(process.cwd(), "src/services/calendar.service.ts"), "utf8");
  const directorCalendar = readFileSync(join(frontend, "director/calendar/page.tsx"), "utf8");

  assert.ok(accessScope.includes('hasAnyRole(actor, ["DIRECTOR"]) && !hasAnyRole(actor, ["CHAIRMAN"])'), "Chairman must be the only role that overrides Director campus scope");
  assert.ok(accessScope.includes("EFFECTIVE_WORKSPACE_ROLE_PRIORITY") && accessScope.includes("getEffectiveWorkspaceRole"), "cross-module scope must use the canonical workspace priority");
  assert.ok(finance.includes("isDirectorScoped(a)") && finance.includes("getDirectorCampusIds(institutionId,a.id)"), "finance must use active Director campus scope");
  assert.ok(students.includes("getStudentWhereScope(institutionId, actor)"), "student lists must derive scope through the shared resolver");
  assert.ok(students.includes("const scopedStudentListInclude: Prisma.UserInclude"), "nested student enrollment output must be filtered by server scope");
  assert.ok(students.includes("include: scopedStudentListInclude"), "the constrained relation include must be used by the student list");
  assert.ok(students.includes("if (actor && isDirectorScoped(actor))") || students.includes("await assertStudentReadAccess(institutionId, userId, actor)"), "student profile reads must retain resource-level scope");
  assert.ok(exams.includes("getEffectiveWorkspaceRole(actor)") && exams.includes('activeRole === "DIRECTOR"'), "examination reads must use the active role");
  assert.ok(exams.includes("getDirectorDepartmentIds(institutionId, actor.id)"), "examination queues must derive departments from CampusAccess");
  assert.ok(attendance.includes("return isDirectorScoped(actor)"), "attendance reports must preserve role precedence");
  assert.ok(attendanceSessions.includes("if (isInstitutionWide(user) && !isDirectorScoped(user))"), "attendance session listing must not make Director institution-wide");
  assert.ok(attendanceSessions.includes('semester: { program: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } } }'), "attendance history must be filtered to assigned-campus departments");
  assert.ok(intelligence.includes("if (isInstitutionWide(actor)) return undefined;"), "only a resolved institution-wide role may use unscoped intelligence");
  assert.ok(intelligence.includes("getAuthorizedDepartmentIds(institutionId, actor)"), "intelligence filters must use the canonical scope resolver");
  assert.ok(exports.includes("const institutionWide = isInstitutionWide(actor)"), "exports must use the central role precedence");
  assert.ok(exports.includes("isDirectorScoped(actor)"), "a Director export must retain campus scope despite secondary broad roles");
  assert.ok(calendar.includes("assertCalendarCampusScopeSupported(actor)"), "unscoped institution calendar APIs must reject Director access");
  assert.ok(directorCalendar.includes('href="/director/events-gallery"') && !directorCalendar.includes("DataExportActions"), "Director calendar must route to campus-scoped event management without an unscoped export button");
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
  assert.ok(erp.includes("assertNoticeDepartmentScope"), "notice create/update/delete must validate the active workspace's department scope");
  assert.ok(erp.includes('const isDirectorWorkspace = !institutionWide && activeRole === "DIRECTOR" && isDirectorScoped(actor)'), "notice listing must resolve Director scope from the effective workspace");
  assert.ok(admissions.includes("getDirectorDepartmentIds"), "admissions must derive Director scope from CampusAccess");
  assert.ok(admissions.includes("assertProgramScope(institutionId, actor, existing.programId)"), "status mutations must be scoped to the application program");
  assert.ok(admissions.includes('getEffectiveWorkspaceRole(actor) === "DIRECTOR"'), "a secondary Director role must not override a different active workspace");
  assert.ok(admissionRoutes.includes("requireAuthenticatedUser(req),\n      pagination"), "admission list API must receive the authenticated actor for scoping");
  assert.ok(admissionRoutes.includes("service.getApplication(requireInstitution(req), requireAuthenticatedUser(req), req.params.id)"), "admission detail API must receive the authenticated actor for scoping");
});
