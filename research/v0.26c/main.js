import "./style.css";

const research = {
  mode: "2d",
  charts: new Map(),
  initMs: {},
  disposeCount: 0,
  lifecycleRuns: [],
  webglContexts: new WeakSet(),
};
window.__V026C_RESEARCH__ = research;

const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function trackedGetContext(type, ...args) {
  const context = originalGetContext.call(this, type, ...args);
  if ((type === "webgl" || type === "webgl2" || type === "experimental-webgl") && context) {
    research.webglContexts.add(context);
  }
  return context;
};

const [{ default: fixture }, echartsModule] = await Promise.all([
  import("./data/count-landscape.json"),
  import("echarts"),
  import("echarts-gl"),
]);
const echarts = echartsModule;
const dataset = fixture.dataset;
const points = dataset.points;
const timeLabels = Array.from({ length: dataset.binCount }, (_, binIndex) => {
  const duration = dataset.endsAtMs - dataset.startsAtMs;
  const atMs = dataset.startsAtMs + Math.floor(duration * (binIndex + .5) / dataset.binCount);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(atMs);
});
const ballotMaximum = Math.max(...points.map((point) => point.ballotsPublished), 1);
const marginMaximum = Math.max(...points.map((point) => Math.abs(point.twoPartyMovementPpm)), 1);
const colorRange = ["#b64736", "#e38a4e", "#e6dfc8", "#8ec2c9", "#246b91"];

function comma(value) { return Math.round(value).toLocaleString("en-US"); }
function signed(value) { return `${value >= 0 ? "+" : "−"}${comma(Math.abs(value))}`; }
function tooltipFor(point) {
  const direction = point.twoPartyMovementVotes === 0 ? "even" : point.twoPartyMovementVotes > 0 ? "Harris" : "Trump";
  return `<b>${point.stateCode} · ${timeLabels[point.binIndex]} ET</b><br/>${comma(point.ballotsPublished)} ballots · ${comma(point.returnsPublished)} returns<br/>${direction === "even" ? "Even two-party movement" : `${direction} ${signed(Math.abs(point.twoPartyMovementVotes))} net votes`}<br/><span style="color:#78909a">H ${comma(point.harrisVotes)} · T ${comma(point.trumpVotes)} · Other ${comma(point.otherVotes)}</span>`;
}

function twoDimensionalOption() {
  return {
    animation: false,
    backgroundColor: "transparent",
    grid: { left: 52, right: 25, top: 42, bottom: 70, containLabel: true },
    tooltip: { trigger: "item", formatter: ({ dataIndex }) => tooltipFor(points[dataIndex]) },
    visualMap: {
      type: "continuous", dimension: 3, min: -marginMaximum, max: marginMaximum,
      left: "center", bottom: 8, orient: "horizontal", itemWidth: 220, itemHeight: 8,
      text: ["Harris movement", "Trump movement"], textStyle: { color: "#6e818a", fontSize: 10 },
      inRange: { color: colorRange }, calculable: false,
    },
    xAxis: {
      type: "category", data: timeLabels, boundaryGap: true,
      axisLine: { lineStyle: { color: "#9cadb2" } },
      axisTick: { show: false }, axisLabel: { color: "#71868f", interval: 5, rotate: 0, fontSize: 10 },
      splitLine: { show: true, lineStyle: { color: "rgba(70,95,105,.08)" } },
    },
    yAxis: {
      type: "category", data: dataset.stateCodes,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: "#214b60", fontFamily: "Newsreader", fontSize: 18, fontWeight: 600 },
      splitLine: { show: true, lineStyle: { color: "rgba(70,95,105,.12)" } },
    },
    series: [{
      type: "scatter",
      data: points.map((point) => [
        point.binIndex,
        point.stateCode,
        point.ballotsPublished,
        point.twoPartyMovementPpm,
      ]),
      symbolSize: (value) => value[2] === 0 ? 3 : 5 + 34 * Math.sqrt(value[2] / ballotMaximum),
      itemStyle: { borderColor: "rgba(255,255,255,.8)", borderWidth: 1, opacity: .92 },
      emphasis: { scale: 1.25 },
    }],
  };
}

function threeDimensionalOption() {
  return {
    animation: false,
    backgroundColor: "transparent",
    tooltip: { formatter: ({ dataIndex }) => tooltipFor(points[dataIndex]) },
    visualMap: {
      type: "continuous", dimension: 3, min: -marginMaximum, max: marginMaximum,
      left: "center", bottom: 8, orient: "horizontal", itemWidth: 220, itemHeight: 8,
      text: ["Harris movement", "Trump movement"], textStyle: { color: "#6e818a", fontSize: 10 },
      inRange: { color: colorRange }, calculable: false,
    },
    grid3D: {
      left: 10, right: 10, top: 0, bottom: 42, boxWidth: 180, boxDepth: 42, boxHeight: 72,
      environment: "#fafaf5",
      light: { main: { intensity: 1.05, shadow: false }, ambient: { intensity: .75 } },
      viewControl: {
        alpha: 20, beta: -22, distance: 205, minDistance: 205, maxDistance: 205,
        rotateSensitivity: 0, zoomSensitivity: 0, panSensitivity: 0, autoRotate: false,
      },
      axisPointer: { show: false },
    },
    xAxis3D: {
      type: "category", data: timeLabels,
      axisLabel: { color: "#71868f", interval: 7, fontSize: 9 },
      axisLine: { lineStyle: { color: "#91a4ac" } },
      splitLine: { lineStyle: { color: "rgba(70,95,105,.08)" } },
    },
    yAxis3D: {
      type: "category", data: dataset.stateCodes,
      axisLabel: { color: "#214b60", fontSize: 12 },
      axisLine: { lineStyle: { color: "#91a4ac" } },
      splitLine: { lineStyle: { color: "rgba(70,95,105,.1)" } },
    },
    zAxis3D: {
      type: "value", name: "ballots", min: 0, max: ballotMaximum,
      nameTextStyle: { color: "#71868f", fontSize: 10 },
      axisLabel: { color: "#71868f", formatter: (value) => value >= 1_000 ? `${Math.round(value / 1_000)}k` : value },
      axisLine: { lineStyle: { color: "#91a4ac" } },
      splitLine: { lineStyle: { color: "rgba(70,95,105,.1)" } },
    },
    series: [{
      type: "bar3D",
      shading: "lambert",
      data: points.map((point) => [
        point.binIndex,
        dataset.stateCodes.indexOf(point.stateCode),
        point.ballotsPublished,
        point.twoPartyMovementPpm,
      ]),
      barSize: 1.1,
      bevelSize: 0,
      itemStyle: { opacity: .95 },
      emphasis: { itemStyle: { opacity: 1 } },
    }],
  };
}

function optionFor(kind) { return kind === "3d" ? threeDimensionalOption() : twoDimensionalOption(); }

function dispose(kind) {
  const chart = research.charts.get(kind);
  if (!chart) return;
  chart.dispose();
  research.charts.delete(kind);
  research.disposeCount += 1;
}

function mount(kind) {
  if (research.charts.has(kind)) return;
  const target = document.querySelector(`#chart-${kind}`);
  const start = performance.now();
  const chart = echarts.init(target, null, { renderer: "canvas" });
  chart.setOption(optionFor(kind), { notMerge: true, lazyUpdate: false });
  research.initMs[kind] = Math.round((performance.now() - start) * 10) / 10;
  research.charts.set(kind, chart);
}

function lifecycleSnapshot() {
  return {
    mode: research.mode,
    activeCharts: research.charts.size,
    canvasCount: document.querySelectorAll(".chart canvas").length,
    disposeCount: research.disposeCount,
    initMs: { ...research.initMs },
  };
}

function renderLifecycle() {
  const snapshot = lifecycleSnapshot();
  document.querySelector("#lifecycle-summary").textContent = `${snapshot.activeCharts} active chart${snapshot.activeCharts === 1 ? "" : "s"} · ${snapshot.canvasCount} canvas${snapshot.canvasCount === 1 ? "" : "es"}`;
  document.querySelector("#lifecycle-detail").textContent = `Init 2D ${snapshot.initMs["2d"] ?? "–"} ms · GL ${snapshot.initMs["3d"] ?? "–"} ms · ${snapshot.disposeCount} disposed`;
}

function setMode(mode) {
  research.mode = mode;
  document.querySelector("#visual-grid").dataset.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  if (mode === "2d") { dispose("3d"); mount("2d"); }
  if (mode === "3d") { dispose("2d"); mount("3d"); }
  if (mode === "split") { mount("2d"); mount("3d"); }
  requestAnimationFrame(() => {
    research.charts.forEach((chart) => chart.resize());
    renderLifecycle();
  });
}

async function runLifecycleTest() {
  const button = document.querySelector("#run-cycles");
  button.disabled = true;
  button.textContent = "Testing…";
  const results = [];
  const host = document.querySelector("#benchmark-host");
  for (const kind of ["2d", "3d"]) {
    const durations = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const node = document.createElement("div");
      node.style.cssText = "width:900px;height:520px";
      host.append(node);
      const start = performance.now();
      const chart = echarts.init(node, null, { renderer: "canvas" });
      chart.setOption(optionFor(kind), { notMerge: true, lazyUpdate: false });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      chart.dispose();
      node.remove();
      durations.push(performance.now() - start);
    }
    results.push({ kind, cycles: 10, averageMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length * 10) / 10, remainingCanvases: host.querySelectorAll("canvas").length });
  }
  research.lifecycleRuns.push(results);
  document.querySelector("#lifecycle-summary").textContent = results.map((result) => `${result.kind.toUpperCase()} ${result.averageMs} ms avg`).join(" · ");
  document.querySelector("#lifecycle-detail").textContent = `10 mount/dispose cycles each · ${results.reduce((sum, result) => sum + result.remainingCanvases, 0)} benchmark canvases retained`;
  button.disabled = false;
  button.textContent = "Run lifecycle test";
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
document.querySelector("#run-cycles").addEventListener("click", runLifecycleTest);
window.addEventListener("resize", () => research.charts.forEach((chart) => chart.resize()));
document.querySelector("#data-summary").textContent = `${comma(dataset.observedReturnCount)} detailed returns · ${comma(dataset.national.ballotsPublished)} ballots · ${dataset.points.length} shared marks`;
document.querySelector("#fingerprint").textContent = fixture.fingerprint;
setMode("2d");
