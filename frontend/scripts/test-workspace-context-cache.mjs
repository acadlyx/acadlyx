import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizationContextKey,
  canApplySessionResponse,
  isSessionCurrent,
  isWorkspaceResultCurrent,
  sessionScopedCacheKey,
} from "../src/lib/sessionScopedCache.mjs";

test("workspace cache keys separate accounts even when selectors match", () => {
  const selectors = { campusId: "campus-a", departmentId: "department-a" };
  assert.notEqual(sessionScopedCacheKey(1, selectors), sessionScopedCacheKey(2, selectors));
  assert.equal(sessionScopedCacheKey(1, selectors), sessionScopedCacheKey(1, {
    departmentId: "department-a",
    campusId: "campus-a",
  }));
});

test("a late response from an old session cannot be applied", async () => {
  let release;
  const delayedResponse = new Promise((resolve) => { release = resolve; });
  let activeScope = 1;
  let activeGeneration = 10;

  const result = delayedResponse.then((value) =>
    canApplySessionResponse(1, activeScope, 10, activeGeneration) ? value : undefined
  );

  // Simulate logging out and signing in as another account before the request
  // resolves; the new hook request also has a newer generation.
  activeScope = 2;
  activeGeneration = 11;
  release({ institutionId: "tenant-A-private-context" });

  assert.equal(await result, undefined);
  assert.equal(isSessionCurrent(1, activeScope), false);
});

test("the current session can apply its own latest response", () => {
  assert.equal(canApplySessionResponse(2, 2, 11, 11), true);
  assert.equal(canApplySessionResponse(2, 2, 10, 11), false);
  assert.equal(canApplySessionResponse(2, 3, 11, 11), false);
});

test("fresh authority signatures ignore ordering but detect role and feature revocation", () => {
  const first = {
    id: "user-a",
    institutionId: "tenant-a",
    roles: ["FACULTY", "HOD"],
    permissions: ["assignments.read", "attendance.read"],
    tenantFeatures: ["assignments", "attendance"],
  };
  assert.equal(authorizationContextKey(first), authorizationContextKey({
    ...first,
    roles: ["HOD", "FACULTY"],
    permissions: ["attendance.read", "assignments.read"],
    tenantFeatures: ["attendance", "assignments"],
  }));
  assert.notEqual(authorizationContextKey(first), authorizationContextKey({
    ...first,
    tenantFeatures: ["attendance"],
  }));
  assert.notEqual(authorizationContextKey(first), authorizationContextKey({
    ...first,
    permissions: ["attendance.read"],
  }));
  assert.equal(authorizationContextKey(null), null);
});

test("selector changes synchronously hide results and errors from prior workspace keys", () => {
  const current = "session-4:{\"campusId\":\"campus-b\"}";
  const prior = "session-4:{\"campusId\":\"campus-a\"}";
  assert.equal(isWorkspaceResultCurrent(current, current), true);
  assert.equal(isWorkspaceResultCurrent(prior, current), false);
  assert.equal(isWorkspaceResultCurrent(undefined, current), false);
});


test("institution switch invalidates cached workspace data even when selectors are identical", () => {
  const selectors = { campusId: "campus-1", academicYearId: "year-1" };
  assert.notEqual(sessionScopedCacheKey("tenant-a-session", selectors), sessionScopedCacheKey("tenant-b-session", selectors));
});

test("authority signature invalidates on institution, role, permission, and disabled-feature changes", () => {
  const baseline = {
    id: "user-1",
    institutionId: "tenant-a",
    roles: ["DIRECTOR"],
    permissions: ["students.read", "campuses.read"],
    tenantFeatures: ["students", "campuses"],
  };
  const baselineKey = authorizationContextKey(baseline);
  assert.notEqual(authorizationContextKey({ ...baseline, institutionId: "tenant-b" }), baselineKey);
  assert.notEqual(authorizationContextKey({ ...baseline, roles: ["STUDENT"] }), baselineKey);
  assert.notEqual(authorizationContextKey({ ...baseline, permissions: ["students.read"] }), baselineKey);
  assert.notEqual(authorizationContextKey({ ...baseline, tenantFeatures: ["students"] }), baselineKey);
});

test("a late response after workspace switching cannot overwrite the new workspace", async () => {
  let resolveOld;
  const oldRequest = new Promise((resolve) => { resolveOld = resolve; });
  let currentRequestKey = "session-8:campus-a:year-a";
  const oldResult = oldRequest.then((value) =>
    isWorkspaceResultCurrent("session-8:campus-a:year-a", currentRequestKey) ? value : undefined
  );

  currentRequestKey = "session-8:campus-b:year-b";
  resolveOld({ campusId: "campus-a", privateRows: ["old workspace data"] });

  assert.equal(await oldResult, undefined);
  assert.equal(isWorkspaceResultCurrent("session-8:campus-b:year-b", currentRequestKey), true);
});

test("logout or revoked session prevents a pending request from publishing data", async () => {
  let resolvePending;
  const pending = new Promise((resolve) => { resolvePending = resolve; });
  let activeSession = 21;
  let generation = 4;
  const published = pending.then((value) =>
    canApplySessionResponse(21, activeSession, 4, generation) ? value : undefined
  );

  // Logout revokes the old local scope; next login receives a new monotonic scope.
  activeSession = 22;
  generation = 5;
  resolvePending({ protectedData: true });
  assert.equal(await published, undefined);
});
