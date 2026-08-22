import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  canonicalSerialize,
  compileNationalReplay,
  createReplayCheckpoint,
  createReplayCheckpoints,
  createReplayReducerContext,
  createReplayZeroState,
  deserializeReplayCheckpoint,
  deserializeReplayReducerState,
  eventCountAtOrBeforeAbsoluteTime,
  lockElectionEndpoint,
  reduceCanonicalEventSet,
  reduceReplayEvent,
  reduceReplayToEventCount,
  replayReducerStateFingerprint,
  reportedCountyState,
  reportedUnitState,
  seekReplayToAbsoluteTime,
  seekReplayToEventCount,
  serializeReplayCheckpoint,
  serializeReplayReducerState,
  validateReplayCheckpoint,
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

function endpointInput(nationalFixture, paFixture, miFixture) {
  return buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: applyBehaviorScenario(paUnits, paFixture.settings),
    michiganFoundation: miFoundation,
    michiganScenario: applyBehaviorScenario(miUnits, miFixture.settings),
    scenarioId: nationalFixture.scenarioId,
    scenarioFingerprint: nationalFixture.scenarioFingerprint,
    createdAt: nationalFixture.createdAt,
  });
}

async function fixture(nationalFixture, paFixture, miFixture) {
  const endpoint = await lockElectionEndpoint(endpointInput(nationalFixture, paFixture, miFixture));
  const replay = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  const context = await createReplayReducerContext(endpoint, replay);
  return { endpoint, replay, context };
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

function vectorTotal(vector) {
  return vector.reduce((sum, candidate) => sum + candidate.votes, 0);
}

function candidateVectorEqual(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  assert.equal(vectorTotal(actual), vectorTotal(expected), `${label} total`);
}

function sparseUnitCount(state) {
  return state.observable.reportedByUnit.buckets.reduce(
    (sum, bucket) => sum + Object.keys(bucket).length,
    0,
  );
}

function cloneEvent(event, changes) {
  return { ...structuredClone(event), ...changes };
}

function findReturn(context, predicate) {
  return context.events.find((event) => event.eventType === "RETURN_PUBLISHED" && predicate(event));
}

test("canonical zero state is deterministic, complete in identity, and zero everywhere", async () => {
  const { context } = await certifiedPromise;
  const first = createReplayZeroState(context);
  const second = createReplayZeroState(context);
  assert.equal(serializeReplayReducerState(first), serializeReplayReducerState(second));
  assert.equal(first.observable.position.eventsApplied, 0);
  assert.equal(first.observable.position.lastAppliedSequence, null);
  assert.equal(first.observable.position.absoluteReplayTimeMs, null);
  assert.equal(first.observable.national.totalVotes, 0);
  assert.equal(first.observable.national.returnsPublished, 0);
  assert.equal(first.observable.jurisdictionsCompleted, 0);
  assert.equal(first.observable.complete, false);
  assert.equal(Object.keys(first.observable.reportedByJurisdiction).length, 51);
  assert.equal(Object.keys(first.observable.reportedByCounty).length, 150);
  assert.equal(sparseUnitCount(first), 0);
  for (const jurisdiction of Object.values(first.observable.reportedByJurisdiction)) {
    assert.equal(jurisdiction.pollClosed, false);
    assert.equal(jurisdiction.completed, false);
    assert.equal(vectorTotal(jurisdiction.candidateVotes), 0);
  }
  for (const county of Object.values(first.observable.reportedByCounty)) {
    assert.equal(vectorTotal(county.candidateVotes), 0);
    assert.equal(county.returnsPublished, 0);
  }
  for (const unit of Object.values(context.units)) {
    assert.equal(vectorTotal(reportedUnitState(
      context,
      first,
      unit.jurisdictionId,
      unit.unitId,
    ).candidateVotes), 0);
  }
  assert.equal(await replayReducerStateFingerprint(first), await replayReducerStateFingerprint(second));
});

test("one pure transition is byte-identical and mutates neither state nor event", async () => {
  const { context } = await certifiedPromise;
  const zero = createReplayZeroState(context);
  const stateBefore = serializeReplayReducerState(zero);
  const event = structuredClone(context.events[0]);
  const eventBefore = canonicalSerialize(event);
  const first = reduceReplayEvent(context, zero, event);
  const second = reduceReplayEvent(context, zero, structuredClone(event));
  assert.equal(serializeReplayReducerState(first), serializeReplayReducerState(second));
  assert.equal(serializeReplayReducerState(zero), stateBefore);
  assert.equal(canonicalSerialize(event), eventBefore);
  assert.equal(first.observable.national.totalVotes, 0);
  assert.equal(first.observable.position.eventsApplied, 1);
});

test("strict sequence, duplication, unknown types, and lifecycle violations fail closed", async () => {
  const { context } = await certifiedPromise;
  const zero = createReplayZeroState(context);
  assert.throws(() => reduceReplayEvent(context, zero, context.events[1]), /sequence 0/);
  const one = reduceReplayEvent(context, zero, context.events[0]);
  assert.throws(() => reduceReplayEvent(context, one, context.events[0]), /sequence 1/);
  assert.throws(() => reduceReplayEvent(
    context,
    zero,
    cloneEvent(context.events[0], { eventType: "STATE_CALL" }),
  ), /canonical stream|authorize/);

  const laterPollCloseIndex = context.events.findIndex((event, index) => (
    index > 0 && event.eventType === "POLL_CLOSE"
  ));
  const beforeLaterClose = reduceReplayToEventCount(context, laterPollCloseIndex);
  const laterClose = context.events[laterPollCloseIndex];
  const duplicateClose = structuredClone(beforeLaterClose);
  duplicateClose.observable.reportedByJurisdiction[laterClose.jurisdictionId].pollClosed = true;
  assert.throws(() => reduceReplayEvent(context, duplicateClose, laterClose), /duplicated/);

  const firstReturnIndex = context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  const beforeReturn = reduceReplayToEventCount(context, firstReturnIndex);
  const firstReturn = context.events[firstReturnIndex];
  const jurisdiction = beforeReturn.observable.reportedByJurisdiction[firstReturn.jurisdictionId];
  const invalid = structuredClone(beforeReturn);
  invalid.observable.reportedByJurisdiction[firstReturn.jurisdictionId] = {
    ...jurisdiction,
    pollClosed: false,
  };
  assert.throws(() => reduceReplayEvent(context, invalid, firstReturn), /lifecycle/);
});

test("coarse, Pennsylvania, Michigan, and off-map returns update only authorized hierarchy", async () => {
  const { context } = await certifiedPromise;
  const coarse = findReturn(context, (event) => event.jurisdictionId === "FL");
  const pa = findReturn(context, (event) => event.jurisdictionId === "PA" && event.countyId != null);
  const mi = findReturn(context, (event) => event.jurisdictionId === "MI" && event.geometryStatus === "mapped");
  const offMap = findReturn(context, (event) => event.jurisdictionId === "MI" && event.geometryStatus === "off-map");
  for (const event of [coarse, pa, mi, offMap]) assert.ok(event);

  const coarseBefore = reduceReplayToEventCount(context, coarse.sequence);
  const coarseAfter = reduceReplayEvent(context, coarseBefore, coarse);
  candidateVectorEqual(
    coarseAfter.observable.reportedByJurisdiction.FL.candidateVotes,
    coarse.candidateDelta,
    "Coarse state",
  );
  assert.equal(sparseUnitCount(coarseAfter), sparseUnitCount(coarseBefore));
  assert.deepEqual(coarseAfter.observable.reportedByCounty, coarseBefore.observable.reportedByCounty);

  for (const event of [pa, mi, offMap]) {
    const before = reduceReplayToEventCount(context, event.sequence);
    const after = reduceReplayEvent(context, before, event);
    const unit = reportedUnitState(context, after, event.jurisdictionId, event.unitId);
    candidateVectorEqual(unit.candidateVotes, event.candidateDelta, "Detailed unit");
    if (event.countyId != null) {
      const countyBefore = reportedCountyState(context, before, event.jurisdictionId, event.countyId);
      const countyAfter = reportedCountyState(context, after, event.jurisdictionId, event.countyId);
      assert.equal(countyAfter.totalVotes - countyBefore.totalVotes, event.totalDelta);
    }
    for (const jurisdictionId of context.jurisdictionIds) {
      if (jurisdictionId === event.jurisdictionId) continue;
      assert.equal(
        after.observable.reportedByJurisdiction[jurisdictionId],
        before.observable.reportedByJurisdiction[jurisdictionId],
      );
    }
  }
  const offMapBefore = reduceReplayToEventCount(context, offMap.sequence);
  const offMapAfter = reduceReplayEvent(context, offMapBefore, offMap);
  assert.equal(
    offMapAfter.observable.reportedByJurisdiction.MI.offMapTotalVotes
      - offMapBefore.observable.reportedByJurisdiction.MI.offMapTotalVotes,
    offMap.totalDelta,
  );
  assert.equal(
    offMapAfter.observable.reportedByJurisdiction.MI.mappedTotalVotes,
    offMapBefore.observable.reportedByJurisdiction.MI.mappedTotalVotes,
  );
});

async function assertFinalState(fixtureValue) {
  const { endpoint, context } = fixtureValue;
  const state = reduceReplayToEventCount(context, context.events.length);
  assert.equal(state.observable.complete, true);
  assert.equal(state.observable.jurisdictionsCompleted, 51);
  assert.equal(state.observable.position.eventsApplied, 13_704);
  assert.equal(state.observable.national.returnsPublished, 13_602);
  assert.equal(sparseUnitCount(state), 13_553);
  candidateVectorEqual(state.observable.national.candidateVotes, endpoint.content.nationalTotals, "National final");
  assert.equal(state.observable.national.totalVotes, endpoint.content.reconciliation.nationalVotes);
  for (const jurisdiction of endpoint.content.jurisdictions) {
    const reported = state.observable.reportedByJurisdiction[jurisdiction.jurisdictionId];
    assert.equal(reported.completed, true);
    candidateVectorEqual(reported.candidateVotes, jurisdiction.candidateVotes, jurisdiction.jurisdictionId);
    for (const county of jurisdiction.counties) {
      candidateVectorEqual(
        reportedCountyState(context, state, jurisdiction.jurisdictionId, county.countyId).candidateVotes,
        county.candidateVotes,
        `${jurisdiction.jurisdictionId}/${county.countyId}`,
      );
    }
    if (!["PA", "MI"].includes(jurisdiction.jurisdictionId)) continue;
    for (const unit of jurisdiction.reportingUnits) {
      candidateVectorEqual(
        reportedUnitState(context, state, jurisdiction.jurisdictionId, unit.unitId).candidateVotes,
        unit.candidateVotes,
        `${jurisdiction.jurisdictionId}/${unit.unitId}`,
      );
    }
  }
  return state;
}

test("certified and complex streams reduce every exact hierarchy to completion", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  await assertFinalState(certified);
  await assertFinalState(complex);
});

test("every prefix contains only applied votes and never over-reports its endpoint", async () => {
  const { endpoint, context } = await certifiedPromise;
  let state = createReplayZeroState(context);
  for (const event of context.events) {
    const nationalBefore = state.observable.national.totalVotes;
    state = reduceReplayEvent(context, state, event);
    const expectedDelta = event.eventType === "RETURN_PUBLISHED" ? event.totalDelta : 0;
    assert.equal(state.observable.national.totalVotes - nationalBefore, expectedDelta);
    assert.ok(state.observable.national.totalVotes <= endpoint.content.reconciliation.nationalVotes);
    for (const candidate of state.observable.national.candidateVotes) {
      assert.ok(candidate.votes <= endpoint.content.nationalTotals.find(
        (locked) => locked.candidateId === candidate.candidateId,
      ).votes);
    }
    for (const candidate of state.observable.national.candidateVotes) {
      const jurisdictionSum = Object.values(state.observable.reportedByJurisdiction).reduce(
        (sum, jurisdiction) => sum + jurisdiction.candidateVotes.find(
          (entry) => entry.candidateId === candidate.candidateId,
        ).votes,
        0,
      );
      assert.equal(candidate.votes, jurisdictionSum);
    }
    assert.equal(
      state.observable.national.totalVotes,
      Object.values(state.observable.reportedByJurisdiction).reduce(
        (sum, jurisdiction) => sum + jurisdiction.totalVotes,
        0,
      ),
    );
  }
});

test("identical applied prefixes with different futures have byte-identical observable state", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const firstReturn = certified.context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  assert.ok(firstReturn > 0);
  assert.equal(
    canonicalSerialize(certified.context.events.slice(0, firstReturn)),
    canonicalSerialize(complex.context.events.slice(0, firstReturn)),
  );
  const certifiedPrefix = reduceReplayToEventCount(certified.context, firstReturn);
  const complexPrefix = reduceReplayToEventCount(complex.context, firstReturn);
  assert.equal(
    canonicalSerialize(certifiedPrefix.observable),
    canonicalSerialize(complexPrefix.observable),
  );
  assert.notEqual(certifiedPrefix.sourceStreamFingerprint, complexPrefix.sourceStreamFingerprint);
  assert.equal("lockedEndpoint" in certifiedPrefix.observable, false);
  assert.equal("remainingVotes" in certifiedPrefix.observable, false);
  assert.equal("percentReported" in certifiedPrefix.observable, false);
  assert.equal("leader" in certifiedPrefix.observable, false);
});

test("completion is an exact assertion and cannot be applied prematurely", async () => {
  const { context } = await certifiedPromise;
  const completionIndex = context.events.findIndex((event) => event.eventType === "REPLAY_COMPLETED");
  const before = reduceReplayToEventCount(context, completionIndex);
  const event = context.events[completionIndex];
  const invalid = structuredClone(before);
  invalid.observable.reportedByJurisdiction[event.jurisdictionId].candidateVotes[0].votes -= 1;
  invalid.observable.reportedByJurisdiction[event.jurisdictionId].totalVotes -= 1;
  assert.throws(() => reduceReplayEvent(context, invalid, event), /cannot complete/);
  const valid = reduceReplayEvent(context, before, event);
  assert.equal(valid.observable.reportedByJurisdiction[event.jurisdictionId].completed, true);
  assert.equal(valid.observable.complete, false);

  const beforeFinal = reduceReplayToEventCount(context, context.events.length - 1);
  const missingCompletion = structuredClone(beforeFinal);
  missingCompletion.observable.jurisdictionsCompleted -= 1;
  assert.throws(() => reduceReplayEvent(
    context,
    missingCompletion,
    context.events.at(-1),
  ), /without exact completion/);
});

test("state serialization, deterministic fingerprints, and frozen positions reproduce", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  for (const [fixtureValue, goldens] of [
    [certified, CERTIFIED_REDUCER_GOLDENS],
    [complex, COMPLEX_REDUCER_GOLDENS],
  ]) {
    assert.equal(fixtureValue.context.sourceStreamFingerprint, goldens.sourceStreamFingerprint);
    for (const [label, eventCount] of Object.entries({
      zero: 0,
      event1: 1,
      event100: 100,
      event1000: 1_000,
      midpoint: Math.floor(fixtureValue.context.events.length / 2),
      final: fixtureValue.context.events.length,
    })) {
      const state = reduceReplayToEventCount(fixtureValue.context, eventCount);
      const serialized = serializeReplayReducerState(state);
      const roundTrip = deserializeReplayReducerState(fixtureValue.context, serialized);
      assert.equal(serializeReplayReducerState(roundTrip), serialized);
      const fingerprint = await replayReducerStateFingerprint(state);
      if (Object.keys(goldens.positions).length > 0) assert.equal(fingerprint, goldens.positions[label]);
      assert.equal(fingerprint, await replayReducerStateFingerprint(roundTrip));
    }
  }
});

test("checkpoints validate, reject tampering and foreign streams, and round-trip", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const state = reduceReplayToEventCount(certified.context, 1_000);
  const checkpoint = await createReplayCheckpoint(certified.context, state);
  await validateReplayCheckpoint(certified.context, checkpoint);
  const serialized = serializeReplayCheckpoint(checkpoint);
  const roundTrip = await deserializeReplayCheckpoint(certified.context, serialized);
  assert.equal(serializeReplayCheckpoint(roundTrip), serialized);
  const tampered = structuredClone(checkpoint);
  tampered.state.observable.national.candidateVotes[0].votes += 1;
  assert.rejects(validateReplayCheckpoint(certified.context, tampered), /fingerprint/);
  assert.rejects(validateReplayCheckpoint(complex.context, checkpoint), /different replay stream/);
});

test("checkpoint reseek, backward reconstruction, and repeated movement are byte-equivalent", async () => {
  const { context } = await certifiedPromise;
  const checkpoints = await createReplayCheckpoints(context, 1_000);
  for (const eventCount of [0, 1, 999, 1_000, 4_321, 9_876, 13_704]) {
    const direct = reduceReplayToEventCount(context, eventCount);
    const seeked = await seekReplayToEventCount(context, eventCount, [...checkpoints].reverse());
    assert.equal(serializeReplayReducerState(seeked), serializeReplayReducerState(direct));
  }
  const forward = await seekReplayToEventCount(context, 11_000, checkpoints);
  const backward = await seekReplayToEventCount(context, 2_000, checkpoints);
  const forwardAgain = await seekReplayToEventCount(context, 11_000, checkpoints);
  assert.equal(serializeReplayReducerState(forward), serializeReplayReducerState(forwardAgain));
  assert.equal(
    serializeReplayReducerState(backward),
    serializeReplayReducerState(reduceReplayToEventCount(context, 2_000)),
  );
});

test("time seek includes the last canonical simultaneous event and remains deterministic", async () => {
  const { context } = await certifiedPromise;
  const checkpoints = await createReplayCheckpoints(context, 2_000);
  const simultaneousIndex = context.events.findIndex((event, index) => (
    index > 0 && event.absoluteReplayTimeMs === context.events[index - 1].absoluteReplayTimeMs
  ));
  assert.ok(simultaneousIndex > 0);
  const time = context.events[simultaneousIndex].absoluteReplayTimeMs;
  const count = eventCountAtOrBeforeAbsoluteTime(context, time);
  assert.ok(count > simultaneousIndex);
  assert.equal(context.events[count - 1].absoluteReplayTimeMs, time);
  assert.ok(count === context.events.length || context.events[count].absoluteReplayTimeMs > time);
  const byTime = await seekReplayToAbsoluteTime(context, time, checkpoints);
  const byCount = await seekReplayToEventCount(context, count, checkpoints);
  assert.equal(serializeReplayReducerState(byTime), serializeReplayReducerState(byCount));
  assert.equal(eventCountAtOrBeforeAbsoluteTime(context, context.events[0].absoluteReplayTimeMs - 1), 0);
});

test("canonical reconstruction ignores external event-array order but rejects gaps and duplicates", async () => {
  const { context } = await certifiedPromise;
  const prefix = context.events.slice(0, 1_200);
  const shuffled = [...prefix].sort((left, right) => (
    (right.sequence % 17) - (left.sequence % 17) || right.sequence - left.sequence
  ));
  assert.equal(
    serializeReplayReducerState(reduceCanonicalEventSet(context, shuffled)),
    serializeReplayReducerState(reduceReplayToEventCount(context, prefix.length)),
  );
  assert.throws(() => reduceCanonicalEventSet(context, prefix.slice(1)), /sequence 0/);
  assert.throws(() => reduceCanonicalEventSet(context, [...prefix, prefix[0]]), /duplicate/);
});

test("invalid accumulated arithmetic and unsupported dependencies fail closed", async () => {
  const { context } = await certifiedPromise;
  const firstReturnIndex = context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  const firstReturn = context.events[firstReturnIndex];
  const before = reduceReplayToEventCount(context, firstReturnIndex);
  const overflow = structuredClone(before);
  overflow.observable.national.candidateVotes[0].votes = Number.MAX_SAFE_INTEGER;
  overflow.observable.national.totalVotes = Number.MAX_SAFE_INTEGER;
  assert.throws(() => reduceReplayEvent(context, overflow, firstReturn), /overflow/);
  const fractional = structuredClone(before);
  fractional.observable.national.candidateVotes[0].votes = 0.5;
  assert.throws(() => reduceReplayEvent(context, fractional, firstReturn), /safe integer/);

  const packageDirectory = new URL("../packages/election-replay/src/", import.meta.url);
  const source = readdirSync(packageDirectory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(new URL(file, packageDirectory), "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /Math\.random\s*\(/);
  assert.doesNotMatch(source, /from\s+["'](?:react|@deck\.gl)/);
  assert.doesNotMatch(source, /DecisionDesk|STATE_CALL|projection|percentReported|remainingVotes/);
});
