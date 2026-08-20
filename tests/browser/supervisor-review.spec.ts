import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";
const screenshotDirectory = resolve(import.meta.dirname, "../../docs/review/v0.19.1-supervisor-review/screenshots");

function scenarioPath(options: { state?: "MI" | "PA"; preference?: number; plan?: string } = {}) {
  const state = options.state ?? "PA";
  const params = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: state,
    target: "harris",
    route: "fewest-states",
    view: "scenario",
    editor: "preference",
    rank: "vtd",
    state,
  });
  if (options.plan) params.set("plan", options.plan);
  params.append("recipe", `${state}|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|${options.preference ?? 2.5}|0,50`);
  return `/app/?${params.toString()}`;
}

async function settle(page: Page) {
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeAnimationHandles ?? -1)).toBe(0);
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeDeckLayerIds.length ?? 0)).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: resolve(screenshotDirectory, name),
    animations: "disabled",
    caret: "hide",
    fullPage: false,
  });
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("capture supervisor review package", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open Sandbox", exact: true }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await capture(page, "01-editorial-home.png");

  await page.goto(scenarioPath({ state: "PA", preference: 2.5, plan: "FL,MI" }));
  await settle(page);
  await page.getByRole("button", { name: "United States", exact: true }).click();
  await expect(page.locator('.application-shell[data-geography-level="national"]')).toBeVisible();
  await capture(page, "02-national-consequence-and-route.png");

  await page.goto(scenarioPath({ state: "PA", preference: 2.5 }));
  await settle(page);
  await page.getByRole("button", { name: "Fit selection" }).click();
  await page.waitForTimeout(1_000);
  await capture(page, "03-pennsylvania-3d-laboratory.png");

  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("tab", { name: "Contributors" }).click();
  await expect(page.getByRole("tabpanel", { name: "Contributors" })).toBeVisible();
  await capture(page, "04-pennsylvania-contributors.png");

  await page.goto(scenarioPath({ state: "MI", preference: 2.5 }));
  await settle(page);
  await page.getByRole("button", { name: "Fit selection" }).click();
  await page.waitForTimeout(1_000);
  await capture(page, "05-michigan-3d-laboratory.png");

  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.getByRole("region", { name: "Michigan data foundation" })).toBeVisible();
  await capture(page, "06-michigan-evidence-ledger.png");
});
