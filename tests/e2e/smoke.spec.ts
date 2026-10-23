import { test, expect } from "@playwright/test";

/**
 * Optional smoke suite — run with: npx playwright test
 * Requires: npm run db:seed && npm run dev (or PLAYWRIGHT_BASE_URL).
 */
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("DetailFlow Phase 1 smoke", () => {
  test("home and demo load", async ({ page }) => {
    await page.goto(base);
    await expect(page.getByRole("heading", { name: /stop losing track/i })).toBeVisible();
    await page.goto(`${base}/demo`);
    await expect(page.getByText(/cleancar mobile detailing/i)).toBeVisible();
    await expect(page.getByText(/fictional|demo/i).first()).toBeVisible();
  });

  test("public booking submits enquiry", async ({ page }) => {
    await page.goto(`${base}/book/cleancar-demo`);
    await page.fill("#name", "E2E Customer");
    await page.fill("#email", `e2e.${Date.now()}@example.com`);
    await page.fill('[name="intake_vehicleMake"]', "VW");
    await page.fill('[name="intake_vehicleModel"]', "Golf");
    await page.selectOption('[name="intake_vehicleSize"]', { label: "Medium" });
    await page.getByRole("button", { name: /request booking/i }).click();
    await expect(page.getByText(/we got your request/i)).toBeVisible({ timeout: 15000 });
  });

  test("demo owner can open dashboard", async ({ page }) => {
    await page.goto(`${base}/login`);
    await page.fill("#email", "demo@cleancar.ie");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/cleancar mobile detailing/i).first()).toBeVisible();
  });
});
