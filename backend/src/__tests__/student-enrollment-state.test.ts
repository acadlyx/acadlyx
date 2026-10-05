import assert from "node:assert/strict";
import test from "node:test";
import { classifyStudentEnrollmentState } from "../utils/studentEnrollmentState";

const valid = {
  status: "ACTIVE",
  program: { id: "p1", isActive: true, department: { id: "d1", isActive: true } },
  academicYear: { id: "y1", isCurrent: true },
  semester: { id: "s1", isActive: true, programId: "p1", academicYearId: "y1" },
  section: { id: "sec1", isActive: true, semesterId: "s1" },
};

test("student without master profile is PROFILE_MISSING", () => {
  assert.equal(classifyStudentEnrollmentState(null, valid), "PROFILE_MISSING");
});

test("student with profile but no enrollment is MISSING", () => {
  assert.equal(classifyStudentEnrollmentState({}, null), "MISSING");
});

test("valid current enrollment is ENROLLED", () => {
  assert.equal(classifyStudentEnrollmentState({}, valid), "ENROLLED");
});

test("inactive enrollment or broken academic relationships is INVALID", () => {
  assert.equal(classifyStudentEnrollmentState({}, { ...valid, status: "COMPLETED" }), "INVALID");
  assert.equal(
    classifyStudentEnrollmentState({}, {
      ...valid,
      semester: { ...valid.semester, programId: "wrong-program" },
    }),
    "INVALID"
  );
  assert.equal(
    classifyStudentEnrollmentState({}, {
      ...valid,
      section: { ...valid.section, semesterId: "wrong-semester" },
    }),
    "INVALID"
  );
});

test("historical enrollment is not treated as the current enrolled state", () => {
  assert.equal(
    classifyStudentEnrollmentState({}, {
      ...valid,
      academicYear: { id: "old-year", isCurrent: false },
    }),
    "INVALID"
  );
});
