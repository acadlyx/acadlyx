import { test, expect } from "@playwright/test";

const baseURL = process.env.ACADLYX_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
const permissions = [
  "reports.read", "students.read", "faculty.read", "departments.read", "courses.read",
  "exams.read", "exams.approve", "results.read", "fees.read", "fees.structure.read",
  "fees.structure.manage", "fees.structure.approve", "fees.structure.publish", "fees.assign",
  "attendance.read", "admissions.read", "placements.read", "obe.read", "lms.read", "operations.read",
  "events.read", "notices.read", "notifications.read", "intelligence.read",
  "timetable.read", "calendar.read", "fees.reports.export", "students.export",
];

async function installAuthenticatedSession(page, role) {
  await page.addInitScript(() => {
    sessionStorage.setItem("acadlyx_access_token", "browser-test-access-token");
    sessionStorage.setItem("acadlyx_refresh_token", "browser-test-refresh-token");
  });

  let metricRequests = 0;
  const user = {
    id: `browser-test-${role.toLowerCase()}`,
    institutionId: "browser-test-institution",
    email: `${role.toLowerCase()}@browser-test.invalid`,
    idNumber: `TEST-${role}`,
    firstName: "Browser",
    lastName: role === "CHAIRMAN" ? "Chairman" : "Director",
    roles: [role],
    permissions,
    tenantFeatures: ["fees", "exams", "lms", "attendance", "placements", "admissions", "obe", "cms", "students", "faculty", "timetable", "results"],
  };

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/auth/me")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: user }) });
      return;
    }
    if (path.endsWith("/workspace/context")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { institution: { name: "Browser Test Institution", logoUrl: null }, breadcrumbs: [] } }) });
      return;
    }
    // Support the canonical summary endpoint and the legacy workspace endpoint.
    // Both paths exercise the same deterministic failure -> retry-success scenario.
    if ((path.endsWith("/erp/me/summary") || path.endsWith("/erp/me/workspace")) && role === "DIRECTOR") {
      metricRequests += 1;
      if (metricRequests === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Synthetic temporary outage" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { stats: { students: 42, faculty: 7, departments: 2, courses: 12, exams: 3, examResults: 9 } } }) });
      }
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
  });
}

test("authenticated Director workspace handles failed metrics, retry, refresh and browser history", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installAuthenticatedSession(page, "DIRECTOR");

  await page.goto(baseURL + "/director", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Director Command Center" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Campus metrics are" })).toContainText("temporarily unavailable");
  await expect(page.getByRole("link", { name: /Reports/i }).first()).toHaveAttribute("href", "/director/reports");
  await expect(page.getByRole("link", { name: /Students/i }).first()).toHaveAttribute("href", "/director/students");

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("42")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Campus metrics are" })).toHaveCount(0);

  await page.locator('a[href="/director/operations"]').first().click();
  await expect(page).toHaveURL(/\/director\/operations$/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director\/operations$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/director$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/director\/operations$/);
  expect(pageErrors, "no unhandled browser exceptions").toEqual([]);
});

test("authenticated Chairman workspace keeps institution-wide navigation role-owned", async ({ page }) => {
  await installAuthenticatedSession(page, "CHAIRMAN");
  await page.goto(baseURL + "/chairman", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Institutional Command Center/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reports/i }).first()).toHaveAttribute("href", "/chairman/reports");
  await expect(page.getByRole("link", { name: /Students/i }).first()).toHaveAttribute("href", "/chairman/students");
  await expect(page.locator('a[href="/chairman/fees"]')).toHaveCount(1);
});
