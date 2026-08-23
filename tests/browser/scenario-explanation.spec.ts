import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1";
const ENGINE_VERSION = "pa-behavior-v1";
const screenshotDirectory = resolve(import.meta.dirname, "../../docs/review/v0.27a-scenario-explanation/screenshots");

function pennsylvaniaScenarioPath() {
  const params = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: "PA",
    target: "harris",
    route: "fewest-states",
    view: "scenario",
    editor: "preference",
    rank: "county",
    state: "PA",
  });
  params.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|1|55|stein|2|0,50`);
  return `/app/?${params.toString()}`;
}

async function openExplanation(page: Page) {
  await page.goto(pennsylvaniaScenarioPath());
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("tab", { name: "Contributors" }).click();
  return page.locator(".analytics-causal-chain");
}

test("scenario explanation connects operation, geography, and electoral consequence", async ({ page }) => {
  test.setTimeout(90_000);
  const explanation = await openExplanation(page);

  await expect(explanation).toBeVisible();
  await expect(explanation.getByText("Preference", { exact: true })).toBeVisible();
  await expect(explanation.getByText("Allegheny County", { exact: true })).toBeVisible();
  await expect(explanation.getByText("Pennsylvania flips to Harris", { exact: true })).toBeVisible();
  await expect(explanation).toContainText("19 EV change hands");
  await expect(explanation).toContainText("top VTD:");
  if (process.env.SANDBOX_CAPTURE_V027A) {
    await explanation.screenshot({ path: resolve(screenshotDirectory, "scenario-explanation-desktop.png") });
  }
});

test("scenario explanation becomes a readable one-column chain on mobile", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const explanation = await openExplanation(page);

  await expect(explanation).toBeVisible();
  const columns = await explanation.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (process.env.SANDBOX_CAPTURE_V027A) {
    await explanation.screenshot({ path: resolve(screenshotDirectory, "scenario-explanation-mobile.png") });
  }
});
