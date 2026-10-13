import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStudentStatus } from "../services/import.service";

test("student import status normalization accepts common case and whitespace variants", () => {
  assert.equal(normalizeStudentStatus("Active"), "ACTIVE");
  assert.equal(normalizeStudentStatus(" active "), "ACTIVE");
  assert.equal(normalizeStudentStatus(" inactive "), "INACTIVE");
  assert.equal(normalizeStudentStatus("Graduated"), "GRADUATED");
  assert.equal(normalizeStudentStatus("Withdrawn"), "WITHDRAWN");
  assert.equal(normalizeStudentStatus("Transferred"), "TRANSFERRED");
});

test("student import defaults missing status to ACTIVE", () => {
  assert.equal(normalizeStudentStatus(""), "ACTIVE");
  assert.equal(normalizeStudentStatus(null), "ACTIVE");
  assert.equal(normalizeStudentStatus(undefined), "ACTIVE");
});

test("student import rejects unknown statuses rather than silently persisting them", () => {
  assert.throws(
    () => normalizeStudentStatus("pending"),
    /Invalid student status/,
  );
});
