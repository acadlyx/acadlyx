import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { authorize, authorizeAnyPermission } from "../middleware/authorize";

function invoke(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  permissions: string[],
  institutionId: string | null = "institution-a",
  roles: string[] = ["ACCOUNTS"]
): unknown {
  let receivedError: unknown;
  const req = {
    user: {
      id: "user-a",
      institutionId,
      roles,
      permissions,
    },
  } as unknown as Request;
  middleware(req, {} as Response, (error?: unknown) => {
    receivedError = error;
  });
  return receivedError;
}

test("Finance route authorization allows the exact required permission", () => {
  for (const permission of [
    "fees.structure.read",
    "fees.structure.manage",
    "fees.structure.approve",
    "fees.assign",
    "fees.read",
    "fees.invoice.manage",
    "fees.payment.record",
    "fees.concession.manage",
    "fees.concession.approve",
    "fees.refund.request",
    "fees.refund.approve",
    "fees.refund.process",
  ] as const) {
    assert.equal(invoke(authorize(permission), [permission]), undefined, permission);
  }
});

test("read-only access cannot call Finance mutation routes", () => {
  for (const permission of [
    "fees.structure.manage",
    "fees.structure.approve",
    "fees.assign",
    "fees.invoice.manage",
    "fees.payment.record",
    "fees.concession.manage",
    "fees.concession.approve",
    "fees.refund.request",
    "fees.refund.approve",
    "fees.refund.process",
  ] as const) {
    assert.ok(invoke(authorize(permission), ["fees.read"]), permission);
  }
});

test("legacy fees.pay and Finance fees.payment.record remain distinct", () => {
  assert.ok(invoke(authorize("fees.payment.record"), ["fees.pay"]));
  assert.ok(invoke(authorize("fees.pay"), ["fees.payment.record"]));
  assert.equal(invoke(authorize("fees.pay"), ["fees.pay"]), undefined);
  assert.equal(invoke(authorize("fees.payment.record"), ["fees.payment.record"]), undefined);
});

test("institutional Finance routes reject a missing tenant context", () => {
  assert.ok(invoke(authorize("fees.read"), ["fees.read"], null));
});

test("export and command-center alternatives retain their existing any-permission contract", () => {
  assert.equal(invoke(authorizeAnyPermission("fees.reports.export", "fees.read"), ["fees.read"]), undefined);
  assert.equal(invoke(authorizeAnyPermission("fees.read", "fees.collection.read"), ["fees.collection.read"]), undefined);
  assert.ok(invoke(authorizeAnyPermission("fees.reports.export", "fees.read"), ["fees.payment.record"]));
});
