import assert from "node:assert/strict";
import test from "node:test";

import {
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
} from "../src/replay/threeStateElectionNight.ts";
import {
  buildNightReportingPaceIndex,
  deriveNightReportingPace,
} from "../src/replay/visibleReportingPace.ts";

function unit(id, countyFips, harrisVotes, trumpVotes) {
  return {
    id,
    countyFips,
    geometryId: id,
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
  { stateCode: "WI", units: [unit("wi-1", "55001", 30, 55), unit("wi-2", "55079", 100, 45)] },
];

test("reporting pace starts empty without exposing a scheduled return", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const pace = deriveNightReportingPace(
    buildNightReportingPaceIndex(replay),
    0,
    replay.startsAtMs,
    25 * 60_000,
  );
  assert.equal(pace.observedReturnCount, 0);
  assert.deepEqual(pace.points, []);
  assert.ok(pace.comparisons.every((state) => state.status === "waiting"));
  assert.equal(JSON.stringify(pace).includes(replay.events[0].eventId), false);
});

test("reporting pace and state progress reconcile to the visible prefix", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const observedReturnCount = 4;
  const currentTimeMs = replay.events[observedReturnCount - 1].atMs;
  const observed = replay.events.slice(0, observedReturnCount);
  const pace = deriveNightReportingPace(
    buildNightReportingPaceIndex(replay),
    observedReturnCount,
    currentTimeMs,
    25 * 60_000,
  );
  assert.equal(pace.points.at(-1).eventId, observed.at(-1).eventId);
  assert.equal(JSON.stringify(pace).includes(replay.events[observedReturnCount].eventId), false);
  for (const state of pace.comparisons) {
    const stateEvents = observed.filter((event) => event.stateCode === state.jurisdictionId);
    assert.equal(state.returnsPublished, stateEvents.length);
    assert.equal(
      state.ballotsPublished,
      stateEvents.reduce((sum, event) => sum + event.totalVotes, 0),
    );
    assert.ok(state.ballotProgressMillionths >= 0 && state.ballotProgressMillionths <= 1_000_000);
    assert.ok(state.returnProgressMillionths >= 0 && state.returnProgressMillionths <= 1_000_000);
  }
});

test("a different seed changes timing but never reporting totals", () => {
  const first = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const second = compileThreeStateElectionNight(STATES, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    seed: DEFAULT_ELECTION_NIGHT_BEHAVIOR.seed + 71,
  });
  const firstPace = deriveNightReportingPace(
    buildNightReportingPaceIndex(first), first.events.length, first.endsAtMs, 25 * 60_000,
  );
  const secondPace = deriveNightReportingPace(
    buildNightReportingPaceIndex(second), second.events.length, second.endsAtMs, 25 * 60_000,
  );
  assert.notDeepEqual(first.events.map((event) => event.atMs), second.events.map((event) => event.atMs));
  assert.deepEqual(
    firstPace.comparisons.map((state) => [state.jurisdictionId, state.ballotsPublished, state.returnsPublished]),
    secondPace.comparisons.map((state) => [state.jurisdictionId, state.ballotsPublished, state.returnsPublished]),
  );
});

test("hidden future candidate shares cannot alter the visible pace payload", () => {
  const firstReplay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const hiddenEvent = firstReplay.events.at(-1);
  const secondStates = STATES.map((state) => ({
    ...state,
    units: state.units.map((entry) => entry.id === hiddenEvent.unitId
      ? { ...entry, harrisVotes: entry.trumpVotes, trumpVotes: entry.harrisVotes }
      : entry),
  }));
  const secondReplay = compileThreeStateElectionNight(secondStates, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const observedReturnCount = firstReplay.events.length - 1;
  const currentTimeMs = firstReplay.events[observedReturnCount - 1].atMs;
  const first = deriveNightReportingPace(
    buildNightReportingPaceIndex(firstReplay), observedReturnCount, currentTimeMs, 25 * 60_000,
  );
  const second = deriveNightReportingPace(
    buildNightReportingPaceIndex(secondReplay), observedReturnCount, currentTimeMs, 25 * 60_000,
  );
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("velocity points are deterministic, bounded, and retain current activity", () => {
  const manyStates = STATES.map((state) => ({
    ...state,
    units: Array.from({ length: 300 }, (_, index) => unit(
      `${state.stateCode.toLowerCase()}-${index}`,
      state.units[0].countyFips,
      40 + index % 17,
      35 + index % 13,
    )),
  }));
  const replay = compileThreeStateElectionNight(manyStates, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const index = buildNightReportingPaceIndex(replay);
  const first = deriveNightReportingPace(index, replay.events.length, replay.endsAtMs, 25 * 60_000, 15, 80);
  const second = deriveNightReportingPace(index, replay.events.length, replay.endsAtMs, 25 * 60_000, 15, 80);
  const unsampled = deriveNightReportingPace(index, replay.events.length, replay.endsAtMs, 25 * 60_000, 15, 2_000);
  assert.equal(first.sampled, true);
  assert.ok(first.points.length <= 80);
  assert.equal(first.points.at(-1).atMs, replay.endsAtMs);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.ok(first.comparisons.every((state) => state.status === "complete"));
  for (const scope of ["national", "PA", "MI", "WI"]) {
    const measure = (point) => scope === "national" ? point.national : point.jurisdictions[scope];
    assert.equal(
      Math.max(...first.points.map((point) => measure(point).ballotsPerMinuteMilli)),
      Math.max(...unsampled.points.map((point) => measure(point).ballotsPerMinuteMilli)),
    );
    assert.equal(
      Math.max(...first.points.map((point) => measure(point).returnsPerMinuteMilli)),
      Math.max(...unsampled.points.map((point) => measure(point).returnsPerMinuteMilli)),
    );
  }
});
