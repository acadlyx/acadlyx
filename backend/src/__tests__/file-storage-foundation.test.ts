import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTenantFolder,
  deleteExternalBeforeMetadata,
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


test("storage metadata is deleted only after provider cleanup succeeds", async () => {
  const calls: string[] = [];
  await deleteExternalBeforeMetadata(
    async () => { calls.push("provider"); },
    async () => { calls.push("metadata"); },
  );
  assert.deepEqual(calls, ["provider", "metadata"]);
});

test("failed provider cleanup preserves storage metadata for retry", async () => {
  const calls: string[] = [];
  await assert.rejects(
    deleteExternalBeforeMetadata(
      async () => {
        calls.push("provider");
        throw new Error("provider unavailable");
      },
      async () => { calls.push("metadata"); },
    ),
    /provider unavailable/,
  );
  assert.deepEqual(calls, ["provider"]);
});
