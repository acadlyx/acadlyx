import assert from "node:assert/strict";
import test from "node:test";

import { authorize, canAccessStudentRelationship } from "../config/authorization";
import { getEffectivePermissions, type PermissionKey } from "../config/rbac";
import type { AuthenticatedUser } from "../types/auth";

function actor(
  id: string,
  institutionId: string | null,
  roles: AuthenticatedUser["roles"],
  permissions: PermissionKey[] = getEffectivePermissions(roles),
): AuthenticatedUser {
  return {
    id,
    institutionId,
    email: `${id}@test.invalid`,
    idNumber: id,
    firstName: "Synthetic",
    lastName: "Actor",
    roles,
    permissions,
  };
}

test("institution permission plus matching tenant allows a legitimate read", () => {
  const institutionAdmin = actor("admin-a", "institution-a", ["INSTITUTION_ADMIN"]);
  const decision = authorize(institutionAdmin, "students.read", {
    institutionId: "institution-a",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "ALLOWED");
});

test("institution A cannot use an otherwise valid permission on institution B", () => {
  const institutionAdmin = actor("admin-a", "institution-a", ["INSTITUTION_ADMIN"]);
  const decision = authorize(institutionAdmin, "students.read", {
    institutionId: "institution-b",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "RECORD_NOT_IN_SCOPE");
});

test("permission does not override a cross-user target identifier", () => {
  const faculty = actor("faculty-a", "institution-a", ["FACULTY"]);
  const decision = authorize(faculty, "students.read", {
    institutionId: "institution-a",
    userId: "student-b",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "RECORD_NOT_IN_SCOPE");
});

test("student may use a self-scoped record with the required permission", () => {
  const student = actor("student-a", "institution-a", ["STUDENT"]);
  const decision = authorize(student, "students.read", {
    institutionId: "institution-a",
    userId: "student-a",
  });
  assert.equal(decision.allowed, true);
});

test("student cannot use a peer's user identifier", () => {
  const student = actor("student-a", "institution-a", ["STUDENT"]);
  const decision = authorize(student, "students.read", {
    institutionId: "institution-a",
    userId: "student-b",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "RECORD_NOT_IN_SCOPE");
});

test("a missing required permission denies even when the target is in the same tenant", () => {
  const student = actor("student-a", "institution-a", ["STUDENT"]);
  const decision = authorize(student, "students.update", {
    institutionId: "institution-a",
    userId: "student-a",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "NO_PERMISSION");
});

test("institution-scoped actor cannot invoke platform-only permissions", () => {
  const institutionAdmin = actor("admin-a", "institution-a", ["INSTITUTION_ADMIN"], [
    "institutions.manage",
  ]);
  const decision = authorize(institutionAdmin, "institutions.manage", {
    institutionId: "institution-a",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "PLATFORM_SCOPE_REQUIRED");
});

test("super admin is not granted tenant operational permission merely by role", () => {
  const platformAdmin = actor("platform-admin", null, ["SUPER_ADMIN"]);
  const decision = authorize(platformAdmin, "fees.payment.record");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "NO_PERMISSION");
});

test("a parent relationship must be positively established for a non-self student", () => {
  const parent = actor("parent-a", "institution-a", ["PARENT"]);
  assert.equal(
    canAccessStudentRelationship(parent, { studentUserId: "student-a" }),
    false,
  );
  assert.equal(
    canAccessStudentRelationship(parent, {
      studentUserId: "student-a",
      currentUserIsLinkedParent: false,
    }),
    false,
  );
});

test("a parent with a server-verified link can pass the relationship helper", () => {
  const parent = actor("parent-a", "institution-a", ["PARENT"]);
  assert.equal(
    canAccessStudentRelationship(parent, {
      studentUserId: "student-a",
      currentUserIsLinkedParent: true,
    }),
    true,
  );
});

test("self and linked-parent relationship positives do not grant student-directory permissions", () => {
  const parent = actor("parent-a", "institution-a", ["PARENT"]);
  assert.equal(parent.permissions.includes("students.read"), false);
  assert.equal(parent.permissions.includes("parent-portal.read"), true);
  assert.equal(
    authorize(parent, "students.read", {
      institutionId: "institution-a",
      userId: "student-a",
    }).allowed,
    false,
  );
});

test("target ownership cannot be substituted with another user's id", () => {
  const faculty = actor("faculty-a", "institution-a", ["FACULTY"]);
  const decision = authorize(faculty, "assignments.read", {
    institutionId: "institution-a",
    ownerUserId: "student-b",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "RECORD_NOT_IN_SCOPE");
});
