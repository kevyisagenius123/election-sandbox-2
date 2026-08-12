import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";

const acceptanceSizes = [
  { width: 800, height: 900 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1280, height: 800 },
  { width: 1350, height: 900 },
  { width: 390, height: 844 },
] as const;

function visualScenarioPath() {
  const params = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: "MI",
    target: "harris",
    route: "fewest-states",
    view: "scenario",
    editor: "preference",
    rank: "vtd",
    state: "MI",
    plan: "FL,MI",
  });
  params.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);
  params.append("recipe", `MI|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);
  return `/?${params.toString()}`;
}

async function loadVisualScenario(page: Page) {
  await page.goto(visualScenarioPath());
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect(page.locator('.route-lab-card[data-status="satisfied"]')).toBeVisible();
  await expect(page.locator(".scenario-score")).toContainText("260");
  await expect(page.locator(".scenario-score")).toContainText("278");
  await page.evaluate(() => document.fonts.ready);
}

for (const size of acceptanceSizes) {
  test(`responsive hierarchy at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(size);
    await loadVisualScenario(page);

    const layout = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { top: rect.top, bottom: rect.bottom, width: rect.width } : null;
      };
      return {
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        map: bounds(".map-stage"),
        score: bounds(".scenario-card"),
        route: bounds(".route-lab-card"),
        path: bounds(".path-card"),
        contribution: bounds(".contribution-card"),
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.map?.width).toBeGreaterThanOrEqual(size.width <= 390 ? 330 : 315);
    expect(layout.score).not.toBeNull();
    expect(layout.route).not.toBeNull();
    expect(layout.path).not.toBeNull();
    expect(layout.contribution).not.toBeNull();
    expect(layout.route!.top).toBeGreaterThanOrEqual(layout.score!.bottom);
    expect(layout.path!.top).toBeGreaterThanOrEqual(layout.route!.bottom);
    expect(layout.contribution!.top).toBeGreaterThan(layout.path!.top);

    await expect(page.getByRole("region", { name: "Route construction for Michigan" })).toContainText("Michigan satisfies this route");
    await expect(page.getByRole("region", { name: "Path to 270" })).toContainText("Net margin votes");
    await expect(page.getByRole("complementary", { name: "Scenario editor" })).toContainText("Where the result moved");
    await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeDeckLayerIds ?? [])).toContain("sandbox-2-counties-MI");

    await expect(page).toHaveScreenshot(`layout-${size.width}x${size.height}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      mask: [page.locator(".atlas-map-scene")],
      maskColor: "#e7e7df",
      maxDiffPixelRatio: 0.015,
    });

    if (size.width === 1180) {
      for (const [name, selector] of [
        ["electoral-ledger", ".scenario-card"],
        ["route-context", ".route-lab-card"],
        ["path-to-270", ".path-card"],
        ["behavior-editor", ".assumption-card"],
        ["contribution-panel", ".contribution-card"],
      ] as const) {
        await expect(page.locator(selector)).toHaveScreenshot(`${name}-1180.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.005,
        });
      }
    }

    if (size.width === 390) {
      await expect(page.locator(".scenario-card")).toHaveScreenshot("electoral-ledger-mobile-390.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.005,
      });
      await expect(page.locator(".route-lab-card")).toHaveScreenshot("route-context-mobile-390.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.005,
      });
    }
  });
}

test("reduced motion removes route progress animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadVisualScenario(page);
  const transition = await page.locator(".route-progress-track span").evaluate((element) => (
    getComputedStyle(element).transitionDuration
  ));
  expect(transition).toBe("0s");
});
