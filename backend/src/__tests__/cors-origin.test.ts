import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCorsOrigin } from "../app";

test("CORS allows this ACADLYX Vercel preview deployment origin", () => {
  assert.equal(
    isAllowedCorsOrigin("https://acadlyx-pjk4wun5k-acadlyx-6683.vercel.app"),
    true,
  );
});

test("CORS rejects unrelated Vercel deployments and lookalike domains", () => {
  assert.equal(isAllowedCorsOrigin("https://other-project-123.vercel.app"), false);
  assert.equal(isAllowedCorsOrigin("https://acadlyx-123-acadlyx-6683.vercel.app.evil.test"), false);
  assert.equal(isAllowedCorsOrigin("http://acadlyx-123-acadlyx-6683.vercel.app"), false);
});
