import assert from "node:assert/strict";
import test from "node:test";

import {
  FEE_ACTION_PERMISSIONS,
  hasFeeActionPermission,
} from "../services/feeAuthorization";

test("Finance actions map to existing backend authorization permissions", () => {
  assert.deepEqual(FEE_ACTION_PERMISSIONS, {
    readFeeStructures: "fees.structure.read",
    manageFeeStructures: "fees.structure.manage",
    approveFeeStructure: "fees.structure.approve",
    assignFeeStructure: "fees.assign",
    readFinancialRecords: "fees.read",
    createInvoice: "fees.invoice.manage",
    cancelInvoice: "fees.invoice.manage",
    recordPayment: "fees.payment.record",
    manageConcession: "fees.concession.manage",
    approveConcession: "fees.concession.approve",
    requestRefund: "fees.refund.request",
    approveRefund: "fees.refund.approve",
    processRefund: "fees.refund.process",
    exportReports: "fees.reports.export",
  });
});

test("read-only Finance access does not grant mutation actions", () => {
  const permissions = ["fees.structure.read", "fees.read"];

  assert.equal(hasFeeActionPermission(permissions, "readFeeStructures"), true);
  assert.equal(hasFeeActionPermission(permissions, "readFinancialRecords"), true);
  assert.equal(hasFeeActionPermission(permissions, "manageFeeStructures"), false);
  assert.equal(hasFeeActionPermission(permissions, "approveFeeStructure"), false);
  assert.equal(hasFeeActionPermission(permissions, "assignFeeStructure"), false);
  assert.equal(hasFeeActionPermission(permissions, "createInvoice"), false);
  assert.equal(hasFeeActionPermission(permissions, "recordPayment"), false);
  assert.equal(hasFeeActionPermission(permissions, "approveConcession"), false);
  assert.equal(hasFeeActionPermission(permissions, "processRefund"), false);
});

test("each Finance mutation requires its specific existing permission", () => {
  assert.equal(hasFeeActionPermission(["fees.structure.manage"], "manageFeeStructures"), true);
  assert.equal(hasFeeActionPermission(["fees.structure.manage"], "approveFeeStructure"), false);
  assert.equal(hasFeeActionPermission(["fees.structure.approve"], "approveFeeStructure"), true);
  assert.equal(hasFeeActionPermission(["fees.assign"], "assignFeeStructure"), true);
  assert.equal(hasFeeActionPermission(["fees.invoice.manage"], "createInvoice"), true);
  assert.equal(hasFeeActionPermission(["fees.payment.record"], "recordPayment"), true);
  assert.equal(hasFeeActionPermission(["fees.concession.manage"], "manageConcession"), true);
  assert.equal(hasFeeActionPermission(["fees.concession.approve"], "approveConcession"), true);
  assert.equal(hasFeeActionPermission(["fees.refund.request"], "requestRefund"), true);
  assert.equal(hasFeeActionPermission(["fees.refund.approve"], "approveRefund"), true);
  assert.equal(hasFeeActionPermission(["fees.refund.process"], "processRefund"), true);
  assert.equal(hasFeeActionPermission(["fees.reports.export"], "exportReports"), true);
  assert.equal(hasFeeActionPermission(["fees.pay"], "recordPayment"), false);
});

test("legacy broad permissions do not silently grant specialized actions", () => {
  for (const action of [
    "manageFeeStructures",
    "approveFeeStructure",
    "assignFeeStructure",
    "createInvoice",
    "recordPayment",
    "approveConcession",
    "processRefund",
  ] as const) {
    assert.equal(hasFeeActionPermission(["fees.manage"], action), false, action);
    assert.equal(hasFeeActionPermission(["fees.admin"], action), false, action);
  }
});
