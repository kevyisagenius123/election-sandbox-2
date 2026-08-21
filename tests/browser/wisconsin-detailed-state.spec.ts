import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1";
const ENGINE_VERSION = "pa-behavior-v1";

function wisconsinScenario(preference = "0") {
  const params = new URLSearchParams({
    scenario: "1",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    turnout: "0",
    turnoutHarris: "55",
    preference,
    thirdParty: "stein",
    thirdPartyShift: "0",
    thirdPartyHarris: "50",
    view: "scenario",
    editor: "preference",
    rank: "vtd",
    state: "WI",
    county: "55001",
    vtd: "55001002750001",
  });
  return `/app/?${params.toString()}`;
}

async function openLaboratoryTab(page: Page, name: "Behavior" | "Contributors" | "Inspector" | "Data") {
  const tab = page.getByRole("tab", { name, exact: true });
  if (!(await tab.isVisible())) {
    await page.getByRole("button", { name: "working", exact: true }).click();
  }
  await tab.click();
}

test("Wisconsin restores an exact reconstructed ward and discloses its evidence contract", async ({ page }) => {
  const runtimeResponse = page.waitForResponse((response) => (
    response.url().endsWith("/data/wi/2020/ward-demographics.json")
  ));
  await page.goto(wisconsinScenario());
  expect((await runtimeResponse).ok()).toBe(true);

  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  const inspector = page.getByRole("region", { name: "Data inspector for Adams - C 0001" });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText("Official LTSB population-disaggregated ward estimate");
  await expect(inspector).toContainText("321");
  await expect(page).toHaveURL(/state=WI/);
  await expect(page).toHaveURL(/vtd=55001002750001/);

  await openLaboratoryTab(page, "Data");
  const evidence = page.getByRole("region", { name: "Wisconsin data foundation" });
  await expect(evidence).toContainText("Wisconsin Legislative Technology Services Bureau");
  await expect(evidence).toContainText("6,946 / 7,086 mapped");
  await expect(evidence).toContainText("population-disaggregated");
  await expect(evidence).toContainText("140 unmatched polygons or units");
  await expect(evidence).toContainText("0 off-map ballots");
});

test("Wisconsin scenario movement survives deterministic URL replay", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto(wisconsinScenario("1.5"));
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();

  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("slider", { name: "Two-party preference transfer" })).toHaveValue("1.5");
  await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText("Harris gains 10 electoral votes");
  await expect(page.getByRole("complementary", { name: "Scenario editor" }).locator(".effect-grid strong").filter({ hasText: /^D \+0\.6$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("slider", { name: "Two-party preference transfer" })).toHaveValue("1.5");
  await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText("Harris gains 10 electoral votes");
});
