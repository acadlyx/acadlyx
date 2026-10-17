import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { applyWorkspaceContext, setActiveWorkspaceContext, transitionWorkspaceContext } from "../src/workspace/workspaceScope.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const catalog = read("src/modules/catalog.ts");
const client = read("src/api/client.ts");
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
  assert.ok(provider.includes("await queryClient.resetQueries()"));
  assert.ok(provider.includes("queryClient.invalidateQueries"));
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
  assert.ok(client.includes('departments: ["campusId"]'));
  assert.ok(client.includes('programs: ["departmentId"]'));
  assert.ok(client.includes('courses: ["departmentId"]'));
  assert.ok(client.includes('batches: ["programId"]'));
  assert.ok(client.includes('students: ["departmentId", "programId", "academicYearId", "semesterId", "sectionId"]'));
  assert.ok(client.includes('"course-offerings": ["semesterId", "sectionId", "departmentId"]'));
});

test("session cache is cleared when a current account's authorization shape changes", () => {
  const app = read("App.tsx");
  assert.ok(app.includes("authorizationShape"));
  assert.ok(app.includes("user?.permissions"));
  assert.match(app, /client\.clear\(\).*authorizationShape/s);
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
    semesterId: "semester-a",
    sectionId: "section-a"
  })) assert.equal(students.get(key), value);
  assert.equal(students.get("batchId"), null, "Do not append a parameter the endpoint does not contractually accept.");

  const unsupported = "/finance/invoices?page=1&status=PENDING";
  assert.equal(applyWorkspaceContext(unsupported, true), unsupported, "Unknown endpoints must not receive guessed query parameters.");
  assert.equal(applyWorkspaceContext("/departments?page=2", false), "/departments?page=2", "Unauthenticated calls must not receive context filters.");

  // Clearing a workspace selector must remove old IDs that came from the
  // previous context, but must preserve independent user-entered filters.
  setActiveWorkspaceContext({ campusId: "campus-a" });
  const cleared = new URLSearchParams(applyWorkspaceContext(
    "/students?departmentId=department-a&programId=program-a&academicYearId=year-a&semesterId=semester-a&sectionId=section-a&search=Smith",
    true
  ).split("?")[1]);
  for (const key of ["departmentId", "programId", "academicYearId", "semesterId", "sectionId"]) {
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
