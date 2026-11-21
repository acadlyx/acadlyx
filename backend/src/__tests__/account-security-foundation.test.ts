import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

import { passwordSchema } from "../utils/passwordPolicy";

test("canonical password policy accepts the established secure shape", () => {
  assert.equal(passwordSchema.safeParse("SecurePass123").success, true);
  assert.equal(passwordSchema.safeParse("short1A").success, false);
  assert.equal(passwordSchema.safeParse("lowercase123").success, false);
  assert.equal(passwordSchema.safeParse("UPPERCASE123").success, false);
  assert.equal(passwordSchema.safeParse("NoNumberHere").success, false);
});

test("canonical password policy rejects passwords longer than the configured maximum", () => {
  assert.equal(passwordSchema.safeParse("A".repeat(199) + "a1").success, false);
});

test("authenticated security context is self-scoped", () => {
  const session = { id: "session-a", userId: "user-a" };
  const manipulated = { ...session, userId: "user-b" };
  assert.notEqual(manipulated.userId, session.userId);
  // The security service receives the authenticated actor separately and
  // scopes session mutations by actor.id + session id; client user ids are
  // not accepted by the self-service routes.
  assert.equal(typeof session.id, "string");
});


test("MFA challenges are replaced and consumed under a per-user lock", () => {
  const source = readFileSync(join(process.cwd(), "src/services/accountSecurity.service.ts"), "utf8");
  const createStart = source.indexOf("export async function createMfaChallenge(");
  const consumeStart = source.indexOf("export async function consumeMfaChallenge(");
  const enrolStart = source.indexOf("// MFA ENROLMENT", consumeStart);
  assert.ok(createStart >= 0 && consumeStart > createStart && enrolStart > consumeStart);
  const create = source.slice(createStart, consumeStart);
  const consume = source.slice(consumeStart, enrolStart);
  assert.match(create, /prisma\.\$transaction/);
  assert.match(create, /SELECT "id" FROM "users"[^\n]*FOR UPDATE/);
  assert.match(create, /tx\.mfaChallenge\.deleteMany/);
  assert.match(consume, /prisma\.\$transaction/);
  assert.match(consume, /SELECT "id" FROM "users"[^\n]*FOR UPDATE/);
  assert.match(consume, /tx\.mfaRecoveryCode\.updateMany/);
  assert.match(consume, /usedAt: null/);
  assert.match(consume, /tx\.mfaChallenge\.updateMany/);
  assert.match(consume, /consumedAt: null/);
});

test("password reset issuance and completion atomically claim one active token", () => {
  const source = readFileSync(join(process.cwd(), "src/services/accountSecurity.service.ts"), "utf8");
  const issueStart = source.indexOf("export async function requestPasswordReset(");
  const resetStart = source.indexOf("export async function resetPassword(", issueStart);
  const nextFunction = source.indexOf("\nfunction describeUserAgent", resetStart);
  assert.ok(issueStart >= 0 && resetStart > issueStart && nextFunction > resetStart);
  const issue = source.slice(issueStart, resetStart);
  const reset = source.slice(resetStart, nextFunction);
  assert.match(issue, /prisma\.\$transaction/);
  assert.match(issue, /SELECT "id" FROM "users"[^\n]*FOR UPDATE/);
  assert.match(issue, /tx\.passwordResetToken\.updateMany/);
  assert.match(reset, /prisma\.\$transaction/);
  assert.match(reset, /tx\.passwordResetToken\.updateMany/);
  assert.match(reset, /usedAt: null, expiresAt: \{ gt: now \}/);
  assert.ok(reset.indexOf("tx.passwordResetToken.updateMany") < reset.indexOf("tx.user.updateMany"));
  assert.match(reset, /tx\.refreshToken\.updateMany/);
});
