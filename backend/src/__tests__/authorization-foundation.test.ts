import test from "node:test";
import assert from "node:assert/strict";

import {
  ROLE_PERMISSIONS,
  hasPermission,
  normalizeRoleName,
  type PermissionKey,
} from "../config/rbac";

test("management and staff role names are not silently remapped", () => {
  assert.equal(normalizeRoleName("MANAGEMENT"), "MANAGEMENT");
  assert.equal(normalizeRoleName("STAFF"), null);
});

test("institution admin is not a specialist operator", () => {
  const permissions = ROLE_PERMISSIONS.INSTITUTION_ADMIN;

  const forbidden: PermissionKey[] = [
    "fees.manage",
    "fees.pay",
    "fees.refund",
    "fees.reconcile",
    "assignments.create",
    "assignments.review",
    "marks.enter",
    "attendance.mark",
    "attendance.correct",
    "attendance.approve",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "results.read",
    "hr.manage",
    "admissions.manage",
    "library.manage",
  ];

  for (const permission of forbidden) {
    assert.equal(
      permissions.includes(permission),
      false,
      `INSTITUTION_ADMIN must not have ${permission}`,
    );
  }
});

test("institution admin retains institutional administration capabilities", () => {
  const required: PermissionKey[] = [
    "users.read",
    "users.create",
    "users.update",
    "students.read",
    "students.create",
    "students.update",
    "departments.read",
    "departments.create",
    "programs.read",
    "programs.create",
    "courses.read",
    "courses.create",
    "sections.read",
    "sections.create",
    "campuses.read",
    "campuses.create",
    "notices.read",
    "notices.manage",
    "calendar.read",
    "calendar.manage",
    "parent-links.read",
    "parent-links.manage",
  ];

  for (const permission of required) {
    assert.equal(
      hasPermission(["INSTITUTION_ADMIN"], permission),
      true,
      `INSTITUTION_ADMIN should retain ${permission}`,
    );
  }
});

test("institution admin stays out of specialist operational domains", () => {
  const forbidden: PermissionKey[] = [
    "fees.manage",
    "fees.pay",
    "fees.refund",
    "fees.approve",
    "assignments.create",
    "assignments.review",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",
    "marks.enter",
    "attendance.mark",
    "attendance.approve",
    "attendance.lock",
    "hr.manage",
    "library.manage",
  ];

  for (const permission of forbidden) {
    assert.equal(
      hasPermission(["INSTITUTION_ADMIN"], permission),
      false,
      `Institution Admin must not receive ${permission}`,
    );
  }
});

test("leadership marks readers match their documented read permissions", () => {
  for (const role of ["CHAIRMAN", "DIRECTOR", "DEAN"]) {
    assert.equal(
      hasPermission([role], "marks.read"),
      true,
      `${role} should be able to read marks`,
    );
  }

  assert.equal(
    hasPermission(["INSTITUTION_ADMIN"], "marks.read"),
    false,
  );
});

test("accounts fee management is permission-driven", () => {
  assert.equal(
    hasPermission(["ACCOUNTS"], "fees.manage"),
    true,
  );
  assert.equal(
    hasPermission(["HOD"], "fees.manage"),
    false,
  );
});

test("people import is limited to roles with people.import", () => {
  assert.equal(
    hasPermission(["INSTITUTION_ADMIN"], "people.import"),
    true,
  );
  assert.equal(
    hasPermission(["HOD"], "people.import"),
    true,
  );
  assert.equal(
    hasPermission(["DIRECTOR"], "people.import"),
    false,
  );
});

test("super admin remains platform-scoped rather than inheriting specialist operations", () => {
  assert.equal(
    hasPermission(["SUPER_ADMIN"], "institutions.manage"),
    true,
  );

  assert.equal(
    hasPermission(["SUPER_ADMIN"], "plans.manage"),
    true,
  );

  assert.equal(
    hasPermission(["SUPER_ADMIN"], "fees.pay"),
    false,
  );

  assert.equal(
    hasPermission(["SUPER_ADMIN"], "exams.manage"),
    false,
  );

  assert.equal(
    hasPermission(["SUPER_ADMIN"], "hr.manage"),
    false,
  );
});


test("student profile read permissions match supported workspace roles", () => {
  const expectedReaders = [
    "INSTITUTION_ADMIN",
    "CHAIRMAN",
    "MANAGEMENT",
    "DIRECTOR",
    "DEAN",
    "REGISTRAR",
    "HOD",
    "FACULTY",
    "ACCOUNTS",
    "ADMISSIONS",
    "EXAMINATION",
    "PLACEMENT",
  ] as const;

  for (const role of expectedReaders) {
    assert.equal(
      hasPermission([role], "students.read"),
      true,
      `${role} should be able to read students in its authorized scope`,
    );
  }

  assert.equal(
    hasPermission(["STUDENT"], "students.read"),
    false,
    "STUDENT must use self-service student APIs rather than institutional student search",
  );

  assert.equal(
    hasPermission(["PARENT"], "students.read"),
    false,
    "PARENT must use linked-child self-service APIs",
  );
});

test("examination workspace has read-only campus context access", () => {
  assert.equal(
    hasPermission(["EXAMINATION"], "campuses.read"),
    true,
  );
  assert.equal(
    hasPermission(["EXAMINATION"], "campuses.create"),
    false,
  );
  assert.equal(
    hasPermission(["EXAMINATION"], "campuses.update"),
    false,
  );
  assert.equal(
    hasPermission(["EXAMINATION"], "campuses.delete"),
    false,
  );
});
