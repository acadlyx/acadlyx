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
  let authMeGate = null;
  let authMeFailure = null;
  const user = {
    id: `browser-test-${role.toLowerCase()}`,
    institutionId: "browser-test-institution",
    email: `${role.toLowerCase()}@browser-test.invalid`,
    idNumber: `TEST-${role}`,
    firstName: "Browser",
    lastName: role === "CHAIRMAN" ? "Chairman" : "Director",
    roles: [role],
    permissions: role === "STUDENT" ? [...permissions, "library.read", "library.borrow"] : permissions,
    tenantFeatures: [
      "fees", "exams", "lms", "attendance", "placements", "admissions", "obe", "cms",
      "students", "faculty", "timetable", "results", "reports", "notifications",
      ...(role === "STUDENT" ? ["library"] : []),
      ...(role === "PARENT" ? ["parent_portal"] : []),
    ],
  };

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/auth/me")) {
      if (authMeGate) {
        const gate = authMeGate;
        authMeGate = null;
        await gate;
      }
      if (authMeFailure) {
        await route.fulfill({ status: authMeFailure.status, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: authMeFailure.message } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: user }) });
      return;
    }
    if (path.endsWith("/workspace/context")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { institution: { name: "Browser Test Institution", logoUrl: null }, breadcrumbs: [] } }) });
      return;
    }
    if (path.endsWith("/students/me/attendance")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { overallPercentage: 0, totalPresent: 0, totalSessions: 0, subjects: [] },
        }),
      });
      return;
    }
    if (path.endsWith("/library/loans/mine")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { items: [], activeCount: 0, outstandingFine: 0 },
        }),
      });
      return;
    }
    if (path.endsWith("/library/books")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          categories: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }),
      });
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

  return {
    user,
    setAuthMeGate(gate) { authMeGate = gate; },
    setAuthMeFailure(failure) { authMeFailure = failure; },
  };
}

test("authenticated Director workspace handles failed metrics, retry, refresh and browser history", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installAuthenticatedSession(page, "DIRECTOR");

  await page.goto(baseURL + "/director", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Director", exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Director", exact: true })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByRole("heading", { name: "Director", exact: true })).toBeVisible();
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

  for (const [path, heading] of [
    ["/placements/calendar", "Placement Calendar"],
    ["/placements/applications", "Placement Applications"],
    ["/placements/offers", "Placement Offers"],
    ["/placements/drives", "Placement Drives"],
    ["/placements/openings", "Job Openings"],
    ["/placements/reports", "Placement Intelligence"],
  ]) {
    await page.goto(baseURL + path, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(baseURL + path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  expect(pageErrors, "placement pages should not throw browser exceptions").toEqual([]);
});


test("stale Student permissions do not redirect an authorized Library route before fresh /auth/me resolves", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  const session = await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/student/attendance", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "My attendance", exact: true })).toBeVisible();

  // Establish a genuine Next.js history entry while the Student is authorized
  // for Library. Then revoke the grant server-side and visit Attendance so the
  // in-memory client cache is refreshed to the now-unprivileged state.
  await page.locator('a[href="/student/library"]').click();
  await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
  expect(pageErrors, "Library page should not throw browser exceptions").toEqual([]);
  session.user.permissions = session.user.permissions.filter((permission) => !["library.read", "library.borrow"].includes(permission));
  session.user.tenantFeatures = session.user.tenantFeatures.filter((feature) => feature !== "library");
  await page.locator('a[href="/student/attendance"]').click();
  await expect(page.getByRole("heading", { name: "My attendance", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/student\/attendance$/);

  // The cached current identity is now missing Library permission. Grant it
  // again on the identity response, gate /auth/me, and navigate back to the
  // existing Library history entry. The guard must wait rather than redirect
  // based on its stale cached denial.
  session.user.permissions = [...session.user.permissions, "library.read", "library.borrow"];
  session.user.tenantFeatures = [...session.user.tenantFeatures, "library"];
  let releaseAuthMe;
  const gate = new Promise((resolve) => { releaseAuthMe = resolve; });
  session.setAuthMeGate(gate);
  const freshAuthRequest = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/auth/me"));
  await page.goBack();
  await expect(page).toHaveURL(/\/student\/library$/);
  await freshAuthRequest;
  await expect(page.getByRole("status").getByText("Checking your secure workspace…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workspace verification unavailable" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/student\/library$/);
  releaseAuthMe();
  await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/student\/library$/);
  await expect(page.getByText(/You do not have access to this page/i)).toHaveCount(0);
});

test("temporary /auth/me failure fails closed and can recover through Retry verification", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  const session = await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/student/attendance", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "My attendance", exact: true })).toBeVisible();

  // Keep a real Library entry in the browser's Next.js history, then return to
  // it with /auth/me failing. Protected content must remain hidden and offer
  // retry, rather than redirecting the student or showing stale records.
  await page.locator('a[href="/student/library"]').click();
  await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
  expect(pageErrors, "Library page should not throw browser exceptions").toEqual([]);
  await page.locator('a[href="/student/attendance"]').click();
  await expect(page.getByRole("heading", { name: "My attendance", exact: true })).toBeVisible();

  session.setAuthMeFailure({ status: 503, message: "Synthetic identity-service outage" });
  await page.goBack();
  await expect(page).toHaveURL(/\/student\/library$/);
  await expect(page.getByRole("heading", { name: "Workspace verification unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry verification" })).toBeVisible();
  await expect(page.getByText(/You do not have access to this page/i)).toHaveCount(0);

  session.setAuthMeFailure(null);
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect(page.getByRole("heading", { name: "My Library", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/student\/library$/);
});


test("Institution Admin navigation does not offer Accounts-owned fee management", async ({ page }) => {
  await installAuthenticatedSession(page, "INSTITUTION_ADMIN");
  await page.goto(baseURL + "/admin", { waitUntil: "networkidle" });
  await expect(page.locator('a[href="/admin"]')).toHaveCount(1);
  await expect(page.locator('a[href="/accounts/fee-structures"]')).toHaveCount(0);
  await expect(page.locator('a[href="/accounts/fee-heads"]')).toHaveCount(0);

  // Direct URLs must obey the same workspace ownership as the sidebar.
  await page.goto(baseURL + "/accounts/fee-structures", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /Fee structures/i })).toHaveCount(0);
});

test("Management fee approvals stay in the Management workspace after direct navigation and refresh", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installAuthenticatedSession(page, "MANAGEMENT");

  await page.goto(baseURL + "/management/fee-approvals", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/management\/fee-approvals$/);
  await expect(page.getByRole("heading", { name: "Pending institutional fee approvals", exact: true })).toBeVisible();
  await expect(page.locator('a[href="/management/fee-approvals"]')).toHaveCount(1);
  await expect(page.locator('a[href="/accounts/fee-structures"]')).toHaveCount(0);
  await expect(page.locator('a[href="/accounts/fee-heads"]')).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/management\/fee-approvals$/);
  await expect(page.getByRole("heading", { name: "Pending institutional fee approvals", exact: true })).toBeVisible();
  expect(pageErrors, "Management fee approval page should not throw browser exceptions").toEqual([]);
});

test("Parent can reach linked-child workspace and its route remains Parent-owned", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installAuthenticatedSession(page, "PARENT");

  await page.goto(baseURL + "/parent/children", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/parent\/children$/);
  await expect(page.getByRole("heading", { name: "My children", exact: true })).toBeVisible();
  await expect(page.locator('a[href="/parent/children"]')).toHaveCount(1);
  expect(pageErrors, "Parent linked-child page should not throw browser exceptions").toEqual([]);
});

test("Dean notices menu resolves to its workspace-owned route", async ({ page }) => {
  await installAuthenticatedSession(page, "DEAN");
  await page.goto(baseURL + "/dean/notices", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/dean\/notices$/);
  await expect(page.locator('a[href="/dean/notices"]')).toHaveCount(1);
  await expect(page.locator('a[href="/notices"]')).toHaveCount(0);
});

test("HOD notices menu resolves to its workspace-owned route", async ({ page }) => {
  await installAuthenticatedSession(page, "HOD");
  await page.goto(baseURL + "/hod/notices", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/hod\/notices$/);
  await expect(page.locator('a[href="/hod/notices"]')).toHaveCount(1);
  await expect(page.locator('a[href="/notices"]')).toHaveCount(0);
});


test("Student cannot open Management fee approvals by entering the URL directly", async ({ page }) => {
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/management/fee-approvals", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Pending institutional fee approvals", exact: true })).toHaveCount(0);
});

test("Student notices navigation resolves to one student-owned route", async ({ page }) => {
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/student/notices", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student\/notices$/);
  await expect(page.locator('a[href="/student/notices"]')).toHaveCount(1);
  await expect(page.locator('a[href="/notices"]')).toHaveCount(0);
});


test("Accounts cannot directly open the role-owned LMS workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "ACCOUNTS");
  await page.goto(baseURL + "/lms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("heading", { name: "LMS", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/lms"]')).toHaveCount(0);
});

test("Student cannot mount administrative user-deletion approvals through a direct URL", async ({ page }) => {
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/user-deletion-approvals", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Permanent Deletion Requests", exact: true })).toHaveCount(0);
});
