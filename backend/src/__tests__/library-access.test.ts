import test from "node:test";
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
