import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-v2";
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

async function loadScenario(page: Page, params: URLSearchParams) {
  const dataResponse = page.waitForResponse((response) => (
    response.url().endsWith("/data/pa/2020/vtd-demographics.json")
  ));
  await page.goto(scenarioPath(params));
  expect((await dataResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
}

test("canonical shared scenario restores the exact result and selected VTD", async ({ page }) => {
  await loadScenario(page, canonicalScenario);

  await expect(page.getByRole("button", { name: "Shift" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Third party" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "VTDs" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Data inspector for ALEPPO Voting District" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Scenario editor" }).getByText("R +5.8", { exact: true })).toBeVisible();
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
    "Scenario matches the certified EV baseline",
  );
  await expect(page.getByRole("slider", { name: "Participation increase" })).toHaveValue("0");
  await expect(page).toHaveURL("http://127.0.0.1:4173/");
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
  });
  await loadScenario(page, preferenceScenario);

  const preference = page.getByRole("slider", { name: "Two-party preference transfer" });
  await preference.fill("8");
  await preference.fill("-12");
  await preference.fill("6.2");

  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(preference).toHaveValue("6.2");
  await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText(
    "Pennsylvania flips to Harris",
  );
  await expect(page.getByRole("complementary", { name: "Scenario editor" }).getByText("D +4.5", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp("preference=6.2(?:&|$)"));
});
