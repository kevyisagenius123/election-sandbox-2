import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1";
const ENGINE_VERSION = "pa-behavior-v1";
const HOSTED_VISUALS = Boolean(process.env.GITHUB_ACTIONS);

function scenarioPath(options: { state?: "MI" | "PA" | "WI"; preference?: number; county?: string; vtd?: string; plan?: string } = {}) {
  const state = options.state ?? "PA";
  const params = new URLSearchParams({
    scenario: "2", data: DATA_VERSION, engine: ENGINE_VERSION, activeState: state,
    target: "harris", route: "fewest-states", view: "scenario", editor: "preference",
    rank: "vtd",
  });
  if (options.plan) params.set("plan", options.plan);
  if (options.state) params.set("state", options.state);
  if (options.county) params.set("county", options.county);
  if (options.vtd) params.set("vtd", options.vtd);
  params.append("recipe", `${state}|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|${options.preference ?? 2.5}|0,50`);
  return `/app?${params.toString()}`;
}

async function loadVisual(page: Page, path: string, home = false) {
  await page.goto(path);
  if (home) await expect(page.getByRole("button", { name: "Open Sandbox", exact: true }).first()).toBeVisible();
  else await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeAnimationHandles ?? -1)).toBe(0);
  await expect.poll(async () => page.evaluate(() => window.__sandboxDiagnostics?.().activeDeckLayerIds.length ?? 0)).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function expectPlatformVisualStable(page: Page, name: string) {
  const options = { animations: "disabled" as const, caret: "hide" as const, fullPage: false };
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
  { name: "01-editorial-home-desktop.png", width: 1440, height: 900, path: "/", mode: "home" },
  { name: "02-us-laboratory-collapsed.png", width: 1440, height: 900, path: scenarioPath(), mode: "laboratory", geography: "national", snap: "collapsed" },
  { name: "03-us-laboratory-working.png", width: 1440, height: 900, path: scenarioPath(), mode: "laboratory", geography: "national", snap: "working" },
  { name: "04-us-laboratory-selected-route.png", width: 1440, height: 900, path: scenarioPath({ plan: "FL,MI" }), mode: "laboratory", geography: "national", snap: "collapsed" },
  { name: "05-pa-laboratory.png", width: 1440, height: 900, path: scenarioPath({ state: "PA" }), mode: "laboratory", geography: "state", snap: "collapsed" },
  { name: "06-county-laboratory.png", width: 1440, height: 900, path: scenarioPath({ state: "PA", county: "42003", vtd: "42003000010" }), mode: "laboratory", geography: "reporting-unit", snap: "working" },
  { name: "07-us-laboratory-1024.png", width: 1024, height: 768, path: scenarioPath(), mode: "laboratory", geography: "national", snap: "working" },
  { name: "08-us-bottom-sheet-390.png", width: 390, height: 844, path: scenarioPath(), mode: "laboratory", geography: "national", snap: "working" },
  { name: "09-wi-laboratory.png", width: 1440, height: 900, path: scenarioPath({ state: "WI", preference: 1.5 }), mode: "laboratory", geography: "state", snap: "collapsed" },
  { name: "10-wi-ward-laboratory.png", width: 1440, height: 900, path: scenarioPath({ state: "WI", preference: 1.5, county: "55001", vtd: "55001002750001" }), mode: "laboratory", geography: "reporting-unit", snap: "working" },
  { name: "11-wi-bottom-sheet-390.png", width: 390, height: 844, path: scenarioPath({ state: "WI", preference: 1.5 }), mode: "laboratory", geography: "state", snap: "working" },
] as const;

for (const reference of references) {
  test(reference.name.replace(".png", ""), async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: reference.width, height: reference.height });
    await loadVisual(page, reference.path, reference.mode === "home");
    if (reference.snap) {
      const snap = page.getByRole("button", { name: reference.snap, exact: true });
      if (reference.snap === "working" && !(await snap.isVisible())) {
        await page.getByRole("button", { name: "Open controls" }).click();
        await expect(page.getByRole("region", { name: "Laboratory desk" })).toHaveAttribute("data-snap", "working");
      } else {
        await snap.click();
        await expect(snap).toHaveAttribute("aria-pressed", "true");
      }
    }
    await expect(page.locator(`.application-shell[data-workspace-mode="${reference.mode}"]`)).toBeVisible();
    if (reference.geography) await expect(page.locator(`.application-shell[data-geography-level="${reference.geography}"]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(reference.width);
    await expectPlatformVisualStable(page, reference.name);
  });
}

test("reduced motion removes drawer and route progress animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadVisual(page, scenarioPath({ state: "MI", preference: 2.5, plan: "FL,MI" }));
  await page.getByRole("button", { name: "working", exact: true }).click();
  expect(await page.locator(".laboratory-drawer").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  expect(await page.locator(".route-progress-track span").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});
