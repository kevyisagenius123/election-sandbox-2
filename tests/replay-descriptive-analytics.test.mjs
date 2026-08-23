import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deriveReplayDescriptiveAnalytics,
  deserializeFingerprintedReplayDescriptiveAnalytics,
  fingerprintReplayDescriptiveAnalytics,
  serializeFingerprintedReplayDescriptiveAnalytics,
  serializeReplayDescriptiveAnalytics,
} from "../packages/election-analytics/src/index.ts";

const CANDIDATES = ["harris", "trump", "stein", "oliver", "other"];
const BASE = 1_000_000;
const MINUTE = 60_000;
const COUNTY_IDS = [
  ["PA", "pa-c1"],
  ["PA", "pa-c2"],
  ["MI", "mi-c1"],
  ["MI", "mi-c2"],
];

function vector(votes = [0, 0, 0, 0, 0]) {
  return CANDIDATES.map((candidateId, index) => ({ candidateId, votes: votes[index] }));
}

function control(sequence, jurisdictionId, eventType, minute) {
  return {
    replaySchemaVersion: "rme-reporting-events-v1",
    jurisdictionId,
    unitId: null,
    eventType,
    batchOrdinal: 0,
    eventId: `${jurisdictionId}:${eventType}:${sequence}`,
    sequence,
    replayTimeMs: minute * MINUTE,
    evidenceStatus: "synthetic",
    countyId: null,
    unitType: null,
    geometryStatus: null,
    candidateDelta: null,
    totalDelta: 0,
    voteEvidenceIds: [],
    orderTieBreaker: sequence,
    jurisdictionSequence: sequence,
    absoluteReplayTimeMs: BASE + minute * MINUTE,
  };
}

function published(sequence, jurisdictionId, countyId, unitId, minute, votes) {
  const candidateDelta = vector(votes);
  return {
    replaySchemaVersion: "rme-reporting-events-v1",
    jurisdictionId,
    unitId,
    eventType: "RETURN_PUBLISHED",
    batchOrdinal: 0,
    eventId: `${jurisdictionId}:RETURN:${unitId}`,
    sequence,
    replayTimeMs: minute * MINUTE,
    evidenceStatus: "synthetic",
    countyId,
    unitType: "precinct",
    geometryStatus: "mapped",
    candidateDelta,
    totalDelta: votes.reduce((sum, value) => sum + value, 0),
    voteEvidenceIds: [`evidence:${jurisdictionId}:${unitId}`],
    orderTieBreaker: sequence,
    jurisdictionSequence: sequence,
    absoluteReplayTimeMs: BASE + minute * MINUTE,
  };
}

const EVENTS = [
  control(0, "PA", "POLL_CLOSE", 0),
  control(1, "MI", "POLL_CLOSE", 1),
  published(2, "PA", "pa-c1", "pa-1", 2, [60, 40, 0, 0, 0]),
  published(3, "MI", "mi-c1", "mi-1", 4, [30, 70, 0, 0, 0]),
  published(4, "PA", "pa-c1", "pa-2", 10, [40, 60, 0, 0, 0]),
  published(5, "PA", "pa-c2", "pa-3", 20, [80, 20, 0, 0, 0]),
  published(6, "MI", "mi-c2", "mi-2", 32, [40, 60, 0, 0, 0]),
];

function addVotes(target, delta) {
  for (let index = 0; index < target.length; index += 1) target[index] += delta[index].votes;
}

function aggregateState(candidateValues = [0, 0, 0, 0, 0], returnsPublished = 0) {
  return {
    candidateVotes: vector(candidateValues),
    totalVotes: candidateValues.reduce((sum, value) => sum + value, 0),
    returnsPublished,
  };
}

function observableFromPrefix(events) {
  const national = [0, 0, 0, 0, 0];
  const jurisdictions = new Map([
    ["PA", { votes: [0, 0, 0, 0, 0], returns: 0, pollClosed: false, completed: false }],
    ["MI", { votes: [0, 0, 0, 0, 0], returns: 0, pollClosed: false, completed: false }],
  ]);
  const counties = new Map(COUNTY_IDS.map(([jurisdictionId, countyId]) => [
    `${jurisdictionId}/${countyId}`,
    { jurisdictionId, countyId, votes: [0, 0, 0, 0, 0], returns: 0 },
  ]));
  const units = [];
  let nationalReturns = 0;
  for (const event of events) {
    const jurisdiction = jurisdictions.get(event.jurisdictionId);
    if (event.eventType === "POLL_CLOSE") jurisdiction.pollClosed = true;
    if (event.eventType === "REPLAY_COMPLETED") jurisdiction.completed = true;
    if (event.eventType !== "RETURN_PUBLISHED") continue;
    addVotes(national, event.candidateDelta);
    addVotes(jurisdiction.votes, event.candidateDelta);
    jurisdiction.returns += 1;
    nationalReturns += 1;
    if (event.countyId) {
      const county = counties.get(`${event.jurisdictionId}/${event.countyId}`);
      addVotes(county.votes, event.candidateDelta);
      county.returns += 1;
    }
    units.push({
      jurisdictionId: event.jurisdictionId,
      unitId: event.unitId,
      countyId: event.countyId,
      unitType: event.unitType,
      geometryStatus: event.geometryStatus,
      ...aggregateState(event.candidateDelta.map((candidate) => candidate.votes), 1),
    });
  }
  const unitBucket = Object.fromEntries(units.map((unit) => [
    `${unit.jurisdictionId}/${unit.unitId}`,
    unit,
  ]));
  const last = events.at(-1) ?? null;
  const completed = [...jurisdictions.values()].filter((state) => state.completed).length;
  return {
    position: {
      eventsApplied: events.length,
      lastAppliedSequence: last?.sequence ?? null,
      lastAppliedEventId: last?.eventId ?? null,
      absoluteReplayTimeMs: last?.absoluteReplayTimeMs ?? null,
    },
    national: aggregateState(national, nationalReturns),
    reportedByJurisdiction: Object.fromEntries([...jurisdictions].map(([jurisdictionId, state]) => {
      const aggregate = aggregateState(state.votes, state.returns);
      return [jurisdictionId, {
        jurisdictionId,
        pollClosed: state.pollClosed,
        completed: state.completed,
        ...aggregate,
        mappedCandidateVotes: vector(state.votes),
        mappedTotalVotes: aggregate.totalVotes,
        offMapCandidateVotes: vector(),
        offMapTotalVotes: 0,
      }];
    })),
    reportedByCounty: Object.fromEntries([...counties].map(([key, county]) => [key, {
      jurisdictionId: county.jurisdictionId,
      countyId: county.countyId,
      ...aggregateState(county.votes, county.returns),
    }])),
    reportedByUnit: {
      bucketCount: 257,
      buckets: [unitBucket, ...Array.from({ length: 256 }, () => ({}))],
    },
    jurisdictionsCompleted: completed,
    complete: completed === jurisdictions.size,
  };
}

function input(overrides = {}) {
  const observedEvents = overrides.observedEvents ?? EVENTS;
  return {
    observable: overrides.observable ?? observableFromPrefix(observedEvents),
    observedEvents,
    replayStartTimeMs: BASE,
    logicalReplayTimeMs: BASE + 35 * MINUTE,
    denominators: [
      { jurisdictionId: "PA", expectedReturns: 4, modeledBallots: 400 },
      { jurisdictionId: "MI", expectedReturns: 3, modeledBallots: 220 },
    ],
    stallThresholdMs: 5 * MINUTE,
    rankingLimit: 10,
    sourceIds: ["source:reducer-prefix", "source:synthetic-clock"],
    ...overrides,
  };
}

test("current-prefix windows and publication rates are exact", () => {
  const analytics = deriveReplayDescriptiveAnalytics(input());
  assert.equal(analytics.observedEventCount, 7);
  assert.equal(analytics.observedReturnCount, 5);
  assert.deepEqual(analytics.windows.map((window) => [
    window.windowMinutes,
    window.national.returnsPublished,
    window.national.ballotsPublished,
    window.national.signedHarrisMinusTrumpMovement,
    window.returnsPerHourMilli,
    window.ballotsPerMinuteMilli,
  ]), [
    [5, 1, 100, -20, 12_000, 20_000],
    [15, 1, 100, -20, 4_000, 6_667],
    [30, 3, 300, 20, 6_000, 10_000],
  ]);
  assert.equal(analytics.analytics.analytics.length, 30);
});

test("progress, mathematical openness, and chronology stay descriptive", () => {
  const analytics = deriveReplayDescriptiveAnalytics(input());
  assert.deepEqual(analytics.progress, [
    {
      jurisdictionId: "MI",
      returns: { numerator: 2, denominator: 3, partsPerMillion: 666_667 },
      representedBallots: { numerator: 200, denominator: 220, partsPerMillion: 909_091 },
    },
    {
      jurisdictionId: "PA",
      returns: { numerator: 3, denominator: 4, partsPerMillion: 750_000 },
      representedBallots: { numerator: 300, denominator: 400, partsPerMillion: 750_000 },
    },
  ]);
  assert.deepEqual(analytics.mathematicalOpenness.map((state) => ({
    id: state.jurisdictionId,
    status: state.status,
    margin: state.signedHarrisMinusTrumpMargin,
    outstanding: state.modeledOutstandingBallots,
    required: state.votesRequiredToOvertake,
    surplus: state.surplusOrShortfallBallots,
  })), [
    { id: "MI", status: "exhausted", margin: -60, outstanding: 20, required: 61, surplus: -41 },
    { id: "PA", status: "open", margin: 60, outstanding: 100, required: 61, surplus: 39 },
  ]);
  assert.deepEqual(analytics.chronology.map((state) => ({
    id: state.jurisdictionId,
    phase: state.phase,
    elapsed: state.elapsedSinceActivityMs,
    stalled: state.stalled,
  })), [
    { id: "MI", phase: "counting", elapsed: 3 * MINUTE, stalled: false },
    { id: "PA", phase: "counting", elapsed: 15 * MINUTE, stalled: true },
  ]);
});

test("newest return, current margins, and recent movers preserve local identity", () => {
  const analytics = deriveReplayDescriptiveAnalytics(input());
  assert.deepEqual({
    sequence: analytics.newestReturn.sequence,
    jurisdictionId: analytics.newestReturn.jurisdictionId,
    countyId: analytics.newestReturn.countyId,
    unitId: analytics.newestReturn.unitId,
    movement: analytics.newestReturn.signedHarrisMinusTrumpMovement,
  }, {
    sequence: 6,
    jurisdictionId: "MI",
    countyId: "mi-c2",
    unitId: "mi-2",
    movement: -20,
  });
  assert.deepEqual(
    analytics.largestCurrentCountyMargins.map((row) => [row.jurisdictionId, row.geographyId, row.signedHarrisMinusTrumpMargin]),
    [["PA", "pa-c2", 60], ["MI", "mi-c1", -40], ["MI", "mi-c2", -20], ["PA", "pa-c1", 0]],
  );
  assert.deepEqual(
    analytics.largestCurrentUnitMargins.slice(0, 2).map((row) => [row.jurisdictionId, row.geographyId, row.signedHarrisMinusTrumpMargin]),
    [["PA", "pa-3", 60], ["MI", "mi-1", -40]],
  );
  assert.deepEqual(
    analytics.recentCountyMovers.map((row) => [row.jurisdictionId, row.geographyId, row.signedHarrisMinusTrumpMovement]),
    [["MI", "mi-c2", -20]],
  );
  assert.deepEqual(
    analytics.recentUnitMovers.map((row) => [row.jurisdictionId, row.geographyId]),
    [["MI", "mi-2"]],
  );
});

test("window boundaries are start-exclusive and end-inclusive", () => {
  const analytics = deriveReplayDescriptiveAnalytics(input());
  assert.equal(analytics.windows.find((window) => window.windowMinutes === 15).national.returnsPublished, 1);
  const atBoundary = deriveReplayDescriptiveAnalytics(input({
    logicalReplayTimeMs: BASE + 35 * MINUTE - 1,
  }));
  assert.equal(atBoundary.windows.find((window) => window.windowMinutes === 15).national.returnsPublished, 2);
});

test("zero prefix has explicit no-return and not-open semantics", () => {
  const observedEvents = [];
  const analytics = deriveReplayDescriptiveAnalytics(input({
    observedEvents,
    observable: observableFromPrefix(observedEvents),
    logicalReplayTimeMs: BASE,
  }));
  assert.equal(analytics.newestReturn, null);
  assert.deepEqual(analytics.windows.map((window) => [window.returnsPerHourMilli, window.ballotsPerMinuteMilli]), [
    [null, null], [null, null], [null, null],
  ]);
  assert.ok(analytics.mathematicalOpenness.every((state) => state.status === "no-returns"));
  assert.ok(analytics.chronology.every((state) => state.phase === "not-open" && !state.stalled));
});

test("missing denominators remain unavailable instead of being inferred", () => {
  const analytics = deriveReplayDescriptiveAnalytics(input({
    denominators: [
      { jurisdictionId: "MI", expectedReturns: null, modeledBallots: null },
      { jurisdictionId: "PA", expectedReturns: null, modeledBallots: null },
    ],
  }));
  assert.ok(analytics.progress.every((state) => state.returns === null && state.representedBallots === null));
  assert.ok(analytics.mathematicalOpenness.every((state) => state.status === "unavailable"));
  const progress = analytics.analytics.analytics.filter((entry) => entry.definitionId.includes("progress"));
  assert.ok(progress.every((entry) => entry.status === "unavailable" && entry.value === null));
});

test("serialization and fingerprints are deterministic and reject tampering", async () => {
  const firstInput = input();
  const secondInput = input({
    denominators: [...firstInput.denominators].reverse(),
    sourceIds: [...firstInput.sourceIds].reverse(),
  });
  const first = deriveReplayDescriptiveAnalytics(firstInput);
  const second = deriveReplayDescriptiveAnalytics(secondInput);
  assert.equal(serializeReplayDescriptiveAnalytics(first), serializeReplayDescriptiveAnalytics(second));
  const fingerprinted = await fingerprintReplayDescriptiveAnalytics(first);
  assert.equal(
    fingerprinted.fingerprint,
    "sha256:5e4c698ded29820ec7fc971e4d1a5031881d610afdde55ea1317295bee7d0819",
  );
  assert.equal(
    serializeFingerprintedReplayDescriptiveAnalytics(fingerprinted),
    serializeFingerprintedReplayDescriptiveAnalytics(await fingerprintReplayDescriptiveAnalytics(second)),
  );
  assert.deepEqual(
    await deserializeFingerprintedReplayDescriptiveAnalytics(
      serializeFingerprintedReplayDescriptiveAnalytics(fingerprinted),
      firstInput,
    ),
    fingerprinted,
  );
  const tampered = JSON.parse(serializeFingerprintedReplayDescriptiveAnalytics(fingerprinted));
  tampered.analytics.windows[0].national.ballotsPublished += 1;
  await assert.rejects(
    deserializeFingerprintedReplayDescriptiveAnalytics(JSON.stringify(tampered), firstInput),
    /do not match/,
  );
});

test("future events are structurally absent from current-prefix analytics", () => {
  const prefix = EVENTS.slice(0, 5);
  const currentInput = input({
    observedEvents: prefix,
    observable: observableFromPrefix(prefix),
    logicalReplayTimeMs: BASE + 12 * MINUTE,
  });
  const first = deriveReplayDescriptiveAnalytics(currentInput);
  const divergentUnusedFuture = [
    published(5, "PA", "pa-c2", "future-red", 20, [0, 500, 0, 0, 0]),
    published(5, "PA", "pa-c2", "future-blue", 20, [500, 0, 0, 0, 0]),
  ];
  assert.notDeepEqual(divergentUnusedFuture[0].candidateDelta, divergentUnusedFuture[1].candidateDelta);
  assert.equal(
    serializeReplayDescriptiveAnalytics(first),
    serializeReplayDescriptiveAnalytics(deriveReplayDescriptiveAnalytics(currentInput)),
  );
  assert.throws(
    () => deriveReplayDescriptiveAnalytics({ ...currentInput, observedEvents: [...prefix, divergentUnusedFuture[0]] }),
    /does not match reducer position/,
  );
});

test("tampered aggregate, county, unit, lifecycle, and denominator state fail closed", () => {
  const aggregateTamper = structuredClone(input());
  aggregateTamper.observable.national.totalVotes += 1;
  assert.throws(() => deriveReplayDescriptiveAnalytics(aggregateTamper), /national reducer state/);

  const countyTamper = structuredClone(input());
  countyTamper.observable.reportedByCounty["PA/pa-c1"].totalVotes += 1;
  assert.throws(() => deriveReplayDescriptiveAnalytics(countyTamper), /pa-c1.*does not reconcile/);

  const unitTamper = structuredClone(input());
  unitTamper.observable.reportedByUnit.buckets[0]["PA/pa-1"].geometryStatus = "off-map";
  assert.throws(() => deriveReplayDescriptiveAnalytics(unitTamper), /pa-1.*does not reconcile/);

  const noPollClose = structuredClone(input());
  noPollClose.observedEvents[0].eventType = "REPLAY_COMPLETED";
  assert.throws(() => deriveReplayDescriptiveAnalytics(noPollClose), /completion violates lifecycle order/);

  assert.throws(() => deriveReplayDescriptiveAnalytics(input({
    denominators: [
      { jurisdictionId: "PA", expectedReturns: 2, modeledBallots: 299 },
      { jurisdictionId: "MI", expectedReturns: 3, modeledBallots: 220 },
    ],
  })), /bounding the current prefix|over-reports/);
});

test("the replay descriptive layer remains headless, deterministic, and non-probabilistic", () => {
  const source = readFileSync(
    new URL("../packages/election-analytics/src/replayDescriptiveAnalytics.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Math\.random|fetch\s*\(|from\s+["']react|deck\.gl|mapbox/i);
  assert.doesNotMatch(source, /finalWinner|projectedWinner|callStatus|winProbability|expectedCandidateShare/i);
});
