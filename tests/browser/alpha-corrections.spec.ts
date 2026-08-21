import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1";
const ENGINE_VERSION = "pa-behavior-v1";

function paScenario(preference = 1) {
  const params = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: "PA",
    target: "harris",
    view: "scenario",
    editor: "preference",
    rank: "vtd",
    state: "PA",
  });
  params.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|${preference}|0,50`);
  return `/app/?${params.toString()}`;
}

async function waitForScenario(page: Page) {
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
}

test("collapsed state drawer exposes an intent-first model action", async ({ page }) => {
  await page.goto(paScenario(0));
  await waitForScenario(page);
  const drawer = page.getByRole("region", { name: "Laboratory desk" });
  await expect(drawer).toHaveAttribute("data-snap", "collapsed");
  await expect(drawer).toContainText("Change Pennsylvania");
  await expect(drawer).toContainText("Turnout · Preference · Third party");
  await page.getByRole("button", { name: "Open controls" }).click();
  await expect(drawer).toHaveAttribute("data-snap", "working");
  await expect(page.getByRole("tab", { name: "Behavior" })).toHaveAttribute("aria-selected", "true");
});

test("state threshold is visible without a route and reuses the canonical route value", async ({ page }) => {
  await page.goto(paScenario(1));
  await waitForScenario(page);
  const stateFact = page.getByRole("region", { name: "Flip requirement for Pennsylvania" });
  await expect(stateFact).toContainText("49,679 net margin votes");
  await expect(stateFact).toContainText("70,588 D");
  await expect(page.locator(".route-construction")).toHaveCount(0);

  await page.getByRole("button", { name: "Compare alternative routes" }).click();
  await page.getByRole("button", { name: "Net margin votes" }).click();
  const route = page.getByTestId("path-route-1");
  await route.getByRole("button", { name: "Open Pennsylvania detailed laboratory" }).click();
  await expect(page.getByRole("region", { name: "Route construction for Pennsylvania" })).toContainText("49,679");
  await expect(stateFact).toContainText("49,679");
});

test("preference numbers teach transfer arithmetic at the values", async ({ page }) => {
  await page.goto(paScenario(1));
  await waitForScenario(page);
  await page.getByRole("button", { name: "Open controls" }).click();
  const explainer = page.locator(".transfer-explainer");
  await expect(explainer).toContainText("35,294 ballots transferred");
  await expect(explainer).toContainText("70,588 votes of Harris−Trump margin movement");
  await expect(explainer).toContainText("changes the two-candidate margin by 2 votes");
});

test("state evidence ledgers and geography language preserve separate contracts", async ({ page }) => {
  await page.goto(paScenario(1));
  await waitForScenario(page);
  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
  const paLedger = page.getByRole("region", { name: "Pennsylvania data foundation" });
  await expect(paLedger).toContainText("2020 Census voting districts (VTDs)");
  await expect(paLedger).toContainText("9,038 / 9,178 mapped");
  await expect(paLedger).toContainText("125,172 off-map ballots");

  await page.getByRole("button", { name: "United States", exact: true }).click();
  await page.getByRole("button", { name: "Michigan", exact: true }).click();
  await waitForScenario(page);
  await page.getByRole("button", { name: "Open controls" }).click();
  await page.getByRole("tab", { name: "Data" }).click();
  const miLedger = page.getByRole("region", { name: "Michigan data foundation" });
  await expect(miLedger).toContainText("2024 precinct reporting units");
  await expect(miLedger).toContainText("4,339 / 4,340 mapped");
  await page.getByRole("tab", { name: "Contributors" }).click();
  await expect(page.getByRole("button", { name: "Precincts", exact: true })).toBeVisible();
});

test("scenario link names the saved object and confirms deterministic reconstruction", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(paScenario(1));
  await waitForScenario(page);
  await page.getByRole("button", { name: "Copy scenario link" }).click();
  await expect(page.getByText("Scenario link copied — this URL reconstructs your current assumptions.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const replay = await context.newPage();
  await replay.goto(copied);
  await expect(replay.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect(replay.getByRole("region", { name: "Flip requirement for Pennsylvania" })).toContainText("49,679");
});
