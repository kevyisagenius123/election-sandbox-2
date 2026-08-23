import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const screenshotDirectory = resolve(
  import.meta.dirname,
  "../../docs/review/v0.24-swingometer-semantics/screenshots",
);

async function openBehavior(page: import("@playwright/test").Page) {
  const openControls = page.getByRole("button", { name: "Open controls", exact: true });
  if (await openControls.isVisible()) await openControls.click();
  const tab = page.getByRole("tab", { name: "Behavior", exact: true });
  await tab.click();
  await expect(page.getByRole("tabpanel", { name: "Behavior" })).toBeVisible();
}

test("Swingometer states each operation contract and its audited denominator", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Pennsylvania", exact: true }).first().click();
  await openBehavior(page);

  const contract = page.getByRole("region", { name: "Current slider contract" });
  await expect(contract).toContainText("Scenario assumption, not a forecast");
  await expect(contract).toContainText("Adds Harris or Trump ballots");
  await expect(contract).toContainText("not CVAP or a 2024 eligibility estimate");

  await page.getByRole("button", { name: "Preference", exact: true }).click();
  await expect(contract).toContainText("Transfers existing ballots directly");
  await expect(contract).toContainText("Total ballots and all third-party totals stay fixed");
  await expect(contract).toContainText("full feasible statewide transfer");
  await expect(page.locator(".preference-labels")).toContainText(/Harris → Trump \d/);
  await expect(page.locator(".preference-labels")).toContainText(/Trump → Harris \d/);

  await page.getByRole("button", { name: "Third party", exact: true }).click();
  await expect(contract).toContainText("Exchanges the selected third-party bucket");
  await expect(contract).toContainText("statewide ballot total stays fixed");
  await expect(page.locator(".third-party-labels")).toContainText(/pts capacity/);

  await page.getByRole("button", { name: "Turnout", exact: true }).click();
  await page.getByRole("button", { name: "expanded", exact: true }).click();
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, "pennsylvania-turnout-contract.png"),
    fullPage: true,
  });
});
