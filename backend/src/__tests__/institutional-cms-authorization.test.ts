import assert from "node:assert/strict";
import test from "node:test";

import {
  approveInstitutionalCms,
  getInstitutionalCms,
  rejectInstitutionalCms,
  submitInstitutionalCms,
  updateInstitutionalCms,
} from "../services/institutionalCms.service";
import { AppError } from "../middleware/errorHandler";
import type { AuthenticatedUser } from "../types/auth";

const tenantId = "tenant-cms-auth-test";
const otherTenantId = "other-tenant-cms-auth-test";

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "cms-actor",
    institutionId: tenantId,
    email: "cms-actor@example.invalid",
    roles: ["INSTITUTION_ADMIN"],
    permissions: [],
    ...overrides,
  };
}

async function expectForbidden(operation: Promise<unknown>, message?: string) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AppError, "authorization failure must be a controlled AppError");
    assert.equal(error.statusCode, 403);
    if (message) assert.match(error.message, new RegExp(message));
    return true;
  });
}

test("tenant CMS rejects Super Admin access before reading tenant records", async () => {
  await expectForbidden(
    getInstitutionalCms(tenantId, actor({
      id: "platform-admin",
      institutionId: null,
      roles: ["SUPER_ADMIN"],
      permissions: ["site.manage"],
    })),
    "Platform administrators cannot access tenant CMS",
  );
});

test("tenant CMS rejects cross-institution reads and draft changes", async () => {
  const institutionAdmin = actor({
    permissions: ["institutional-cms.read", "institutional-cms.manage"],
  });
  await expectForbidden(getInstitutionalCms(otherTenantId, institutionAdmin), "another institution");
  await expectForbidden(
    updateInstitutionalCms(otherTenantId, institutionAdmin, { brand: { institutionName: "other" } }),
    "another institution",
  );
  await expectForbidden(submitInstitutionalCms(otherTenantId, institutionAdmin), "another institution");
});

test("Student and unrelated tenant roles cannot read, change, or submit Institutional CMS drafts", async () => {
  const student = actor({ roles: ["STUDENT"], permissions: ["notices.read"] });
  await expectForbidden(getInstitutionalCms(tenantId, student), "read permission");
  await expectForbidden(updateInstitutionalCms(tenantId, student, {}), "draft-management permission");
  await expectForbidden(submitInstitutionalCms(tenantId, student), "draft-management permission");
});

test("institutional draft writers cannot approve or reject without the approver role and permission", async () => {
  const institutionAdmin = actor({
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["institutional-cms.read", "institutional-cms.manage", "institutional-cms.approve"],
  });
  await expectForbidden(approveInstitutionalCms(tenantId, institutionAdmin), "approval authority");
  await expectForbidden(rejectInstitutionalCms(tenantId, institutionAdmin, "Not approved"), "approval authority");

  const chairmanWithoutPermission = actor({
    roles: ["CHAIRMAN"],
    permissions: ["institutional-cms.read"],
  });
  await expectForbidden(approveInstitutionalCms(tenantId, chairmanWithoutPermission), "approval authority");
  await expectForbidden(rejectInstitutionalCms(tenantId, chairmanWithoutPermission, "Not approved"), "approval authority");
});

test("CMS approver permissions do not grant draft-writer capabilities", async () => {
  const director = actor({
    roles: ["DIRECTOR"],
    permissions: ["institutional-cms.read", "institutional-cms.approve"],
  });
  await expectForbidden(
    updateInstitutionalCms(tenantId, director, {}),
    "draft-management permission",
  );
  await expectForbidden(
    submitInstitutionalCms(tenantId, director),
    "draft-management permission",
  );
});
