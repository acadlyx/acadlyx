import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { PERMISSIONS, ROLE_PERMISSIONS } from "../config/rbac";

test("fee-structure access is granted only through canonical scoped permissions", () => {
  const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));
  assert.ok(permissionKeys.has("fees.structure.read"));
  assert.ok(permissionKeys.has("fees.structure.manage"));
  assert.ok(permissionKeys.has("fees.structure.approve"));
  assert.ok(permissionKeys.has("fees.structure.publish"));
  assert.ok(ROLE_PERMISSIONS.CHAIRMAN.includes("fees.structure.publish"));
  assert.ok(!ROLE_PERMISSIONS.DIRECTOR.includes("fees.structure.publish"));

  for (const role of ["CHAIRMAN", "MANAGEMENT", "ACCOUNTS"] as const) {
    assert.ok(
      ROLE_PERMISSIONS[role].includes("fees.structure.read"),
      `${role} must be able to read fee structures`,
    );
    assert.ok(
      ROLE_PERMISSIONS[role].includes("fees.structure.manage"),
      `${role} must receive fee-structure write access only through the existing role policy`,
    );
    assert.ok(ROLE_PERMISSIONS[role].includes("academic-years.read"), role + " needs academic-year lookup access");
    assert.ok(ROLE_PERMISSIONS[role].includes("semesters.read"), role + " needs semester lookup access");
  }
  assert.ok(!ROLE_PERMISSIONS.INSTITUTION_ADMIN.includes("fees.structure.read"));
  assert.ok(!ROLE_PERMISSIONS.INSTITUTION_ADMIN.includes("fees.structure.manage"));
  assert.ok(ROLE_PERMISSIONS.INSTITUTION_ADMIN.includes("academic-years.read"));
  assert.ok(ROLE_PERMISSIONS.INSTITUTION_ADMIN.includes("semesters.read"));

  for (const role of ["STUDENT", "PARENT", "FACULTY", "HOD"] as const) {
    assert.ok(
      !ROLE_PERMISSIONS[role].includes("fees.structure.read"),
      `${role} must not gain access to institutional fee-structure administration`,
    );
    assert.ok(
      !ROLE_PERMISSIONS[role].includes("fees.structure.manage"),
      `${role} must not gain fee-structure write authority`,
    );
  }
});

test("fee-structure managers receive only academic metadata reads needed by setup forms", () => {
  for (const role of ["ACCOUNTS", "CHAIRMAN", "MANAGEMENT"] as const) {
    const grants = ROLE_PERMISSIONS[role];
    assert.ok(grants.includes("academic-years.read"));
    assert.ok(grants.includes("semesters.read"));
    assert.ok(!grants.includes("academic-years.create"));
    assert.ok(!grants.includes("academic-years.update"));
    assert.ok(!grants.includes("semesters.create"));
    assert.ok(!grants.includes("semesters.update"));
    assert.ok(!grants.includes("semesters.delete"));
  }
});
test("fee-structure permissions do not imply unrelated financial authority", () => {
  for (const role of ["CHAIRMAN", "MANAGEMENT"] as const) {
    const grants = ROLE_PERMISSIONS[role];
    assert.ok(grants.includes("fees.structure.manage"));
    assert.ok(!grants.includes("fees.payment.record"));
    assert.ok(!grants.includes("fees.refund.process"));
    assert.ok(!grants.includes("fees.concession.approve"));
  }
});


test("fee structure activation uses pending approval except for explicit Chairman direct publication", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const createStart = source.indexOf("export async function createFeeStructure(");
  const submitStart = source.indexOf("export async function submitFeeStructureForApproval(");
  const publishStart = source.indexOf("export async function publishFeeStructure(");
  const approveStart = source.indexOf("export async function approveFeeStructure(");
  const rejectStart = source.indexOf("export async function rejectFeeStructure(");
  const assignStart = source.indexOf("export async function assignFeeStructure(");
  assert.ok(createStart >= 0 && submitStart > createStart && publishStart > submitStart && approveStart > publishStart && rejectStart > approveStart && assignStart > rejectStart);
  const create = source.slice(createStart, submitStart);
  const submit = source.slice(submitStart, approveStart);
  const publish = source.slice(publishStart, approveStart);
  const approve = source.slice(approveStart, rejectStart);
  const reject = source.slice(rejectStart, assignStart);
  assert.match(create, /const status: FeeStructureStatus = "DRAFT"/);
  assert.match(submit, /"status" = 'PENDING_APPROVAL'/);
  assert.match(submit, /"status" = 'DRAFT'/);
  assert.match(publish, /getEffectiveWorkspaceRole\(actor\) !== "CHAIRMAN"/);
  assert.match(publish, /!actor\.permissions\.includes\("fees\.structure\.publish"\)/);
  assert.match(publish, /"status" = 'ACTIVE'/);
  assert.match(publish, /"status" = 'DRAFT'/);
  assert.match(publish, /fee-structure\.publish-direct/);
  assert.match(approve, /"status" = 'ACTIVE'/);
  assert.match(approve, /"status" = 'PENDING_APPROVAL'/);
  assert.match(approve, /"createdById" <> \$\{actor\.id\}/);
  assert.match(reject, /"status" = 'REJECTED'/);
  assert.match(reject, /normalizedReason\.length < 3/);
  assert.match(reject, /"createdById" <> \$\{actor\.id\}/);
  const updateStart = source.indexOf("export async function updateFeeStructure(");
  const update = source.slice(updateStart);
  assert.match(update, /current\.status !== "DRAFT" && current\.status !== "REJECTED"/);
  assert.match(update, /current\.status === "REJECTED"\s*\?\s*"DRAFT"/);
  assert.match(update, /AND "status" = \$\{current\.status\}/);
  assert.match(update, /if \(changed !== 1\)/);
  assert.match(update, /current\.notes\?\.split\("\\n\[Approval rejection\] "\)\[0\]/);
});
