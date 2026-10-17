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
  assert.match(query, /COALESCE\("refundedAmount", 0\)/);
  assert.match(query, /COALESCE\("lateFeeAmount", 0\)/);
  assert.match(query, /"status" <> 'CANCELLED'/);
  assert.match(query, /"dueDate" < CURRENT_TIMESTAMP/);
});


test("student and parent roles cannot read a roster-level exam marksheet", () => {
  const service = fs.readFileSync(
    path.join(root, "src/services/examination.service.ts"),
    "utf8",
  );
  const start = service.indexOf("export async function getMarksSheet(");
  const end = service.indexOf("\n/**\n * Saves or resubmits marks.", start);
  assert.ok(start >= 0 && end > start, "Expected the canonical marks-sheet service");
  const handler = service.slice(start, end);
  const guard = handler.indexOf('if (activeRole === "STUDENT" || activeRole === "PARENT")');
  const rosterQuery = handler.indexOf("getCourseOfferingRoster(");
  assert.ok(guard >= 0, "Student and Parent effective roles must be explicitly denied");
  assert.ok(rosterQuery > guard, "Deny self-service roles before loading the complete student roster");
  assert.match(handler, /getEffectiveWorkspaceRole\(actor\)/);
  assert.match(handler, /Roster-level marksheets are only available/);
});


test("marksheet and locking use the registered eligible candidate set", () => {
  const service = fs.readFileSync(
    path.join(root, "src/services/examination.service.ts"),
    "utf8",
  );
  const sheetStart = service.indexOf("export async function getMarksSheet(");
  const sheetEnd = service.indexOf("\n/**\n * Saves or resubmits marks.", sheetStart);
  assert.ok(sheetStart >= 0 && sheetEnd > sheetStart);
  const sheet = service.slice(sheetStart, sheetEnd);
  assert.match(sheet, /if \(session\.registrationRequired\)/);
  assert.match(sheet, /FROM "exam_registrations" r/);
  assert.match(sheet, /JOIN "exam_eligibilities" e/);
  assert.match(sheet, /r\."status" = 'REGISTERED'/);
  assert.match(sheet, /e\."status" = 'ELIGIBLE'/);
  assert.match(sheet, /roster = roster\.filter\(\(student\) => eligibleIds\.has\(student\.studentId\)\)/);

  const lockStart = service.indexOf("export async function lockExamSchedule(");
  const lockEnd = service.indexOf("export async function enqueuePublishExamResults(", lockStart);
  assert.ok(lockStart >= 0 && lockEnd > lockStart);
  const lock = service.slice(lockStart, lockEnd);
  assert.match(lock, /FROM "exam_registrations" r/);
  assert.match(lock, /JOIN "exam_eligibilities" e/);
  assert.match(lock, /r\."status" = 'REGISTERED'/);
  assert.match(lock, /e\."status" = 'ELIGIBLE'/);
});
