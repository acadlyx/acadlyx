export const REGISTRATION_SEAT_RESERVING_STATUSES = ["REQUESTED", "APPROVED"] as const;

export interface RegistrationCalendar {
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
  addDropDeadline?: Date | null;
  startDate?: Date | null;
  withdrawalDeadline?: Date | null;
  exceptionalWithdrawalAllowed?: boolean;
  exceptionalWithdrawalStartsAt?: Date | null;
  exceptionalWithdrawalEndsAt?: Date | null;
}

export function isRegistrationAllowed(now: Date, policy: Pick<RegistrationCalendar, "registrationOpensAt" | "registrationClosesAt">, offeringOpen: boolean): boolean {
  return offeringOpen && (!policy.registrationOpensAt || now >= policy.registrationOpensAt) && (!policy.registrationClosesAt || now <= policy.registrationClosesAt);
}

export function isStudentCancellationAllowed(now: Date, policy: Pick<RegistrationCalendar, "registrationOpensAt" | "registrationClosesAt" | "addDropDeadline">, offeringOpen: boolean): boolean {
  if (policy.registrationOpensAt && now < policy.registrationOpensAt) return false;
  // An explicit add/drop date is authoritative and must not be shortened
  // by the separate offering-registration toggle.
  if (policy.addDropDeadline) return now <= policy.addDropDeadline;
  return Boolean(offeringOpen && policy.registrationClosesAt && now <= policy.registrationClosesAt);
}

export function isWithdrawalRequestAllowed(now: Date, policy: Pick<RegistrationCalendar, "startDate" | "withdrawalDeadline" | "exceptionalWithdrawalAllowed" | "exceptionalWithdrawalStartsAt" | "exceptionalWithdrawalEndsAt">): boolean {
  const normal = Boolean(policy.withdrawalDeadline && (!policy.startDate || now >= policy.startDate) && now <= policy.withdrawalDeadline);
  const exceptional = Boolean(policy.exceptionalWithdrawalAllowed && policy.exceptionalWithdrawalStartsAt && policy.exceptionalWithdrawalEndsAt && now >= policy.exceptionalWithdrawalStartsAt && now <= policy.exceptionalWithdrawalEndsAt);
  return normal || exceptional;
}

export function canStudentCancelRegistration(status: string): boolean {
  return status === "REQUESTED";
}

export function canTransitionRegistration(from: string, to: string): boolean {
  const transitions: Record<string, readonly string[]> = {
    REQUESTED: ["APPROVED", "REJECTED", "NEEDS_CORRECTION", "DROPPED"],
    NEEDS_CORRECTION: ["REQUESTED"],
    APPROVED: ["WITHDRAWN", "DROPPED"],
    REJECTED: [], DROPPED: [], WITHDRAWN: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
