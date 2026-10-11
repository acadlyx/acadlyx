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
