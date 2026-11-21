import assert from "node:assert/strict";
import test from "node:test";

import { buildStudentProfileUpdateFields, normalizeStudentStatus, parseWorkbook } from "../services/import.service";

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

test("blank student-import columns preserve existing profile fields and status", () => {
  const update = buildStudentProfileUpdateFields({
    row: {
      gender: "",
      address: "",
      guardianname: "",
      dateofbirth: "",
      admissiondate: "",
      status: "",
    },
    admissionNumber: "ADM-100",
    dateOfBirth: null,
    admissionDate: null,
    normalizedStatus: "ACTIVE",
  });

  assert.deepEqual(update, { admissionNumber: "ADM-100" });
});

test("student import updates only optional fields actually supplied", () => {
  const dateOfBirth = new Date("2008-05-04T00:00:00.000Z");
  const update = buildStudentProfileUpdateFields({
    row: {
      gender: " Female ",
      address: "",
      guardianname: " Parent One ",
      dateofbirth: "2008-05-04",
      status: "inactive",
    },
    admissionNumber: "ADM-200",
    dateOfBirth,
    admissionDate: null,
    normalizedStatus: normalizeStudentStatus("inactive"),
  });

  assert.deepEqual(update, {
    admissionNumber: "ADM-200",
    dateOfBirth,
    gender: "Female",
    guardianName: "Parent One",
    status: "INACTIVE",
  });
});

test("student import rejects invalid non-empty dates instead of saving them as missing values", () => {
  assert.throws(
    () => buildStudentProfileUpdateFields({
      row: { dateofbirth: "not-a-date" },
      admissionNumber: "ADM-300",
      dateOfBirth: null,
      admissionDate: null,
      normalizedStatus: "ACTIVE",
    }),
    /Invalid date of birth/,
  );
});

test("CSV import normalizes spaced headers and preserves UTF-8 row values", () => {
  const csv = Buffer.from(
    "Admission Number,First Name,Last Name\nADM-CSV-1,Asha,Sharma",
    "utf8",
  );
  const parsed = parseWorkbook(csv);
  assert.equal(parsed.totalRows, 1);
  assert.deepEqual(parsed.rows[0], {
    admissionnumber: "ADM-CSV-1",
    firstname: "Asha",
    lastname: "Sharma",
  });
});

test("CSV import accepts a UTF-8 BOM", () => {
  const csv = Buffer.from(
    "\uFEFFAdmission Number,First Name\nADM-BOM-1,Asha",
    "utf8",
  );
  assert.deepEqual(parseWorkbook(csv).rows[0], {
    admissionnumber: "ADM-BOM-1",
    firstname: "Asha",
  });
});
