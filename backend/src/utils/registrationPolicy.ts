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


export type RegistrationCalendar = {
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
  addDropDeadline?: Date | null;
  startDate?: Date | null;
  withdrawalDeadline?: Date | null;
  exceptionalWithdrawalAllowed?: boolean;
  exceptionalWithdrawalStartsAt?: Date | null;
  exceptionalWithdrawalEndsAt?: Date | null;
};

export function isWithinConfiguredWindow(now: Date, opensAt?: Date | null, closesAt?: Date | null): boolean {
  return (!opensAt || now >= opensAt) && (!closesAt || now <= closesAt);
}

export function isRegistrationAllowed(
  now: Date,
  policy: Pick<RegistrationCalendar, "registrationOpensAt" | "registrationClosesAt">,
  manualOpen: boolean
): boolean {
  return manualOpen && isWithinConfiguredWindow(now, policy.registrationOpensAt, policy.registrationClosesAt);
}

export function isAddDropAllowed(
  now: Date,
  policy: Pick<RegistrationCalendar, "addDropDeadline">,
  manualOpen: boolean
): boolean {
  return policy.addDropDeadline ? now <= policy.addDropDeadline : manualOpen;
}

export function isWithdrawalRequestAllowed(
  now: Date,
  policy: Pick<RegistrationCalendar, "startDate" | "withdrawalDeadline" | "exceptionalWithdrawalAllowed" | "exceptionalWithdrawalStartsAt" | "exceptionalWithdrawalEndsAt">
): boolean {
  const normalWindowOpen = Boolean(
    policy.withdrawalDeadline &&
    (!policy.startDate || now >= policy.startDate) &&
    now <= policy.withdrawalDeadline
  );
  const exceptionalWindowOpen = Boolean(
    policy.exceptionalWithdrawalAllowed &&
    policy.exceptionalWithdrawalStartsAt &&
    policy.exceptionalWithdrawalEndsAt &&
    now >= policy.exceptionalWithdrawalStartsAt &&
    now <= policy.exceptionalWithdrawalEndsAt
  );
  return normalWindowOpen || exceptionalWindowOpen;
}

export const REGISTRATION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  REQUESTED: ["APPROVED", "REJECTED", "NEEDS_CORRECTION", "DROPPED"],
  NEEDS_CORRECTION: ["REQUESTED"],
  APPROVED: ["WITHDRAWN"],
  REJECTED: [],
  DROPPED: [],
  WITHDRAWN: [],
};

export function canTransitionRegistrationState(from: string, to: string): boolean {
  return REGISTRATION_TRANSITIONS[from]?.includes(to) ?? false;
}
