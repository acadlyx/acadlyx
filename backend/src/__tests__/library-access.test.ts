import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { missingPermissionDependencies } from "../middleware/authorize";
import assert from "node:assert/strict";

import { getEffectivePermissions } from "../config/rbac";
import { buildLibraryFineListWhere } from "../services/library.service";

test("students receive library self-service permissions but not librarian authority", () => {
  const permissions = getEffectivePermissions(["STUDENT"]);

  assert.ok(permissions.includes("library.read"));
  assert.ok(permissions.includes("library.borrow"));
  assert.ok(!permissions.includes("library.manage"));
  assert.ok(!permissions.includes("library.fines.waive.request"));
  assert.ok(!permissions.includes("library.fines.waive.approve"));
});

test("student fine query is restricted to the authenticated student's issues and institution", () => {
  assert.deepEqual(
    buildLibraryFineListWhere("institution-a", {
      id: "student-a",
      roles: ["STUDENT"],
    }),
    {
      institutionId: "institution-a",
      issue: { borrowerId: "student-a" },
    },
  );
});

test("staff fine query remains institution-scoped and does not inherit student ownership filtering", () => {
  assert.deepEqual(
    buildLibraryFineListWhere("institution-a", {
      id: "librarian-a",
      roles: ["LIBRARIAN"],
    }),
    { institutionId: "institution-a" },
  );
});

test("mixed-role student requests remain limited to their own fines", () => {
  assert.deepEqual(
    buildLibraryFineListWhere("institution-a", {
      id: "student-a",
      roles: ["LIBRARIAN", "STUDENT"],
    }),
    {
      institutionId: "institution-a",
      issue: { borrowerId: "student-a" },
    },
  );
});

test("student self-service borrowing does not require staff student-directory access", () => {
  const studentPermissions = getEffectivePermissions(["STUDENT"]);
  assert.equal(studentPermissions.includes("library.borrow"), true);
  assert.equal(studentPermissions.includes("library.read"), true);
  assert.equal(studentPermissions.includes("students.read"), false);
  const routes = fs.readFileSync(path.resolve(__dirname, "../routes/library.routes.ts"), "utf8");
  const mineStart = routes.indexOf('"/loans/mine"');
  const mineEnd = routes.indexOf('"/loans"', mineStart + 1);
  assert.ok(mineStart >= 0 && mineEnd > mineStart, "self-service loans route must exist");
  const selfServiceRoute = routes.slice(mineStart, mineEnd);
  assert.match(selfServiceRoute, /authorize\("library\.borrow"\)/);
  assert.doesNotMatch(selfServiceRoute, /authorizeWorkflow/);
  const missing = missingPermissionDependencies(studentPermissions, ["library.borrow"]);
  assert.ok(missing.some((item) => item.permission === "students.read"));
  for (const routePath of ['"/reservations"', '"/reservations/:id/cancel"']) {
    const start = routes.indexOf(routePath);
    assert.ok(start >= 0, "student reservation route must exist: " + routePath);
    const nextRoute = routes.indexOf("router.", start + routePath.length);
    const routeBlock = routes.slice(start, nextRoute < 0 ? routes.length : nextRoute);
    assert.match(routeBlock, /authorize\("library\.borrow"\)/);
    assert.doesNotMatch(routeBlock, /authorizeWorkflow/);
  }
});
