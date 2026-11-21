/**
 * Authorization and tenant-boundary tests.
 *
 * These cover the pure decision logic that every request depends on:
 * permission gating, role hierarchy, tenant ownership and audience
 * scoping. They deliberately avoid the database so they run in CI
 * without a Postgres instance.
 *
 * Run with: npm test
 */
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { NextFunction, Request, Response } from "express";

import {
  authorize,
  authorizeAnyPermission,
  authorizeRoles,
} from "../middleware/authorize";
import type { PermissionKey } from "../config/rbac";
import { AppError } from "../middleware/errorHandler";
import {
  getEffectivePermissions,
  getRolePermissions,
  NOTICE_MANAGEMENT_ROLES,
  SYSTEM_ROLE_NAMES,
  isPlatformPermission,
  outranks,
  hasPermission,
} from "../config/rbac";
import { assertSameInstitution } from "../utils/requireInstitution";
import { visibleAudiences } from "../services/calendar.service";
import { AuthenticatedUser } from "../types/auth";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    institutionId: "tenant-a",
    email: "user@example.edu",
    roles: ["STUDENT"],
    permissions: getEffectivePermissions(["STUDENT"]),
    ...overrides,
  };
}

/** Captures whatever the middleware passes to next(). */
function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  user: AuthenticatedUser | undefined
): unknown {
  let captured: unknown = "NOT_CALLED";
  middleware(
    { user } as unknown as Request,
    {} as Response,
    ((error?: unknown) => {
      captured = error;
    }) as NextFunction
  );
  return captured;
}

describe("authorize middleware", () => {
  test("rejects an unauthenticated request with 401", () => {
    const error = runMiddleware(authorize("students.read"), undefined);
    assert.ok(error instanceof AppError);
    assert.equal((error as AppError).statusCode, 401);
  });

  test("rejects a caller missing the permission with 403", () => {
    const error = runMiddleware(authorize("fees.manage"), makeUser());
    assert.ok(error instanceof AppError);
    assert.match(String((error as AppError).message), /fees\.manage/);
  });

  test("allows a caller holding every required permission", () => {
    const staff = makeUser({
      roles: ["ACCOUNTS"],
      permissions: getEffectivePermissions(["ACCOUNTS"]),
    });
    assert.equal(runMiddleware(authorize("fees.manage", "fees.pay"), staff), undefined);
  });

  test("requires ALL permissions, not any", () => {
    const student = makeUser();
    const error = runMiddleware(
      authorize("attendance.read", "attendance.mark"),
      student
    );
    assert.ok(error instanceof AppError, "student must not pass attendance.mark");
  });

  test("role workspaces reject other roles", () => {
    const error = runMiddleware(authorizeRoles("STUDENT"), makeUser({ roles: ["FACULTY"] }));
    assert.ok(error instanceof AppError);
  });

  test("rejects a tenant permission when no institution context exists", () => {
    const error = runMiddleware(
      authorize("students.read"),
      makeUser({
        institutionId: null,
        roles: ["FACULTY"],
        permissions: ["students.read"],
      })
    );
    assert.ok(error instanceof AppError);
    assert.equal((error as AppError).statusCode, 403);
  });

  test("accepts a permitted parent portal read without student-directory access", () => {
    const parent = makeUser({
      roles: ["PARENT"],
      permissions: ["parent-portal.read"],
    });
    assert.equal(
      runMiddleware(
        authorizeAnyPermission("students.read", "parent-portal.read"),
        parent
      ),
      undefined
    );
  });
});

describe("tenant isolation", () => {
  test("a user cannot reach a record owned by another institution", () => {
    assert.throws(
      () => assertSameInstitution(makeUser(), "tenant-b"),
      (error: unknown) => error instanceof AppError
    );
  });

  test("a user may reach a record owned by their own institution", () => {
    assert.doesNotThrow(() => assertSameInstitution(makeUser(), "tenant-a"));
  });

  test("a user with no institution is never treated as a tenant member", () => {
    assert.throws(
      () =>
        assertSameInstitution(
          makeUser({ institutionId: null, roles: ["ACCOUNTS"] }),
          "tenant-a"
        ),
      (error: unknown) => error instanceof AppError
    );
  });
});

describe("notice permission policy", () => {
  test("tenant notice reads are available to institutional roles but not platform-only Super Admin", () => {
    for (const role of SYSTEM_ROLE_NAMES) {
      const permissions = getRolePermissions(role);
      assert.equal(
        permissions.includes("notices.read"),
        role !== "SUPER_ADMIN",
        `${role} tenant notice-read grant must match its authority domain`,
      );
    }
  });

  test("only explicit scoped writers receive notice management permission", () => {
    const writers = new Set<string>(NOTICE_MANAGEMENT_ROLES);
    assert.equal(writers.has("SUPER_ADMIN"), false);
    assert.equal(writers.has("STUDENT"), false);
    assert.equal(writers.has("PARENT"), false);
    for (const role of SYSTEM_ROLE_NAMES) {
      assert.equal(
        getRolePermissions(role).includes("notices.manage"),
        writers.has(role),
        `${role} notice-write permission must match the canonical writer policy`,
      );
    }
  });

  test("student remains read-only even when role permissions are recomputed", () => {
    assert.equal(getEffectivePermissions(["STUDENT"]).includes("notices.read"), true);
    assert.equal(getEffectivePermissions(["STUDENT"]).includes("notices.manage"), false);
    assert.equal(getEffectivePermissions(["PARENT"]).includes("notices.manage"), false);
  });
});

describe("role matrix", () => {
  test("students hold no management permissions", () => {
    for (const permission of [
      "fees.manage",
      "hr.manage",
      "library.manage",
      "certificates.issue",
      "users.create",
      "registration.approve",
    ] satisfies PermissionKey[]) {
      assert.equal(
        hasPermission(["STUDENT"], permission),
        false,
        `STUDENT must not hold ${permission}`
      );
    }
  });

  test("parents are read-only and never see fee management", () => {
    assert.equal(hasPermission(["PARENT"], "fees.read"), true);
    assert.equal(hasPermission(["PARENT"], "fees.manage"), false);
    assert.equal(hasPermission(["PARENT"], "marks.enter"), false);
  });

  test("platform-only permissions are not granted to institution roles", () => {
    assert.equal(isPlatformPermission("institutions.manage"), true);
    for (const role of ["INSTITUTION_ADMIN", "DIRECTOR", "ACCOUNTS", "HOD"]) {
      assert.equal(
        hasPermission([role], "institutions.manage"),
        false,
        `${role} must not manage institutions`
      );
    }
  });

  test("approval hierarchy is strict, not reflexive", () => {
    assert.equal(outranks(["HOD"], ["FACULTY"]), true);
    assert.equal(outranks(["FACULTY"], ["FACULTY"]), false);
    assert.equal(outranks(["FACULTY"], ["HOD"]), false);
    assert.equal(outranks(["INSTITUTION_ADMIN"], ["DIRECTOR"]), true);
  });
});

describe("calendar audience scoping", () => {
  test("a student never sees faculty-only or staff-only entries", () => {
    const audiences = visibleAudiences(makeUser());
    assert.deepEqual(audiences.sort(), ["ALL", "STUDENTS"]);
  });

  test("a parent is scoped to the student audience", () => {
    const audiences = visibleAudiences(
      makeUser({ roles: ["PARENT"], permissions: getEffectivePermissions(["PARENT"]) })
    );
    assert.equal(audiences.includes("FACULTY"), false);
    assert.equal(audiences.includes("STUDENTS"), true);
  });

  test("a calendar manager sees every audience", () => {
    const audiences = visibleAudiences(
      makeUser({
        roles: ["INSTITUTION_ADMIN"],
        permissions: getEffectivePermissions(["INSTITUTION_ADMIN"]),
      })
    );
    assert.deepEqual(audiences.sort(), ["ALL", "FACULTY", "STAFF", "STUDENTS"]);
  });
});
