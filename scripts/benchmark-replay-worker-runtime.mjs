import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import { lockElectionEndpoint } from "../packages/election-replay/src/index.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "../src/data/miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import {
  REPLAY_WORKER_PROTOCOL_VERSION,
} from "../src/runtime/replayWorkerProtocol.ts";
import { ReplayWorkerRuntime } from "../src/runtime/replayWorkerRuntime.ts";
import { MICHIGAN_BASELINE_REPLAY_FIXTURE } from "../tests/replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "../tests/replay-fixtures/national-endpoints.mjs";
import { PENNSYLVANIA_BASELINE_REPLAY_FIXTURE } from "../tests/replay-fixtures/pennsylvania-endpoints.mjs";

const paFoundation = decodePennsylvaniaDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
)));
const miFoundation = decodeMichiganDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url),
  "utf8",
)));
const endpoint = await lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
  pennsylvaniaFoundation: paFoundation,
  pennsylvaniaScenario: applyBehaviorScenario(
    toBehaviorModelUnits(paFoundation),
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.settings,
  ),
  michiganFoundation: miFoundation,
  michiganScenario: applyBehaviorScenario(
    toMichiganBehaviorModelUnits(miFoundation),
    MICHIGAN_BASELINE_REPLAY_FIXTURE.settings,
  ),
  scenarioId: NATIONAL_BASELINE_REPLAY_FIXTURE.scenarioId,
  scenarioFingerprint: NATIONAL_BASELINE_REPLAY_FIXTURE.scenarioFingerprint,
  createdAt: NATIONAL_BASELINE_REPLAY_FIXTURE.createdAt,
}));

let requestId = 1;
function request(value) {
  return {
    protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
    requestId: requestId++,
    ...value,
  };
}
function bytes(value) {
  return Buffer.byteLength(JSON.stringify(value));
}
function percentile(values, fraction) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))];
}

const runtime = new ReplayWorkerRuntime();
const initializationStarted = performance.now();
const ready = await runtime.handle(request({
  type: "INITIALIZE",
  endpoint,
  definition: NATIONAL_REPLAY_DEFINITION,
  checkpointCadenceEvents: 250,
}));
const initializationMs = performance.now() - initializationStarted;
if (ready.type !== "READY") throw new Error(ready.message);

const stepDurations = [];
const stepSizes = [];
for (let index = 0; index < 25; index += 1) {
  const started = performance.now();
  const response = await runtime.handle(request({
    type: "COMMAND",
    command: { type: "STEP_NEXT_EVENT_TIME" },
  }));
  stepDurations.push(performance.now() - started);
  stepSizes.push(bytes(response));
}

const seekStarted = performance.now();
const seek = await runtime.handle(request({
  type: "COMMAND",
  command: { type: "SEEK_PROGRESS", progressMillionths: 500_000 },
}));
const seekMs = performance.now() - seekStarted;
if (seek.type !== "UPDATE") throw new Error(seek.message);

const resyncStarted = performance.now();
const resync = await runtime.handle(request({ type: "RESYNCHRONIZE" }));
const resyncMs = performance.now() - resyncStarted;
if (resync.type !== "RESYNCHRONIZED") throw new Error(resync.message);

console.log(JSON.stringify({
  initializationMs: Number(initializationMs.toFixed(2)),
  initialSnapshotBytes: bytes(ready),
  stepUpdateBytes: {
    minimum: Math.min(...stepSizes),
    median: percentile(stepSizes, 0.5),
    maximum: Math.max(...stepSizes),
  },
  stepCommandMs: {
    p50: Number(percentile(stepDurations, 0.5).toFixed(3)),
    p95: Number(percentile(stepDurations, 0.95).toFixed(3)),
    maximum: Number(Math.max(...stepDurations).toFixed(3)),
  },
  midpointSeekMs: Number(seekMs.toFixed(3)),
  midpointUpdateBytes: bytes(seek),
  midpointResynchronizationMs: Number(resyncMs.toFixed(3)),
  midpointResynchronizationBytes: bytes(resync),
}, null, 2));
