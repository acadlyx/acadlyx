import assert from "node:assert/strict";
import test from "node:test";

import { assertExistingStudentImportPermission, assertPartialStudentImportScope } from "../services/import.service";
import type { AuthenticatedUser } from "../types/auth";

function actor(roles: string[]): AuthenticatedUser {
  return {
    id: "actor-1",
    institutionId: "institution-1",
    email: "actor@example.invalid",
    roles,
    permissions: ["students.create"],
  };
}

test("department-scoped student imports cannot create unplaced or incompletely scoped students", async () => {
  await assert.rejects(
    assertPartialStudentImportScope("institution-1", actor(["HOD"]), null, null, null),
    /must include a valid programme, academic year, and semester/,
  );
  await assert.rejects(
    assertPartialStudentImportScope("institution-1", actor(["DEAN"]), null, null, null),
    /must include a valid programme, academic year, and semester/,
  );
  await assert.rejects(
    assertPartialStudentImportScope("institution-1", actor(["DIRECTOR"]), null, null, null),
    /must include a valid programme, academic year, and semester/,
  );
});

test("institution administration and institution-wide admissions may create incomplete student rows for follow-up", async () => {
  await assert.doesNotReject(
    assertPartialStudentImportScope("institution-1", actor(["INSTITUTION_ADMIN"]), null, null, null),
  );
  await assert.doesNotReject(
    assertPartialStudentImportScope("institution-1", actor(["ADMISSIONS"]), null, null, null),
  );
});

test("updating an existing student requires the distinct students.update permission", () => {
  assert.throws(
    () => assertExistingStudentImportPermission(actor(["INSTITUTION_ADMIN"])),
    /requires students.update permission/,
  );
  assert.doesNotThrow(() => assertExistingStudentImportPermission({
    ...actor(["INSTITUTION_ADMIN"]),
    permissions: ["students.create", "students.update"],
  }));
});
