/**
 * Shared registration policy primitives. Keep seat reservation and student
 * self-service transitions consistent across the catalogue and mutations.
 */
export const REGISTRATION_SEAT_RESERVING_STATUSES = ["REQUESTED", "APPROVED"] as const;

export function isSeatReservingRegistrationStatus(status: string): boolean {
  return REGISTRATION_SEAT_RESERVING_STATUSES.includes(status as (typeof REGISTRATION_SEAT_RESERVING_STATUSES)[number]);
}

export function canStudentCancelRegistration(status: string): boolean {
  return status === "REQUESTED";
}

export function canStudentResubmitRegistration(status: string): boolean {
  return status === "NEEDS_CORRECTION";
}

export function hasCapacityForReservations(
  capacity: number | null,
  reservedCount: number
): boolean {
  return capacity === null || (Number.isInteger(capacity) && capacity >= reservedCount);
}
