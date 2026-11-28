import { test, expect } from "@playwright/test";

const baseURL = process.env.ACADLYX_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
const viewportWidths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

test("the public page family fits viewports and legacy URLs lead to the CMS page", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const routes = [
    "/",
    "/about",
    "/about-acadlyx",
    "/contact",
    "/request-demo",
    "/partners",
    "/team",
    "/updates",
  ];

  for (const route of routes) {
    await page.goto(baseURL + route, { waitUntil: "networkidle" });
    const pageHeading = page.getByRole("heading", { level: 1 }).first();
    await expect(pageHeading).toBeVisible();
    expect(
      (await pageHeading.innerText()).trim().length,
      `${route} must have a non-empty page heading`,
    ).toBeGreaterThan(4);

    if (route !== "/" && route !== "/about-acadlyx") {
      await expect(page).toHaveURL(/\/about-acadlyx$/);
    }

    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.document,
        `${route} should not overflow horizontally at ${width}px`,
      ).toBeLessThanOrEqual(dimensions.viewport + 1);

      if (route === "/" && width === 1440) {
        await page.screenshot({ path: testInfo.outputPath("desktop-home.png"), fullPage: true });
      }
      if (route === "/about-acadlyx" && width === 390) {
        await page.screenshot({ path: testInfo.outputPath("mobile-about.png"), fullPage: true });
      }
    }
  }

  expect(pageErrors, "Public route runtime exceptions").toEqual([]);
});

test("the public shell has no menu and links only to the CMS page and sign in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "networkidle" });

  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator('button[aria-controls="public-mobile-navigation"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Learn More About ACADLYX", exact: true })).toHaveAttribute("href", "/about-acadlyx");

  await page.getByRole("link", { name: "Learn More About ACADLYX", exact: true }).click();
  await expect(page).toHaveURL(/\/about-acadlyx$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test("the sign-in link reaches the real login form and invalid credentials show an error", async ({ page }, testInfo) => {
  const pageErrors = [];
  const consoleErrors = [];
  const httpFailures = [];
  let attemptingInvalidLogin = false;

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) {
      httpFailures.push({ status: response.status(), url: response.url() });
    }
  });
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (attemptingInvalidLogin && [400, 401, 422].some(status => text.includes(String(status)))) return;
    consoleErrors.push(text);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to ACADLYX" })).toBeVisible();
  await expect(page.getByLabel("Email or user ID")).toBeVisible();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("desktop-login.png"), fullPage: true });

  const loginResponsePromise = page.waitForResponse(response =>
    response.url().includes("/api/v1/auth/login") && response.request().method() === "POST"
  );
  await page.getByLabel("Email or user ID").fill("missing-user-for-ui-smoke");
  await page.locator('input[autocomplete="current-password"]').fill("invalid-password-for-ui-smoke");
  attemptingInvalidLogin = true;
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const loginResponse = await loginResponsePromise;
  expect([400, 401, 422]).toContain(loginResponse.status());
  const loginErrorAlert = page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
  await expect(loginErrorAlert).toBeVisible();
  await expect(loginErrorAlert).not.toBeEmpty();
  attemptingInvalidLogin = false;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to ACADLYX" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-login.png"), fullPage: true });

  expect(pageErrors, "Browser runtime exceptions").toEqual([]);
  const unexpectedHttpFailures = httpFailures.filter(({ status, url }) =>
    !(url.includes("/api/v1/auth/login") && [400, 401, 422].includes(status))
  );
  expect(unexpectedHttpFailures, "Unexpected failed HTTP responses").toEqual([]);
  expect(
    consoleErrors,
    `Browser console errors; HTTP failures: ${JSON.stringify(httpFailures)}`,
  ).toEqual([]);
});
