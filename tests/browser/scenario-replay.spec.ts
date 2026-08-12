import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";

const canonicalScenario = new URLSearchParams({
  scenario: "1",
  data: DATA_VERSION,
  engine: ENGINE_VERSION,
  turnout: "1.2",
  turnoutHarris: "63",
  preference: "-4.7",
  thirdParty: "oliver",
  thirdPartyShift: "0.8",
  thirdPartyHarris: "41",
  view: "difference",
  editor: "third-party",
  rank: "vtd",
  state: "PA",
  county: "42003",
  vtd: "42003000010",
});

function scenarioPath(params: URLSearchParams) {
  return `/?${params.toString()}`;
}

async function loadScenario(page: Page, params: URLSearchParams, stateCode = "PA") {
  const dataResponse = page.waitForResponse((response) => (
    response.url().endsWith(stateCode === "MI"
      ? "/data/mi/2020/precinct-demographics.json"
      : "/data/pa/2020/vtd-demographics.json")
  ));
  await page.goto(scenarioPath(params));
  expect((await dataResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
}

async function openLaboratoryTab(page: Page, name: "Behavior" | "Contributors" | "Inspector") {
  if (await page.locator('.application-shell[data-workspace-mode="laboratory"]').count() === 0) return;
  const tab = page.getByRole("tab", { name, exact: true });
  if (!(await tab.isVisible())) {
    const working = page.getByRole("button", { name: "working", exact: true });
    await working.click();
    await expect(working).toHaveAttribute("aria-pressed", "true");
  }
  await tab.click();
}

test("canonical shared scenario restores the exact result and selected VTD", async ({ page }) => {
  await loadScenario(page, canonicalScenario);

  await expect(page.getByRole("button", { name: "Shift" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Data inspector for ALEPPO Voting District" })).toBeVisible();
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("button", { name: "Third party" })).toHaveAttribute("aria-pressed", "true");
  await openLaboratoryTab(page, "Contributors");
  await expect(page.getByRole("button", { name: "Precincts" })).toHaveAttribute("aria-pressed", "true");
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("complementary", { name: "Scenario editor" }).locator(".effect-grid strong").getByText("R +5.8", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Shared scenario restored from a compatible deterministic URL.",
  );
  await expect(page).toHaveURL(new RegExp(`vtd=42003000010(?:&|$)`));
});

test("official alphanumeric VTD identifiers survive browser replay", async ({ page }) => {
  const alphanumericVtd = new URLSearchParams({
    scenario: "1",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    turnout: "0",
    turnoutHarris: "55",
    preference: "0",
    thirdParty: "stein",
    thirdPartyShift: "0",
    thirdPartyHarris: "50",
    view: "scenario",
    editor: "turnout",
    rank: "county",
    state: "PA",
    county: "42003",
    vtd: "4200300A000",
  });

  await loadScenario(page, alphanumericVtd);

  await expect(
    page.getByRole("region", { name: "Data inspector for PITTSBURGH WARD 15 DISTRICT 09" }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`vtd=4200300A000(?:&|$)`));
});

test("Michigan direct, split, and unavailable precinct bridges replay honestly", async ({ page }) => {
  const cases = [
    {
      county: "26001",
      precinct: "WP-001-01040-00001",
      name: "Alcona Township, Precinct 1",
      evidence: "Direct official 2020 VTD bridge",
    },
    {
      county: "26005",
      precinct: "WP-005-37460-00001",
      name: "Heath Township, Precinct 1",
      evidence: "Registered-voter-weighted 2020 VTD split",
    },
    {
      county: "26003",
      precinct: "WP-003-60820-00001",
      name: "Onota Township, Precinct 1",
      evidence: "Demographic bridge unavailable",
    },
  ];

  for (const item of cases) {
    const params = new URLSearchParams({
      scenario: "1",
      data: DATA_VERSION,
      engine: ENGINE_VERSION,
      turnout: "0",
      turnoutHarris: "55",
      preference: "0",
      thirdParty: "stein",
      thirdPartyShift: "0",
      thirdPartyHarris: "50",
      view: "scenario",
      editor: "turnout",
      rank: "vtd",
      state: "MI",
      county: item.county,
      vtd: item.precinct,
    });
    await loadScenario(page, params, "MI");
    const inspector = page.getByRole("region", { name: `Data inspector for ${item.name}` });
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText(item.evidence);
    await expect(page.getByText(/of precinct-file votes map to these polygons/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`vtd=${item.precinct}(?:&|$)`));
  }
});

test("unsupported future links fail closed to the certified baseline", async ({ page }) => {
  const unsupported = new URLSearchParams({
    scenario: "99",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    turnout: "1.2",
    state: "PA",
  });

  await loadScenario(page, unsupported);

  await expect(page.getByRole("status")).toContainText(
    "Shared scenario URL version 99 is not supported.",
  );
  await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText(
    "The scenario matches the certified Electoral College baseline.",
  );
  await expect(page.locator('.application-shell[data-workspace-mode="laboratory"][data-geography-level="national"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll("recipe")).toHaveLength(0);
  await expect(page).toHaveURL("http://127.0.0.1:4173/app/");
});

test("rapid scenario changes publish only the newest worker result", async ({ page }) => {
  const preferenceScenario = new URLSearchParams({
    scenario: "1",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    turnout: "0",
    turnoutHarris: "55",
    preference: "0",
    thirdParty: "stein",
    thirdPartyShift: "0",
    thirdPartyHarris: "50",
    view: "scenario",
    editor: "preference",
    rank: "county",
    state: "PA",
  });
  await loadScenario(page, preferenceScenario);
  await openLaboratoryTab(page, "Behavior");

  const preference = page.getByRole("slider", { name: "Two-party preference transfer" });
  await preference.fill("8");
  await preference.fill("-12");
  await preference.fill("6.2");

  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(preference).toHaveValue("6.2");
  await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText("Harris gains 19 electoral votes");
  await expect(page.getByRole("complementary", { name: "Scenario editor" }).locator(".effect-grid strong").getByText("D +4.5", { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("scenario")).toBe("2");
  await expect.poll(() => (
    new URL(page.url()).searchParams.getAll("recipe").find((recipe) => recipe.startsWith("PA|"))
  )).toContain("|6.2|");
});

test("a two-state portfolio aggregates deterministically and survives state switching", async ({ page }) => {
  test.setTimeout(60_000);
  const portfolio = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: "MI",
    view: "scenario",
    editor: "preference",
    rank: "county",
    state: "MI",
  });
  portfolio.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);
  portfolio.append("recipe", `MI|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);

  await loadScenario(page, portfolio, "MI");
  const editor = page.getByRole("complementary", { name: "Scenario editor" });
  await expect(editor.getByText("260", { exact: true })).toBeVisible();
  await expect(editor.getByText("278", { exact: true })).toBeVisible();
  await expect(page.getByTestId("portfolio-state-PA")).toContainText("D");
  await expect(page.getByTestId("portfolio-state-MI")).toContainText("D");
  await expect(page.getByTestId("path-route-1")).toContainText("WI");
  await expect(page.getByTestId("path-route-1")).toContainText("260 → 270 EV");
  await expect(page.getByTestId("path-route-1")).toContainText("actual → required");

  await page.getByTestId("portfolio-state-PA").click();
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("slider", { name: "Two-party preference transfer" })).toHaveValue("2.5");
  await expect(page.getByTestId("portfolio-state-PA")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();

  await page.getByRole("button", { name: "collapsed", exact: true }).click();
  await page.getByTestId("portfolio-state-MI").click();
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("slider", { name: "Two-party preference transfer" })).toHaveValue("2.5");
  await expect(page.getByTestId("portfolio-state-MI")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect.poll(() => new URL(page.url()).searchParams.getAll("recipe").length).toBe(2);

  await page.getByRole("button", { name: "collapsed", exact: true }).click();
  await page.getByRole("button", { name: "Compare alternative routes" }).click();
  await page.getByRole("button", { name: "Net margin votes" }).click();
  await expect(page.getByRole("button", { name: "Net margin votes" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("route")).toBe("margin-votes");

  await page.getByRole("button", { name: "Trump", exact: true }).click();
  await expect(page.getByRole("button", { name: "Trump", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".consequence-ledger-heading")).toContainText("−34 Trump EV");
  await expect.poll(() => new URL(page.url()).searchParams.get("target")).toBe("trump");

  await page.reload();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Trump", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".scenario-score")).toContainText("260");
  await expect(page.locator(".scenario-score")).toContainText("278");
  await expect(page.locator(".consequence-ledger-heading")).toContainText("−34 Trump EV");
  await page.getByRole("button", { name: "Compare alternative routes" }).click();
  await expect(page.getByRole("button", { name: "Net margin votes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Path to 270" })).toContainText("Trump already holds a majority.");
});

test("an active state that does not flip remains visible with zero EV consequence", async ({ page }) => {
  const portfolio = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: "PA",
    target: "harris",
    view: "scenario",
    editor: "preference",
    rank: "county",
    state: "PA",
  });
  portfolio.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|0.5|0,50`);

  await loadScenario(page, portfolio);
  const editor = page.getByRole("complementary", { name: "Scenario editor" });
  await expect(page.getByTestId("portfolio-state-PA")).toContainText("0 EV");
  await expect(editor).toContainText("Pennsylvania changed in the model, but no state changed its Electoral College allocation.");
  await expect(page.locator(".scenario-score")).toContainText("226");
  await expect(page.locator(".scenario-score")).toContainText("312");
});

test("a Required Michigan route becomes Modeled, Satisfied, replayable, and reversible", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Open Sandbox", exact: true }).first().click();
  await expect(page.locator('.application-shell[data-workspace-mode="laboratory"][data-geography-level="national"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await page.getByRole("button", { name: "Compare alternative routes" }).click();
  const firstRoute = page.getByTestId("path-route-1");
  await expect(firstRoute).toContainText("FL + MI");
  await expect(firstRoute.getByRole("button", { name: /Open Florida/ })).toHaveCount(0);

  await firstRoute.getByRole("button", { name: "Open Michigan detailed laboratory" }).click();
  await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toContainText(
    "Michigan remains a mathematical requirement.",
  );
  await expect.poll(() => new URL(page.url()).searchParams.get("plan")).toBe("FL,MI");

  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await openLaboratoryTab(page, "Behavior");
  await page.getByRole("button", { name: "Preference", exact: true }).click();
  const preference = page.getByRole("slider", { name: "Two-party preference transfer" });
  await preference.fill("0.5");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toContainText(
    "Michigan improved in the model but remains Required.",
  );

  await preference.fill("2.5");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  const routeLab = page.getByRole("region", { name: "Route construction for Michigan" });
  await expect(routeLab).toContainText("Michigan satisfies this route.");
  await expect(routeLab).toContainText("15 verified electoral votes");
  await expect(page.locator(".route-construction")).toContainText("1 of 2 states satisfied");

  await page.getByRole("button", { name: "United States", exact: true }).click();
  await expect(page.locator(".route-construction")).toContainText("Michigan");
  await expect(page.locator(".route-construction")).toContainText("satisfied");
  await page.getByRole("button", { name: "Open Michigan route laboratory" }).click();

  await page.reload();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await openLaboratoryTab(page, "Behavior");
  await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toContainText(
    "Michigan satisfies this route.",
  );
  await expect(page.getByRole("slider", { name: "Two-party preference transfer" })).toHaveValue("2.5");

  await preference.fill("0");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toContainText(
    "Michigan remains a mathematical requirement.",
  );
  await expect(page.locator(".route-construction")).toContainText("0 of 2 states satisfied");

  await page.getByRole("button", { name: "Trump", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("plan")).toBeNull();
  await expect(page.locator(".route-construction")).toHaveCount(0);
});
