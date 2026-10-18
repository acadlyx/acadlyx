import { test, expect } from "@playwright/test";

const baseURL = process.env.ACADLYX_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";

const TENANT_ROLES = [
  "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN",
  "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS",
  "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT",
  "PARENT", "CLUB_PRESIDENT", "STAFF",
];

async function installRoleSession(page, role, disabledFeatures = []) {
  await page.addInitScript(() => {
    sessionStorage.setItem("acadlyx_access_token", "role-matrix-access-token");
    sessionStorage.setItem("acadlyx_refresh_token", "role-matrix-refresh-token");
  });

  const user = {
    id: `role-matrix-${role.toLowerCase()}`,
    institutionId: role === "SUPER_ADMIN" ? null : "role-matrix-institution",
    email: `${role.toLowerCase()}@role-matrix.invalid`,
    idNumber: `MATRIX-${role}`,
    firstName: "Role",
    lastName: role,
    roles: [role],
    permissions: [
      "reports.read", "students.read", "faculty.read", "departments.read",
      "courses.read", "exams.read", "results.read", "fees.read",
      "attendance.read", "admissions.read", "placements.read", "lms.read",
      "operations.read", "events.read", "notices.read", "notifications.read",
      "intelligence.read", "timetable.read", "calendar.read", "registration.read", "enrollment.read", "leave.apply", "documents.read",
      ...(role === "SUPER_ADMIN" ? ["institutions.manage", "users.read", "plans.manage", "site.manage"] : []),
      ...(role === "CMS" ? ["site.manage"] : []),
      ...(role === "INSTITUTION_ADMIN" ? ["institutional-cms.read", "institutional-cms.manage"] : []),
      ...(["CHAIRMAN", "MANAGEMENT", "DIRECTOR"].includes(role) ? ["institutional-cms.read", "institutional-cms.approve"] : []),
    ],
    tenantFeatures: [
      "fees", "exams", "lms", "attendance", "placements", "admissions",
      "students", "faculty", "timetable", "results", "reports",
      "notifications", "documents", "certificates", "notices",
      "assignments", "calendar", "operations", "registration",
      "import_export", "analytics", "promotions", "academics", "hr",
      "intelligence", "cms", "parent_portal", "library", "leave",
    ].filter((feature) => !disabledFeatures.includes(feature)),
  };

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/v1/")) {
      await route.continue();
      return;
    }
    if (url.pathname.endsWith("/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: user }),
      });
      return;
    }
    if (url.pathname.endsWith("/workspace/context")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { institution: { name: "Role Matrix Institution", logoUrl: null }, breadcrumbs: [] },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

test.describe("Canonical dashboard-role direct URL and platform boundary matrix", () => {
  for (const role of TENANT_ROLES) {
    test(`${role} cannot open the Super Admin URL directly`, async ({ page }) => {
      await installRoleSession(page, role);
      await page.goto(`${baseURL}/superadmin`, { waitUntil: "domcontentloaded" });
      await expect.poll(() => new URL(page.url()).pathname).not.toBe("/superadmin");
      await expect(page.locator('a[href="/superadmin"]')).toHaveCount(0);
    });
  }

  test("SUPER_ADMIN cannot enter a tenant Director URL directly", async ({ page }) => {
    await installRoleSession(page, "SUPER_ADMIN");
    await page.goto(`${baseURL}/director`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/superadmin");
  });
});

test("Super Admin website CMS remains platform-accessible when tenant CMS entitlement is absent", async ({ page }) => {
  await installRoleSession(page, "SUPER_ADMIN", ["cms"]);
  await page.goto(`${baseURL}/site-content`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/site-content");
  await expect(page.getByRole("heading", { name: "100% CMS-driven external site" })).toBeVisible();
});

for (const role of ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"]) {
  test(`${role} cannot open institutional CMS when tenant cms entitlement is disabled`, async ({ page }) => {
    await installRoleSession(page, role, ["cms"]);
    await page.goto(`${baseURL}/admin/institutional-cms`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/admin/institutional-cms");
  });
}
 
const ROLE_HOME = {
  SUPER_ADMIN: "/superadmin",
  INSTITUTION_ADMIN: "/admin",
  CHAIRMAN: "/chairman",
  MANAGEMENT: "/management",
  DIRECTOR: "/director",
  DEAN: "/dean",
  REGISTRAR: "/registrar",
  HOD: "/hod",
  FACULTY: "/faculty",
  ACCOUNTS: "/accounts",
  HR: "/hr",
  ADMISSIONS: "/admissions",
  EXAMINATION: "/examination",
  LIBRARIAN: "/library",
  PLACEMENT: "/placements",
  IT: "/it",
  CMS: "/site-content",
  STUDENT: "/student",
  PARENT: "/parent",
  CLUB_PRESIDENT: "/club-president",
  STAFF: "/staff",
};

async function navigateAndWaitForIdentity(page, path) {
  const identityResponse = page.waitForResponse((response) => {
    try { return new URL(response.url()).pathname.endsWith("/auth/me"); }
    catch { return false; }
  });
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await identityResponse;
}

test.describe("canonical dashboard ownership across all registered roles", () => {
  for (const [role, home] of Object.entries(ROLE_HOME)) {
    test(`${role} can open its own workspace by direct URL`, async ({ page }) => {
      await installRoleSession(page, role);
      await navigateAndWaitForIdentity(page, home);
      await expect.poll(() => new URL(page.url()).pathname).toBe(home);
    });
  }
});

const ENTITLEMENT_ROUTE_CASES = [
  { role: "INSTITUTION_ADMIN", path: "/admin/notices", feature: "notices", home: "/admin" },
  { role: "INSTITUTION_ADMIN", path: "/admin/placements", feature: "placements", home: "/admin" },
  { role: "MANAGEMENT", path: "/management/placements", feature: "placements", home: "/management" },
  { role: "REGISTRAR", path: "/registrar/placements", feature: "placements", home: "/registrar" },
  { role: "DIRECTOR", path: "/director/placements", feature: "placements", home: "/director" },
  { role: "DIRECTOR", path: "/director/imports", feature: "import_export", home: "/director" },
  { role: "IT", path: "/it/imports", feature: "import_export", home: "/it" },
  { role: "HOD", path: "/hod/enrollment-requests", feature: "admissions", home: "/hod" },
  { role: "HOD", path: "/hod/course-registration-requests", feature: "registration", home: "/hod" },
  { role: "STUDENT", path: "/student/documents", feature: "documents", home: "/student" },
  { role: "STUDENT", path: "/student/leave", feature: "leave", home: "/student" },
];


test("HOD query-backed registration view requires the registration entitlement", async ({ page }) => {
  await installRoleSession(page, "HOD", ["registration"]);
  await navigateAndWaitForIdentity(page, "/hod?tab=registrations");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/hod");
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(page.locator('a[href="/hod?tab=registrations"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Registration approval" })).toHaveCount(0);
});

test.describe("tenant feature route enforcement", () => {
  for (const { role, path, feature, home } of ENTITLEMENT_ROUTE_CASES) {
    test(`${role} retains ${path} when ${feature} is enabled`, async ({ page }) => {
      await installRoleSession(page, role);
      await navigateAndWaitForIdentity(page, path);
      await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    });

    test(`${role} is redirected from ${path} when ${feature} is disabled`, async ({ page }) => {
      await installRoleSession(page, role, [feature]);
      await navigateAndWaitForIdentity(page, path);
      await expect.poll(() => new URL(page.url()).pathname).toBe(home);
      await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
    });
  }
});

const INSTITUTIONAL_CMS_OWNERS = ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"];
for (const role of TENANT_ROLES.filter((candidate) => !INSTITUTIONAL_CMS_OWNERS.includes(candidate))) {
  test(`${role} cannot open the tenant Institutional CMS workflow directly`, async ({ page }) => {
    await installRoleSession(page, role);
    await page.goto(`${baseURL}/admin/institutional-cms`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/admin/institutional-cms");
  });
}

for (const role of TENANT_ROLES.filter((candidate) => candidate !== "CMS")) {
  test(`${role} cannot open the platform Website CMS directly`, async ({ page }) => {
    await installRoleSession(page, role);
    await page.goto(`${baseURL}/site-content`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/site-content");
  });
}
