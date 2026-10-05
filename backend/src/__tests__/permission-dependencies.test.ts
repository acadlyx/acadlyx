import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSION_DEPENDENCIES,
  getEffectivePermissions,
} from "../config/rbac";
import { missingPermissionDependencies } from "../middleware/authorize";

test("workflow dependency graph is centralized and does not grant write permissions", () => {
  const issue = PERMISSION_DEPENDENCIES.find((item) => item.permission === "library.borrow");
  assert.ok(issue);
  assert.equal(issue?.dependencies.some((dependency) => dependency.permission === "students.update"), false);
  assert.equal(issue?.dependencies.some((dependency) => dependency.access !== "READ"), false);
});

test("dependency resolver identifies missing read capabilities without changing grants", () => {
  const granted = getEffectivePermissions(["LIBRARIAN"]);
  const missing = missingPermissionDependencies(granted, ["library.borrow"]);
  assert.equal(missing.length, 0);
  assert.equal(granted.includes("students.update"), false);
});

test("examination admit-card style dependencies remain read-only", () => {
  const dependency = PERMISSION_DEPENDENCIES.find((item) => item.permission === "exams.manage");
  assert.ok(dependency);
  assert.equal(dependency?.dependencies.every((item) => item.access === "READ"), true);
});
