import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const frontend = join(process.cwd(), "../frontend/src/app");

test("Chairman operations is an independent workspace page", () => {
  const page = readFileSync(join(frontend, "chairman/operations/page.tsx"), "utf8");
  assert.ok(!page.includes('from "@/app/operations/page"'), "Chairman must not alias the generic operations page");
  assert.ok(page.includes('allowedRoles={["CHAIRMAN"]}'), "Chairman route must retain its role boundary");
  for (const route of [
    "/chairman/intelligence",
    "/chairman/fee-approvals",
    "/chairman/fees",
    "/chairman/examinations",
    "/chairman/students",
    "/chairman/placements",
    "/chairman/reports",
  ]) {
    assert.ok(page.includes(`href: "${route}"`), `expected dedicated Chairman destination: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Director operations remains inside Director-specific routes", () => {
  const page = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  assert.ok(page.includes('allowedRoles={["DIRECTOR"]}'), "Director route must retain its role boundary");
  assert.ok(!page.includes('href: "/students"'), "Director operations must not navigate to unscoped global students");
  assert.ok(!page.includes('href: "/admissions"'), "Director operations must not navigate to unscoped global admissions");
  for (const route of [
    "/director/students",
    "/director/examinations",
    "/director/obe",
    "/director/fees",
    "/director/fee-approvals",
    "/director/placements",
    "/director/reports",
    "/director/imports",
  ]) {
    assert.ok(page.includes(`href: "${route}"`), `expected dedicated Director destination: ${route}`);
    assert.ok(existsSync(join(frontend, route.slice(1), "page.tsx")), `destination route must exist: ${route}`);
  }
});

test("Executive dashboard shortcuts stay in the correct workspace", () => {
  const chairman = readFileSync(join(frontend, "../components/dashboard/ChairmanDashboard.tsx"), "utf8");
  const director = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  for (const route of ["/chairman/intelligence", "/chairman/reports", "/chairman/fees", "/chairman/examinations", "/chairman/fee-approvals"]) {
    assert.ok(chairman.includes(route), `Chairman dashboard should link to ${route}`);
  }
  for (const route of ["/director/operations", "/director/students", "/director/fees", "/director/placements"]) {
    assert.ok(director.includes(route), `Director dashboard should link to ${route}`);
  }
  assert.ok(!director.includes('["Campus students","/students"]'), "Director shortcut must not route to the global student page");
  assert.ok(!director.includes('["Admissions","/admissions"]'), "Director shortcut must not route to global admissions");
});

test("Executive dashboards distinguish unavailable metrics from zero", () => {
  const chairman = readFileSync(join(frontend, "../components/dashboard/ChairmanDashboard.tsx"), "utf8");
  const director = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  for (const [name, source] of [["Chairman", chairman], ["Director", director]] as const) {
    assert.ok(source.includes("setUnavailable(true)"), `${name} dashboard must track unavailable data`);
    assert.ok(source.includes("value === undefined"), `${name} dashboard must not render missing metrics as zero`);
    assert.ok(source.includes("Retry"), `${name} dashboard must offer a retry after load failure`);
    assert.ok(!source.includes("setError(err.message)"), `${name} dashboard must not expose raw server errors`);
  }
});

test("Chairman fee approval UI prevents duplicate mutations and avoids raw API errors", () => {
  const page = readFileSync(join(frontend, "chairman/fee-approvals/page.tsx"), "utf8");
  assert.ok(page.includes("const [busyId, setBusyId] = useState<string | null>(null)"));
  assert.ok(page.includes("if (busyId) return;"), "approval handlers must ignore duplicate actions while busy");
  assert.ok(page.includes("disabled={busyId !== null || loading}"), "approval controls must be disabled while processing");
  assert.ok(page.includes("reason.trim().length < 3"), "rejection must validate a meaningful reason in the UI");
  assert.ok(page.includes("catch { setError("), "API failures must use controlled user-facing messages");
  assert.ok(!page.includes("setError(e instanceof Error ? e.message"), "raw API exception messages must not be displayed");
  assert.ok(page.includes('allowedRoles={["CHAIRMAN"]}'), "fee approval page must retain Chairman role boundary");
});


test("Director fee approvals have a dedicated page and backend campus-scope enforcement", () => {
  const page = readFileSync(join(frontend, "director/fee-approvals/page.tsx"), "utf8");
  const operations = readFileSync(join(frontend, "director/operations/page.tsx"), "utf8");
  const dashboard = readFileSync(join(frontend, "../components/dashboard/DirectorDashboard.tsx"), "utf8");
  const feeService = readFileSync(join(process.cwd(), "src/services/feeStructure.service.ts"), "utf8");
  const rbac = readFileSync(join(process.cwd(), "src/config/rbac.ts"), "utf8");

  assert.ok(page.includes('allowedRoles={["DIRECTOR"]}'), "approval page must be Director-only");
  assert.ok(page.includes("assigned campus scope"), "page must explain the campus boundary");
  assert.ok(operations.includes('href: "/director/fee-approvals"'), "operations page must link to the dedicated approval page");
  assert.ok(dashboard.includes('["Campus fee approvals", "/director/fee-approvals"]'), "dashboard must link to the dedicated approval page");
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.read"'));
  assert.ok(rbac.slice(rbac.indexOf("DIRECTOR:"), rbac.indexOf("DEAN:")).includes('"fees.structure.approve"'));
  assert.ok(feeService.includes("getDirectorDepartmentIds"), "fee service must derive Director scope from server-side campus assignments");
  assert.ok(feeService.includes('fs."programId" IN ('), "Director fee listing must be filtered to programs in assigned campus departments");
  assert.ok(feeService.includes("assertFeeStructureInActorScope(institutionId, actor, structureId)"), "approval and rejection mutations must validate record scope");
});
