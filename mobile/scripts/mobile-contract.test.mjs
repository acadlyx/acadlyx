import test from "node:test";
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
  for (const route of ["/library/books", "/library/reservations", "/library/loans", "/library/fines", "/return", "/renew"]) assert.ok(library.includes(route), "Missing library route fragment: " + route);
  assert.ok(library.includes("library.manage"));
  assert.ok(calendar.includes("/calendar/events"));
  assert.ok(calendar.includes("calendar.manage"));
  assert.ok(attendance.includes("/attendance-sessions"));
  assert.ok(attendance.includes("attendance.mark"));
  assert.ok(attendance.includes("JSON.stringify({ records, submit })"));
  assert.ok(attendance.includes("session.isLocked"));
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
    "../docs/mobile/MOBILE_ROLE_PERMISSION_MATRIX.md",
    "../docs/mobile/MOBILE_API_INTEGRATION.md",
    "../docs/mobile/MOBILE_TEST_REPORT.md",
    "../docs/mobile/MOBILE_BUILD_AND_RELEASE.md",
    "../docs/mobile/MOBILE_KNOWN_LIMITATIONS.md"
  ];
  for (const path of docs) assert.ok(readFileSync(resolve(root, path), "utf8").length > 500, "Missing/short doc: " + path);
  assert.ok(read("../docs/mobile/MOBILE_FEATURE_PARITY.md").includes("No 100% parity claim is made."));
});
