import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";
const HOSTED_VISUALS = Boolean(process.env.GITHUB_ACTIONS);

function scenarioPath(options: {
  state?: "MI" | "PA";
  preference?: number;
  county?: string;
  vtd?: string;
  plan?: string;
} = {}) {
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
    plan: options.plan ?? "FL,MI",
  });
  if (options.state) params.set("state", options.state);
  if (options.county) params.set("county", options.county);
  if (options.vtd) params.set("vtd", options.vtd);
  params.append("recipe", `${state}|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|${options.preference ?? 2.5}|0,50`);
  return `/?${params.toString()}`;
}

async function loadVisual(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeAnimationHandles ?? -1)).toBe(0);
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeDeckLayerIds.length ?? 0)).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function expectPlatformVisualStable(page: Page, name: string) {
  const options = {
    animations: "disabled" as const,
    caret: "hide" as const,
    fullPage: false,
  };
  if (!HOSTED_VISUALS) {
    await expect(page).toHaveScreenshot(name, { ...options, maxDiffPixelRatio: 0.015 });
    return;
  }
  const first = await page.screenshot(options);
  await page.waitForTimeout(150);
  const second = await page.screenshot(options);
  expect(first.equals(second)).toBe(true);
}

const references = [
  { name: "01-national-editorial-desktop.png", width: 1440, height: 900, path: scenarioPath() },
  { name: "02-pa-laboratory-collapsed.png", width: 1440, height: 900, path: scenarioPath({ state: "PA" }), snap: "collapsed" },
  { name: "03-pa-laboratory-working.png", width: 1440, height: 900, path: scenarioPath({ state: "PA" }), snap: "working" },
  { name: "04-pa-laboratory-expanded.png", width: 1440, height: 900, path: scenarioPath({ state: "PA" }), snap: "expanded" },
  { name: "05-county-inspector.png", width: 1440, height: 900, path: scenarioPath({ state: "PA", county: "42003", vtd: "42003000010" }), snap: "working" },
  { name: "06-modeled-unsatisfied-route.png", width: 1440, height: 900, path: scenarioPath({ state: "MI", preference: 0.5 }), snap: "collapsed" },
  { name: "07-satisfied-route.png", width: 1440, height: 900, path: scenarioPath({ state: "MI", preference: 2.5 }), snap: "collapsed" },
  { name: "08-laboratory-1024.png", width: 1024, height: 768, path: scenarioPath({ state: "PA" }), snap: "working" },
  { name: "09-laboratory-800.png", width: 800, height: 900, path: scenarioPath({ state: "PA" }), snap: "working" },
  { name: "10-bottom-sheet-390.png", width: 390, height: 844, path: scenarioPath({ state: "PA" }), snap: "working" },
] as const;

for (const reference of references) {
  test(reference.name.replace(".png", ""), async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: reference.width, height: reference.height });
    await loadVisual(page, reference.path);
    if (reference.snap) {
      const snap = page.getByRole("button", { name: reference.snap, exact: true });
      await snap.click();
      await expect(snap).toHaveAttribute("aria-pressed", "true");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(reference.width);
    if (reference.name.includes("national")) {
      await expect(page.locator('.application-shell[data-workspace-mode="national"]')).toBeVisible();
    }
    await expectPlatformVisualStable(page, reference.name);
  });
}

test("reduced motion removes drawer and route progress animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadVisual(page, scenarioPath({ state: "MI", preference: 2.5 }));
  await page.getByRole("button", { name: "working", exact: true }).click();
  expect(await page.locator(".laboratory-drawer").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  expect(await page.locator(".route-progress-track span").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});
