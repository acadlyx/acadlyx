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
  assert.ok(ids.length >= 25, "Expected an initial, broad module catalog.");
  assert.equal(new Set(ids).size, ids.length, "Module ids must be unique.");
  assert.ok(endpoints.length >= 25, "Every module should specify a backend route.");
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