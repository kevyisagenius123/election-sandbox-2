import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const DATA_VERSION = "us2024-pa-vtd2020-mi-precinct2024-v1";
const ENGINE_VERSION = "pa-behavior-v1";
const STRESS_CYCLES = Number(process.env.SANDBOX_STRESS_CYCLES ?? 6);
const WARMUP_CYCLES = Math.min(5, Math.max(2, Math.floor(STRESS_CYCLES / 3)));
const MEBIBYTE = 1024 * 1024;

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function percentile(values: number[], percentileValue: number) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * percentileValue) - 1)];
}

function linearSlope(values: number[]) {
  const center = (values.length - 1) / 2;
  const numerator = values.reduce((sum, value, index) => sum + (index - center) * value, 0);
  const denominator = values.reduce((sum, _value, index) => sum + (index - center) ** 2, 0);
  return numerator / denominator;
}

interface RuntimeDiagnostics {
  activeDetailedWorker: "MI" | "PA" | null;
  detailedWorkerCount: number;
  portfolioWorkerCount: number;
  activeModelShardBytes: number;
  portfolioRequestedModelBytes: number;
  geometryCacheEntries: number;
  geometryCacheBytes: number;
  pendingGeometryFetches: number;
  pendingScenarioRequests: number;
  activeAnimationHandles: number;
  mapMountCount: number;
  webglContextCount: number;
  activeDeckLayerIds: readonly string[];
}

function portfolioPath() {
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
  });
  params.append("recipe", `PA|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);
  params.append("recipe", `MI|2024-president|${DATA_VERSION}|${ENGINE_VERSION}|0|55|stein|2.5|0,50`);
  return `/?${params.toString()}`;
}

async function diagnostics(page: Page) {
  return page.evaluate(() => {
    if (!window.__sandboxDiagnostics) throw new Error("Runtime diagnostics hook is unavailable");
    return window.__sandboxDiagnostics();
  }) as Promise<RuntimeDiagnostics>;
}

async function waitForSettledRuntime(page: Page, stateCode: "MI" | "PA") {
  await expect(page.getByRole("button", { name: "Copy scenario link" })).toBeEnabled();
  await expect.poll(async () => diagnostics(page)).toMatchObject({
    activeDetailedWorker: stateCode,
    detailedWorkerCount: 1,
    portfolioWorkerCount: 1,
    pendingGeometryFetches: 0,
    pendingScenarioRequests: 0,
    mapMountCount: 1,
    webglContextCount: 1,
  });
  await expect.poll(async () => (await diagnostics(page)).activeAnimationHandles).toBe(0);
}

async function openTopPrecinct(page: Page, stateCode: "MI" | "PA") {
  const contributorsTab = page.getByRole("tab", { name: "Contributors", exact: true });
  if (!(await contributorsTab.isVisible())) await page.getByRole("button", { name: "working", exact: true }).click();
  await contributorsTab.click();
  await page.getByRole("button", { name: stateCode === "PA" ? "VTDs" : "Precincts", exact: true }).click();
  const firstContribution = page.locator(".contribution-list button").first();
  await expect(firstContribution).toBeVisible();
  await firstContribution.click();
  await expect(page.locator(".atlas-data-note")).toContainText(stateCode === "PA" ? "Verified VTD returns" : "Verified precinct returns");
  await expect(page.locator(".atlas-load-status")).toHaveCount(0);
  await expect.poll(async () => (await diagnostics(page)).geometryCacheBytes).toBeGreaterThan(0);
  return diagnostics(page);
}

async function switchDetailedState(page: Page, stateCode: "MI" | "PA") {
  await page.getByTestId(`portfolio-state-${stateCode}`).click();
  await waitForSettledRuntime(page, stateCode);
}

test("deterministic PA and MI session holds lifecycle and byte bounds", async ({ page, context }) => {
  test.setTimeout(Math.max(120_000, STRESS_CYCLES * 25_000));
  await page.goto(portfolioPath());
  await waitForSettledRuntime(page, "MI");
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  const samples: Array<{
    cycle: number;
    usedHeapBytes: number;
    peakGeometryBytes: number;
    diagnostics: RuntimeDiagnostics;
    durationMs: number;
  }> = [];

  for (let cycle = 1; cycle <= STRESS_CYCLES; cycle += 1) {
    const started = performance.now();
    const michiganLoaded = await openTopPrecinct(page, "MI");
    await switchDetailedState(page, "PA");
    const pennsylvaniaLoaded = await openTopPrecinct(page, "PA");
    await switchDetailedState(page, "MI");
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage") as { usedSize: number };
    const snapshot = await diagnostics(page);
    samples.push({
      cycle,
      usedHeapBytes: heap.usedSize,
      peakGeometryBytes: Math.max(michiganLoaded.geometryCacheBytes, pennsylvaniaLoaded.geometryCacheBytes),
      diagnostics: snapshot,
      durationMs: performance.now() - started,
    });

    expect(snapshot.detailedWorkerCount).toBe(1);
    expect(snapshot.portfolioWorkerCount).toBe(1);
    expect(snapshot.webglContextCount).toBe(1);
    expect(snapshot.mapMountCount).toBe(1);
    expect(snapshot.geometryCacheEntries).toBeLessThanOrEqual(6);
    expect(Math.max(michiganLoaded.geometryCacheBytes, pennsylvaniaLoaded.geometryCacheBytes)).toBeGreaterThan(0);
    expect(snapshot.pendingGeometryFetches).toBe(0);
    expect(snapshot.pendingScenarioRequests).toBe(0);
    expect(snapshot.activeAnimationHandles).toBe(0);
    expect(snapshot.activeDeckLayerIds).toContain("sandbox-2-counties-MI");
  }

  await expect(page.locator(".scenario-score")).toContainText("260");
  await expect(page.locator(".scenario-score")).toContainText("278");
  await expect(page.getByTestId("path-route-1")).toContainText("260 → 270 EV");
  await expect.poll(() => new URL(page.url()).searchParams.getAll("recipe").length).toBe(2);

  if (STRESS_CYCLES >= 30) {
    const measured = samples.slice(WARMUP_CYCLES);
    const openingMedian = median(measured.slice(0, 5).map((sample) => sample.usedHeapBytes));
    const closingMedian = median(measured.slice(-5).map((sample) => sample.usedHeapBytes));
    const heapGrowthBytes = closingMedian - openingMedian;
    const heapGrowthPct = heapGrowthBytes / openingMedian * 100;
    const heapSlopeBytesPerCycle = linearSlope(measured.map((sample) => sample.usedHeapBytes));
    const cycleP95Ms = percentile(measured.map((sample) => sample.durationMs), 0.95);
    const analysis = {
      openingMedianHeapBytes: openingMedian,
      closingMedianHeapBytes: closingMedian,
      heapGrowthBytes,
      heapGrowthPct,
      heapSlopeBytesPerCycle,
      cycleP95Ms,
      budgets: {
        maximumHeapGrowthBytes: 20 * MEBIBYTE,
        maximumHeapGrowthPct: 20,
        maximumHeapSlopeBytesPerCycle: 0.5 * MEBIBYTE,
        maximumCycleP95Ms: 15_000,
      },
    };
    await mkdir("test-results", { recursive: true });
    await writeFile(
      "test-results/runtime-profile.json",
      `${JSON.stringify({ warmupCycles: WARMUP_CYCLES, measuredCycles: measured.length, analysis, samples }, null, 2)}\n`,
      "utf8",
    );
    expect(heapGrowthBytes).toBeLessThanOrEqual(20 * MEBIBYTE);
    expect(heapGrowthPct).toBeLessThanOrEqual(20);
    expect(heapSlopeBytesPerCycle).toBeLessThanOrEqual(0.5 * MEBIBYTE);
    expect(cycleP95Ms).toBeLessThanOrEqual(15_000);
  }
});

test("hostile state replacement rejects delayed geometry and leaves one owner", async ({ page }) => {
  test.setTimeout(90_000);
  let delayedGeometryRequests = 0;
  await page.route(/\/data\/(pa|mi)\/2024\/precincts\/.*\.json$/, async (route) => {
    delayedGeometryRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto(portfolioPath());
  await waitForSettledRuntime(page, "MI");

  await page.getByRole("button", { name: "working", exact: true }).click();
  await page.getByRole("tab", { name: "Contributors", exact: true }).click();
  await page.getByRole("button", { name: "Precincts", exact: true }).click();
  await page.locator(".contribution-list button").first().click();
  await page.getByTestId("portfolio-state-PA").click();
  await page.getByTestId("portfolio-state-MI").click();
  await page.getByTestId("portfolio-state-PA").click();
  await page.getByTestId("portfolio-state-MI").click();
  await page.getByTestId("portfolio-state-PA").click();

  await waitForSettledRuntime(page, "PA");
  expect(delayedGeometryRequests).toBeGreaterThan(0);
  const snapshot = await diagnostics(page);
  expect(snapshot.activeDetailedWorker).toBe("PA");
  expect(snapshot.detailedWorkerCount).toBe(1);
  expect(snapshot.portfolioWorkerCount).toBe(1);
  expect(snapshot.pendingGeometryFetches).toBe(0);
  expect(snapshot.pendingScenarioRequests).toBe(0);
  expect(snapshot.activeAnimationHandles).toBe(0);
  expect(snapshot.webglContextCount).toBe(1);
  expect(snapshot.geometryCacheEntries).toBeLessThanOrEqual(6);
});
