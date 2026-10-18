import assert from "node:assert/strict";
import test from "node:test";
import {
  canApplySessionResponse,
  isSessionCurrent,
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
