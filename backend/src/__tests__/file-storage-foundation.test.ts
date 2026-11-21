import test from "node:test";
import type { Request } from "express";
import { assertModuleAccess } from "../controllers/fileStorage.controller";
import assert from "node:assert/strict";

import {
  buildTenantFolder,
  validateAllowedMime,
} from "../services/fileStorage.service";

test("storage folders are tenant isolated and module scoped", () => {
  assert.equal(
    buildTenantFolder("tenant-123", "admissions", "user-456"),
    "acadlyx/tenant-123/admissions/user-456",
  );

  assert.equal(
    buildTenantFolder("tenant-123", "examinations"),
    "acadlyx/tenant-123/examinations",
  );
});

test("storage folder module names are normalized", () => {
  assert.equal(
    buildTenantFolder("tenant-123", "Student Documents"),
    "acadlyx/tenant-123/student-documents",
  );
});

test("storage MIME validation rejects unapproved types", () => {
  assert.throws(
    () => validateAllowedMime("application/x-msdownload", ["application/pdf", "image/png"]),
    /not allowed/,
  );

  assert.doesNotThrow(() =>
    validateAllowedMime("application/pdf", ["application/pdf", "image/png"]),
  );
});


test("platform role does not bypass tenant-module upload and deletion permissions", () => {
  const platformAdminWithoutTenantGrant = {
    user: {
      id: "platform-admin",
      institutionId: "tenant-a",
      roles: ["SUPER_ADMIN"],
      permissions: [],
    },
  } as unknown as Request;

  assert.throws(
    () => assertModuleAccess(platformAdminWithoutTenantGrant, "expenses", "expenses.manage"),
    /not allowed to upload files for this module/,
  );

  const platformAdminWithExplicitGrant = {
    user: {
      id: "platform-admin",
      institutionId: "tenant-a",
      roles: ["SUPER_ADMIN"],
      permissions: ["expenses.manage"],
    },
  } as unknown as Request;

  assert.doesNotThrow(() =>
    assertModuleAccess(platformAdminWithExplicitGrant, "expenses", "expenses.manage"),
  );
});
