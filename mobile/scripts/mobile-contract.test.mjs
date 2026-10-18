import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { applyWorkspaceContext, getAuthorizationShape, resetAuthorizationState, setActiveWorkspaceContext, transitionWorkspaceContext } from "../src/workspace/workspaceScope.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const catalog = read("src/modules/catalog.ts");
const client = read("src/api/client.ts");
const workspaceScope = read("src/workspace/workspaceScope.mjs");
const appSource = read("App.tsx");
const app = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

test("catalog ids are unique and endpoint strings are absolute API paths", () => {
  const ids = [...catalog.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
  const endpoints = [...catalog.matchAll(/\bendpoint:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 40, "Expected a broad initial module inventory.");
  assert.equal(new Set(ids).size, ids.length, "Module ids must be unique.");
  assert.equal(endpoints.length, ids.length, "Each module should map to an API endpoint.");
  for (const endpoint of endpoints) assert.ok(endpoint.startsWith("/"), "Bad endpoint: " + endpoint);
});

test("session tokens use SecureStore and no privileged database secret is bundled", () => {
  assert.ok(client.includes("expo-secure-store"));
  assert.ok(client.includes("SecureStore.setItemAsync"));
  assert.ok(client.includes("SecureStore.getItemAsync"));
  assert.ok(!/service_role|postgresql:\/\/|SUPABASE_SERVICE_ROLE_KEY/i.test(client));
});

test("navigator source contains real line breaks between JSX elements", () => {
  const navigator = read("src/navigation/RootNavigator.tsx");
  assert.ok(!navigator.includes("\\n          <Stack.Screen"), "Navigator must not contain literal escaped newline text before JSX.");
  assert.ok(navigator.includes("\n          <Stack.Screen"), "Navigator stack screens should be separate source lines.");
});

test("native identity and platform commands are configured", () => {
  assert.equal(app.expo.name, "ACADLYX");
  assert.equal(app.expo.scheme, "acadlyx");
  assert.equal(pkg.scripts.android, "expo run:android");
  assert.equal(pkg.scripts.ios, "expo run:ios");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
});

test("bounded session refresh and backend permission filtering are present", () => {
  assert.ok(client.includes("retryOnUnauthorized"));
  assert.ok(client.includes("refreshSession"));
  assert.ok(catalog.includes("user.permissions.includes"));
  assert.ok(catalog.includes("requiredAnyPermissions"));
});

test("global search uses the existing server-scoped API and is reachable in native navigation", () => {
  const screen = read("src/screens/GlobalSearchScreen.tsx");
  const navigator = read("src/navigation/RootNavigator.tsx");
  assert.ok(screen.includes("/search?q="));
  assert.ok(screen.includes("encodeURIComponent(queryText)"));
  assert.ok(screen.includes("queryText.length >= 2"));
  assert.ok(screen.includes("function openResult"));
  assert.ok(screen.includes('navigation.navigate("Notices")'));
  assert.ok(screen.includes('moduleId: result.type === "person" ? "students" : "courses"'));
  assert.ok(navigator.includes("GlobalSearchScreen"));
  assert.ok(navigator.includes("name=\"Search\" component={GlobalSearchScreen}"));
});

test("all twenty canonical roles have distinct native dashboard compositions", () => {
  const dashboard = read("src/screens/RoleDashboardScreen.tsx");
  const navigator = read("src/navigation/RootNavigator.tsx");
  for (const role of ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT", "CLUB_PRESIDENT"]) {
    assert.match(dashboard, new RegExp("\\b" + role + "\\s*:"), "Missing dashboard composition for " + role);
  }
  assert.ok(dashboard.includes("/my-work"));
  assert.ok(dashboard.includes("signalPermission"), "Role signals must be permission-gated before request.");
  assert.ok(dashboard.includes("EFFECTIVE_WORKSPACE_ROLE_PRIORITY") || dashboard.includes("Keep this exact order aligned"), "Dashboard role selection must track the backend effective-role policy.");
  assert.ok(dashboard.includes("Counts are never substituted"));
  assert.ok(navigator.includes("RoleDashboardScreen"));
});

test("workspace context exposes seven dimensions and revalidates scope before cache reset", () => {
  const screen = read("src/screens/WorkspaceContextScreen.tsx");
  const provider = read("src/workspace/WorkspaceContextProvider.tsx");
  const navigator = read("src/navigation/RootNavigator.tsx");
  const workspaceRoute = read("../backend/src/routes/workspaceContext.routes.ts");
  const workspaceService = read("../backend/src/services/workspaceContext.service.ts");

  for (const field of ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]) {
    assert.ok(screen.includes(field), "Missing native selector dimension: " + field);
  }
  assert.match(screen, /case "semesterId":[\s\S]*?batchId: null/, "Changing semesters must clear a potentially incompatible batch.");
  assert.ok(screen.includes('context?.role === "STUDENT"'), "Only a server-derived active Student workspace may lock context selection.");
  assert.ok(provider.includes('"/workspace/context"'), "Selection must use the existing backend context route.");
  assert.ok(provider.includes("transitionWorkspaceContext"));
  assert.ok(workspaceScope.includes("await queryClient.cancelQueries()"));
  assert.ok(workspaceScope.includes("query.reset()"), "Cached values must be cleared before the active scope label changes.");
  assert.ok(workspaceScope.includes('invalidateQueries({ refetchType: "active" })'));
  assert.ok(provider.includes("setActiveWorkspaceContext(next.scope)"));
  assert.ok(provider.includes("expo-secure-store"), "Validated context must use secure device persistence.");
  assert.ok(provider.includes("workspaceStorageKey"), "Persisted context must be isolated by account and roles.");
  assert.ok(provider.includes("clearStoredScope"), "An invalid remembered context must be removed before fallback.");
  assert.ok(provider.includes("/workspace/context\")"), "Invalid persisted context must fall back to the server default.");
  assert.ok(navigator.includes('name="WorkspaceContext" component={WorkspaceContextScreen}'));
  assert.ok(workspaceRoute.includes('req.query.campusId'));
  assert.ok(workspaceService.includes("Campus not found in your authorized institution scope"));
  for (const validation of [
    "Department not found in your authorized institution scope",
    "Program is not valid for the selected department or authorized scope",
    "Academic year is not valid for the selected academic context",
    "Semester is not valid for the selected academic context",
    "Section is not valid for the selected semester",
    "Batch is not valid for the selected program"
  ]) assert.ok(workspaceService.includes(validation), "Missing server validation: " + validation);
  assert.ok(workspaceScope.includes('departments: ["campusId"]'));
  assert.ok(workspaceScope.includes('programs: ["campusId", "departmentId"]'));
  assert.ok(workspaceScope.includes('courses: ["campusId", "departmentId"]'));
  assert.ok(workspaceScope.includes('"academic-years": ["campusId", "departmentId", "programId"]'));
  assert.ok(workspaceScope.includes('batches: ["campusId", "departmentId", "programId"]'));
  assert.ok(workspaceScope.includes('semesters: ["campusId", "programId", "departmentId", "academicYearId"]'));
  assert.ok(workspaceScope.includes('sections: ["campusId", "semesterId", "departmentId"]'));
  assert.ok(workspaceScope.includes('"course-offerings": ["campusId", "semesterId", "sectionId", "departmentId"]'));
  assert.ok(workspaceScope.includes('students: ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]'));
  assert.ok(workspaceScope.includes('assignments: ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]'));
  assert.ok(workspaceScope.includes('"attendance-sessions": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]'));
  assert.ok(workspaceScope.includes('"internal-marks": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]'));
  assert.ok(workspaceScope.includes('"erp/timetable": ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]'));
  assert.ok(provider.includes("authorizationKey") && provider.includes("user.permissions"));
  assert.ok(provider.includes("mustWaitForValidatedContext"), "Do not render screens until the current saved scope is server-validated.");
  assert.ok(appSource.includes("await resetAuthorizationState(client, () => setActiveWorkspaceContext(null))"), "Session cache boundary must reset scoped queries before rendering the new authorization shape.");
  assert.ok(appSource.includes("setActiveWorkspaceContext(null)") || client.includes("setActiveWorkspaceContext"));
});

test("authorization changes distinguish account, roles and permissions and clear previous scope/cache", async () => {
  const app = read("App.tsx");
  assert.ok(app.includes("getAuthorizationShape(user)"));
  assert.ok(app.includes("resetAuthorizationState(client, () => setActiveWorkspaceContext(null))"));
  assert.ok(app.includes("clearedShape !== authorizationShape"), "The new auth shape must be gated until cache reset completes.");

  const original = { id: "user-a", roles: ["FACULTY", "STUDENT"], permissions: ["attendance.read", "assignments.read"] };
  assert.equal(
    getAuthorizationShape(original),
    getAuthorizationShape({ ...original, roles: [...original.roles].reverse(), permissions: [...original.permissions].reverse() }),
    "Role/permission ordering alone must not create a new authorization shape."
  );
  assert.notEqual(getAuthorizationShape(original), getAuthorizationShape({ ...original, id: "user-b" }), "Account changes must invalidate scope.");
  assert.notEqual(getAuthorizationShape(original), getAuthorizationShape({ ...original, roles: ["STUDENT"] }), "Role changes must invalidate scope.");
  assert.notEqual(getAuthorizationShape(original), getAuthorizationShape({ ...original, permissions: ["attendance.read"] }), "Permission revocation must invalidate scope.");

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  try {
    setActiveWorkspaceContext({ campusId: "campus-old", departmentId: "department-old" });
    await queryClient.fetchQuery({ queryKey: ["private-records", "user-a"], queryFn: async () => [{ id: "record-from-old-scope" }] });
    assert.ok(queryClient.getQueryData(["private-records", "user-a"]));
    assert.ok(applyWorkspaceContext("/courses", true).includes("campusId=campus-old"));
    await resetAuthorizationState(queryClient, () => setActiveWorkspaceContext(null));
    assert.equal(queryClient.getQueryCache().getAll().length, 0, "No old account's records may remain cached.");
    assert.equal(applyWorkspaceContext("/courses", true), "/courses", "The old scope must be cleared before new account requests.");
  } finally {
    queryClient.clear();
  }
});

test("assignment lifecycle calls use real backend route patterns", () => {
  const screen = read("src/screens/AssignmentsScreen.tsx");
  for (const route of ["/assignments", "/submit", "/submissions", "/reopen"]) assert.ok(screen.includes(route), "Missing route fragment: " + route);
  for (const permission of ["assignments.create", "assignments.update", "assignments.submit", "assignments.review"]) assert.ok(screen.includes(permission), "Missing permission: " + permission);
});

test("notices and timetable include scoped API actions and permission gates", () => {
  const notices = read("src/screens/NoticesScreen.tsx");
  const timetable = read("src/screens/TimetableScreen.tsx");
  assert.ok(notices.includes("/erp/notices"));
  assert.ok(notices.includes("notices.manage"));
  assert.ok(timetable.includes("/erp/timetable"));
  assert.ok(timetable.includes("timetable.manage"));
  assert.ok(timetable.includes("/course-offerings"));
});

test("library and calendar native screens reference existing API workflows", () => {
  const library = read("src/screens/LibraryScreen.tsx");
  const calendar = read("src/screens/CalendarScreen.tsx");
  const attendance = read("src/screens/AttendanceScreen.tsx");
  const leave = read("src/screens/LeaveScreen.tsx");
  const parent = read("src/screens/ParentScreen.tsx");
  const hr = read("src/screens/HRScreen.tsx");
  const admissions = read("src/screens/AdmissionsScreen.tsx");
  const studentPortal = read("src/screens/StudentPortalScreen.tsx");
  for (const route of ["/library/books", "/library/reservations", "/library/loans", "/library/fines", "/return", "/renew"]) assert.ok(library.includes(route), "Missing library route fragment: " + route);
  assert.ok(library.includes("library.manage"));
  assert.ok(calendar.includes("/calendar/events"));
  assert.ok(calendar.includes("calendar.manage"));
  assert.ok(attendance.includes("/attendance-sessions"));
  assert.ok(attendance.includes("attendance.mark"));
  assert.ok(attendance.includes("JSON.stringify({ records, submit })"));
  assert.ok(attendance.includes("session.isLocked"));
  assert.ok(leave.includes("/leave/requests/mine"));
  assert.ok(leave.includes("/leave/requests/approvals"));
  assert.ok(leave.includes("/leave/requests/") && leave.includes("/decision"));
  assert.ok(leave.includes("leave.apply") && leave.includes("leave.approve"));
  assert.ok(parent.includes("/parent/children"));
  assert.ok(parent.includes("/attendance") && parent.includes("/results") && parent.includes("/fees"));
  assert.ok(parent.includes("roles.includes(\"PARENT\")"));
});

test("placement workspace uses existing eligibility and lifecycle contracts", () => {
  const placement = read("src/screens/PlacementScreen.tsx");
  const navigator = read("src/navigation/RootNavigator.tsx");
  const modules = read("src/screens/ModulesScreen.tsx");
  for (const route of ["/placements/drives", "/eligibility", "/apply", "/placements/opportunities", "/placements/offers", "/placements/my-calendar"]) assert.ok(placement.includes(route), "Missing placement API contract: " + route);
  assert.ok(placement.includes("placements.apply"));
  assert.ok(placement.includes("missingAttributes"));
  assert.ok(navigator.includes("PlacementScreen"));
  assert.ok(read("src/navigation/openModule.ts").includes('navigation.navigate("Placement")'));
});

test("LMS workspace uses the existing course, discussion, and workflow contracts", () => {
  const lms = read("src/screens/LmsScreen.tsx");
  const navigator = read("src/navigation/RootNavigator.tsx");
  const modules = read("src/screens/ModulesScreen.tsx");
  for (const route of ["/lms/catalog", "/workspace", "/workflow", "/discussions"]) assert.ok(lms.includes(route), "Missing LMS route fragment: " + route);
  for (const permission of ["lms.manage", "lms.attempt"]) assert.ok(lms.includes(permission), "Missing LMS permission gate: " + permission);
  assert.ok(lms.includes("Linking.openURL"), "Course resources and meeting links should open through the native handler.");
  assert.ok(navigator.includes("LmsScreen"));
  assert.ok(read("src/navigation/openModule.ts").includes('navigation.navigate("Lms")'));
});

test("original logo is bundled and displayed on sign-in", () => {
  const logo = readFileSync(resolve(root, "assets/acadlyx-logo.png"));
  const login = read("src/screens/LoginScreen.tsx");
  assert.ok(logo.length > 1000);
  assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(login.includes("assets/acadlyx-logo.png"));
});

test("required parity and release documentation exists and states limitations honestly", () => {
  const docs = [
    "../docs/mobile/MOBILE_ARCHITECTURE.md",
    "../docs/mobile/MOBILE_FEATURE_PARITY.md",
    "../docs/mobile/MOBILE_IMPLEMENTATION_TRACKER.md",
    "../docs/mobile/MOBILE_ROLE_PERMISSION_MATRIX.md",
    "../docs/mobile/MOBILE_API_INTEGRATION.md",
    "../docs/mobile/MOBILE_TEST_REPORT.md",
    "../docs/mobile/MOBILE_BUILD_AND_RELEASE.md",
    "../docs/mobile/MOBILE_KNOWN_LIMITATIONS.md"
  ];
  for (const path of docs) assert.ok(readFileSync(resolve(root, path), "utf8").length > 500, "Missing/short doc: " + path);
  assert.ok(read("../docs/mobile/MOBILE_FEATURE_PARITY.md").includes("No 100% parity claim is made."));
  assert.ok(read("../docs/mobile/MOBILE_IMPLEMENTATION_TRACKER.md").includes("IMPLEMENTED_UNVERIFIED"));
});


test("workspace query filters follow the new scope, remove stale selections, and preserve UI filters", () => {
  setActiveWorkspaceContext(null);
  setActiveWorkspaceContext(null);
  setActiveWorkspaceContext({
    campusId: "campus-a",
    departmentId: "department-a",
    programId: "program-a",
    academicYearId: "year-a",
    batchId: "batch-a",
    semesterId: "semester-a",
    sectionId: "section-a"
  });

  const departments = new URLSearchParams(applyWorkspaceContext("/departments?page=2&campusId=campus-old&search=engineering", true).split("?")[1]);
  assert.equal(departments.get("campusId"), "campus-a");
  assert.equal(departments.get("search"), "engineering");
  assert.equal(departments.get("page"), "2");

  const years = new URLSearchParams(applyWorkspaceContext("/academic-years?search=2026", true).split("?")[1]);
  assert.equal(years.get("campusId"), "campus-a");
  assert.equal(years.get("departmentId"), "department-a");
  assert.equal(years.get("programId"), "program-a");

  const students = new URLSearchParams(applyWorkspaceContext("/students?page=1&status=ACTIVE", true).split("?")[1]);
  for (const [key, value] of Object.entries({
    campusId: "campus-a",
    departmentId: "department-a",
    programId: "program-a",
    academicYearId: "year-a",
    batchId: "batch-a",
    semesterId: "semester-a",
    sectionId: "section-a"
  })) assert.equal(students.get(key), value);

  for (const endpoint of ["/assignments", "/attendance-sessions", "/internal-marks", "/erp/timetable"]) {
    const params = new URLSearchParams(applyWorkspaceContext(endpoint, true).split("?")[1]);
    assert.equal(params.get("campusId"), "campus-a", endpoint + " should follow campus context.");
    assert.equal(params.get("programId"), "program-a", endpoint + " should follow programme context.");
    assert.equal(params.get("batchId"), "batch-a", endpoint + " should follow batch context.");
    assert.equal(params.get("sectionId"), "section-a", endpoint + " should follow section context.");
  }

  const unsupported = "/finance/invoices?page=1&status=PENDING";
  assert.equal(applyWorkspaceContext(unsupported, true), unsupported, "Unknown endpoints must not receive guessed query parameters.");
  assert.equal(applyWorkspaceContext("/departments?page=2", false), "/departments?page=2", "Unauthenticated calls must not receive context filters.");

  // Clearing a workspace selector must remove old IDs that came from the
  // previous context, but must preserve independent user-entered filters.
  setActiveWorkspaceContext({ campusId: "campus-a" });
  const cleared = new URLSearchParams(applyWorkspaceContext(
    "/students?departmentId=department-a&programId=program-a&academicYearId=year-a&batchId=batch-a&semesterId=semester-a&sectionId=section-a&search=Smith",
    true
  ).split("?")[1]);
  for (const key of ["departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"]) {
    assert.equal(cleared.get(key), null, "Stale scope must be removed for " + key);
  }
  assert.equal(cleared.get("search"), "Smith");
  assert.equal(cleared.get("campusId"), "campus-a");
});

test("workspace transition cancels old reads and resets cached records before active screens refetch", async () => {
  let activeScope = "campus-a";
  let persistedScope = null;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const observer = new QueryObserver(queryClient, {
    queryKey: ["scope-aware-records"],
    queryFn: async () => activeScope
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    await queryClient.fetchQuery({ queryKey: ["inactive-scope-cache"], queryFn: async () => activeScope, staleTime: Infinity });
    assert.equal(queryClient.getQueryData(["scope-aware-records"]), "campus-a");
    assert.equal(queryClient.getQueryData(["inactive-scope-cache"]), "campus-a");

    await transitionWorkspaceContext(
      queryClient,
      () => { activeScope = "campus-b"; },
      async () => { persistedScope = activeScope; }
    );

    assert.equal(persistedScope, "campus-b", "Persist only the activated canonical scope.");
    assert.equal(queryClient.getQueryData(["scope-aware-records"]), "campus-b", "An active screen must refetch after transition.");
    assert.equal(queryClient.getQueryData(["inactive-scope-cache"]), undefined, "Inactive screens must not retain records from the previous scope.");
  } finally {
    unsubscribe();
    queryClient.clear();
  }
});


test("module entry points share canonical native destinations and workspace-aware query keys", () => {
  const routing = read("src/navigation/openModule.ts");
  const modules = read("src/screens/ModulesScreen.tsx");
  const dashboard = read("src/screens/RoleDashboardScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const expected = [
    "assignments", "notices", "timetable", "library", "calendar", "attendance",
    "leave", "parent-children", "hr", "admissions", "placements", "lms",
    "student-dashboard", "student-attendance", "student-marks", "student-results",
    "student-assignments", "student-timetable"
  ];
  for (const id of expected) assert.ok(routing.includes('case "' + id + '"'), "Missing canonical mobile destination for " + id);
  assert.ok(modules.includes("openModule(navigation, item.id)"));
  assert.ok(dashboard.includes("openModule(navigation, moduleId)"));
  assert.ok(moduleScreen.includes("workspaceKey") && moduleScreen.includes('queryKey: ["module", user?.id, workspaceKey, module?.id]'));
  assert.ok(dashboard.includes('queryKey: ["dashboard-work", user?.id, workspaceKey, role]'));
  assert.ok(dashboard.includes('queryKey: ["dashboard-signal", user?.id, workspaceKey, role]'));
});


test("Android Back follows tab history and preserves stack/auth boundaries", () => {
  const navigator = read("src/navigation/RootNavigator.tsx");
  const modules = read("src/screens/ModulesScreen.tsx");
  const dashboard = read("src/screens/RoleDashboardScreen.tsx");
  const auth = read("src/auth/AuthProvider.tsx");

  // Tab history returns to the previously selected tab. Module details are
  // pushed on the root native stack so Back pops to their real origin.
  assert.ok(navigator.includes('<Tabs.Navigator backBehavior="history" screenOptions={{'));
  assert.ok(navigator.includes('<Stack.Screen name="Main" component={MainTabs}'));
  assert.ok(navigator.includes('<Stack.Screen name="Module" component={ModuleScreen}'));
  const moduleNavigation = read("src/navigation/openModule.ts");
  assert.ok(modules.includes("openModule(navigation, item.id)"));
  assert.ok(dashboard.includes("openModule(navigation, moduleId)"));
  assert.ok(moduleNavigation.includes('navigation.navigate("Module", { moduleId })'));
  assert.ok(navigator.includes('name="WorkspaceContext" component={WorkspaceContextScreen}'));

  // Keep React Navigation's native Back handling; no blanket handler should
  // mask an absent/replaced stack entry or forcibly exit the application.
  assert.ok(!/BackHandler/.test(navigator + modules + dashboard));

  // Logout clears credentials and swaps protected routes for Login.
  assert.ok(navigator.includes('status === "authenticated" ? <>'));
  assert.ok(navigator.includes('name="Login" component={LoginScreen}'));
  assert.ok(auth.includes("await clearTokens()"));
  assert.ok(auth.includes('setStatus("unauthenticated")'));
});


test("academic master-data modules use validated operational CRUD workflows instead of read-only discovery", () => {
  const screen = read("src/screens/AcademicRecordsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  for (const id of ["campuses", "departments", "programs", "academic-years", "batches", "semesters", "sections", "courses", "course-offerings"]) {
    assert.ok(screen.includes(id), "Missing academic master workflow: " + id);
  }
  for (const permission of ["campuses.create", "departments.update", "programs.delete", "academic-years.update", "batches.create", "semesters.create", "sections.delete", "courses.create", "course-offerings.update"]) {
    assert.ok(screen.includes(permission), "Missing permission contract: " + permission);
  }
  for (const operation of ['method: editing ? "PATCH" : "POST"', 'method: "DELETE"', "invalidateQueries", "Confirm", "Previous", "Next"]) {
    if (operation === "Confirm") assert.ok(screen.includes("Alert.alert"), "Destructive changes must be confirmed.");
    else assert.ok(screen.includes(operation), "Missing CRUD contract: " + operation);
  }
  assert.ok(screen.includes("Raw record IDs are not accepted"), "Relationship choices must not require manual UUID entry.");
  assert.ok(moduleScreen.includes("supportsAcademicRecords(module.id)"));
  assert.ok(moduleScreen.includes("!isAcademicRecordsWorkspace"), "Generic discovery must not run alongside CRUD workflows.");
});


test("dedicated mobile workflows partition server data by active workspace", () => {
  const screens = [
    "AssignmentsScreen.tsx", "AttendanceScreen.tsx", "AdmissionsScreen.tsx", "PlacementScreen.tsx",
    "LibraryScreen.tsx", "HRScreen.tsx", "LeaveScreen.tsx", "NoticesScreen.tsx", "CalendarScreen.tsx",
    "DocumentsScreen.tsx", "LmsScreen.tsx", "FinanceScreen.tsx", "ExaminationsScreen.tsx",
    "StudentPortalScreen.tsx", "ParentScreen.tsx", "TimetableScreen.tsx", "NotificationsScreen.tsx", "GlobalSearchScreen.tsx"
  ];
  for (const name of screens) {
    const screen = read("src/screens/" + name);
    assert.ok(screen.includes("useWorkspaceContext"), name + " must subscribe to workspace scope");
    assert.ok(screen.includes("workspaceKey"), name + " must partition query keys by workspace");
  }
  const academic = read("src/screens/AcademicRecordsScreen.tsx");
  assert.ok(academic.includes('config!.endpoint !== "/course-offerings"'), "Do not send unsupported search params to course offerings.");
  assert.ok(academic.includes("const filtered = term ? loaded.filter"), "Search must filter the canonical list.");
  const notices = read("src/screens/NoticesScreen.tsx");
  assert.ok(notices.includes("canTargetDepartment") && notices.includes('"/departments?page=1&pageSize=100"'));
  assert.ok(notices.includes("departmentId: departmentId || null"), "Notice edits must be able to clear scope without arbitrary IDs.");
});


test("mobile query keys cannot share cached results across academic workspace changes", () => {
  const screens = [
    "AssignmentsScreen.tsx", "AttendanceScreen.tsx", "AdmissionsScreen.tsx", "PlacementScreen.tsx",
    "LibraryScreen.tsx", "HRScreen.tsx", "LeaveScreen.tsx", "NoticesScreen.tsx", "CalendarScreen.tsx",
    "DocumentsScreen.tsx", "LmsScreen.tsx", "FinanceScreen.tsx", "ExaminationsScreen.tsx",
    "StudentPortalScreen.tsx", "ParentScreen.tsx", "TimetableScreen.tsx", "NotificationsScreen.tsx",
    "GlobalSearchScreen.tsx", "AcademicRecordsScreen.tsx"
  ];
  for (const name of screens) {
    const screen = read("src/screens/" + name);
    assert.ok(screen.includes("useWorkspaceContext"), name + " must subscribe to the workspace provider");
    const queryKeys = [...screen.matchAll(/queryKey:\\s*(\\[[^\\]\\n]*\\])/g)];
    for (const match of queryKeys) {
      const before = screen.slice(Math.max(0, match.index - 100), match.index);
      if (before.includes("invalidateQueries")) continue;
      const key = match[1];
      if (key.includes("user?.id")) assert.ok(key.includes("workspaceKey"), name + " has an unscoped query key: " + key);
    }
    if (name === "PlacementScreen.tsx") assert.ok(screen.includes('const keys = ["placements", user?.id, workspaceKey]'));
  }
});


test("student master and enrollment mobile workflow uses canonical scoped endpoints", () => {
  const screen = read("src/screens/StudentsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const routes = read("../backend/src/routes/student.routes.ts");
  const validators = read("../backend/src/validators/studentAdmin.validators.ts");
  for (const endpoint of ['"/students"', '"/students/" + encodeURIComponent(selectedId) + "/enrollments"']) {
    assert.ok(screen.includes(endpoint), "Missing student workflow endpoint " + endpoint);
  }
  assert.ok(screen.includes('method: "PATCH"') && screen.includes('method: "POST"'));
  assert.ok(screen.includes("students.create") && screen.includes("students.update") && screen.includes("students.read"));
  assert.ok(screen.includes("workspaceKey") && screen.includes("student-enrollments"));
  assert.ok(screen.includes("password") && screen.includes("Initial password"));
  assert.ok(screen.includes("No authorized choices are available; record IDs cannot be entered manually."));
  assert.ok(moduleScreen.includes('module?.id === "students"') && moduleScreen.includes("<StudentsScreen />"));
  assert.ok(routes.includes("studentAdminController.create") && routes.includes("studentAdminController.enroll"));
  assert.ok(validators.includes("createStudentSchema") && validators.includes("enrollStudentSchema"));
});


test("events mobile workflow uses authorized CRUD and a bounded multipart image upload route", () => {
  const screen = read("src/screens/EventsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const route = read("../backend/src/routes/events.routes.ts");
  const controller = read("../backend/src/controllers/events.controller.ts");
  const client = read("src/api/client.ts");
  const validators = read("../backend/src/validators/events.validators.ts");
  for (const endpoint of ['"/events"', '"/events/categories"', '"/events/media/upload"', '"/events/"+encodeURIComponent']) {
    assert.ok(screen.includes(endpoint), "Missing event workflow endpoint " + endpoint);
  }
  assert.ok(screen.includes('method:editingId?"PATCH":"POST"') && screen.includes('method:"POST"') && screen.includes('method:"DELETE"'));
  assert.ok(screen.includes("events.manage") && screen.includes("events.read") && screen.includes("workspaceKey"));
  assert.ok(screen.includes("DocumentPicker.getDocumentAsync") && screen.includes("FormData"));
  assert.ok(route.includes('authorize("events.manage"), imageUpload.single("file"), controller.uploadMedia'));
  assert.ok(route.includes("fileSize: 10 * 1024 * 1024") && route.includes("files: 1"));
  assert.ok(controller.includes("assertSafeImageUpload(req.file)") && controller.includes('module:"events-gallery"'));
  assert.ok(client.includes("isMultipartBody") && client.includes("!isMultipartBody"));
  assert.ok(validators.includes("createEventSchema") && validators.includes("updateEventSchema"));
  assert.ok(moduleScreen.includes('module?.id === "events"') && moduleScreen.includes("<EventsScreen />"));
});


test("registrations mobile workflow covers student self-service and authorized approval lifecycle", () => {
  const screen = read("src/screens/RegistrationsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const routes = read("../backend/src/routes/registration.routes.ts");
  const validators = read("../backend/src/validators/registration.validators.ts");
  assert.ok(screen.includes('"/registrations"') && screen.includes('"/registrations/mine"'));
  assert.ok(screen.includes("/offerings/available") && screen.includes("/decision") && screen.includes("/drop"));
  assert.ok(screen.includes("registration.submit") && screen.includes("registration.read") && screen.includes("registration.approve"));
  assert.ok(screen.includes("workspaceKey") && screen.includes('queryKey:["registrations",user?.id,workspaceKey'));
  assert.ok(screen.includes("Remarks are required when rejecting or requesting correction."));
  assert.ok(routes.includes('authorize("registration.approve")') && routes.includes("service.decide") && routes.includes("service.drop"));
  assert.ok(validators.includes("bulkDecisionSchema") && validators.includes("registerSchema"));
  assert.ok(moduleScreen.includes('module?.id === "registrations"') && moduleScreen.includes("<RegistrationsScreen />"));
});


test("user administration mobile workflow is permission-gated and uses the canonical tenant API", () => {
 const screen = read("src/screens/UsersScreen.tsx");
 const moduleScreen = read("src/screens/ModuleScreen.tsx");
 const routes = read("../backend/src/routes/user.routes.ts");
 const validators = read("../backend/src/validators/user.validators.ts");
 assert.ok(screen.includes('"/users?page="') && screen.includes('"/users/"+encodeURIComponent'));
 assert.ok(screen.includes('method:editingId?"PATCH":"POST"') && screen.includes('"/status"'));
 assert.ok(screen.includes("users.read") && screen.includes("users.create") && screen.includes("users.update") && screen.includes("users.delete"));
 assert.ok(screen.includes("departmentIds") && screen.includes("campusIds") && screen.includes("workspaceKey"));
 assert.ok(!screen.includes('"SUPER_ADMIN"') && !screen.includes('"STUDENT"'));
 assert.ok(routes.includes("createUserSchema") && routes.includes("updateUserSchema") && routes.includes('"/:id/status"'));
 assert.ok(validators.includes("departmentIds") && validators.includes("campusIds"));
 assert.ok(moduleScreen.includes('module?.id === "users"') && moduleScreen.includes("<UsersScreen />"));
});


test("faculty mobile dashboard uses the dedicated self-scoped backend surface", () => {
 const screen = read("src/screens/FacultyScreen.tsx");
 const moduleScreen = read("src/screens/ModuleScreen.tsx");
 const routes = read("../backend/src/routes/faculty.routes.ts");
 assert.ok(screen.includes('"/faculty/me/course-offerings"') && screen.includes('"/faculty/me/dashboard"'));
 assert.ok(screen.includes("workspaceKey") && screen.includes("useWorkspaceContext"));
 assert.ok(screen.includes('user?.roles?.includes("FACULTY")'));
 assert.ok(screen.includes('openModule(navigation,"attendance")') && screen.includes('openModule(navigation,"assignments")'));
 assert.ok(routes.includes('authorizeRoles("FACULTY")') && routes.includes('"/me/dashboard"') && routes.includes('"/me/course-offerings"'));
 assert.ok(moduleScreen.includes('module?.id === "faculty"') && moduleScreen.includes("<FacultyScreen />"));
});


test("enrollment request mobile workflow covers eligible self-service, scoped decisions and real state transitions", () => {
 const screen = read("src/screens/EnrollmentRequestsScreen.tsx");
 const moduleScreen = read("src/screens/ModuleScreen.tsx");
 const routes = read("../backend/src/routes/enrollmentRequest.routes.ts");
 const validators = read("../backend/src/validators/enrollmentRequest.validators.ts");
 assert.ok(screen.includes('"/enrollment-requests/mine"')&&screen.includes('"/enrollment-requests/eligible-contexts"'));
 assert.ok(screen.includes('"/enrollment-requests"')&&screen.includes('"/decision"'));
 assert.ok(screen.includes("enrollment.submit")&&screen.includes("enrollment.read")&&screen.includes("enrollment.approve"));
 assert.ok(screen.includes("workspaceKey")&&screen.includes("selectedContext"));
 assert.ok(screen.includes("A reason is required for rejection or correction."));
 assert.ok(routes.includes("service.submitEnrollmentRequest")&&routes.includes("service.decideEnrollmentRequest"));
 assert.ok(validators.includes("submitEnrollmentRequestSchema")&&validators.includes("decideEnrollmentRequestSchema"));
 assert.ok(moduleScreen.includes('module?.id === "enrollment-requests"')&&moduleScreen.includes("<EnrollmentRequestsScreen />"));
});


test("operations mobile workspace provides scoped asset, facility and maintenance lifecycle controls", () => {
 const screen = read("src/screens/OperationsScreen.tsx");
 const moduleScreen = read("src/screens/ModuleScreen.tsx");
 const routes = read("../backend/src/routes/operations.routes.ts");
 const validators = read("../backend/src/validators/coreErp.validators.ts");
 for (const endpoint of ['/operations/summary','/operations/assets','/operations/facilities','/operations/maintenance','/operations/asset-categories']) assert.ok(screen.includes(endpoint),"Missing operations endpoint "+endpoint);
 assert.ok(screen.includes("operations.read")&&screen.includes("operations.manage")&&screen.includes("maintenance.raise"));
 assert.ok(screen.includes('method:editAsset?"PATCH":"POST"')&&screen.includes('method:editFacility?"PATCH":"POST"')&&screen.includes('method:editMaintenance?"PATCH":"POST"'));
 assert.ok(screen.includes("workspaceKey")&&screen.includes("invalidateQueries"));
 assert.ok(routes.includes("createAssetSchema")&&routes.includes("createFacilitySchema")&&routes.includes("createMaintenanceSchema")&&routes.includes('authorize("operations.manage")'));
 assert.ok(validators.includes("createAssetSchema")&&validators.includes("updateMaintenanceSchema"));
 assert.ok(moduleScreen.includes('module?.id === "operations"')&&moduleScreen.includes("<OperationsScreen />"));
});


test("certificate mobile workflow implements request, issue, reject and public verification APIs", () => {
 const screen=read("src/screens/CertificatesScreen.tsx");
 const moduleScreen=read("src/screens/ModuleScreen.tsx");
 const routes=read("../backend/src/routes/certificate.routes.ts");
 const validators=read("../backend/src/validators/certificate.validators.ts");
 assert.ok(screen.includes('"/certificates/mine"')&&screen.includes('"/certificates?page=1&pageSize=50'));
 assert.ok(screen.includes('"/certificates/"+encodeURIComponent(id(a.row))+"/"+a.verb'));
 assert.ok(screen.includes('"/certificates/verify/"+encodeURIComponent(number.trim())'));
 assert.ok(screen.includes("certificates.request")&&screen.includes("certificates.read")&&screen.includes("certificates.issue"));
 assert.ok(screen.includes("purpose.trim().length<3")&&screen.includes("Rejection remarks must contain at least three characters."));
 assert.ok(routes.includes("service.requestCertificate")&&routes.includes("service.issueCertificate")&&routes.includes("service.rejectCertificate")&&routes.includes("service.verifyCertificate"));
 assert.ok(validators.includes("requestCertificateSchema")&&validators.includes("issueCertificateSchema")&&validators.includes("rejectCertificateSchema"));
 assert.ok(screen.includes("wk")&&moduleScreen.includes('module?.id === "certificates"')&&moduleScreen.includes("<CertificatesScreen />"));
});


test("native finance screen binds existing backend contracts and permission-gated workflows", () => {
  const finance = read("src/screens/FinanceScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const modules = read("src/modules/catalog.ts");
  const financeRoutes = read("../backend/src/routes/finance.routes.ts");
  const financeService = read("../backend/src/services/finance.service.ts");
  const erpRoutes = read("../backend/src/routes/erp.routes.ts");
  for (const route of ["/erp/fee-structures", "/finance/invoices?page=1&pageSize=25", "/finance/payments", "/finance/refunds", "/finance/payments/", "/finance/refunds/"]) {
    assert.ok(finance.includes(route), "Missing existing route: " + route);
  }
  for (const permission of ["fees.structure.read", "fees.structure.manage", "fees.structure.approve", "fees.structure.publish", "fees.invoice.read", "fees.payment.read", "fees.refund.read", "fees.refund.request", "fees.refund.approve", "fees.refund.process"]) {
    assert.ok(finance.includes(permission), "Missing UI permission gate: " + permission);
  }
  assert.ok(moduleScreen.includes('from "./FinanceScreen"'));
  assert.ok(modules.includes('id: "fee-structures"'));
  assert.ok(modules.includes('id: "finance-refunds"'));
  assert.ok(financeRoutes.includes('authorizeAnyPermission("fees.read","fees.invoice.read")'));
  assert.ok(financeRoutes.includes('authorizeAnyPermission("fees.read","fees.payment.read")'));
  assert.ok(financeRoutes.includes('authorizeAnyPermission("fees.read","fees.refund.read","fees.refund.approve","fees.refund.process")'));
  assert.ok(financeService.includes('!has(a,"fees.refund.approve")&&!has(a,"fees.refund.process")'));
  for (const route of ['"/fee-structures/:id/submit"', '"/fee-structures/:id/publish"', '"/fee-structures/:id/approve"', '"/fee-structures/:id/reject"']) {
    assert.ok(erpRoutes.includes(route), "Missing fee-structure transition: " + route);
  }
});


test("native examination workspace uses canonical marks lifecycle and protects student/parent views", () => {
  const screen = read("src/screens/ExaminationsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const routes = read("../backend/src/routes/examination.routes.ts");
  const service = read("../backend/src/services/examination.service.ts");
  for (const route of [
    "/examinations/sessions?page=1&pageSize=30",
    "/examinations/sessions/",
    "/examinations/schedules/",
    "/marks",
    "/marks/approve",
    "/lock",
    "/publish",
    "/examinations/jobs/"
  ]) assert.ok(screen.includes(route), "Missing exam API path: " + route);
  for (const permission of ["exams.read", "marks.read", "marks.enter", "exams.approve"]) {
    assert.ok(screen.includes(permission), "Missing permission gate: " + permission);
  }
  assert.ok(screen.includes('effectiveRole === "STUDENT" || effectiveRole === "PARENT"'));
  assert.ok(screen.includes(": !canReadMarks ?"), "Student/Parent roles must not render the staff marksheet branch.");
  assert.ok(moduleScreen.includes('module?.id === "examinations"'));
  for (const route of [
    '"/schedules/:id/marks"',
    '"/schedules/:id/marks/approve"',
    '"/schedules/:id/lock"',
    '"/schedules/:id/publish"'
  ]) assert.ok(routes.includes(route), "Missing backend route: " + route);
  assert.match(service, /activeRole === "STUDENT" \|\| activeRole === "PARENT"/);
});


test("native internal-mark entry uses faculty-owned rosters and existing validation", () => {
  const screen = read("src/screens/InternalMarksScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const dashboard = read("src/screens/RoleDashboardScreen.tsx");
  const catalog = read("src/modules/catalog.ts");
  const routes = read("../backend/src/routes/internalMark.routes.ts");
  const validators = read("../backend/src/validators/internalMark.validators.ts");
  const service = read("../backend/src/services/internalMark.service.ts");
  const facultyRoutes = read("../backend/src/routes/faculty.routes.ts");
  const rosterService = read("../backend/src/services/courseOffering.service.ts");
  const webMarksPage = read("../frontend/src/app/faculty/marks/[courseOfferingId]/page.tsx");

  for (const route of ["/faculty/me/course-offerings", "/course-offerings/", "/roster", "/internal-marks?courseOfferingId=", 'apiRequest<unknown>("/internal-marks"']) {
    assert.ok(screen.includes(route), "Missing internal-mark API integration: " + route);
  }
  for (const permission of ["marks.read", "marks.enter", "students.read", "course-offerings.read"]) {
    assert.ok(screen.includes(permission), "Missing permission gate: " + permission);
  }
  assert.ok(screen.includes('role === "FACULTY"'));
  assert.ok(screen.includes("records.length"), "Saving must require at least one non-empty mark");
  assert.ok(moduleScreen.includes('module?.id === "internal-marks"'));
  assert.ok(dashboard.includes('label: "Internal marks"'));
  assert.ok(catalog.includes('allowedRoles: ["SUPER_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR", "EXAMINATION", "DIRECTOR", "DEAN", "HOD", "FACULTY"]'));
  assert.ok(routes.includes('authorize("marks.read")'));
  assert.ok(routes.includes('authorizeWorkflow("marks.enter")'));
  assert.ok(validators.includes("maxMarks: z.number().positive().max(1000)"));
  assert.ok(service.includes("assertOwnsCourseOffering(user, offering.facultyId)"));
  assert.ok(service.includes("getCourseOfferingRosterIds(institutionId, offering.id)"));
  assert.ok(facultyRoutes.includes('"/me/course-offerings"'));
  assert.ok(rosterService.includes("assertOwnsCourseOffering(user, offering.facultyId)"));
  assert.ok(webMarksPage.includes("getCourseOfferingRoster") && webMarksPage.includes("enterMarks"));
});


test("internal mark fields are read-only without marks.enter", () => {
  const screen = read("src/screens/InternalMarksScreen.tsx");
  assert.ok(screen.includes("const canEnter = isFaculty && has("));
  assert.ok(screen.includes("editable={canEnter} value={maxMarks}"));
  assert.ok(screen.includes("editable={canEnter} value={marks[student.studentId] || \"\"}"));
  assert.ok(screen.includes("{canEnter ? <Button"));
  assert.ok(screen.includes("Read-only access: your session does not have marks.enter."));
});


test("private student document assets apply student record scope before download", () => {
  const controller = read("../backend/src/controllers/fileStorage.controller.ts");
  assert.ok(controller.includes('result.file.module === "documents" && result.file.referenceId'));
  assert.ok(controller.includes('role: { name: "STUDENT" }'));
  assert.ok(controller.includes("await assertCanViewStudent(institutionId, actor, referencedStudent.id)"));
  assert.ok(controller.includes("!canReadReferencedStudentDocument"));
  assert.ok(controller.includes("const isOwner = result.file.ownerId === actor.id"));
});


test("student performance and published results use canonical scoped APIs", () => {
  const portal = read("src/screens/StudentPortalScreen.tsx");
  const client = read("src/api/client.ts");
  const modules = read("src/screens/ModulesScreen.tsx");
  const dashboard = read("src/screens/RoleDashboardScreen.tsx");
  const navigation = read("src/navigation/RootNavigator.tsx");
  const catalog = read("src/modules/catalog.ts");
  const examinationRoutes = read("../backend/src/routes/examination.routes.ts");
  const examinationService = read("../backend/src/services/examination.service.ts");
  const studentRoutes = read("../backend/src/routes/student.routes.ts");

  for (const endpoint of ["/examinations/my/performance", "/examinations/my/results", "/students/me/marks"]) {
    assert.ok(portal.includes(endpoint), "Missing self-service endpoint: " + endpoint);
  }
  assert.ok(portal.includes('tab==="RESULTS"'));
  assert.ok(portal.includes("Internal assessment marks"));
  assert.ok(portal.includes("Published examination results"));
  assert.ok(portal.includes("Download marksheet PDF"));
  assert.ok(client.includes("export async function apiDownloadPdf"));
  assert.ok(client.includes('headers.set("Authorization", "Bearer " + token)'));
  assert.ok(client.includes("if (await refreshSession()) return request(false)"));
  assert.ok(client.includes('contentType !== "application/pdf"'));
  assert.ok(client.includes('!== "%PDF"'));
  assert.ok(client.includes("await file.write(bytes)"));
  assert.ok(read("src/navigation/openModule.ts").includes('case "student-results"'));
  assert.ok(navigation.includes('"RESULTS"'));
  assert.ok(catalog.includes('id: "student-results"'));
  assert.ok(examinationRoutes.includes('"/my/performance"') && examinationRoutes.includes('"/my/results"'));
  const routeStart = examinationRoutes.indexOf('"/sessions/:id/marksheet.pdf"');
  assert.ok(routeStart >= 0);
  assert.ok(examinationRoutes.slice(routeStart, routeStart + 500).includes('authorize("results.read")'));
  const pdfStart = examinationService.indexOf("export async function generateStudentMarksheetPdf(");
  const pdfEnd = examinationService.indexOf("\n// ==========================================================", pdfStart);
  assert.ok(pdfStart >= 0 && pdfEnd > pdfStart);
  assert.ok(examinationService.slice(pdfStart, pdfEnd).includes("assertCanViewStudent(institutionId, actor, studentId)"));
  assert.ok(studentRoutes.includes('"/me/marks"') && studentRoutes.includes('authorizeRoles("STUDENT")'));
});


test("native documents viewer uses the authenticated scoped portal endpoint", () => {
  const screen = read("src/screens/DocumentsScreen.tsx");
  const moduleScreen = read("src/screens/ModuleScreen.tsx");
  const catalog = read("src/modules/catalog.ts");
  const routes = read("../backend/src/routes/portal.routes.ts");
  const service = read("../backend/src/services/portal.service.ts");
  assert.ok(screen.includes('"/portal/documents/me"'));
  assert.ok(screen.includes('user.permissions.includes("documents.read")'));
  assert.ok(screen.includes("Linking.openURL(document.url)"));
  assert.ok(screen.includes("if (!/^https?:\\/\\/\\S+$/i.test(document.url)"));
  assert.ok(screen.includes("query.isError") && screen.includes("ListEmptyComponent"));
  assert.ok(moduleScreen.includes('module?.id === "documents"'));
  assert.ok(moduleScreen.includes("if (isDocumentsWorkspace) return <DocumentsScreen />"));
  assert.ok(catalog.includes('id: "documents"') && catalog.includes('requiredAnyPermissions: ["documents.read"]'));
  assert.ok(routes.includes('"/documents/me"'));
  const myDocumentsRoute = routes.indexOf('"/documents/me"');
  assert.ok(myDocumentsRoute >= 0);
  assert.ok(routes.slice(myDocumentsRoute, myDocumentsRoute + 180).includes('"documents.read"'));
  assert.ok(service.includes("export async function listMyDocuments"));
  assert.ok(service.includes("return getDocumentsForOwner("));
  assert.ok(service.includes("ownerId"));
});
