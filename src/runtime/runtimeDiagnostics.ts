import type { DetailedStateCode } from "../data/detailedStateManifest.ts";

export interface RuntimeDiagnosticsSnapshot {
  activeDetailedWorker: DetailedStateCode | null;
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

declare global {
  interface Window {
    __sandboxDiagnostics?: () => RuntimeDiagnosticsSnapshot;
  }
}

const detailedWorkers = new Map<symbol, { stateCode: DetailedStateCode; artifactBytes: number }>();
const portfolioWorkers = new Map<symbol, number>();
const mapMounts = new Set<symbol>();
const webglContexts = new Set<symbol>();
const mapAnimations = new Map<symbol, Set<string>>();
const mapLayerIds = new Map<symbol, readonly string[]>();
let geometryCacheEntries = 0;
let geometryCacheBytes = 0;
let pendingGeometryFetches = 0;
let pendingScenarioRequests = 0;

function immutableSnapshot(): RuntimeDiagnosticsSnapshot {
  const activeDetailed = [...detailedWorkers.values()];
  return Object.freeze({
    activeDetailedWorker: activeDetailed.length === 1 ? activeDetailed[0].stateCode : null,
    detailedWorkerCount: activeDetailed.length,
    portfolioWorkerCount: portfolioWorkers.size,
    activeModelShardBytes: activeDetailed.reduce((sum, worker) => sum + worker.artifactBytes, 0),
    portfolioRequestedModelBytes: [...portfolioWorkers.values()].reduce((sum, bytes) => sum + bytes, 0),
    geometryCacheEntries,
    geometryCacheBytes,
    pendingGeometryFetches,
    pendingScenarioRequests,
    activeAnimationHandles: [...mapAnimations.values()].reduce((sum, handles) => sum + handles.size, 0),
    mapMountCount: mapMounts.size,
    webglContextCount: webglContexts.size,
    activeDeckLayerIds: Object.freeze([...new Set([...mapLayerIds.values()].flat())].sort()),
  });
}

export function installRuntimeDiagnosticsHook() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  Object.defineProperty(window, "__sandboxDiagnostics", {
    configurable: true,
    value: immutableSnapshot,
    writable: false,
  });
}

export function registerDetailedWorker(stateCode: DetailedStateCode, artifactBytes: number) {
  const token = Symbol(`detailed-worker-${stateCode}`);
  detailedWorkers.set(token, { stateCode, artifactBytes });
  return () => detailedWorkers.delete(token);
}

export function registerPortfolioWorker(requestedArtifactBytes: number) {
  const token = Symbol("portfolio-worker");
  portfolioWorkers.set(token, requestedArtifactBytes);
  return () => portfolioWorkers.delete(token);
}

export function startScenarioRequest() {
  pendingScenarioRequests += 1;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pendingScenarioRequests = Math.max(0, pendingScenarioRequests - 1);
  };
}

export function startGeometryFetch() {
  pendingGeometryFetches += 1;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pendingGeometryFetches = Math.max(0, pendingGeometryFetches - 1);
  };
}

export function publishGeometryCache(entries: number, bytes: number) {
  geometryCacheEntries = entries;
  geometryCacheBytes = bytes;
}

export function registerMapMount(token = Symbol("atlas-map")) {
  mapMounts.add(token);
  mapAnimations.set(token, new Set());
  return {
    token,
    release() {
      mapMounts.delete(token);
      webglContexts.delete(token);
      mapAnimations.delete(token);
      mapLayerIds.delete(token);
    },
  };
}

export function setMapWebglContext(token: symbol, active: boolean) {
  if (active) webglContexts.add(token);
  else webglContexts.delete(token);
}

export function setMapAnimation(token: symbol, name: string, active: boolean) {
  const handles = mapAnimations.get(token);
  if (!handles) return;
  if (active) handles.add(name);
  else handles.delete(name);
}

export function publishMapLayerIds(token: symbol, ids: readonly string[]) {
  if (!mapMounts.has(token)) return;
  mapLayerIds.set(token, Object.freeze([...ids]));
}
