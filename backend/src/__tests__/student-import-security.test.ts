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
    assertPartialStudentImportScope("institution-1", actor(["HOD"]), null),
    /must include a valid programme and academic year/,
  );
  await assert.rejects(
    assertPartialStudentImportScope("institution-1", actor(["DEAN"]), null),
    /must include a valid programme and academic year/,
  );
  await assert.rejects(
    assertPartialStudentImportScope("institution-1", actor(["DIRECTOR"]), null),
    /must include a valid programme and academic year/,
  );
});

test("institution administration and institution-wide admissions may create incomplete student rows for follow-up", async () => {
  await assert.doesNotReject(
    assertPartialStudentImportScope("institution-1", actor(["INSTITUTION_ADMIN"]), null),
  );
  await assert.doesNotReject(
    assertPartialStudentImportScope("institution-1", actor(["ADMISSIONS"]), null),
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
