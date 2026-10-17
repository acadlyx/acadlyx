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
  assert.ok(appSource.includes("await client.cancelQueries()"));
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

