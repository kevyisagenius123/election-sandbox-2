import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const screenshotDirectory = resolve("docs/review/v0.26c-count-landscape/screenshots");

test.beforeAll(async () => mkdir(screenshotDirectory, { recursive: true }));

test("2D and GL candidates share data but retain distinct lifecycle costs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByText("20,499 detailed returns", { exact: false })).toBeVisible();
  await expect(page.locator("#chart-2d canvas")).toHaveCount(1);
  await page.screenshot({ path: resolve(screenshotDirectory, "count-landscape-2d-desktop.png") });

  await page.getByRole("button", { name: "GL candidate" }).click();
  await expect(page.locator("#chart-2d canvas")).toHaveCount(0);
  await expect(page.locator("#chart-3d canvas")).toHaveCount(2);
  await page.screenshot({ path: resolve(screenshotDirectory, "count-landscape-gl-desktop.png") });

  await page.getByRole("button", { name: "Run lifecycle test" }).click();
  await expect(page.getByText("10 mount/dispose cycles each", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("0 benchmark canvases retained", { exact: false })).toBeVisible();
  const run = await page.evaluate(() => window.__V026C_RESEARCH__.lifecycleRuns.at(-1));
  expect(run).toHaveLength(2);
  expect(run.every((result) => result.remainingCanvases === 0)).toBe(true);
  expect(run.find((result) => result.kind === "3d").averageMs).toBeGreaterThan(
    run.find((result) => result.kind === "2d").averageMs,
  );
  await page.getByRole("button", { name: "2D control" }).click();
  await expect(page.locator("#chart-3d canvas")).toHaveCount(0);
});

test("2D control remains usable without body overflow on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#chart-2d canvas")).toHaveCount(1);
  const bodyOverflows = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
  expect(bodyOverflows).toBe(false);
  await page.screenshot({ path: resolve(screenshotDirectory, "count-landscape-2d-mobile.png") });
});
