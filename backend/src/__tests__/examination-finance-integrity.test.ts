import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

test("exam fee eligibility subtracts refunded amounts and floors each overdue invoice at zero", () => {
  const service = fs.readFileSync(
    path.join(root, "src/services/examination.service.ts"),
    "utf8",
  );
  const start = service.indexOf("async function getOutstandingStudentDues(");
  const end = service.indexOf("\nfunction sessionTargetsStudent(", start);
  assert.ok(start >= 0 && end > start, "Expected the canonical exam outstanding-dues query");
  const query = service.slice(start, end);

  assert.match(query, /COALESCE\(SUM\(GREATEST\(0,/);
  assert.match(query, /-"refundedAmount"/);
  assert.match(query, /\+"lateFeeAmount"/);
  assert.match(query, /"status" <> 'CANCELLED'/);
  assert.match(query, /"dueDate" < CURRENT_TIMESTAMP/);
});
