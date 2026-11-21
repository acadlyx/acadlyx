import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../config/rbac";
import { decideEnrollmentRequestSchema } from "../validators/enrollmentRequest.validators";
import { bulkDecisionSchema, registerSchema } from "../validators/registration.validators";
import {
  canStudentCancelRegistration,
  canStudentResubmitRegistration,
  hasCapacityForReservations,
  isSeatReservingRegistrationStatus,
  canTransitionRegistrationState,
  isRegistrationAllowed,
  isAddDropAllowed,
  isWithdrawalRequestAllowed,
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

test("capacity reductions cannot exceed the seat reservations", () => {
  assert.equal(hasCapacityForReservations(null, 25), true);
  assert.equal(hasCapacityForReservations(25, 25), true);
  assert.equal(hasCapacityForReservations(24, 25), false);
  assert.equal(hasCapacityForReservations(0, 0), true);
});

test("registration calendar windows are enforced using supplied server time", () => {
  const opens = new Date("2026-06-01T00:00:00.000Z");
  const closes = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(isRegistrationAllowed(new Date("2026-05-31T23:59:59.000Z"), { registrationOpensAt: opens, registrationClosesAt: closes }, true), false);
  assert.equal(isRegistrationAllowed(new Date("2026-06-05T12:00:00.000Z"), { registrationOpensAt: opens, registrationClosesAt: closes }, true), true);
  assert.equal(isRegistrationAllowed(new Date("2026-06-11T00:00:00.000Z"), { registrationOpensAt: opens, registrationClosesAt: closes }, true), false);
  assert.equal(isRegistrationAllowed(new Date("2026-06-05T12:00:00.000Z"), { registrationOpensAt: opens, registrationClosesAt: closes }, false), false);
});

test("add/drop deadline takes precedence over manual registration close", () => {
  const deadline = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(isAddDropAllowed(new Date("2026-06-09T23:59:00.000Z"), { addDropDeadline: deadline }, false), true);
  assert.equal(isAddDropAllowed(new Date("2026-06-11T00:00:00.000Z"), { addDropDeadline: deadline }, true), false);
  assert.equal(isAddDropAllowed(new Date("2026-06-09T23:59:00.000Z"), {}, false), false);
});

test("formal withdrawal requires a configured normal or exceptional window", () => {
  const normal = new Date("2026-06-10T00:00:00.000Z");
  assert.equal(isWithdrawalRequestAllowed(new Date("2026-06-09T00:00:00.000Z"), { withdrawalDeadline: normal }), true);
  assert.equal(isWithdrawalRequestAllowed(new Date("2026-06-11T00:00:00.000Z"), { withdrawalDeadline: normal }), false);
  assert.equal(isWithdrawalRequestAllowed(new Date("2026-06-11T00:00:00.000Z"), {
    exceptionalWithdrawalAllowed: true,
    exceptionalWithdrawalStartsAt: new Date("2026-06-11T00:00:00.000Z"),
    exceptionalWithdrawalEndsAt: new Date("2026-06-12T00:00:00.000Z"),
  }), true);
  assert.equal(isWithdrawalRequestAllowed(new Date("2026-06-11T00:00:00.000Z"), {}), false);
});

test("registration transition matrix rejects silent reactivation and invalid decisions", () => {
  assert.equal(canTransitionRegistrationState("REQUESTED", "APPROVED"), true);
  assert.equal(canTransitionRegistrationState("REQUESTED", "REJECTED"), true);
  assert.equal(canTransitionRegistrationState("REQUESTED", "NEEDS_CORRECTION"), true);
  assert.equal(canTransitionRegistrationState("REQUESTED", "DROPPED"), true);
  assert.equal(canTransitionRegistrationState("NEEDS_CORRECTION", "REQUESTED"), true);
  assert.equal(canTransitionRegistrationState("APPROVED", "WITHDRAWN"), true);
  assert.equal(canTransitionRegistrationState("APPROVED", "DROPPED"), false);
  assert.equal(canTransitionRegistrationState("DROPPED", "REQUESTED"), false);
  assert.equal(canTransitionRegistrationState("REJECTED", "REQUESTED"), false);
  assert.equal(canTransitionRegistrationState("WITHDRAWN", "REQUESTED"), false);
});
