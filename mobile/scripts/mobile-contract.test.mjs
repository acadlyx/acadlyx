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
  assert.ok(ids.length >= 40, "Expected broad initial module inventory.");
  assert.equal(new Set(ids).size, ids.length, "Module ids must be unique.");
  assert.equal(endpoints.length, ids.length, "Every module must map to an endpoint.");
  for (const endpoint of endpoints) assert.ok(endpoint.startsWith("/"), "Bad endpoint: " + endpoint);
});

test("session tokens use Expo SecureStore; privileged database secrets are absent", () => {
  assert.match(client, /expo-secure-store/);
  assert.match(client, /SecureStore\.setItemAsync/);
  assert.doesNotMatch(client, /service_role|postgresql:\/\/|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("native identity and platform commands are configured", () => {
  assert.equal(app.expo.name, "ACADLYX");
  assert.equal(app.expo.scheme, "acadlyx");
  assert.equal(pkg.scripts.android, "expo run:android");
  assert.equal(pkg.scripts.ios, "expo run:ios");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
});

test("the auth client includes a bounded refresh-on-401 path and permission filtering", () => {
  assert.match(client, /retryOnUnauthorized/);
  assert.match(client, /refreshSession/);
  assert.match(catalog, /user\.permissions\.includes/);
  assert.match(catalog, /requiredAnyPermissions/);
});

test("dedicated assignment, notice and timetable screens call the existing APIs", () => {
  const assignments = read("src/screens/AssignmentsScreen.tsx");
  const notices = read("src/screens/NoticesScreen.tsx");
  const timetable = read("src/screens/TimetableScreen.tsx");
  const library = read("src/screens/LibraryScreen.tsx");
  assert.match(assignments, /\/assignments\/.*\/submit/);
  assert.match(assignments, /\/submissions\/.*\/reopen/);
  assert.match(assignments, /assignments\.create/);
  assert.match(notices, /\/erp\/notices/);
  assert.match(notices, /notices\.manage/);
  assert.match(timetable, /\/erp\/timetable/);
  assert.match(timetable, /timetable\.manage/);
  assert.match(timetable, /course-offerings/);
  assert.match(library, /\/library\/reservations/);
  assert.match(library, /\/library\/loans\/.*\/return/);
  assert.match(library, /\/library\/loans\/.*\/renew/);
  assert.match(library, /library\.manage/);
});

test("actual repository logo is bundled and displayed on native sign-in", () => {
  const logo = readFileSync(resolve(root, "assets/acadlyx-logo.png"));
  const login = read("src/screens/LoginScreen.tsx");
  assert.ok(logo.length > 1000);
  assert.equal(logo.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(login, /assets\/acadlyx-logo\.png/);
});

test("required parity and release documentation exists and states limits candidly", () => {
  const names = [
    "../docs/mobile/MOBILE_ARCHITECTURE.md",
    "../docs/mobile/MOBILE_FEATURE_PARITY.md",
    "../docs/mobile/MOBILE_ROLE_PERMISSION_MATRIX.md",
    "../docs/mobile/MOBILE_API_INTEGRATION.md",
    "../docs/mobile/MOBILE_TEST_REPORT.md",
    "../docs/mobile/MOBILE_BUILD_AND_RELEASE.md",
    "../docs/mobile/MOBILE_KNOWN_LIMITATIONS.md"
  ];
  for (const name of names) assert.ok(readFileSync(resolve(root, name), "utf8").length > 500, "Missing/short doc: " + name);
  assert.match(read("../docs/mobile/MOBILE_FEATURE_PARITY.md"), /100% parity claim is not made/i);
});
