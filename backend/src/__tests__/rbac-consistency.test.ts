import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PERMISSIONS,
  PermissionKey,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
  SystemRoleName,
} from "../config/rbac";

const ROOT = path.resolve(__dirname, "../../..");

function extractQuotedPermissionKeys(content: string): string[] {
  const matches = content.matchAll(/authorize\(\s*['"]([^'"]+)['"]/g);
  return [...matches].map((match) => match[1]);
}

function extractNavigationPermissionKeys(content: string): string[] {
  const matches = content.matchAll(/permissions:\s*\[([^\]]*)\]/gms);
  const keys: string[] = [];

  for (const match of matches) {
    const values = match[1].matchAll(/['"]([^'"]+)['"]/g);
    for (const value of values) keys.push(value[1]);
  }

  return keys;
}

function collectRouteFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(fullPath);
    return entry.name.endsWith(".routes.ts") ? [fullPath] : [];
  });
}

test("every role permission exists in the canonical permission catalog", () => {
  const catalog = new Set<string>(PERMISSIONS.map((permission) => permission.key));

  for (const role of SYSTEM_ROLE_NAMES) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      assert.ok(
        catalog.has(permission),
        `${role} references unknown permission ${permission}`,
      );
    }
  }
});

test("all backend route permission gates exist in the canonical catalog", () => {
  const catalog = new Set<string>(PERMISSIONS.map((permission) => permission.key));
  const routeFiles = collectRouteFiles(path.join(ROOT, "backend", "src", "routes"));
  const unknown: string[] = [];

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const permission of extractQuotedPermissionKeys(content)) {
      if (!catalog.has(permission)) {
        unknown.push(`${path.relative(ROOT, file)} -> ${permission}`);
      }
    }
  }

  assert.deepEqual(unknown, [], `Unknown route permission(s): ${unknown.join("; ")}`);
});

test("all frontend navigation permission keys exist in the canonical catalog", () => {
  const catalog = new Set<string>(PERMISSIONS.map((permission) => permission.key));
  const navigationPath = path.join(ROOT, "frontend", "src", "lib", "navigation.ts");
  const content = fs.readFileSync(navigationPath, "utf8");
  const unknown = extractNavigationPermissionKeys(content).filter(
    (permission) => !catalog.has(permission),
  );

  assert.deepEqual(
    [...new Set(unknown)],
    [],
    `Unknown navigation permission(s): ${[...new Set(unknown)].join("; ")}`,
  );
});

test("critical examination, result and user-lifecycle permissions are assigned intentionally", () => {
  const has = (role: SystemRoleName, permission: PermissionKey) =>
    (ROLE_PERMISSIONS[role] ?? []).includes(permission);

  assert.equal(has("EXAMINATION", "exams.read"), true);
  assert.equal(has("EXAMINATION", "exams.manage"), true);
  assert.equal(has("EXAMINATION", "exams.approve"), true);
  assert.equal(has("EXAMINATION", "marks.read"), true);
  assert.equal(has("EXAMINATION", "marks.enter"), true);
  assert.equal(has("EXAMINATION", "results.read"), true);

  assert.equal(has("STUDENT", "exams.read"), true);
  assert.equal(has("STUDENT", "results.read"), true);
  assert.equal(has("FACULTY", "exams.read"), true);
  assert.equal(has("FACULTY", "marks.read"), true);
  assert.equal(has("FACULTY", "marks.enter"), true);
  assert.equal(has("HOD", "exams.read"), true);
  assert.equal(has("HOD", "results.read"), true);

  assert.equal(has("INSTITUTION_ADMIN", "users.read"), true);
  assert.equal(has("INSTITUTION_ADMIN", "users.update"), true);
  assert.equal(has("INSTITUTION_ADMIN", "users.delete"), true);
});

test("institution administration does not receive examination write authority by default", () => {
  const permissions = new Set<PermissionKey>(ROLE_PERMISSIONS.INSTITUTION_ADMIN ?? []);

  assert.equal(permissions.has("exams.manage"), false);
  assert.equal(permissions.has("exams.approve"), false);
});
