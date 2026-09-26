import test from "node:test";
import assert from "node:assert/strict";

import {
  ROLE_PERMISSIONS,
  hasPermission,
  normalizeRoleName,
} from "../config/rbac";

test("legacy management aliases normalize to canonical roles", () => {
  assert.equal(normalizeRoleName("MANAGEMENT"), "CHAIRMAN");
  assert.equal(normalizeRoleName("STAFF"), "ACCOUNTS");
});

test("institution admin is not a specialist operator", () => {
  const permissions = ROLE_PERMISSIONS.INSTITUTION_ADMIN;

  const forbidden = [
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
      permissions.includes(permission as never),
      false,
      `INSTITUTION_ADMIN must not have ${permission}`,
    );
  }
});

test("institution admin retains institutional administration capabilities", () => {
  const required = [
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
      hasPermission(["INSTITUTION_ADMIN"], permission as never),
      true,
      `INSTITUTION_ADMIN should retain ${permission}`,
    );
  }
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
