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
    tenantFeatures: ["fees", "exams", "lms", "attendance", "placements", "admissions", "obe", "cms", "students", "faculty", "timetable", "results", "reports"],
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
    if (path.endsWith("/placements/criteria-options")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { campuses: [], departments: [], programs: [], batches: [], semesters: [], skills: [] } }) });
      return;
    }
    if (path.endsWith("/placements/metrics")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { companies: 0, drives: 0, openDrives: 0, applications: 0, offers: 0, acceptedOffers: 0, joinedOffers: 0, placementRate: 0, offerAcceptanceRate: 0, joiningRate: 0, averagePackage: 0, highestPackage: 0 } }) });
      return;
    }
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
  await expect(page.getByRole("heading", { name: "Director", exact: true })).toBeVisible();

  // Exercise the shared mobile workspace drawer and its keyboard lifecycle.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMenu = page.getByRole("button", { name: "Open navigation" });
  await mobileMenu.click();
  const drawer = page.getByRole("dialog", { name: "Mobile workspace navigation" });
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document, `Director workspace overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }

  await expect(page.getByRole("alert").filter({ hasText: "Campus metrics are" })).toContainText("temporarily unavailable");
  await expect(page.getByRole("link", { name: /Reports/i }).first()).toHaveAttribute("href", "/director/reports");
  await expect(page.getByRole("link", { name: /Students/i }).first()).toHaveAttribute("href", "/director/students");

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("42")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Campus metrics are" })).toHaveCount(0);

  // The legacy Operations URL must redirect to the role-specific workspace;
  // the removed Operations page must not return as a duplicate destination.
  await page.goto(baseURL + "/director/operations", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  expect(pageErrors, "no unhandled browser exceptions").toEqual([]);
});

test("authenticated Chairman workspace keeps institution-wide navigation role-owned", async ({ page }) => {
  await installAuthenticatedSession(page, "CHAIRMAN");
  await page.goto(baseURL + "/chairman", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Chairman", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reports/i }).first()).toHaveAttribute("href", "/chairman/reports");
  await expect(page.getByRole("link", { name: /Students/i }).first()).toHaveAttribute("href", "/chairman/students");
  await expect(page.locator('a[href="/chairman/fees"]')).toHaveCount(1);
});


test("placement workspace routes load with scoped authenticated session", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installAuthenticatedSession(page, "PLACEMENT");

  const routes = [
    ["/placements/calendar", "label", "Search schedule"],
    ["/placements/applications", "label", "Search applicants"],
    ["/placements/offers", "label", "Search offers"],
    ["/placements/drives", "label", "Search drives"],
    ["/placements/openings", "heading", "Create job opening"],
    ["/placements/reports", "heading", "Placement data exports"],
  ];

  for (const [path, locatorType, visibleText] of routes) {
    await page.goto(baseURL + path, { waitUntil: "networkidle" });
    const pageAnchor = locatorType === "label"
      ? page.getByLabel(visibleText, { exact: true })
      : page.getByRole("heading", { name: visibleText, exact: true });
    await expect(pageAnchor).toBeVisible();
  }
  expect(pageErrors, "placement pages should not throw browser exceptions").toEqual([]);
});


test("Dean, Management, Registrar and IT workspaces render across supported viewport sizes", async ({ browser }) => {
  const scenarios = [
    { role: "DEAN", path: "/dean", heading: "Dean Workspace" },
    { role: "MANAGEMENT", path: "/management", heading: "Management Workspace" },
    { role: "REGISTRAR", path: "/registrar", heading: "Registrar Workspace" },
    { role: "IT", path: "/it", heading: "IT Workspace" },
  ];

  for (const scenario of scenarios) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    try {
      await installAuthenticatedSession(page, scenario.role);
      const navigationResponse = await page.goto(baseURL + scenario.path, { waitUntil: "networkidle" });
      const pageState = {
        status: navigationResponse?.status() ?? null,
        url: page.url(),
        headings: await page.getByRole("heading").allTextContents(),
        body: (await page.locator("body").innerText()).slice(0, 1600),
      };
      console.log(`[workspace-smoke] ${scenario.role}: ${JSON.stringify(pageState)}`);
      await expect(
        page.getByRole("heading", { name: scenario.heading, exact: true }),
        `Expected ${scenario.heading}; observed ${JSON.stringify(pageState)}`,
      ).toBeVisible();

      for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
        }));
        expect(
          dimensions.document,
          `${scenario.role} workspace overflow at ${width}px`,
        ).toBeLessThanOrEqual(dimensions.viewport + 1);
      }

      if (scenario.role !== "IT") {
        await expect(page.getByText("Not reported").first()).toBeVisible();
      } else {
        await expect(page.getByRole("link", { name: "Overview", exact: true }).first()).toBeVisible();
      }

      expect(pageErrors, `${scenario.role} workspace runtime exceptions`).toEqual([]);
    } finally {
      await page.close();
    }
  }
});
