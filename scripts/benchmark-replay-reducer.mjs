import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  compileNationalReplay,
  createReplayCheckpoints,
  createReplayReducerContext,
  lockElectionEndpoint,
  reduceReplayToEventCount,
  seekReplayToEventCount,
  serializeReplayCheckpoint,
  serializeReplayReducerState,
} from "../packages/election-replay/src/index.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "../src/data/miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import { MICHIGAN_BASELINE_REPLAY_FIXTURE } from "../tests/replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "../tests/replay-fixtures/national-endpoints.mjs";
import { PENNSYLVANIA_BASELINE_REPLAY_FIXTURE } from "../tests/replay-fixtures/pennsylvania-endpoints.mjs";

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (value) => sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * value) - 1),
  )];
  return {
    medianMs: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    worstMs: Number(sorted.at(-1).toFixed(3)),
  };
}

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
const replay = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
const context = await createReplayReducerContext(endpoint, replay);

reduceReplayToEventCount(context, context.events.length);
const fullRuns = [];
for (let run = 0; run < 7; run += 1) {
  const started = performance.now();
  reduceReplayToEventCount(context, context.events.length);
  fullRuns.push(performance.now() - started);
}

const checkpointStarted = performance.now();
const checkpoints = await createReplayCheckpoints(context, 500);
const checkpointBuildMs = performance.now() - checkpointStarted;
const finalState = reduceReplayToEventCount(context, context.events.length);
const fullStateBytes = Buffer.byteLength(serializeReplayReducerState(finalState));
const checkpointBytes = checkpoints.reduce(
  (sum, checkpoint) => sum + Buffer.byteLength(serializeReplayCheckpoint(checkpoint)),
  0,
);

const positions = Array.from({ length: 100 }, (_, index) => (
  ((index + 1) * 7_919) % (context.events.length + 1)
));
const seekRuns = [];
for (const position of positions) {
  const started = performance.now();
  await seekReplayToEventCount(context, position, checkpoints);
  seekRuns.push(performance.now() - started);
}

process.stdout.write(`${JSON.stringify({
  benchmarkVersion: "rme-reducer-benchmark-v1",
  sourceStreamFingerprint: context.sourceStreamFingerprint,
  eventCount: context.events.length,
  fullReduction: {
    runs: fullRuns.length,
    ...distribution(fullRuns),
  },
  checkpointSeek: {
    cadenceEvents: 500,
    checkpointCount: checkpoints.length,
    checkpointBuildMs: Number(checkpointBuildMs.toFixed(3)),
    runs: seekRuns.length,
    ...distribution(seekRuns),
  },
  serializedMemory: {
    fullReducerStateBytes: fullStateBytes,
    allCheckpointsBytes: checkpointBytes,
  },
}, null, 2)}\n`);
