/**
 * Canonical action-to-permission contract for the Finance API.
 * Route middleware remains the security boundary; these definitions are used
 * by fee-structure service guards and regression tests.
 */
export const FEE_ACTION_PERMISSIONS = {
  readFeeStructures: "fees.structure.read",
  manageFeeStructures: "fees.structure.manage",
  approveFeeStructure: "fees.structure.approve",
  assignFeeStructure: "fees.assign",
  readFinancialRecords: "fees.read",
  createInvoice: "fees.invoice.manage",
  cancelInvoice: "fees.invoice.manage",
  recordPayment: "fees.payment.record",
  recordLegacyErpPayment: "fees.pay",
  manageConcession: "fees.concession.manage",
  approveConcession: "fees.concession.approve",
  requestRefund: "fees.refund.request",
  approveRefund: "fees.refund.approve",
  processRefund: "fees.refund.process",
  exportReports: "fees.reports.export",
} as const;

export type FeeAction = keyof typeof FEE_ACTION_PERMISSIONS;

export function hasFeeActionPermission(
  permissions: readonly string[],
  action: FeeAction
): boolean {
  return permissions.includes(FEE_ACTION_PERMISSIONS[action]);
}
