import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const screenshotDirectory = resolve(
  import.meta.dirname,
  "../../docs/review/v0.23a-visible-replay/screenshots",
);

test("Election Night runs the Swingometer result on the persistent atlas map", async ({ page }) => {
  test.setTimeout(150_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.removeItem("sandbox-2-election-night-profiles-v1"));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Pennsylvania", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toBeVisible();

  const canvas = page.locator(".atlas-map-scene canvas").first();
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => { element.dataset.replayPersistenceProbe = "same-map"; });
  const pathBefore = new URL(page.url()).pathname;

  await page.getByRole("button", { name: "Election Night", exact: true }).click();
  await expect(page.getByRole("region", { name: "Election night controls" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toBeHidden();
  await expect(page.locator('.atlas-map-scene canvas[data-replay-persistence-probe="same-map"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(pathBefore);
  const play = page.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator(".night-initialization")).toBeHidden();
  await expect(page.getByRole("region", { name: "Three-state election night desk" })).toContainText("WI");
  await expect(page.getByText(/No statewide fallback returns/)).toBeVisible();
  await expect(page.getByText("Pennsylvania, county by county", { exact: true })).toBeVisible();

  const consoleRegion = page.getByRole("region", { name: "Election night controls" });
  const consoleHandle = page.getByRole("button", { name: "Resize Election Night dock" });
  const handleBox = await consoleHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 300, { steps: 8 });
  await page.mouse.up();
  await expect(consoleRegion).toHaveAttribute("data-snap", "working");
  await expect(page.getByLabel("Election night speed")).toHaveValue("1");
  await page.getByLabel("Election night speed").selectOption("0.5");
  await expect(page.getByLabel("Election night speed")).toHaveValue("0.5");

  await page.getByRole("button", { name: "Next return", exact: true }).click();
  await expect(page.locator(".night-dock-clock small")).not.toContainText(/^0 returns/);

  await page.getByLabel("Election night timeline").fill("250000");
  await expect(page.locator(".night-dock-clock small")).not.toContainText("0 ballots", { timeout: 30_000 });
  await expect(page.locator(".night-live-lead")).toContainText("published local units");
  const pennsylvaniaMarginAtQuarter = await page.locator(".night-state-ledger .night-state-row").first().locator("b").textContent();
  await page.getByLabel("Election night timeline").fill("420000");
  await expect(page.locator(".night-state-ledger .night-state-row").first().locator("b")).not.toHaveText(pennsylvaniaMarginAtQuarter ?? "", { timeout: 30_000 });

  await page.getByRole("tab", { name: "Direct the count", exact: true }).click();
  await expect(page.getByRole("region", { name: "Election night behavior editor" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Chronology preview" })).toContainText("Planned reporting windows");
  await page.getByLabel("Reporting profile").selectOption("volatile-waves");
  await expect(page.getByLabel(/Count duration/)).toHaveValue("18");
  await page.getByLabel("County override state").selectOption("PA");
  await page.getByLabel("County override county").selectOption("42003");
  await page.getByRole("button", { name: "Add override", exact: true }).click();
  await page.getByLabel(/PA .* start shift/).fill("90");
  await page.getByLabel(/PA .* count length/).fill("150");
  await expect(page.getByRole("region", { name: "Chronology preview" })).toContainText("1 local exception");
  await page.getByLabel("Chronology profile name").fill("Supervisor demo");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved Supervisor demo in this browser.")).toBeVisible();
  await page.getByLabel(/Count duration/).fill("17");
  await page.getByLabel("Reporting profile").selectOption({ label: "Supervisor demo" });
  await expect(page.getByLabel(/Count duration/)).toHaveValue("18");
  await page.getByRole("button", { name: "expanded", exact: true }).click();
  await page.screenshot({
    path: resolve(screenshotDirectory, "election-night-director-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply and restart count", exact: true }).click();
  await expect(play).toBeEnabled({ timeout: 100_000 });
  await expect(page.getByRole("region", { name: "Chronology preview" })).toContainText("Running chronology");
  await page.getByRole("tab", { name: "Live", exact: true }).click();

  await play.click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.waitForTimeout(1_000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "collapsed", exact: true }).click();
  await expect(consoleRegion).toHaveAttribute("data-snap", "collapsed");

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, "integrated-election-night-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Election night speed")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({
    path: resolve(screenshotDirectory, "integrated-election-night-mobile.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Edit Swingometer", exact: true }).click();
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Election night controls" })).toBeHidden();
  await expect(page.locator('.atlas-map-scene canvas[data-replay-persistence-probe="same-map"]')).toBeVisible();

  expect(consoleErrors.filter((message) => (
    message !== "Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED"
  ))).toEqual([]);
});

test("Editorial home introduces the model before entering the laboratory", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Build the electorate. Then watch it count." })).toBeVisible();
  await expect(page.locator(".home-capabilities")).toContainText("Model");
  await expect(page.locator(".home-workflow")).toContainText("Analyst workflow");
  await expect(page.locator(".home-foundation")).toContainText("Pennsylvania");
  await expect(page.locator(".atlas-map-scene canvas").first()).toBeVisible();

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, "editorial-home-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Enter the laboratory", exact: true }).first().click();
  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toBeVisible();
});
