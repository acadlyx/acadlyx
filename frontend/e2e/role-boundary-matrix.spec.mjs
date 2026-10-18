import { test, expect } from "@playwright/test";

const baseURL = process.env.ACADLYX_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";

const TENANT_ROLES = [
  "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN",
  "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS",
  "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT",
  "PARENT", "CLUB_PRESIDENT",
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
      "intelligence.read", "timetable.read", "calendar.read",
      ...(role === "SUPER_ADMIN" ? ["institutions.manage", "users.read", "plans.manage", "site.manage"] : []),
      ...(role === "INSTITUTION_ADMIN" ? ["institutional-cms.read", "institutional-cms.manage"] : []),
      ...(["CHAIRMAN", "MANAGEMENT", "DIRECTOR"].includes(role) ? ["institutional-cms.read", "institutional-cms.approve"] : []),
    ],
    tenantFeatures: [
      "fees", "exams", "lms", "attendance", "placements", "admissions",
      "students", "faculty", "timetable", "results", "reports",
      "notifications", "documents", "certificates", "notices",
      "assignments", "calendar", "operations", "registration",
      "import_export", "analytics", "promotions", "academics", "hr",
      "intelligence", "cms", "parent_portal", "library",
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

test.describe("20-role direct URL and platform boundary matrix", () => {
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
  await expect(page.getByRole("heading", { name: "Website CMS" })).toBeVisible();
});

for (const role of ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"]) {
  test(`${role} cannot open institutional CMS when tenant cms entitlement is disabled`, async ({ page }) => {
    await installRoleSession(page, role, ["cms"]);
    await page.goto(`${baseURL}/admin/institutional-cms`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/admin/institutional-cms");
  });
}
