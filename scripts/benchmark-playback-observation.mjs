import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  compileNationalReplay,
  createReplayPlaybackCursor,
  createReplayReducerContext,
  createReplaySeekIndex,
  createSanitizedPlaybackSnapshot,
  createSanitizedPlaybackTransition,
  lockElectionEndpoint,
  seekReplayPlaybackCursorToEventCount,
  serializeSanitizedPlaybackSnapshot,
  serializeSanitizedPlaybackTransition,
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

function measure(runs, action) {
  const values = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    action();
    values.push(performance.now() - started);
  }
  return distribution(values);
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
  const index = createReplaySeekIndex(context, 250);
  const zero = createReplayPlaybackCursor(context, index);
  const oneGroup = stepReplayPlaybackCursorToNextEventTime(context, zero);
  const midpoint = seekReplayPlaybackCursorToEventCount(
    context,
    index,
    zero,
    Math.floor(context.events.length / 2),
  );
  const final = seekReplayPlaybackCursorToEventCount(
    context,
    index,
    zero,
    context.events.length,
  );

  const zeroSnapshot = createSanitizedPlaybackSnapshot(context, zero);
  const midpointSnapshot = createSanitizedPlaybackSnapshot(context, midpoint);
  const finalSnapshot = createSanitizedPlaybackSnapshot(context, final);
  const oneGroupTransition = createSanitizedPlaybackTransition(context, zero, oneGroup);
  const midpointTransition = createSanitizedPlaybackTransition(context, zero, midpoint);
  const backwardTransition = createSanitizedPlaybackTransition(context, midpoint, zero);

  return {
    fixture: label,
    sourceStreamFingerprintForBenchmarkOnly: context.sourceStreamFingerprint,
    eventCount: context.events.length,
    snapshotDerivation: {
      zero: measure(100, () => createSanitizedPlaybackSnapshot(context, zero)),
      midpoint: measure(25, () => createSanitizedPlaybackSnapshot(context, midpoint)),
      final: measure(10, () => createSanitizedPlaybackSnapshot(context, final)),
    },
    snapshotSerializedBytes: {
      zero: Buffer.byteLength(serializeSanitizedPlaybackSnapshot(zeroSnapshot)),
      midpoint: Buffer.byteLength(serializeSanitizedPlaybackSnapshot(midpointSnapshot)),
      final: Buffer.byteLength(serializeSanitizedPlaybackSnapshot(finalSnapshot)),
    },
    transitionDerivation: {
      stationary: measure(1_000, () => createSanitizedPlaybackTransition(context, zero, zero)),
      oneTimestampGroup: measure(
        1_000,
        () => createSanitizedPlaybackTransition(context, zero, oneGroup),
      ),
      zeroToMidpoint: measure(
        20,
        () => createSanitizedPlaybackTransition(context, zero, midpoint),
      ),
      midpointToZero: measure(
        100,
        () => createSanitizedPlaybackTransition(context, midpoint, zero),
      ),
    },
    transitionSerializedBytes: {
      oneTimestampGroup: Buffer.byteLength(
        serializeSanitizedPlaybackTransition(oneGroupTransition),
      ),
      zeroToMidpoint: Buffer.byteLength(
        serializeSanitizedPlaybackTransition(midpointTransition),
      ),
      midpointToZero: Buffer.byteLength(
        serializeSanitizedPlaybackTransition(backwardTransition),
      ),
    },
    currentOnlyCounts: {
      midpointReportedCounties: midpointSnapshot.election.reportedCounties.length,
      midpointPublishedUnits: midpointSnapshot.election.publishedUnits.length,
      finalReportedCounties: finalSnapshot.election.reportedCounties.length,
      finalPublishedUnits: finalSnapshot.election.publishedUnits.length,
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
  benchmarkVersion: "rme-playback-observation-benchmark-v1",
  nodeVersion: process.version,
  note: "Stream fingerprints appear only in this benchmark envelope and never in sanitized observation output.",
  fixtures: [certified, complex],
}, null, 2)}\n`);
