import assert from "node:assert/strict";
import test from "node:test";

import { classifyImportJobReuse } from "../services/import.service";

const request = {
  jobPayload: {
    fileId: "previous-file",
    importType: "students",
    mode: "atomic",
  },
  jobCreatorId: "actor-1",
  uploadedFileId: "new-file",
  actorId: "actor-1",
  type: "students" as const,
  mode: "atomic" as const,
};

test("a new background import job retains the newly uploaded file", () => {
  assert.equal(
    classifyImportJobReuse({ ...request, jobPayload: { ...request.jobPayload, fileId: "new-file" } }),
    "new-job",
  );
});

test("same actor and same import request safely reuses the prior job", () => {
  assert.equal(classifyImportJobReuse(request), "reuse-same-request");
});

test("an identical upload cannot expose another actor's background job", () => {
  assert.equal(
    classifyImportJobReuse({ ...request, jobCreatorId: "actor-2" }),
    "different-owner",
  );
});

test("a duplicate upload with a different type or mode is rejected instead of silently reusing incompatible work", () => {
  assert.equal(classifyImportJobReuse({ ...request, mode: "partial" }), "different-request");
  assert.equal(classifyImportJobReuse({ ...request, type: "faculty" }), "different-request");
});

test("malformed background-job payloads are never reused", () => {
  assert.equal(classifyImportJobReuse({ ...request, jobPayload: { fileId: "old-file" } }), "invalid-payload");
  assert.equal(classifyImportJobReuse({ ...request, jobPayload: null }), "invalid-payload");
});
