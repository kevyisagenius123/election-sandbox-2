import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const evidenceDirectory = resolve(import.meta.dirname, "../../docs/review/v0.19.1-supervisor-review/ai-supervisor");

async function waitForScenario(page: Page) {
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeAnimationHandles ?? -1)).toBe(0);
}

async function openControls(page: Page) {
  const button = page.getByRole("button", { name: "Open controls" });
  if (await button.isVisible()) await button.click();
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toHaveAttribute("data-snap", "working");
}

async function setRangeValue(locator: Locator, value: number) {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(nextValue));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: resolve(evidenceDirectory, name),
    animations: "disabled",
    caret: "hide",
    fullPage: false,
  });
}

test("AI supervisor completes Gate B on the frozen candidate", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const evidence: Record<string, unknown> = {};

  await page.goto("/app/");
  await waitForScenario(page);
  await page.getByRole("button", { name: "Pennsylvania", exact: true }).first().click();
  await waitForScenario(page);
  await openControls(page);
  await page.getByRole("button", { name: "Preference", exact: true }).click();

  const preference = page.locator("#pa-preference");
  await setRangeValue(preference, 1);
  await waitForScenario(page);
  const paRequirement = page.getByRole("region", { name: "Flip requirement for Pennsylvania" });
  await expect(paRequirement).toContainText("49,679");
  evidence.task1 = {
    firstAction: "Opened Pennsylvania, then Open controls and Preference.",
    visibleEffect: await page.locator(".selected-readout").innerText(),
  };
  evidence.task2 = {
    firstAction: "Read the always-visible Pennsylvania flip-requirement card.",
    requirement: await paRequirement.innerText(),
  };
  await capture(page, "01-pa-stop-short.png");

  await setRangeValue(preference, 2.5);
  await waitForScenario(page);
  await expect(paRequirement).toContainText("Still needed");
  await expect(paRequirement).toContainText("0");
  await page.getByRole("tab", { name: "Contributors" }).click();
  const contributionCard = page.locator(".contribution-card");
  await contributionCard.getByRole("button", { name: "Counties", exact: true }).click();
  const countyRows = await contributionCard.locator(".contribution-list li").evaluateAll((rows) => rows.slice(0, 5).map((row) => (row.textContent ?? "").replace(/\s+/g, " ").trim()));
  await contributionCard.getByRole("button", { name: "VTDs", exact: true }).click();
  const vtdRows = await contributionCard.locator(".contribution-list li").evaluateAll((rows) => rows.slice(0, 5).map((row) => (row.textContent ?? "").replace(/\s+/g, " ").trim()));
  evidence.task3 = {
    firstAction: "Raised the same preference control through the state threshold, then opened Contributors.",
    requirement: await paRequirement.innerText(),
    countyRows,
    vtdRows,
  };
  await capture(page, "02-pa-flipped-contributors.png");

  await page.getByRole("button", { name: "United States", exact: true }).click();
  await expect(page.locator('.application-shell[data-geography-level="national"]')).toBeVisible();
  await page.getByRole("button", { name: "Compare alternative routes" }).click();
  await page.getByRole("button", { name: "Net margin votes" }).click();
  const firstRoute = page.getByTestId("path-route-1");
  const routeBeforeSelection = await firstRoute.innerText();
  await firstRoute.getByRole("button").first().click();
  const routeConstruction = page.locator(".route-construction");
  await expect(routeConstruction).toBeVisible();
  evidence.task4 = {
    firstAction: "Returned to the United States, opened route alternatives, and selected Net margin votes.",
    selectedRoute: routeBeforeSelection,
    construction: await routeConstruction.innerText(),
    definitions: await page.locator(".route-disclosure").innerText(),
  };
  await capture(page, "03-path-to-270.png");

  await page.getByRole("button", { name: "Copy scenario link" }).click();
  await expect(page.getByText("Scenario link copied — this URL reconstructs your current assumptions.")).toBeVisible();
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const replay = await context.newPage();
  await replay.goto(copiedUrl);
  await waitForScenario(replay);
  evidence.task5 = {
    firstAction: "Used Copy scenario link and opened the copied URL in a new page.",
    restoredUrlHasRecipes: new URL(copiedUrl).searchParams.getAll("recipe").length,
    restoredRoute: await replay.locator(".route-construction").innerText(),
    restoredConsequence: await replay.locator(".consequence-summary").innerText(),
  };
  await capture(replay, "04-restored-scenario.png");
  await replay.close();

  await page.getByRole("button", { name: "Pennsylvania", exact: true }).first().click();
  await waitForScenario(page);
  await openControls(page);
  await page.getByRole("tab", { name: "Data" }).click();
  const paLedger = page.getByRole("region", { name: "Pennsylvania data foundation" });
  const paEvidence = await paLedger.innerText();
  await capture(page, "05-pa-evidence.png");

  await page.getByRole("button", { name: "United States", exact: true }).click();
  await page.getByRole("button", { name: "Michigan", exact: true }).click();
  await waitForScenario(page);
  await openControls(page);
  await page.getByRole("tab", { name: "Data" }).click();
  const miLedger = page.getByRole("region", { name: "Michigan data foundation" });
  const miEvidence = await miLedger.innerText();
  evidence.task6 = {
    firstAction: "Opened each state's Data tab from its detailed laboratory.",
    pennsylvania: paEvidence,
    michigan: miEvidence,
  };
  await capture(page, "06-mi-evidence.png");

  evidence.task7 = {
    firstAction: "Read the Electoral College scenario card and changed-state ledger.",
    consequence: await page.locator(".consequence-summary").innerText(),
    score: await page.locator(".scenario-score").innerText(),
    ledger: await page.getByLabel("Changed state Electoral College consequences").innerText(),
  };

  await page.getByRole("button", { name: "United States", exact: true }).click();
  await openControls(page);
  await page.getByRole("tab", { name: "Data" }).click();
  const nationalEvidence = await page.getByRole("region", { name: "National data coverage" }).innerText();
  evidence.adversarial = {
    forecast: await page.locator(".route-disclosure").innerText(),
    wisconsin: nationalEvidence,
    geographyComparison: { pennsylvania: paEvidence, michigan: miEvidence },
  };
  await capture(page, "07-national-data-boundary.png");

  console.log(`AI_SUPERVISOR_EVIDENCE ${JSON.stringify(evidence)}`);
});
