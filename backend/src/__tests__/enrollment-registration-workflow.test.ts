import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../config/rbac";
import { decideEnrollmentRequestSchema } from "../validators/enrollmentRequest.validators";
import { bulkDecisionSchema, registerSchema, registrationListQuery, availableOfferingsQuery, withdrawalRequestSchema, withdrawalDecisionSchema } from "../validators/registration.validators";
import { canStudentCancelRegistration, canTransitionRegistration, isRegistrationAllowed, isStudentCancellationAllowed, isWithdrawalRequestAllowed } from "../utils/registrationPolicy";

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


test("registration search parameters survive query validation", () => {
  const list = registrationListQuery.safeParse({ search: "  algorithms " });
  assert.equal(list.success, true);
  if (list.success) assert.equal(list.data.search, "algorithms");
  const offerings = availableOfferingsQuery.safeParse({ search: " CS-101 " });
  assert.equal(offerings.success, true);
  if (offerings.success) assert.equal(offerings.data.search, "CS-101");
});

test("student course transitions prevent unrestricted drop and re-registration", () => {
  assert.equal(canStudentCancelRegistration("REQUESTED"), true);
  assert.equal(canStudentCancelRegistration("APPROVED"), false);
  assert.equal(canStudentCancelRegistration("DROPPED"), false);
  assert.equal(canTransitionRegistration("DROPPED", "REQUESTED"), false);
  assert.equal(canTransitionRegistration("REJECTED", "REQUESTED"), false);
  assert.equal(canTransitionRegistration("WITHDRAWN", "REQUESTED"), false);
  assert.equal(canTransitionRegistration("NEEDS_CORRECTION", "REQUESTED"), true);
  assert.equal(canTransitionRegistration("APPROVED", "WITHDRAWN"), true);
});

test("calendar windows fail closed when add/drop and withdrawal policies are not configured", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  assert.equal(isRegistrationAllowed(now, {}, true), true);
  assert.equal(isStudentCancellationAllowed(now, {}, true), false);
  assert.equal(isStudentCancellationAllowed(now, { registrationOpensAt: new Date("2026-09-01T00:00:00Z"), registrationClosesAt: new Date("2026-09-15T00:00:00Z") }, true), true);
  assert.equal(isStudentCancellationAllowed(now, { addDropDeadline: new Date("2026-09-05T00:00:00Z") }, true), false);
  assert.equal(isWithdrawalRequestAllowed(now, {}), false);
  assert.equal(isWithdrawalRequestAllowed(now, { startDate: new Date("2026-08-01T00:00:00Z"), withdrawalDeadline: new Date("2026-09-15T00:00:00Z") }), true);
});

test("withdrawal inputs require a reason and require a note for rejection", () => {
  assert.equal(withdrawalRequestSchema.safeParse({ reason: "Need to change course" }).success, true);
  assert.equal(withdrawalRequestSchema.safeParse({ reason: "bad" }).success, false);
  assert.equal(withdrawalDecisionSchema.safeParse({ decision: "REJECTED" }).success, false);
  assert.equal(withdrawalDecisionSchema.safeParse({ decision: "APPROVED" }).success, true);
});
