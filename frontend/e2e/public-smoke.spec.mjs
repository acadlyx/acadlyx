import { test, expect } from "@playwright/test";

test("public homepage and real login error flow render at desktop and mobile sizes", async ({ page }, testInfo) => {
  const baseURL = process.env.ACADLYX_BROWSER_BASE_URL ?? "http://127.0.0.1:3000";
  const pageErrors = [];
  const consoleErrors = [];
  const httpFailures = [];
  let attemptingInvalidLogin = false;
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) httpFailures.push({ status: response.status(), url: response.url() });
  });
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (attemptingInvalidLogin && ["400", "401", "422"].some(status => text.includes(status))) return;
    consoleErrors.push(text);
  });

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const loginButton = page.getByRole("button", { name: /login|access acadlyx/i }).first();
  await expect(loginButton).toBeVisible();
  await expect(page.getByText("Illustrative preview")).toBeVisible();
  await expect(page.getByText("Live workspace")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("desktop-home.png"), fullPage: true });

  await loginButton.click();
  await expect(page.getByRole("heading", { name: "Sign in to ACADLYX" })).toBeVisible();
  await expect(page.getByLabel("ID number / email / roll number")).toBeVisible();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("desktop-login.png"), fullPage: true });

  const loginResponsePromise = page.waitForResponse(response =>
    response.url().includes("/api/v1/auth/login") && response.request().method() === "POST"
  );
  await page.getByLabel("ID number / email / roll number").fill("missing-user-for-ui-smoke");
  await page.locator('input[autocomplete="current-password"]').fill("invalid-password-for-ui-smoke");
  attemptingInvalidLogin = true;
  await page.getByRole("button", { name: "Sign in" }).click();
  const loginResponse = await loginResponsePromise;
  expect([400, 401, 422]).toContain(loginResponse.status());
  await expect(page.getByRole("alert")).toBeVisible();
  attemptingInvalidLogin = false;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /login|access acadlyx/i }).first().click();
  await expect(page.getByRole("heading", { name: "Sign in to ACADLYX" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-login.png"), fullPage: true });

  expect(pageErrors, "Browser runtime exceptions").toEqual([]);
  const unexpectedHttpFailures = httpFailures.filter(({ status, url }) => !(url.includes("/api/v1/auth/login") && [400, 401, 422].includes(status)));
  expect(unexpectedHttpFailures, "Unexpected failed HTTP responses").toEqual([]);
  expect(consoleErrors, `Browser console errors; HTTP failures: ${JSON.stringify(httpFailures)}`).toEqual([]);
});
