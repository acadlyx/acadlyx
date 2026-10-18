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
  let authMeRequests = 0;
  const user = {
    id: `browser-test-${role.toLowerCase()}`,
    institutionId: "browser-test-institution",
    email: `${role.toLowerCase()}@browser-test.invalid`,
    idNumber: `TEST-${role}`,
    firstName: "Browser",
    lastName: role === "CHAIRMAN" ? "Chairman" : "Director",
    roles: [role],
    permissions: [
      ...permissions,
      ...(role === "STUDENT" || role === "LIBRARIAN" ? ["library.read", "library.borrow"] : []),
      ...(role === "PARENT" ? ["parent-portal.read", "parent-links.read"] : []),
      ...(role === "CMS" ? ["site.manage"] : []),
      ...(role === "REGISTRAR" ? ["certificates.read", "certificates.issue"] : []),
      ...(role === "ADMISSIONS" ? ["parent-links.read", "parent-links.manage"] : []),
    ],
    // This common fixture represents a tenant that has these modules
    // enabled. Route-ownership tests must reach the role boundary, not fail
    // early because a required tenant feature was omitted from the fixture.
    // Feature-disabled behavior is covered separately with explicit overrides.
    tenantFeatures: [
      "fees", "exams", "lms", "attendance", "placements", "admissions", "obe", "cms",
      "students", "faculty", "timetable", "results", "reports", "notifications",
      "documents", "certificates", "notices", "assignments", "calendar", "operations",
      "registration", "import_export", "analytics", "promotions", "academics", "hr",
      "intelligence",
      ...(role === "STUDENT" || role === "LIBRARIAN" ? ["library"] : []),
      ...(role === "PARENT" ? ["parent_portal"] : []),
    ],
  };

  // Intercept at the request boundary rather than relying on a glob that
  // may differ when NEXT_PUBLIC_API_URL changes host/port between environments.
  // Continue all non-API browser requests unchanged; only versioned API calls
  // receive deterministic, role-scoped fixtures in these isolated UI tests.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    // Do not install the application service worker in mocked-auth tests:
    // service-worker fetches bypass page.route() and leak synthetic test
    // tokens to the isolated API instead of using the deterministic fixtures.
    if (path === "/sw.js") {
      await route.fulfill({ status: 404, contentType: "application/javascript", body: "" });
      return;
    }
    if (!path.startsWith("/api/v1/")) {
      await route.continue();
      return;
    }

    if (path.endsWith("/auth/me")) {
      authMeRequests += 1;
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
    if (path === "/api/v1/students" && (role === "ADMISSIONS" || role === "LIBRARIAN")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{
            id: "browser-test-student",
            firstName: "Test",
            lastName: "Student",
            email: "student@browser-test.invalid",
            profile: { admissionNumber: "TEST-001" },
          }],
          meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        }),
      });
      return;
    }
    if (path === "/api/v1/students/browser-test-student" && role === "ADMISSIONS") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "browser-test-student",
            firstName: "Test",
            lastName: "Student",
            email: "student@browser-test.invalid",
            isActive: true,
            createdAt: "2026-10-01T00:00:00.000Z",
            profile: { admissionNumber: "TEST-001" },
            enrollments: [],
            currentEnrollment: null,
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
  });

  return {
    user,
    authMeRequests() { return authMeRequests; },
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

test("the Accounts fee URL is blocked for every non-Accounts canonical role", async ({ page }) => {
  const cases = [
    ["SUPER_ADMIN", "/superadmin"], ["INSTITUTION_ADMIN", "/admin"],
    ["CHAIRMAN", "/chairman"], ["MANAGEMENT", "/management"],
    ["DIRECTOR", "/director"], ["DEAN", "/dean"], ["REGISTRAR", "/registrar"],
    ["HOD", "/hod"], ["FACULTY", "/faculty"], ["ACCOUNTS", "/accounts"],
    ["HR", "/hr"], ["ADMISSIONS", "/admissions"], ["EXAMINATION", "/examination"],
    ["LIBRARIAN", "/library"], ["PLACEMENT", "/placements"], ["IT", "/it"],
    ["CMS", "/site-content"], ["STUDENT", "/student"], ["PARENT", "/parent"],
    ["CLUB_PRESIDENT", "/club-president"],
  ];
  const session = await installAuthenticatedSession(page, "ACCOUNTS");
  const feeRequests = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/erp/fee-heads") || path.startsWith("/api/v1/erp/fee-structures")) feeRequests.push(path);
  });

  for (const [role, home] of cases) {
    session.user.roles = [role];
    // Mirror the role-specific capabilities for every simulated identity,
    // so a denial means the Accounts route belongs to another workspace,
    // not that the destination home lacks a fixture permission.
    session.user.permissions = [
      ...permissions,
      ...(role === "STUDENT" || role === "LIBRARIAN" ? ["library.read", "library.borrow"] : []),
      ...(role === "PARENT" ? ["parent-portal.read", "parent-links.read"] : []),
      ...(role === "CMS" ? ["site.manage"] : []),
      ...(role === "REGISTRAR" ? ["certificates.read", "certificates.issue"] : []),
      ...(role === "ADMISSIONS" ? ["parent-links.read", "parent-links.manage"] : []),
    ];
    // Give each role the features its workspace requires, so route ownership
    // (not an unrelated disabled module) is what this matrix evaluates.
    session.user.tenantFeatures = [
      ...session.user.tenantFeatures.filter((feature) => feature !== "parent_portal" && feature !== "library"),
      ...(role === "PARENT" ? ["parent_portal"] : []),
      ...(role === "LIBRARIAN" ? ["library"] : []),
    ];
    feeRequests.length = 0;
    await page.goto(baseURL + "/accounts/fee-structures", { waitUntil: "networkidle" });
    const actual = new URL(page.url()).pathname;
    if (role === "ACCOUNTS") {
      expect(actual).toBe("/accounts/fee-structures");
      expect(feeRequests.length).toBeGreaterThan(0);
    } else {
      expect(actual === home || (role === "PARENT" && actual === "/parent/children")).toBeTruthy();
      expect(feeRequests, role + " must not load fee data before workspace authorization").toEqual([]);
      await expect(page.locator('a[href="/accounts/fee-structures"]')).toHaveCount(0);
      await expect(page.locator('a[href="/accounts/fee-heads"]')).toHaveCount(0);
    }
  }

  session.user.roles = ["STUDENT", "ACCOUNTS"];
  feeRequests.length = 0;
  await page.goto(baseURL + "/accounts/fee-structures", { waitUntil: "networkidle" });
  expect(new URL(page.url()).pathname).toBe("/student");
  expect(feeRequests, "Student+Accounts must keep Student workspace ownership").toEqual([]);
});

test("disabled tenant feature blocks Faculty assignment route before API effects", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/assignments")) {
      forbiddenRequests.push(request.url());
    }
  });

  const session = await installAuthenticatedSession(page, "FACULTY");
  // Give the test principal the relevant RBAC capabilities so this assertion
  // isolates feature entitlement rather than failing on a missing permission.
  session.user.permissions = [
    ...session.user.permissions,
    "assignments.read",
    "assignments.create",
    "assignments.update",
  ];
  session.user.tenantFeatures = session.user.tenantFeatures.filter((feature) => feature !== "assignments");

  await page.goto(baseURL + "/faculty/assignments", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/faculty$/);
  await expect(page.getByRole("heading", { name: /Assignments/i })).toHaveCount(0);
  expect(forbiddenRequests, "disabled tenant modules must not start protected API effects").toEqual([]);
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
  // The unified workspace shell labels this navigation destination "Children";
  // the page content separately exposes the no-linked-child empty state.
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await expect(page.getByText(/No students are linked to this account/i)).toBeVisible();
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


test("Accounts cannot mount LMS data by entering the role-owned route directly", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/api/v1/lms")) forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "ACCOUNTS");
  await page.goto(baseURL + "/lms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("heading", { name: "LMS", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/lms"]')).toHaveCount(0);
  expect(forbiddenRequests, "an unowned LMS route must be rejected before protected page effects run").toEqual([]);
});

test("Student cannot mount administrative user-deletion approvals through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("permanent-deletion-requests")) forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/user-deletion-approvals", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Permanent Deletion Requests", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "the deletion queue API must not be called for a non-owner route").toEqual([]);
});


test("Director cannot mount Institution Admin student master through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/students") forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "DIRECTOR");
  await page.goto(baseURL + "/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByRole("heading", { name: "Students", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "the generic Institution Admin student-list request must not run for a Director").toEqual([]);
});


test("Director cannot mount Dean-only academics data through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  const forbiddenPaths = new Set([
    "/api/v1/departments",
    "/api/v1/programs",
    "/api/v1/academic-years",
    "/api/v1/course-offerings",
  ]);
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (forbiddenPaths.has(pathname)) forbiddenRequests.push(request.url());
  });

  await installAuthenticatedSession(page, "DIRECTOR");
  await page.goto(baseURL + "/academics", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByRole("heading", { name: "Academic structure", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "Dean-only academic structure APIs must not run for a Director direct URL").toEqual([]);
});

test("Student cannot mount the shared leadership timetable through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    // Track only API effects for the shared leadership route. Next.js page
    // chunks and RSC prefetches include /timetable in their browser URLs too.
    if (pathname.startsWith("/api/v1/timetable")) forbiddenRequests.push(request.url());
  });

  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/timetable", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Timetable", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "the student must use the Student-owned timetable route, not the shared leadership page").toEqual([]);
});


test("Director cannot mount Admissions-only student list through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/students") forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "DIRECTOR");
  await page.goto(baseURL + "/admissions/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByRole("heading", { name: "Admissions Students", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "Director must not fetch the Admissions-scoped student list").toEqual([]);
});

test("Student cannot mount Librarian-only student access list through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/students") forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/library/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Library Students", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "Student must not fetch the Librarian-scoped student list").toEqual([]);
});

test("Director cannot mount Admissions-only reports through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/exports/attendance/options") forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "DIRECTOR");
  await page.goto(baseURL + "/admissions/reports", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/director$/);
  await expect(page.getByRole("heading", { name: "Institutional reports", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "Director must not load Admission-only report options").toEqual([]);
});

test("Student cannot mount Librarian-only reports through a direct URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/exports/attendance/options") forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/library/reports", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: "Institutional reports", exact: true })).toHaveCount(0);
  expect(forbiddenRequests, "Student must not load Library-only report options").toEqual([]);
});


test("Librarian student list is role-owned and does not link to an unauthorized generic profile", async ({ page }) => {
  await installAuthenticatedSession(page, "LIBRARIAN");
  await page.goto(baseURL + "/library/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/library\/students$/);
  await expect(page.getByText("Test Student", { exact: false })).toBeVisible();
  await expect(page.locator('a[href="/library/students/browser-test-student"]')).toHaveCount(0);
  await expect(page.locator('a[href="/students/browser-test-student"]')).toHaveCount(0);
  await expect(page.locator('a[href="/library/students"]')).toHaveCount(1);
});

test("Admissions student list opens the existing role-authorized student profile deep link", async ({ page }) => {
  await installAuthenticatedSession(page, "ADMISSIONS");
  await page.goto(baseURL + "/admissions/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admissions\/students$/);
  await expect(page.getByText("Test Student", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Test Student/ }).click();
  await expect(page).toHaveURL(/\/students\/browser-test-student$/);
  // The shell header reflects the current student identity; verify the
  // actual profile heading and admission number rendered by the page.
  await expect(page.getByRole("heading", { name: "Test Student", exact: true })).toBeVisible();
  await expect(page.getByText("TEST-001", { exact: true })).toBeVisible();
});


test("Accounts legacy Payments URL resolves to Accounts payments", async ({ page }) => {
  await installAuthenticatedSession(page, "ACCOUNTS");
  await page.goto(baseURL + "/payments", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/accounts\/payments$/);
  await expect(page.getByRole("heading", { name: /Payments/i }).first()).toBeVisible();
});

test("Student legacy Payments URL resolves to Student fees, not Accounts", async ({ page }) => {
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/payments", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student\/fees$/);
  await expect(page.locator('a[href="/accounts/payments"]')).toHaveCount(0);
});

test("Parent legacy Payments URL resolves to linked-child workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "PARENT");
  await page.goto(baseURL + "/payments", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/parent\/children$/);
  // The unified workspace shell labels this navigation destination "Children";
  // the page content separately exposes the no-linked-child empty state.
  await expect(page.getByRole("heading", { name: "Children", exact: true })).toBeVisible();
  await expect(page.getByText(/No students are linked to this account/i)).toBeVisible();
});

test("Accounts legacy fee-receipts URL resolves to Accounts receipts", async ({ page }) => {
  await installAuthenticatedSession(page, "ACCOUNTS");
  await page.goto(baseURL + "/fees/receipts", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/accounts\/receipts$/);
  await expect(page.getByRole("heading", { name: /Receipts/i }).first()).toBeVisible();
});

test("Student cannot mount Accounts receipts through the legacy fee-receipts URL", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/api/v1/erp/fee-receipts")) forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/fees/receipts", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  expect(forbiddenRequests, "legacy Accounts receipts route must not start fee-receipt API effects for Student").toEqual([]);
});

test("Club President legacy route resolves to Club President workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "CLUB_PRESIDENT");
  await page.goto(baseURL + "/club", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/club-president$/);
});

test("CMS legacy route resolves to authorized CMS workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "CMS");
  await page.goto(baseURL + "/cms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/site-content$/);
});

test("Admissions enrollment alias resolves to Admissions workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "ADMISSIONS");
  await page.goto(baseURL + "/enrollment", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admissions$/);
});

test("Registrar forms alias resolves to certificates workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "REGISTRAR");
  await page.goto(baseURL + "/forms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/certificates$/);
});

test("Institution Admin institution-settings alias resolves to admin workspace", async ({ page }) => {
  await installAuthenticatedSession(page, "INSTITUTION_ADMIN");
  await page.goto(baseURL + "/institution-settings", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admin$/);
});


test("Student cannot open the CMS legacy alias or trigger CMS data requests", async ({ page }) => {
  const forbiddenRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/api/v1/cms") || pathname.includes("/api/v1/site-content")) forbiddenRequests.push(request.url());
  });
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/cms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: /Website CMS/i })).toHaveCount(0);
  expect(forbiddenRequests, "unauthorized legacy CMS routes must not issue CMS requests").toEqual([]);
});

test("Student cannot open the Registrar forms legacy alias", async ({ page }) => {
  await installAuthenticatedSession(page, "STUDENT");
  await page.goto(baseURL + "/forms", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { name: /Certificates/i }).first()).toHaveCount(0);
});
