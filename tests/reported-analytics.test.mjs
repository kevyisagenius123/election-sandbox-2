import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  canonicalSerialize,
  compileNationalReplay,
  createReplayReducerContext,
  createReportedAnalyticsEnvelope,
  deriveCountyReportedAnalytics,
  deriveFullReportedAnalytics,
  deriveJurisdictionReportedAnalytics,
  deriveNationalReportedAnalytics,
  deriveReportedVoteAnalytics,
  deriveUnitReportedAnalytics,
  deserializeDerivedReportedAnalytics,
  deserializeReportedAnalyticsEnvelope,
  lockElectionEndpoint,
  reduceReplayToEventCount,
  replayReducerStateFingerprint,
  serializeDerivedReportedAnalytics,
  serializeReportedAnalyticsEnvelope,
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

const CANDIDATES = ["harris", "trump", "stein", "oliver", "other"];

function aggregate(votes, returnsPublished = votes.reduce((sum, value) => sum + value, 0) > 0 ? 1 : 0) {
  return {
    candidateVotes: CANDIDATES.map((candidateId, index) => ({ candidateId, votes: votes[index] })),
    totalVotes: votes.reduce((sum, value) => sum + value, 0),
    returnsPublished,
  };
}

test("zero, one-vote, exact-tie, ranking, and third-party semantics are explicit", () => {
  const zero = deriveReportedVoteAnalytics(aggregate([0, 0, 0, 0, 0]));
  assert.deepEqual(zero.reportedVoteLeader, { type: "none" });
  assert.deepEqual(zero.reportedLeaderMargin, { type: "none" });
  assert.equal(zero.allCandidateReportedShares, null);
  assert.equal(zero.harrisTrumpReportedShares, null);

  const one = deriveReportedVoteAnalytics(aggregate([1, 0, 0, 0, 0]));
  assert.deepEqual(one.reportedVoteLeader, { type: "candidate", candidateId: "harris", votes: 1 });
  assert.deepEqual(one.reportedLeaderMargin, { type: "candidate", candidateId: "harris", votes: 1 });
  assert.equal(one.allCandidateReportedShares[0].allCandidateReportedShare.partsPerMillion, 1_000_000);

  const tie = deriveReportedVoteAnalytics(aggregate([100, 100, 0, 0, 0]));
  assert.equal(tie.reportedVoteLeader.type, "tie");
  assert.deepEqual(tie.reportedVoteLeader.candidateIds, ["harris", "trump"]);
  assert.deepEqual(tie.reportedLeaderMargin, { type: "tie", votes: 0 });
  assert.equal(tie.candidateRanking[0].rank, 1);
  assert.equal(tie.candidateRanking[1].rank, 1);

  const thirdParty = deriveReportedVoteAnalytics(aggregate([100, 90, 200, 5, 4]));
  assert.equal(thirdParty.reportedVoteLeader.candidateId, "stein");
  assert.equal(thirdParty.harrisTrumpReportedMargin.signedHarrisMinusTrumpVotes, 10);
  assert.equal(thirdParty.harrisTrumpReportedMargin.leader, "harris");
  assert.equal(thirdParty.harrisTrumpReportedShares.harris.denominatorVotes, 190);
  assert.equal(thirdParty.candidateRanking.map((candidate) => candidate.candidateId).join(","), "stein,harris,trump,oliver,other");
});

test("reported shares carry explicit reconciled denominators and safe integer law", () => {
  const analytics = deriveReportedVoteAnalytics(aggregate([51, 47, 1, 1, 0]));
  assert.equal(
    analytics.allCandidateReportedShares.reduce(
      (sum, candidate) => sum + candidate.allCandidateReportedShare.numeratorVotes,
      0,
    ),
    analytics.totalReportedVotes,
  );
  for (const candidate of analytics.allCandidateReportedShares) {
    assert.equal(candidate.allCandidateReportedShare.denominatorVotes, analytics.totalReportedVotes);
  }
  assert.equal(analytics.harrisTrumpReportedShares.harris.denominatorVotes, 98);
  assert.equal(analytics.harrisTrumpReportedShares.trump.denominatorVotes, 98);
  assert.throws(() => deriveReportedVoteAnalytics(aggregate([0.5, 0, 0, 0, 0])), /safe integer/);
  assert.throws(() => deriveReportedVoteAnalytics({
    ...aggregate([1, 0, 0, 0, 0]),
    totalVotes: Number.MAX_SAFE_INTEGER,
  }), /reconcile/);
});

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

test("same observable prefix with different futures derives byte-identical analytics", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const firstReturn = certified.context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  const certifiedState = reduceReplayToEventCount(certified.context, firstReturn);
  const complexState = reduceReplayToEventCount(complex.context, firstReturn);
  assert.equal(canonicalSerialize(certifiedState.observable), canonicalSerialize(complexState.observable));
  const before = canonicalSerialize(certifiedState.observable);
  const first = deriveFullReportedAnalytics(certifiedState.observable);
  const second = deriveFullReportedAnalytics(complexState.observable);
  assert.equal(serializeDerivedReportedAnalytics(first), serializeDerivedReportedAnalytics(second));
  assert.equal(canonicalSerialize(certifiedState.observable), before);
});

test("national, detailed jurisdiction, county, unit, and coarse capability analytics stay honest", async () => {
  const { context } = await certifiedPromise;
  const eventCount = Math.floor(context.events.length / 2);
  const state = reduceReplayToEventCount(context, eventCount);
  const national = deriveNationalReportedAnalytics(state.observable);
  assert.deepEqual(national.candidateVotes, state.observable.national.candidateVotes);
  assert.equal(national.totalReportedVotes, state.observable.national.totalVotes);

  for (const jurisdictionId of ["PA", "MI"]) {
    const analytics = deriveJurisdictionReportedAnalytics(state.observable, jurisdictionId);
    assert.equal(analytics.geographyAvailability, "detailed");
    assert.ok(analytics.representation);
    assert.equal(
      analytics.representation.mapped.totalReportedVotes,
      state.observable.reportedByJurisdiction[jurisdictionId].mappedTotalVotes,
    );
    assert.equal(
      analytics.representation.offMap.totalReportedVotes,
      state.observable.reportedByJurisdiction[jurisdictionId].offMapTotalVotes,
    );
  }
  const county = Object.values(state.observable.reportedByCounty).find((entry) => entry.returnsPublished > 0);
  assert.ok(county);
  const countyAnalytics = deriveCountyReportedAnalytics(state.observable, county.jurisdictionId, county.countyId);
  assert.deepEqual(countyAnalytics.candidateVotes, county.candidateVotes);
  const unit = state.observable.reportedByUnit.buckets.flatMap(Object.values)[0];
  assert.ok(unit);
  assert.deepEqual(
    deriveUnitReportedAnalytics(state.observable, unit.jurisdictionId, unit.unitId).candidateVotes,
    unit.candidateVotes,
  );

  const coarse = deriveJurisdictionReportedAnalytics(state.observable, "WI");
  assert.equal(coarse.geographyAvailability, "jurisdiction-only");
  assert.equal(coarse.representation, null);
  assert.throws(() => deriveCountyReportedAnalytics(state.observable, "WI", "55001"), /No detailed/);
});

test("reported leaders and Harris-Trump margins imply no winner, EV, progress, or future fields", async () => {
  const { context } = await certifiedPromise;
  const state = reduceReplayToEventCount(context, 1_000);
  const analytics = deriveFullReportedAnalytics(state.observable);
  const serialized = serializeDerivedReportedAnalytics(analytics);
  for (const prohibited of [
    "winner", "electoralVotes", "remainingVotes", "expectedVotes",
    "percentReported", "projection", "callStatus",
  ]) {
    assert.equal(serialized.includes(`"${prohibited}"`), false);
  }
});

test("final reported analytics equal final reducer arithmetic without endpoint input", async () => {
  for (const fixtureValue of await Promise.all([certifiedPromise, complexPromise])) {
    const state = reduceReplayToEventCount(fixtureValue.context, fixtureValue.context.events.length);
    const analytics = deriveFullReportedAnalytics(state.observable);
    assert.equal(analytics.complete, true);
    assert.deepEqual(analytics.national.candidateVotes, state.observable.national.candidateVotes);
    assert.equal(analytics.national.totalReportedVotes, state.observable.national.totalVotes);
    assert.equal(analytics.jurisdictions.length, 51);
    assert.equal(analytics.counties.length, 150);
    assert.equal(analytics.publishedUnits.length, 13_553);
  }
});

test("analytics serialization, validation, envelopes, and fingerprints reproduce", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  for (const [fixtureValue, goldens] of [
    [certified, CERTIFIED_ANALYTICS_GOLDENS],
    [complex, COMPLEX_ANALYTICS_GOLDENS],
  ]) {
    const positions = {
      zero: 0,
      event1: 1,
      event100: 100,
      event1000: 1_000,
      midpoint: Math.floor(fixtureValue.context.events.length / 2),
      final: fixtureValue.context.events.length,
    };
    for (const [label, eventCount] of Object.entries(positions)) {
      const state = reduceReplayToEventCount(fixtureValue.context, eventCount);
      const analytics = deriveFullReportedAnalytics(state.observable);
      const serialized = serializeDerivedReportedAnalytics(analytics);
      assert.equal(
        serializeDerivedReportedAnalytics(deserializeDerivedReportedAnalytics(serialized, state.observable)),
        serialized,
      );
      const stateFingerprint = await replayReducerStateFingerprint(state);
      const envelope = await createReportedAnalyticsEnvelope(state.observable, stateFingerprint);
      const envelopeSerialized = serializeReportedAnalyticsEnvelope(envelope);
      const roundTrip = await deserializeReportedAnalyticsEnvelope(
        envelopeSerialized,
        state.observable,
        stateFingerprint,
      );
      assert.equal(serializeReportedAnalyticsEnvelope(roundTrip), envelopeSerialized);
      if (Object.keys(goldens.positions).length > 0) {
        assert.equal(envelope.analyticsFingerprint, goldens.positions[label]);
      }
    }
  }
});

test("tampered analytics fail validation and source isolation is enforced structurally", async () => {
  const { context } = await certifiedPromise;
  const state = reduceReplayToEventCount(context, 100);
  const analytics = deriveFullReportedAnalytics(state.observable);
  const tampered = structuredClone(analytics);
  tampered.national.candidateVotes[0].votes += 1;
  assert.throws(() => deserializeDerivedReportedAnalytics(
    canonicalSerialize(tampered),
    state.observable,
  ), /do not match/);

  const source = readFileSync(
    new URL("../packages/election-replay/src/reportedAnalytics.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /LockedElectionEndpoint|CompiledNationalReplay|ComposedReplayEvent/);
  assert.doesNotMatch(source, /nationalComposition|jurisdictionComposition|endpoint\.ts|reducerCheckpoint/);
  assert.doesNotMatch(source, /Math\.random\s*\(|from\s+["'](?:react|@deck\.gl)/);
  assert.doesNotMatch(source, /DecisionDesk|STATE_CALL|expectedVotes|remainingVotes|percentReported/);
});
