import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../config/rbac";
import { decideEnrollmentRequestSchema } from "../validators/enrollmentRequest.validators";
import { bulkDecisionSchema, registerSchema } from "../validators/registration.validators";
import {
  canStudentCancelRegistration,
  canStudentResubmitRegistration,
  isSeatReservingRegistrationStatus,
} from "../utils/registrationPolicy";

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

test("course registration state policy reserves seats consistently", () => {
  assert.equal(isSeatReservingRegistrationStatus("REQUESTED"), true);
  assert.equal(isSeatReservingRegistrationStatus("APPROVED"), true);
  assert.equal(isSeatReservingRegistrationStatus("DROPPED"), false);
  assert.equal(isSeatReservingRegistrationStatus("REJECTED"), false);
});

test("students may only cancel pending requests directly", () => {
  assert.equal(canStudentCancelRegistration("REQUESTED"), true);
  assert.equal(canStudentCancelRegistration("APPROVED"), false);
  assert.equal(canStudentCancelRegistration("DROPPED"), false);
  assert.equal(canStudentCancelRegistration("REJECTED"), false);
});

test("only correction-required registrations may be resubmitted in place", () => {
  assert.equal(canStudentResubmitRegistration("NEEDS_CORRECTION"), true);
  assert.equal(canStudentResubmitRegistration("REQUESTED"), false);
  assert.equal(canStudentResubmitRegistration("APPROVED"), false);
  assert.equal(canStudentResubmitRegistration("REJECTED"), false);
  assert.equal(canStudentResubmitRegistration("DROPPED"), false);
});
