import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../types/auth";
import {
  getEffectiveWorkspaceRole,
  isInstitutionWide,
} from "../services/accessScope.service";

function actor(roles: string[]): Pick<AuthenticatedUser, "roles"> {
  return { roles } as Pick<AuthenticatedUser, "roles">;
}

test("a specialist active workspace is not widened by a secondary institution-wide role", () => {
  for (const roles of [
    ["ACCOUNTS", "REGISTRAR"],
    ["ACCOUNTS", "INSTITUTION_ADMIN"],
    ["ADMISSIONS", "INSTITUTION_ADMIN"],
    ["EXAMINATION", "MANAGEMENT"],
    ["HR", "INSTITUTION_ADMIN"],
    ["DIRECTOR", "INSTITUTION_ADMIN"],
    ["DEAN", "REGISTRAR"],
    ["HOD", "MANAGEMENT"],
  ]) {
    const current = actor(roles);
    assert.equal(isInstitutionWide(current), false, roles.join("+"));
  }
});

test("Chairman is the explicit institution-wide override", () => {
  const current = actor(["CHAIRMAN", "DIRECTOR"]);
  assert.equal(getEffectiveWorkspaceRole(current), "CHAIRMAN");
  assert.equal(isInstitutionWide(current), true);
});

test("pure institution-wide roles retain generic institution scope", () => {
  for (const role of ["INSTITUTION_ADMIN", "MANAGEMENT", "REGISTRAR", "SUPER_ADMIN"]) {
    assert.equal(isInstitutionWide(actor([role])), true, role);
  }
});

test("a specialist role remains specialized when it is the only role", () => {
  for (const role of ["ACCOUNTS", "ADMISSIONS", "EXAMINATION", "HR"]) {
    assert.equal(getEffectiveWorkspaceRole(actor([role])), role);
    assert.equal(isInstitutionWide(actor([role])), false, role);
  }
});
