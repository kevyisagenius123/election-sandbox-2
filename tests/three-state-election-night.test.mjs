import assert from "node:assert/strict";
import test from "node:test";

import {
  buildElectionNightChronologyPreview,
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
  ELECTION_NIGHT_PROFILES,
} from "../src/replay/threeStateElectionNight.ts";

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

const states = [
  { stateCode: "PA", units: [unit("pa-1", "42001", 80, 40), unit("pa-2", "42003", 25, 70)] },
  { stateCode: "MI", units: [unit("mi-1", "26001", 60, 45), unit("mi-2", "26163", 90, 35)] },
  { stateCode: "WI", units: [unit("wi-1", "55001", 30, 55), unit("wi-2", "55079", 100, 45)] },
];

test("three-state election night contains only detailed PA, MI, and WI unit returns", () => {
  const replay = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  assert.deepEqual([...new Set(replay.events.map((event) => event.stateCode))].sort(), ["MI", "PA", "WI"]);
  assert.equal(replay.events.length, 6);
  assert.deepEqual(replay.stateReturnTotals, { PA: 2, MI: 2, WI: 2 });
  assert.equal(new Set(replay.events.map((event) => event.eventId)).size, replay.events.length);
  assert.equal(new Set(replay.events.map((event) => event.atMs)).size, replay.events.length);
});

test("three-state scheduling is deterministic and behavior changes timing without changing votes", () => {
  const first = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const second = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  assert.deepEqual(first, second);

  const directed = compileThreeStateElectionNight(states, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    durationHours: 22,
    reportingOrder: "urban-first",
    volatility: 92,
    stallIntensity: 80,
    seed: 77,
  });
  assert.notDeepEqual(first.events.map((event) => event.atMs), directed.events.map((event) => event.atMs));
  const votes = (replay) => replay.events.map((event) => ({
    eventId: event.eventId,
    harrisVotes: event.harrisVotes,
    trumpVotes: event.trumpVotes,
    totalVotes: event.totalVotes,
  })).sort((left, right) => left.eventId.localeCompare(right.eventId));
  assert.deepEqual(votes(first), votes(directed));
});

test("three-state scheduling rejects missing or unsupported jurisdictions", () => {
  assert.throws(
    () => compileThreeStateElectionNight(states.slice(0, 2), DEFAULT_ELECTION_NIGHT_BEHAVIOR),
    /missing WI/,
  );
  assert.throws(
    () => compileThreeStateElectionNight([...states, { stateCode: "GA", units: [] }], DEFAULT_ELECTION_NIGHT_BEHAVIOR),
    /exactly PA, MI, and WI/,
  );
});

test("county overrides alter only the named county chronology", () => {
  const baseline = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
  const directed = compileThreeStateElectionNight(states, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    countyOverrides: [{
      stateCode: "PA",
      countyId: "42003",
      startOffsetMinutes: 120,
      countDurationPercent: 175,
    }],
  });
  const baselineById = new Map(baseline.events.map((event) => [event.eventId, event]));
  const directedById = new Map(directed.events.map((event) => [event.eventId, event]));
  assert.notEqual(directedById.get("three-state-night-v1/PA/pa-2").atMs, baselineById.get("three-state-night-v1/PA/pa-2").atMs);
  for (const [eventId, event] of directedById) {
    const original = baselineById.get(eventId);
    assert.deepEqual({
      harrisVotes: event.harrisVotes,
      trumpVotes: event.trumpVotes,
      steinVotes: event.steinVotes,
      oliverVotes: event.oliverVotes,
      residualOtherVotes: event.residualOtherVotes,
      totalVotes: event.totalVotes,
    }, {
      harrisVotes: original.harrisVotes,
      trumpVotes: original.trumpVotes,
      steinVotes: original.steinVotes,
      oliverVotes: original.oliverVotes,
      residualOtherVotes: original.residualOtherVotes,
      totalVotes: original.totalVotes,
    });
    if (eventId !== "three-state-night-v1/PA/pa-2") assert.equal(event.atMs, original.atMs);
  }
});

test("profiles and chronology previews are deterministic and candidate-blind", () => {
  assert.equal(ELECTION_NIGHT_PROFILES.length, 4);
  for (const profile of ELECTION_NIGHT_PROFILES) {
    const first = compileThreeStateElectionNight(states, profile.behavior);
    const second = compileThreeStateElectionNight(states, profile.behavior);
    assert.deepEqual(first, second);
    assert.deepEqual(
      first.events.map((event) => event.totalVotes).sort((left, right) => left - right),
      states.flatMap((state) => state.units.map((entry) => entry.totalVotes)).sort((left, right) => left - right),
    );
  }
  const preview = buildElectionNightChronologyPreview(ELECTION_NIGHT_PROFILES[1].behavior);
  assert.deepEqual(preview.states.map((state) => state.stateCode), ["PA", "MI", "WI"]);
  assert.equal(preview.overrideCount, 0);
  assert.ok(preview.endsAtMs > preview.startsAtMs);
});

test("county override validation rejects duplicates and dishonest ranges", () => {
  const override = { stateCode: "PA", countyId: "42003", startOffsetMinutes: 0, countDurationPercent: 100 };
  assert.throws(() => compileThreeStateElectionNight(states, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    countyOverrides: [override, override],
  }), /must be unique/);
  assert.throws(() => compileThreeStateElectionNight(states, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    countyOverrides: [{ ...override, startOffsetMinutes: 361 }],
  }), /start offset/);
  assert.throws(() => compileThreeStateElectionNight(states, {
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    countyOverrides: [{ ...override, countDurationPercent: 10 }],
  }), /count duration/);
});
