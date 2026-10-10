import { test, expect } from "@playwright/test";

test("public homepage and real login error flow render at desktop and mobile sizes", async ({ page }, testInfo) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  const loginButton = page.getByRole("button", { name: /login/i }).first();
  await expect(loginButton).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("desktop-home.png"), fullPage: true });

  await loginButton.click();
  await expect(page.getByRole("heading", { name: "Sign in to ACADLYX" })).toBeVisible();
  await expect(page.getByLabel("ID number / email / roll number")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("desktop-login.png"), fullPage: true });

  const loginResponsePromise = page.waitForResponse(response =>
    response.url().includes("/api/v1/auth/login") && response.request().method() === "POST"
  );
  await page.getByLabel("ID number / email / roll number").fill("missing-user-for-ui-smoke");
  await page.getByLabel("Password").fill("invalid-password-for-ui-smoke");
  await page.getByRole("button", { name: "Sign in" }).click();
  const loginResponse = await loginResponsePromise;
  expect([400, 401, 422]).toContain(loginResponse.status());
  await expect(page.getByRole("alert")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /login/i }).first().click();
  await expect(page.getByRole("heading", { name: "Sign in to ACADLYX" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile-login.png"), fullPage: true });

  expect(pageErrors, "Browser runtime exceptions").toEqual([]);
  expect(consoleErrors, "Browser console errors").toEqual([]);
});
