import assert from "node:assert/strict";
import test from "node:test";

import {
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
} from "../src/replay/threeStateElectionNight.ts";
import {
  buildNightMarginTimelineIndex,
  deriveNightMarginTimeline,
} from "../src/replay/visibleReplayTimeline.ts";

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

test("visible margin timeline starts empty and exposes no scheduled future return", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const index = buildNightMarginTimelineIndex(replay);
  const timeline = deriveNightMarginTimeline(index, 0, replay.startsAtMs);
  assert.equal(timeline.observedReturnCount, 0);
  assert.deepEqual(timeline.points, []);
  assert.equal(JSON.stringify(timeline).includes(replay.events[0].eventId), false);
});

test("visible margin timeline exactly reconstructs the observed prefix", () => {
  const replay = compileThreeStateElectionNight(STATES, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const index = buildNightMarginTimelineIndex(replay);
  const observedReturnCount = 4;
  const timeline = deriveNightMarginTimeline(
    index,
    observedReturnCount,
    replay.events[observedReturnCount - 1].atMs,
  );
  const observed = replay.events.slice(0, observedReturnCount);
  const latest = timeline.points.at(-1);
  const nationalHarris = observed.reduce((sum, event) => sum + event.harrisVotes, 0);
  const nationalTrump = observed.reduce((sum, event) => sum + event.trumpVotes, 0);
  const nationalTotal = observed.reduce((sum, event) => sum + event.totalVotes, 0);
  assert.equal(timeline.points.length, observedReturnCount);
  assert.equal(latest.eventId, observed.at(-1).eventId);
  assert.equal(
    latest.nationalMarginPartsPerMillion,
    Math.round((nationalHarris - nationalTrump) * 1_000_000 / nationalTotal),
  );
  assert.equal(JSON.stringify(timeline).includes(replay.events[observedReturnCount].eventId), false);
});

test("timeline display points are deterministically bounded and retain the latest return", () => {
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
  const index = buildNightMarginTimelineIndex(replay);
  const first = deriveNightMarginTimeline(index, replay.events.length, replay.endsAtMs, 80);
  const second = deriveNightMarginTimeline(index, replay.events.length, replay.endsAtMs, 80);
  assert.equal(first.sampled, true);
  assert.ok(first.points.length <= 80);
  assert.equal(first.points.at(-1).eventId, replay.events.at(-1).eventId);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("different hidden future candidate vectors cannot alter a visible timeline", () => {
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
  const first = deriveNightMarginTimeline(
    buildNightMarginTimelineIndex(firstReplay),
    observedReturnCount,
    currentTimeMs,
  );
  const second = deriveNightMarginTimeline(
    buildNightMarginTimelineIndex(secondReplay),
    observedReturnCount,
    currentTimeMs,
  );
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
