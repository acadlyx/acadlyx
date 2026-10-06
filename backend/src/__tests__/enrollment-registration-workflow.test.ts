import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../config/rbac";
import { decideEnrollmentRequestSchema } from "../validators/enrollmentRequest.validators";
import { bulkDecisionSchema, registerSchema } from "../validators/registration.validators";

test("student/HOD enrollment permissions are separated", () => {
  assert.ok(ROLE_PERMISSIONS.STUDENT.includes("enrollment.submit"));
  assert.ok(ROLE_PERMISSIONS.STUDENT.includes("enrollment.read"));
  assert.ok(!ROLE_PERMISSIONS.STUDENT.includes("enrollment.approve"));
  assert.ok(ROLE_PERMISSIONS.HOD.includes("enrollment.read"));
  assert.ok(ROLE_PERMISSIONS.HOD.includes("enrollment.approve"));
});

test("enrollment rejection and correction require a reason", () => {
  assert.equal(decideEnrollmentRequestSchema.safeParse({ decision: "REJECTED" }).success, false);
  assert.equal(decideEnrollmentRequestSchema.safeParse({ decision: "NEEDS_CORRECTION" }).success, false);
  assert.equal(decideEnrollmentRequestSchema.safeParse({ decision: "APPROVED" }).success, true);
});

test("bulk registration decisions require remarks for non-approval", () => {
  assert.equal(bulkDecisionSchema.safeParse({ registrationIds: ["00000000-0000-4000-8000-000000000001"], decision: "REJECTED" }).success, false);
  assert.equal(bulkDecisionSchema.safeParse({ registrationIds: ["00000000-0000-4000-8000-000000000001"], decision: "REJECTED", remarks: "Prerequisite not met" }).success, true);
});

test("registration input remains offering-based and student-scoped", () => {
  assert.equal(registerSchema.safeParse({ courseOfferingId: "00000000-0000-4000-8000-000000000001" }).success, true);
  assert.equal(registerSchema.safeParse({ courseOfferingId: "00000000-0000-4000-8000-000000000001", studentId: "00000000-0000-4000-8000-000000000002" }).success, true);
});
