import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../types/auth";
import { canManageLibraryCirculation } from "../services/library.service";

function actor(roles: string[], permissions: string[]): AuthenticatedUser {
  return {
    id: "test-user",
    institutionId: "test-institution",
    email: "library-role-test@integration.invalid",
    idNumber: "LIBRARY-ROLE-TEST",
    firstName: "Library",
    lastName: "Test",
    roles,
    permissions,
    sessionId: "test-session",
  } as AuthenticatedUser;
}

test("only an effective Librarian workspace can circulate books for other users", () => {
  assert.equal(canManageLibraryCirculation(actor(["LIBRARIAN"], ["library.manage"])), true);
  assert.equal(canManageLibraryCirculation(actor(["STUDENT", "LIBRARIAN"], ["library.manage", "library.borrow"])), false);
  assert.equal(canManageLibraryCirculation(actor(["PARENT", "LIBRARIAN"], ["library.manage", "library.borrow"])), false);
  assert.equal(canManageLibraryCirculation(actor(["INSTITUTION_ADMIN", "LIBRARIAN"], ["library.manage"])), false);
  assert.equal(canManageLibraryCirculation(actor(["LIBRARIAN"], ["library.borrow"])), false);
});
