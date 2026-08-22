import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  compileNationalReplay,
  createReplayReducerContext,
  createReplaySeekIndex,
  lockElectionEndpoint,
  reduceReplayToEventCount,
  replaySeekIndexMetadata,
  seekReplayIndexToEventCount,
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
import {
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
} from "../tests/replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "../tests/replay-fixtures/national-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
} from "../tests/replay-fixtures/pennsylvania-endpoints.mjs";

const CADENCE_EVENTS = 250;

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction) => sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  )];
  return {
    runs: values.length,
    p50Ms: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    p99Ms: Number(percentile(0.99).toFixed(3)),
    worstMs: Number(sorted.at(-1).toFixed(3)),
  };
}

function measuredRuns(runs, action) {
  const values = [];
  let checksum = 0;
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    const state = action(run);
    values.push(performance.now() - started);
    checksum += state.observable.national.totalVotes;
  }
  return { ...distribution(values), checksum };
}

function randomPositions(eventCount, count) {
  let state = 0x22c0ffee;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % (eventCount + 1);
  });
}

const paFoundation = decodePennsylvaniaDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
)));
const miFoundation = decodeMichiganDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url),
  "utf8",
)));
const paUnits = toBehaviorModelUnits(paFoundation);
const miUnits = toMichiganBehaviorModelUnits(miFoundation);

async function buildContext(national, pa, mi) {
  const endpoint = await lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: applyBehaviorScenario(paUnits, pa.settings),
    michiganFoundation: miFoundation,
    michiganScenario: applyBehaviorScenario(miUnits, mi.settings),
    scenarioId: national.scenarioId,
    scenarioFingerprint: national.scenarioFingerprint,
    createdAt: national.createdAt,
  }));
  const replay = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  return createReplayReducerContext(endpoint, replay);
}

function heapUsedAfterGc() {
  globalThis.gc?.();
  return process.memoryUsage().heapUsed;
}

async function benchmarkFixture(label, fixtures) {
  const context = await buildContext(...fixtures);
  const eventCount = context.events.length;
  const midpoint = Math.floor(eventCount / 2);
  const namedPositions = {
    early: Math.min(100, eventCount),
    midpoint,
    nearFinal: Math.max(0, eventCount - 100),
  };

  reduceReplayToEventCount(context, eventCount);
  const coldFullReplay = measuredRuns(7, () => reduceReplayToEventCount(context, eventCount));

  const heapBefore = heapUsedAfterGc();
  const constructionStarted = performance.now();
  const index = createReplaySeekIndex(context, CADENCE_EVENTS);
  const constructionMs = performance.now() - constructionStarted;
  const heapAfter = heapUsedAfterGc();

  const baselineNamed = {};
  const checkpointNamed = {};
  for (const [positionLabel, position] of Object.entries(namedPositions)) {
    baselineNamed[positionLabel] = measuredRuns(
      7,
      () => reduceReplayToEventCount(context, position),
    );
    checkpointNamed[positionLabel] = measuredRuns(
      25,
      () => seekReplayIndexToEventCount(context, index, position),
    );
  }

  const positions = randomPositions(eventCount, 100);
  const randomBaseline = measuredRuns(
    positions.length,
    (run) => reduceReplayToEventCount(context, positions[run]),
  );
  const randomCheckpoint = measuredRuns(
    positions.length,
    (run) => seekReplayIndexToEventCount(context, index, positions[run]),
  );

  const ugly = [0, eventCount, 1, midpoint, 100, eventCount, 1_000, 0, eventCount - 1, 17];
  const repeatedMovement = measuredRuns(
    100,
    (run) => seekReplayIndexToEventCount(context, index, ugly[run % ugly.length]),
  );

  let logicalFullSnapshotBytes = 0;
  for (const checkpoint of index.checkpoints) {
    logicalFullSnapshotBytes += Buffer.byteLength(serializeReplayReducerState(checkpoint.state));
  }
  const finalStateBytes = Buffer.byteLength(serializeReplayReducerState(
    seekReplayIndexToEventCount(context, index, eventCount),
  ));
  const metadataBytes = Buffer.byteLength(JSON.stringify(replaySeekIndexMetadata(index)));

  return {
    fixture: label,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    eventCount,
    cadenceEvents: CADENCE_EVENTS,
    coldFullReplay,
    namedSeek: {
      positions: namedPositions,
      baseline: baselineNamed,
      checkpoint: checkpointNamed,
    },
    randomSeek: {
      positionCount: positions.length,
      baseline: randomBaseline,
      checkpoint: randomCheckpoint,
    },
    repeatedBackwardForwardCheckpointSeek: repeatedMovement,
    checkpointConstruction: {
      milliseconds: Number(constructionMs.toFixed(3)),
      checkpointCount: index.checkpoints.length,
      maxTailEvents: index.maxTailEvents,
    },
    runtimeMemory: {
      heapUsedBeforeBytes: heapBefore,
      heapUsedAfterBytes: heapAfter,
      measuredHeapIncreaseBytes: heapAfter - heapBefore,
      finalReducerStateSerializedBytes: finalStateBytes,
      checkpointMetadataBytes: metadataBytes,
      logicalFullSnapshotSerializationBytes: logicalFullSnapshotBytes,
      note: "Runtime checkpoints structurally share immutable reducer objects; logical serialization is comparison evidence, not a persistence format.",
    },
  };
}

const certified = await benchmarkFixture("certified", [
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
]);
const complex = await benchmarkFixture("complex", [
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
]);

process.stdout.write(`${JSON.stringify({
  benchmarkVersion: "rme-replay-seek-benchmark-v1",
  nodeVersion: process.version,
  garbageCollectorExposed: typeof globalThis.gc === "function",
  fixtures: [certified, complex],
}, null, 2)}\n`);
