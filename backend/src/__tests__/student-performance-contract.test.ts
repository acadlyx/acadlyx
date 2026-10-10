import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

test("student performance is sourced from approved/published canonical examination marks", () => {
  const service = fs.readFileSync(path.join(root, "src/services/examination.service.ts"), "utf8");
  const start = service.indexOf("export async function getStudentExamPerformance(");
  const end = service.indexOf("\nexport async function getStudentPublishedResults(", start);
  assert.ok(start >= 0 && end > start, "Expected canonical student performance query");
  const query = service.slice(start, end);

  assert.match(query, /await assertCanViewStudent\(institutionId, actor, studentId\)/);
  assert.match(query, /FROM "exam_marks" m/);
  assert.match(query, /m\."institutionId"=\$\{institutionId\}/);
  assert.match(query, /m\."studentId"=\$\{studentId\}/);
  assert.match(query, /m\."status" IN \('APPROVED','PUBLISHED'\)/);
  assert.match(query, /JOIN "exam_schedules" s/);
  assert.match(query, /JOIN "exam_sessions" es/);
  assert.match(query, /JOIN "course_offerings" co/);
  assert.match(query, /JOIN "courses" c/);
});

test("student published results require the canonical publication record", () => {
  const service = fs.readFileSync(path.join(root, "src/services/examination.service.ts"), "utf8");
  const start = service.indexOf("export async function getStudentPublishedResults(");
  const end = service.indexOf("\nexport async function createAdmitCardHold(", start);
  assert.ok(start >= 0 && end > start, "Expected canonical published-results query");
  const query = service.slice(start, end);

  assert.match(query, /await assertCanViewStudent\(institutionId, actor, studentId\)/);
  assert.match(query, /JOIN "exam_result_publications" rp/);
  assert.match(query, /rp\."status"='PUBLISHED'/);
  assert.match(query, /m\."status"='PUBLISHED'/);
  assert.match(query, /m\."institutionId"=\$\{institutionId\}/);
  assert.match(query, /m\."studentId"=\$\{studentId\}/);
});

test("self-service performance and result routes derive the target from the authenticated actor", () => {
  const routes = fs.readFileSync(path.join(root, "src/routes/examination.routes.ts"), "utf8");
  const performanceStart = routes.indexOf('"/my/performance"');
  const resultsStart = routes.indexOf('"/my/results"');
  const studentRoutesStart = routes.indexOf('"/students/:studentId/eligibility"');

  assert.ok(performanceStart >= 0 && resultsStart > performanceStart && studentRoutesStart > resultsStart);
  const selfRoutes = routes.slice(performanceStart, studentRoutesStart);
  assert.match(selfRoutes, /authorize\("exams\.read"\)/);
  assert.match(selfRoutes, /authorize\("results\.read"\)/);
  assert.match(selfRoutes, /getStudentExamPerformance\([\s\S]*?actor, actor\.id/);
  assert.match(selfRoutes, /getStudentPublishedResults\([\s\S]*?actor, actor\.id/);
  assert.doesNotMatch(selfRoutes, /req\.params\.studentId|req\.query\.studentId/);
});

test("student dashboard performance score includes institution-scoped internal marks when exam results are absent", () => {
  const service = fs.readFileSync(path.join(root, "src/services/intelligence.service.ts"), "utf8");
  assert.match(service, /prisma\.internalMark\.aggregate\([\s\S]*?_sum: \{ marksObtained: true, maxMarks: true \}/);
  assert.match(service, /FROM "exam_marks" m[\s\S]*?m\."institutionId"\s*=\s*\$\{institutionId\}[\s\S]*?m\."studentId"\s*=\s*\$\{studentId\}/);
  assert.match(service, /FROM "exam_results" er[\s\S]*?er\."institutionId"\s*=\s*\$\{institutionId\}[\s\S]*?er\."studentId"\s*=\s*\$\{studentId\}/);
  assert.match(service, /examTotals\?\.maximum > 0[\s\S]*?legacyTotals\?\.maximum > 0[\s\S]*?internalMaximum > 0/);
});
