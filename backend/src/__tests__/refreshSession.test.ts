import test from "node:test";
import assert from "node:assert/strict";
import { isActiveRefreshSession } from "../utils/refreshSession";

const now = new Date("2026-10-09T12:00:00.000Z");
const active = {
  userId: "user-a",
  revokedAt: null,
  expiresAt: new Date("2026-10-10T12:00:00.000Z"),
};

test("an active session for the token subject is accepted", () => {
  assert.equal(isActiveRefreshSession(active, "user-a", now), true);
});

test("a missing session is rejected", () => {
  assert.equal(isActiveRefreshSession(null, "user-a", now), false);
});

test("a session belonging to a different user is rejected", () => {
  assert.equal(isActiveRefreshSession(active, "user-b", now), false);
});

test("a revoked session is rejected even when its JWT has not expired", () => {
  assert.equal(
    isActiveRefreshSession({ ...active, revokedAt: new Date("2026-10-09T11:00:00.000Z") }, "user-a", now),
    false,
  );
});

test("an expired refresh session is rejected", () => {
  assert.equal(
    isActiveRefreshSession({ ...active, expiresAt: new Date("2026-10-09T11:59:59.999Z") }, "user-a", now),
    false,
  );
});

test("a session expiring exactly now is rejected", () => {
  assert.equal(
    isActiveRefreshSession({ ...active, expiresAt: now }, "user-a", now),
    false,
  );
});
