import {
  applyBehaviorScenario,
  type BehaviorModelUnit,
} from "../../packages/election-model/src/scenario.ts";
import {
  getDetailedStateManifest,
  type DetailedStateCode,
} from "../data/detailedStateManifest.ts";
import {
  getDetailedStateRuntimeAdapter,
} from "../data/detailedStateRuntimeLoaders.ts";
import type {
  DetailedStateWorkerRequest,
  DetailedStateWorkerResponse,
} from "./detailedStateWorkerProtocol.ts";

interface WorkerScope {
  onmessage: ((event: MessageEvent<DetailedStateWorkerRequest>) => void) | null;
  postMessage(message: DetailedStateWorkerResponse): void;
}

const workerScope = globalThis as unknown as WorkerScope;
let activeStateCode: DetailedStateCode | null = null;
let behaviorModelUnits: BehaviorModelUnit[] | null = null;
let initialization: Promise<void> | null = null;
let pendingCalculation: Extract<
  DetailedStateWorkerRequest,
  { type: "calculate" }
> | null = null;
let calculationScheduled = false;

function postError(requestId: number, error: unknown) {
  workerScope.postMessage({
    type: "error",
    requestId,
    stateCode: activeStateCode,
    message: error instanceof Error ? error.message : "Detailed state calculation failed",
  });
}

async function initialize(request: Extract<DetailedStateWorkerRequest, { type: "initialize" }>) {
  const manifest = getDetailedStateManifest(request.stateCode);
  activeStateCode = manifest.code;
  const adapter = getDetailedStateRuntimeAdapter(manifest.runtime.loader);
  const response = await fetch(request.artifactUrl);
  if (!response.ok) {
    throw new Error(`Detailed state runtime request failed with ${response.status}`);
  }
  const foundation = adapter.decode(await response.json());
  if (foundation.stateCode !== manifest.code) {
    throw new Error("Detailed state runtime decoded the wrong state foundation");
  }
  if (
    foundation.schemaVersion !== manifest.runtime.schemaVersion
    || foundation.encoding !== manifest.runtime.encoding
  ) {
    throw new Error("Detailed state runtime does not match its manifest contract");
  }
  behaviorModelUnits = adapter.toBehaviorModelUnits(foundation);
  const scenario = applyBehaviorScenario(behaviorModelUnits, request.settings);
  workerScope.postMessage({
    type: "ready",
    requestId: request.requestId,
    stateCode: manifest.code,
    foundation,
    scenario,
  });
}

async function calculate(request: Extract<DetailedStateWorkerRequest, { type: "calculate" }>) {
  if (initialization) await initialization;
  if (!activeStateCode || !behaviorModelUnits) {
    throw new Error("Detailed state runtime has not initialized");
  }
  workerScope.postMessage({
    type: "scenario",
    requestId: request.requestId,
    stateCode: activeStateCode,
    scenario: applyBehaviorScenario(behaviorModelUnits, request.settings),
  });
}

async function drainLatestCalculation() {
  calculationScheduled = false;
  if (initialization) await initialization;
  const request = pendingCalculation;
  pendingCalculation = null;
  if (!request) return;
  try {
    await calculate(request);
  } catch (error: unknown) {
    postError(request.requestId, error);
  }
  if (pendingCalculation && !calculationScheduled) {
    calculationScheduled = true;
    setTimeout(() => { void drainLatestCalculation(); }, 0);
  }
}

function enqueueLatestCalculation(
  request: Extract<DetailedStateWorkerRequest, { type: "calculate" }>,
) {
  pendingCalculation = request;
  if (calculationScheduled) return;
  calculationScheduled = true;
  setTimeout(() => { void drainLatestCalculation(); }, 0);
}

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.type === "initialize") {
    initialization = initialize(request).catch((error: unknown) => {
      postError(request.requestId, error);
    });
    return;
  }
  enqueueLatestCalculation(request);
};
