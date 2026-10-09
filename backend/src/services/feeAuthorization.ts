/**
 * Canonical permission contract for the ERP Finance actions.
 *
 * Route middleware remains the security boundary. This map is shared by
 * service-level checks and regression tests so legacy aliases cannot silently
 * grant structure read/write access.
 */
export const FEE_ACTION_PERMISSIONS = {
  readFeeStructures: "fees.structure.read",
  manageFeeStructures: "fees.structure.manage",
  approveFeeStructure: "fees.structure.approve",
  assignFeeStructure: "fees.assign",
  createInvoice: "fees.manage",
  readInvoices: "fees.read",
  recordPayment: "fees.payment.record",
} as const;

export type FeeAction = keyof typeof FEE_ACTION_PERMISSIONS;

export function hasFeeActionPermission(
  permissions: readonly string[],
  action: FeeAction
): boolean {
  return permissions.includes(FEE_ACTION_PERMISSIONS[action]);
}
