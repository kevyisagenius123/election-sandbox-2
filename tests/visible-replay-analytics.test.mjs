import assert from "node:assert/strict";
import test from "node:test";

import { serializeReplayDescriptiveAnalytics } from "../packages/election-analytics/src/index.ts";
import {
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
} from "../src/replay/threeStateElectionNight.ts";
import {
  buildVisibleReplayAnalyticsIndex,
  deriveVisibleReplayAnalytics,
} from "../src/replay/visibleReplayAnalytics.ts";

function unit(id, countyFips, harrisVotes, trumpVotes, geometryId = id) {
  return {
    id,
    countyFips,
    geometryId,
    harrisVotes,
    trumpVotes,
    steinVotes: 2,
    oliverVotes: 1,
    residualOtherVotes: 3,
    otherVotes: 6,
    totalVotes: harrisVotes + trumpVotes + 6,
    turnoutDenominator: 1_000,
    turnoutCapacity: 100,
    turnoutAddedVotes: 0,
    turnoutHarrisVotes: 0,
    turnoutTrumpVotes: 0,
    preferenceNetHarrisGain: 0,
    thirdPartyCandidateDelta: 0,
    netHarrisGain: 0,
  };
}

const STATES = [
  { stateCode: "PA", units: [unit("pa-1", "42001", 80, 40), unit("pa-2", "42003", 25, 70)] },
  { stateCode: "MI", units: [unit("mi-1", "26001", 60, 45), unit("mi-2", "26163", 90, 35)] },
  { stateCode: "WI", units: [unit("wi-1", "55001", 30, 55), unit("wi-2", "55079", 100, 45, null)] },
];

function zero() {
  return { harris: 0, trump: 0, stein: 0, oliver: 0, residual: 0, total: 0, returns: 0 };
}

function add(target, event) {
  target.harris += event.harrisVotes;
  target.trump += event.trumpVotes;
  target.stein += event.steinVotes;
  target.oliver += event.oliverVotes;
  target.residual += event.residualOtherVotes;
  target.total += event.totalVotes;
  target.returns += 1;
}

function aggregate(value) {
  return {
    candidateVotes: [
      { candidateId: "harris", votes: value.harris },
      { candidateId: "trump", votes: value.trump },
      { candidateId: "stein", votes: value.stein },
      { candidateId: "oliver", votes: value.oliver },
      { candidateId: "other-residual", votes: value.residual },
    ],
    totalReportedVotes: value.total,
    returnsPublished: value.returns,
  };
}

function snapshotAt(replay, logicalReplayTimeMs) {
  const national = zero();
  const states = new Map([["PA", zero()], ["MI", zero()], ["WI", zero()]]);
  const counties = new Map();
  const units = [];
  for (const event of replay.events.filter((candidate) => candidate.atMs <= logicalReplayTimeMs)) {
    add(national, event);
    add(states.get(event.stateCode), event);
    if (event.countyId) {
      const key = `${event.stateCode}/${event.countyId}`;
      const county = counties.get(key) ?? zero();
      add(county, event);
      counties.set(key, county);
    }
    const value = zero();
    add(value, event);
    units.push({
      jurisdictionId: event.stateCode,
      unitId: event.unitId,
      countyId: event.countyId,
      geometryId: event.geometryId,
      ...aggregate(value),
    });
  }
  return {
    national: aggregate(national),
    jurisdictions: [...states].map(([jurisdictionId, value]) => ({
      jurisdictionId,
      geographyAvailability: "detailed",
      expectedReturns: replay.stateReturnTotals[jurisdictionId],
      ...aggregate(value),
    })),
    counties: [...counties].map(([key, value]) => {
      const [jurisdictionId, countyId] = key.split("/");
      return { jurisdictionId, countyId, ...aggregate(value) };
    }),
    units,
  };
}

function analyticsAt(replay, logicalReplayTimeMs) {
  const snapshot = snapshotAt(replay, logicalReplayTimeMs);
  return deriveVisibleReplayAnalytics({
    index: buildVisibleReplayAnalyticsIndex(replay),
    logicalReplayTimeMs,
    stallThresholdMs: 25 * 60_000,
    ...snapshot,
  });
}

test("visible replay analytics begin with explicit poll-close and no-return state", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const index = buildVisibleReplayAnalyticsIndex(replay);
  const analytics = analyticsAt(replay, index.replayStartTimeMs);
  assert.equal(analytics.observedReturnCount, 0);
  assert.equal(analytics.newestReturn, null);
  assert.ok(analytics.progress.every((state) => state.returns.numerator === 0));
  assert.equal(analytics.chronology.find((state) => state.jurisdictionId === "PA").phase, "awaiting-first-return");
  assert.equal(analytics.chronology.find((state) => state.jurisdictionId === "WI").phase, "not-open");
});

test("visible replay analytics reconcile current detailed units through every geography", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const logicalReplayTimeMs = replay.events[2].atMs;
  const analytics = analyticsAt(replay, logicalReplayTimeMs);
  const prefix = replay.events.filter((event) => event.atMs <= logicalReplayTimeMs);
  assert.equal(analytics.observedReturnCount, prefix.length);
  assert.equal(analytics.newestReturn.eventId, prefix.at(-1).eventId);
  assert.equal(
    analytics.windows.find((window) => window.windowMinutes === 30).national.ballotsPublished,
    prefix.filter((event) => event.atMs > logicalReplayTimeMs - 30 * 60_000)
      .reduce((sum, event) => sum + event.totalVotes, 0),
  );
  assert.ok(analytics.largestCurrentCountyMargins.length > 0);
  assert.ok(analytics.largestCurrentUnitMargins.length > 0);
});

test("visible replay analytics reach exact completion without turning arithmetic into a call", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const analytics = analyticsAt(replay, replay.endsAtMs);
  assert.equal(analytics.observedReturnCount, replay.events.length);
  assert.ok(analytics.progress.every((state) => state.returns.partsPerMillion === 1_000_000));
  assert.ok(analytics.progress.every((state) => state.representedBallots.partsPerMillion === 1_000_000));
  assert.ok(analytics.mathematicalOpenness.every((state) => state.status === "complete"));
  assert.ok(analytics.chronology.every((state) => state.phase === "complete" && !state.stalled));
  assert.equal("projectedWinner" in analytics, false);
  assert.equal("callStatus" in analytics, false);
});

test("different hidden future candidate vectors cannot alter the same visible prefix", () => {
  const firstReplay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const lastEvent = firstReplay.events.at(-1);
  const secondStates = STATES.map((state) => ({
    ...state,
    units: state.units.map((entry) => entry.id === lastEvent.unitId
      ? { ...entry, harrisVotes: entry.trumpVotes, trumpVotes: entry.harrisVotes }
      : entry),
  }));
  const secondReplay = compileThreeStateElectionNight(secondStates, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  assert.deepEqual(firstReplay.events.map((event) => event.atMs), secondReplay.events.map((event) => event.atMs));
  const logicalReplayTimeMs = firstReplay.events.at(-2).atMs;
  assert.equal(
    serializeReplayDescriptiveAnalytics(analyticsAt(firstReplay, logicalReplayTimeMs)),
    serializeReplayDescriptiveAnalytics(analyticsAt(secondReplay, logicalReplayTimeMs)),
  );
});
