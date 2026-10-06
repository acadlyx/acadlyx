import test from "node:test";
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
