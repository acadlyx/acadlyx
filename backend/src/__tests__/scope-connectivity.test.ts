import assert from "node:assert/strict";
import test from "node:test";

import {
  hasScopedWorkspaceRole,
  isDirectorScoped,
  isInstitutionWide,
  isInstitutionWideAdmissions,
  isInstitutionWideExamination,
  isInstitutionWideFinance,
  getEffectiveWorkspaceRole,
} from "../services/accessScope.service";

const actor = (...roles: string[]) => ({ roles });

test("Director plus secondary Institution Admin remains campus-scoped", () => {
  const user = actor("DIRECTOR", "INSTITUTION_ADMIN");
  assert.equal(isDirectorScoped(user), true);
  assert.equal(isInstitutionWide(user), false);
  assert.equal(hasScopedWorkspaceRole(user), true);
});

test("Dean plus secondary Accounts remains department-scoped", () => {
  const user = actor("DEAN", "ACCOUNTS");
  assert.equal(isInstitutionWide(user), false);
  assert.equal(isInstitutionWideFinance(user), false);
});

test("HOD plus secondary Registrar remains department-scoped", () => {
  const user = actor("HOD", "REGISTRAR");
  assert.equal(isInstitutionWide(user), false);
  assert.equal(isInstitutionWideFinance(user), false);
});

test("Accounts has institution-wide finance authority without generic student-directory scope", () => {
  const user = actor("ACCOUNTS");
  assert.equal(isInstitutionWide(user), false);
  assert.equal(isInstitutionWideFinance(user), true);
});

test("Admissions has institution-wide admissions authority without generic student-directory scope", () => {
  const user = actor("ADMISSIONS");
  assert.equal(isInstitutionWide(user), false);
  assert.equal(isInstitutionWideAdmissions(user), true);
});

test("Examination has institution-wide examination authority without generic user-directory scope", () => {
  const user = actor("EXAMINATION");
  assert.equal(isInstitutionWide(user), false);
  assert.equal(isInstitutionWideExamination(user), true);
});

test("Chairman remains institution-wide when a legacy Director role is also present", () => {
  const user = actor("CHAIRMAN", "DIRECTOR");
  assert.equal(isInstitutionWide(user), true);
  assert.equal(isDirectorScoped(user), false);
});

test("Institution Admin cannot inherit Accounts or Examination from secondary roles", () => {
  const user = actor("INSTITUTION_ADMIN", "ACCOUNTS", "EXAMINATION");
  assert.equal(getEffectiveWorkspaceRole(user), "INSTITUTION_ADMIN");
  assert.equal(isInstitutionWideFinance(user), false);
  assert.equal(isInstitutionWideExamination(user), false);
});

test("an active scoped workspace takes precedence over secondary admin grants", () => {
  assert.equal(getEffectiveWorkspaceRole(actor("HOD", "REGISTRAR", "INSTITUTION_ADMIN")), "HOD");
  assert.equal(getEffectiveWorkspaceRole(actor("DIRECTOR", "SUPER_ADMIN")), "DIRECTOR");
  assert.equal(getEffectiveWorkspaceRole(actor("CHAIRMAN", "DIRECTOR")), "CHAIRMAN");
});

test("institution-wide tenant roles retain generic scope while Super Admin remains platform-only", () => {
  assert.equal(isInstitutionWide(actor("INSTITUTION_ADMIN")), true);
  assert.equal(isInstitutionWide(actor("MANAGEMENT")), true);
  assert.equal(isInstitutionWide(actor("REGISTRAR")), true);
  assert.equal(isInstitutionWide(actor("SUPER_ADMIN")), false);
});
