import { expect, test, type Page } from "@playwright/test";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";

interface LaboratoryDiagnostics {
  activeAnimationHandles: number;
  activeMapView: readonly number[] | null;
  detailedWorkerCount: number;
  mapMountCount: number;
  pendingGeometryFetches: number;
  pendingScenarioRequests: number;
  portfolioWorkerCount: number;
  webglContextCount: number;
}

function laboratoryPath(stateCode: "MI" | "PA" = "PA", preference = 2.5) {
  const params = new URLSearchParams({
    scenario: "2",
    data: DATA_VERSION,
    engine: ENGINE_VERSION,
    activeState: stateCode,
    target: "harris",
    route: "fewest-states",
    view: "scenario",
    editor: "preference",
    rank: "vtd",
    state: stateCode,
    plan: "FL,MI",
  });
  params.append("recipe", `${stateCode}|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|${preference}|0,50`);
  return `/?${params.toString()}`;
}

async function diagnostics(page: Page) {
  return page.evaluate(() => {
    if (!window.__sandboxDiagnostics) throw new Error("Runtime diagnostics hook is unavailable");
    return window.__sandboxDiagnostics();
  }) as Promise<LaboratoryDiagnostics>;
}

async function loadLaboratory(page: Page, stateCode: "MI" | "PA" = "PA", preference = 2.5) {
  await page.goto(laboratoryPath(stateCode, preference));
  await expect(page.locator('.application-shell[data-workspace-mode="laboratory"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await expect.poll(async () => diagnostics(page)).toMatchObject({
    activeAnimationHandles: 0,
    detailedWorkerCount: 1,
    mapMountCount: 1,
    pendingGeometryFetches: 0,
    pendingScenarioRequests: 0,
    portfolioWorkerCount: 1,
    webglContextCount: 1,
  });
}

async function setDrawer(page: Page, snap: "collapsed" | "working" | "expanded") {
  const button = page.getByRole("button", { name: snap, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

test("National and Laboratory shells preserve one scenario and one runtime", async ({ page }) => {
  await loadLaboratory(page);
  const recipe = new URL(page.url()).searchParams.getAll("recipe");

  await page.locator(".laboratory-context").getByRole("button", { name: /United States/ }).click();
  await expect(page.locator('.application-shell[data-workspace-mode="national"]')).toBeVisible();
  await expect.poll(async () => diagnostics(page)).toMatchObject({
    detailedWorkerCount: 1,
    mapMountCount: 1,
    portfolioWorkerCount: 1,
    webglContextCount: 1,
  });
  await expect(page.getByTestId("portfolio-state-PA")).toContainText("D");

  await page.getByTestId("portfolio-state-PA").click();
  await expect(page.locator('.application-shell[data-workspace-mode="laboratory"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll("recipe")).toEqual(recipe);
  await expect.poll(async () => diagnostics(page)).toMatchObject({
    detailedWorkerCount: 1,
    mapMountCount: 1,
    portfolioWorkerCount: 1,
    webglContextCount: 1,
  });
});

test("drawer snaps and boundary drag preserve the camera and map height", async ({ page }) => {
  await loadLaboratory(page);
  const initialView = (await diagnostics(page)).activeMapView;
  expect(initialView).not.toBeNull();

  await setDrawer(page, "working");
  await setDrawer(page, "expanded");
  expect(await page.locator(".map-stage").evaluate((element) => element.clientHeight)).toBeGreaterThanOrEqual(320);
  expect((await diagnostics(page)).activeMapView).toEqual(initialView);

  await setDrawer(page, "collapsed");
  const handle = page.getByRole("button", { name: "Resize laboratory drawer" });
  const box = await handle.boundingBox();
  if (!box) throw new Error("Drawer handle has no layout box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 360, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Laboratory desk" })).not.toHaveAttribute("data-snap", "collapsed");
  expect((await diagnostics(page)).activeMapView).toEqual(initialView);
});

test("contribution selection opens the geography Inspector", async ({ page }) => {
  test.setTimeout(60_000);
  await loadLaboratory(page);
  await setDrawer(page, "working");
  await page.getByRole("tab", { name: "Contributors", exact: true }).click();
  await page.getByRole("button", { name: "Precincts", exact: true }).click();
  const contribution = page.locator(".contribution-list button").first();
  await expect(contribution).toBeVisible();
  await contribution.click();
  await expect(page.getByRole("tab", { name: "Inspector", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".inspector-card")).toBeVisible();
});

test("right rail is bounded and route alternatives restore focus on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await loadLaboratory(page);
  const alternatives = page.locator(".route-alternatives-button");
  await expect(alternatives).toHaveAccessibleName("Compare alternative routes");
  await alternatives.click();
  await expect(alternatives).toHaveAttribute("aria-expanded", "true");
  const layout = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(".control-column");
    if (!rail) throw new Error("Right rail is unavailable");
    rail.scrollTop = rail.scrollHeight;
    return {
      bodyHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      bodyScrollY: scrollY,
      railClientHeight: rail.clientHeight,
      railScrollHeight: rail.scrollHeight,
      railScrollTop: rail.scrollTop,
    };
  });
  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.bodyScrollY).toBe(0);
  expect(layout.railScrollHeight).toBeGreaterThan(layout.railClientHeight);
  expect(layout.railScrollTop).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(alternatives).toHaveAttribute("aria-expanded", "false");
  await expect(alternatives).toHaveAccessibleName("Compare alternative routes");
  await expect(alternatives).toBeFocused();
});

test("reduced motion, tab keyboarding, viewport resize, and mobile safe area remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadLaboratory(page);
  await setDrawer(page, "working");
  expect(await page.getByRole("region", { name: "Laboratory desk" }).evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");

  const behavior = page.getByRole("tab", { name: "Behavior", exact: true });
  await behavior.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Contributors", exact: true })).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole("region", { name: "Laboratory desk" })).toHaveAttribute("data-snap", "working");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.getByRole("region", { name: "Laboratory desk" }).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { bottom: rect.bottom, width: rect.width, viewportHeight: innerHeight, viewportWidth: innerWidth };
  });
  expect(mobile.bottom).toBe(mobile.viewportHeight);
  expect(mobile.width).toBeLessThanOrEqual(mobile.viewportWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
