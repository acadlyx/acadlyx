import assert from "node:assert/strict";
import test from "node:test";

import {
  FEE_ACTION_PERMISSIONS,
  hasFeeActionPermission,
} from "../services/feeAuthorization";

test("fee actions map to the repository's existing route permissions", () => {
  assert.deepEqual(FEE_ACTION_PERMISSIONS, {
    readFeeStructures: "fees.structure.read",
    manageFeeStructures: "fees.structure.manage",
    approveFeeStructure: "fees.structure.approve",
    assignFeeStructure: "fees.assign",
    createInvoice: "fees.manage",
    readInvoices: "fees.read",
    recordPayment: "fees.payment.record",
  });
});

test("read-only Finance permission does not grant mutation actions", () => {
  const permissions = ["fees.structure.read", "fees.read"];

  assert.equal(hasFeeActionPermission(permissions, "readFeeStructures"), true);
  assert.equal(hasFeeActionPermission(permissions, "readInvoices"), true);
  assert.equal(hasFeeActionPermission(permissions, "manageFeeStructures"), false);
  assert.equal(hasFeeActionPermission(permissions, "approveFeeStructure"), false);
  assert.equal(hasFeeActionPermission(permissions, "assignFeeStructure"), false);
  assert.equal(hasFeeActionPermission(permissions, "createInvoice"), false);
  assert.equal(hasFeeActionPermission(permissions, "recordPayment"), false);
});

test("each Finance mutation requires its specific existing permission", () => {
  assert.equal(hasFeeActionPermission(["fees.structure.manage"], "manageFeeStructures"), true);
  assert.equal(hasFeeActionPermission(["fees.structure.manage"], "approveFeeStructure"), false);
  assert.equal(hasFeeActionPermission(["fees.structure.approve"], "approveFeeStructure"), true);
  assert.equal(hasFeeActionPermission(["fees.assign"], "assignFeeStructure"), true);
  assert.equal(hasFeeActionPermission(["fees.manage"], "createInvoice"), true);
  assert.equal(hasFeeActionPermission(["fees.payment.record"], "recordPayment"), true);
  assert.equal(hasFeeActionPermission(["fees.pay"], "recordPayment"), false);
});

test("legacy fees.manage does not grant fee-structure write access", () => {
  assert.equal(hasFeeActionPermission(["fees.manage"], "manageFeeStructures"), false);
});
