import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  compileNationalReplay,
  createReplayReducerContext,
  createReplaySeekIndex,
  createReportedAnalyticsEnvelope,
  deriveFullReportedAnalytics,
  lockElectionEndpoint,
  reduceReplayToEventCount,
  replayReducerStateFingerprint,
  replaySeekIndexMetadata,
  seekReplayIndexToAbsoluteTime,
  seekReplayIndexToEventCount,
  serializeDerivedReportedAnalytics,
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
} from "./replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "./replay-fixtures/national-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
} from "./replay-fixtures/pennsylvania-endpoints.mjs";
import {
  CERTIFIED_ANALYTICS_GOLDENS,
  COMPLEX_ANALYTICS_GOLDENS,
} from "./replay-fixtures/reported-analytics-goldens.mjs";
import {
  CERTIFIED_REDUCER_GOLDENS,
  COMPLEX_REDUCER_GOLDENS,
} from "./replay-fixtures/reducer-goldens.mjs";

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

async function fixture(national, pa, mi) {
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
  return { context: await createReplayReducerContext(endpoint, replay) };
}

const certifiedPromise = fixture(
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
);
const complexPromise = fixture(
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
);

function canonicalPositions(eventCount) {
  return {
    zero: 0,
    event1: 1,
    event100: 100,
    event1000: 1_000,
    midpoint: Math.floor(eventCount / 2),
    final: eventCount,
  };
}

function deterministicRandomPositions(eventCount, count) {
  let state = 0x22c0ffee;
  const positions = [];
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    positions.push(state % (eventCount + 1));
  }
  return positions;
}

async function assertEquivalentAt(context, index, eventCount) {
  const direct = reduceReplayToEventCount(context, eventCount);
  const seeked = seekReplayIndexToEventCount(context, index, eventCount);
  assert.equal(serializeReplayReducerState(seeked), serializeReplayReducerState(direct));
  assert.equal(
    serializeDerivedReportedAnalytics(deriveFullReportedAnalytics(seeked.observable)),
    serializeDerivedReportedAnalytics(deriveFullReportedAnalytics(direct.observable)),
  );
  assert.equal(
    await replayReducerStateFingerprint(seeked),
    await replayReducerStateFingerprint(direct),
  );
}

test("seek indexes are immutable process-local reducer accelerators without analytics", async () => {
  const { context } = await certifiedPromise;
  const index = createReplaySeekIndex(context, 250);
  const metadata = replaySeekIndexMetadata(index);
  assert.equal(Object.isFrozen(index), true);
  assert.equal(Object.isFrozen(index.checkpoints), true);
  assert.equal(index.checkpoints.every((checkpoint) => Object.isFrozen(checkpoint)), true);
  assert.equal(metadata.checkpointCount, Math.ceil(context.events.length / 250) + 1);
  assert.equal(metadata.maxTailEvents, 249);
  assert.equal("analytics" in index, false);
  assert.equal(index.checkpoints.some((checkpoint) => "analytics" in checkpoint), false);
  assert.throws(() => createReplaySeekIndex(context, 0), /positive safe integer/);
  assert.throws(
    () => seekReplayIndexToEventCount(context, structuredClone(index), 100),
    /process-local accelerator/,
  );
});

test("certified and complex arbitrary seeks are byte-identical to full-prefix replay", async () => {
  for (const fixtureValue of await Promise.all([certifiedPromise, complexPromise])) {
    const { context } = fixtureValue;
    const index = createReplaySeekIndex(context, 250);
    const positions = [
      ...Object.values(canonicalPositions(context.events.length)),
      ...deterministicRandomPositions(context.events.length, 20),
    ];
    for (const eventCount of positions) await assertEquivalentAt(context, index, eventCount);
  }
});

test("ugly backward and forward seek history cannot influence reconstructed state", async () => {
  for (const { context } of await Promise.all([certifiedPromise, complexPromise])) {
    const index = createReplaySeekIndex(context, 333);
    const midpoint = Math.floor(context.events.length / 2);
    const ugly = [
      0, context.events.length, 1, midpoint, 100, context.events.length,
      1_000, 0, context.events.length - 1, 17, midpoint + 1, 100,
    ];
    const firstPass = ugly.map((position) => (
      serializeReplayReducerState(seekReplayIndexToEventCount(context, index, position))
    ));
    const secondPass = ugly.map((position) => (
      serializeReplayReducerState(seekReplayIndexToEventCount(context, index, position))
    ));
    assert.deepEqual(secondPass, firstPass);
  }
});

test("v0.22A reducer and v0.22B analytics fingerprints remain frozen through seek", async () => {
  const fixtures = await Promise.all([certifiedPromise, complexPromise]);
  for (const [fixtureValue, reducerGoldens, analyticsGoldens] of [
    [fixtures[0], CERTIFIED_REDUCER_GOLDENS, CERTIFIED_ANALYTICS_GOLDENS],
    [fixtures[1], COMPLEX_REDUCER_GOLDENS, COMPLEX_ANALYTICS_GOLDENS],
  ]) {
    const { context } = fixtureValue;
    const index = createReplaySeekIndex(context, 250);
    for (const [label, eventCount] of Object.entries(canonicalPositions(context.events.length))) {
      const state = seekReplayIndexToEventCount(context, index, eventCount);
      const stateFingerprint = await replayReducerStateFingerprint(state);
      assert.equal(stateFingerprint, reducerGoldens.positions[label]);
      const envelope = await createReportedAnalyticsEnvelope(state.observable, stateFingerprint);
      assert.equal(envelope.analyticsFingerprint, analyticsGoldens.positions[label]);
    }
  }
});

test("absolute-time seek honors canonical simultaneous-event boundaries", async () => {
  const { context } = await certifiedPromise;
  const index = createReplaySeekIndex(context, 250);
  const simultaneous = context.events.findIndex((event, eventIndex) => (
    eventIndex > 0 && event.absoluteReplayTimeMs === context.events[eventIndex - 1].absoluteReplayTimeMs
  ));
  assert.ok(simultaneous > 0);
  const absoluteReplayTimeMs = context.events[simultaneous].absoluteReplayTimeMs;
  const byTime = seekReplayIndexToAbsoluteTime(context, index, absoluteReplayTimeMs);
  const expectedCount = context.events.findLastIndex(
    (event) => event.absoluteReplayTimeMs <= absoluteReplayTimeMs,
  ) + 1;
  const byCount = seekReplayIndexToEventCount(context, index, expectedCount);
  assert.equal(serializeReplayReducerState(byTime), serializeReplayReducerState(byCount));
});

test("foreign streams, invalid targets, and source dependency drift fail closed", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const index = createReplaySeekIndex(certified.context, 250);
  assert.throws(
    () => seekReplayIndexToEventCount(complex.context, index, 100),
    /incompatible/,
  );
  assert.throws(() => seekReplayIndexToEventCount(certified.context, index, -1), /outside/);
  assert.throws(
    () => seekReplayIndexToEventCount(certified.context, index, certified.context.events.length + 1),
    /outside/,
  );
  const source = readFileSync(
    new URL("../packages/election-replay/src/replaySeekIndex.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /reportedAnalytics|deriveFullReportedAnalytics|DecisionDesk|STATE_CALL/);
  assert.doesNotMatch(source, /localStorage|indexedDB|from\s+["'](?:react|@deck\.gl)/);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
