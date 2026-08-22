import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  advanceReplayPlaybackCursor,
  compileNationalReplay,
  createReplayPlaybackCursor,
  createReplayReducerContext,
  createReplaySeekIndex,
  lockElectionEndpoint,
  playReplayPlaybackCursor,
  replayPlaybackCursorMetadata,
  seekReplayPlaybackCursorToEventCount,
  stepReplayPlaybackCursorToNextEventTime,
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

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (fraction) => sorted[Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  )];
  return {
    runs: values.length,
    p50Ms: Number(at(0.5).toFixed(3)),
    p95Ms: Number(at(0.95).toFixed(3)),
    p99Ms: Number(at(0.99).toFixed(3)),
    worstMs: Number(sorted.at(-1).toFixed(3)),
  };
}

function randomPositions(eventCount, count) {
  let state = 0x22d0ffee;
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

async function benchmarkFixture(label, fixtures) {
  const context = await buildContext(...fixtures);
  const seekIndex = createReplaySeekIndex(context, 250);
  const zero = createReplayPlaybackCursor(context, seekIndex);

  const creationTimes = [];
  for (let run = 0; run < 100; run += 1) {
    const started = performance.now();
    createReplayPlaybackCursor(context, seekIndex);
    creationTimes.push(performance.now() - started);
  }

  const randomSeekTimes = [];
  let seekChecksum = 0;
  for (const eventCount of randomPositions(context.events.length, 100)) {
    const started = performance.now();
    const cursor = seekReplayPlaybackCursorToEventCount(
      context,
      seekIndex,
      zero,
      eventCount,
    );
    randomSeekTimes.push(performance.now() - started);
    seekChecksum += cursor.reducerState.observable.national.totalVotes;
  }

  const advanceTimes = [];
  let cursor = playReplayPlaybackCursor(context, zero);
  const advanceCount = 1_000;
  const duration = cursor.endBoundaryAbsoluteTimeMs - cursor.startBoundaryAbsoluteTimeMs;
  const baseDelta = Math.floor(duration / advanceCount);
  let remainder = duration % advanceCount;
  const advanceStarted = performance.now();
  for (let run = 0; run < advanceCount; run += 1) {
    const deltaMs = baseDelta + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    const started = performance.now();
    cursor = advanceReplayPlaybackCursor(context, cursor, deltaMs);
    advanceTimes.push(performance.now() - started);
  }
  const completeAdvanceMs = performance.now() - advanceStarted;
  if (cursor.status !== "complete") throw new Error(`${label} partitioned playback did not complete`);

  const stepTimes = [];
  let stepped = zero;
  const stepStarted = performance.now();
  while (stepped.status !== "complete") {
    const started = performance.now();
    stepped = stepReplayPlaybackCursorToNextEventTime(context, stepped);
    stepTimes.push(performance.now() - started);
  }
  const completeStepMs = performance.now() - stepStarted;
  if (
    stepped.reducerState.observable.national.totalVotes
    !== cursor.reducerState.observable.national.totalVotes
  ) {
    throw new Error(`${label} controller workloads did not reconcile`);
  }

  return {
    fixture: label,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    eventCount: context.events.length,
    checkpointCadenceEvents: 250,
    cursorCreation: distribution(creationTimes),
    randomEventPositionSeek: {
      ...distribution(randomSeekTimes),
      checksum: seekChecksum,
    },
    partitionedFullPlayback: {
      partitions: advanceCount,
      totalMs: Number(completeAdvanceMs.toFixed(3)),
      perAdvance: distribution(advanceTimes),
      finalVotes: cursor.reducerState.observable.national.totalVotes,
    },
    stepEveryCanonicalTimestamp: {
      timestampGroups: stepTimes.length,
      totalMs: Number(completeStepMs.toFixed(3)),
      perStep: distribution(stepTimes),
      finalVotes: stepped.reducerState.observable.national.totalVotes,
    },
    cursorMetadataBytes: Buffer.byteLength(JSON.stringify(replayPlaybackCursorMetadata(cursor))),
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
  benchmarkVersion: "rme-playback-cursor-benchmark-v1",
  nodeVersion: process.version,
  fixtures: [certified, complex],
}, null, 2)}\n`);
