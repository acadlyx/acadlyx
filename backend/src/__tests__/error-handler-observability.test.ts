import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("production 5xx logs retain diagnostic cause and stack while client responses stay sanitized", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/middleware/errorHandler.ts"), "utf8");
  assert.match(source, /statusCode >= 500/);
  assert.match(source, /serverError: err\.message\.slice\(0, 1000\)/);
  assert.match(source, /stack: err\.stack/);
  assert.match(source, /: "Internal server error"/);
  assert.match(source, /logger\.error\(/);
});
