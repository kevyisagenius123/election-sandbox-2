import type { CandidateVoteVector, LockedReportingUnitType } from "../../packages/election-replay/src/contracts.ts";
import type { ComposedReplayEvent } from "../../packages/election-replay/src/jurisdictionComposition.ts";
import { REPLAY_UNIT_BUCKET_COUNT, type ReplayObservableState } from "../../packages/election-replay/src/reducer.ts";
import {
  deriveReplayDescriptiveAnalytics,
  type ReplayDescriptiveAnalytics,
} from "../../packages/election-analytics/src/index.ts";
import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type {
  NightAggregate,
  NightJurisdiction,
  NightPublishedUnit,
  NightReportedCounty,
} from "../runtime/threeStateNightProtocol.ts";
import {
  ELECTION_NIGHT_POLL_CLOSE_MS,
  type CompiledThreeStateNight,
  type ThreeStateReturnEvent,
} from "./threeStateElectionNight.ts";

const STATE_CODES: readonly DetailedStateCode[] = ["PA", "MI", "WI"];
const CANDIDATE_IDS = ["harris", "trump", "stein", "oliver", "other"] as const;
const SOURCE_IDS = [
  "source:three-state-visible-replay-prefix",
  "source:scenario-ballot-denominators",
] as const;

type TimelineSeed = Omit<
  ComposedReplayEvent,
  "sequence" | "jurisdictionSequence" | "orderTieBreaker"
>;

export interface VisibleReplayAnalyticsIndex {
  replayStartTimeMs: number;
  events: readonly ComposedReplayEvent[];
  modeledBallots: Readonly<Record<DetailedStateCode, number>>;
  expectedReturns: Readonly<Record<DetailedStateCode, number>>;
}

export interface DeriveVisibleReplayAnalyticsInput {
  index: VisibleReplayAnalyticsIndex;
  logicalReplayTimeMs: number;
  stallThresholdMs: number;
  national: NightAggregate;
  jurisdictions: readonly NightJurisdiction[];
  counties: readonly NightReportedCounty[];
  units: readonly NightPublishedUnit[];
}

function canonicalCandidateVector(values: Readonly<Record<(typeof CANDIDATE_IDS)[number], number>>) {
  return CANDIDATE_IDS.map((candidateId) => ({ candidateId, votes: values[candidateId] }));
}

function eventCandidateVector(event: ThreeStateReturnEvent): CandidateVoteVector {
  return canonicalCandidateVector({
    harris: event.harrisVotes,
    trump: event.trumpVotes,
    stein: event.steinVotes,
    oliver: event.oliverVotes,
    other: event.residualOtherVotes,
  });
}

function aggregateCandidateVector(aggregate: NightAggregate): CandidateVoteVector {
  const values = new Map(aggregate.candidateVotes.map((candidate) => [candidate.candidateId, candidate.votes]));
  return canonicalCandidateVector({
    harris: values.get("harris") ?? 0,
    trump: values.get("trump") ?? 0,
    stein: values.get("stein") ?? 0,
    oliver: values.get("oliver") ?? 0,
    other: values.get("other-residual") ?? 0,
  });
}

function unitType(stateCode: DetailedStateCode): LockedReportingUnitType {
  if (stateCode === "PA") return "vtd";
  if (stateCode === "WI") return "ward";
  return "precinct";
}

function controlEvent(
  jurisdictionId: DetailedStateCode,
  eventType: "POLL_CLOSE" | "REPLAY_COMPLETED",
  absoluteReplayTimeMs: number,
): TimelineSeed {
  return {
    replaySchemaVersion: "rme-reporting-events-v1",
    jurisdictionId,
    unitId: null,
    eventType,
    batchOrdinal: 0,
    eventId: `visible/${jurisdictionId}/${eventType}`,
    replayTimeMs: absoluteReplayTimeMs - ELECTION_NIGHT_POLL_CLOSE_MS[jurisdictionId],
    evidenceStatus: "synthetic",
    countyId: null,
    unitType: null,
    geometryStatus: null,
    candidateDelta: null,
    totalDelta: 0,
    voteEvidenceIds: [],
    absoluteReplayTimeMs,
  };
}

function returnEvent(event: ThreeStateReturnEvent): TimelineSeed {
  return {
    replaySchemaVersion: "rme-reporting-events-v1",
    jurisdictionId: event.stateCode,
    unitId: event.unitId,
    eventType: "RETURN_PUBLISHED",
    batchOrdinal: 0,
    eventId: event.eventId,
    replayTimeMs: event.atMs - ELECTION_NIGHT_POLL_CLOSE_MS[event.stateCode],
    evidenceStatus: "synthetic",
    countyId: event.countyId,
    unitType: unitType(event.stateCode),
    geometryStatus: event.geometryId === null ? "off-map" : "mapped",
    candidateDelta: eventCandidateVector(event),
    totalDelta: event.totalVotes,
    voteEvidenceIds: [`visible-scenario-unit/${event.stateCode}/${event.unitId}`],
    absoluteReplayTimeMs: event.atMs,
  };
}

function timelinePriority(event: TimelineSeed) {
  if (event.eventType === "POLL_CLOSE") return 0;
  if (event.eventType === "RETURN_PUBLISHED") return 1;
  return 2;
}

export function buildVisibleReplayAnalyticsIndex(
  replay: CompiledThreeStateNight,
): VisibleReplayAnalyticsIndex {
  const seeds: TimelineSeed[] = STATE_CODES.map((stateCode) => controlEvent(
    stateCode,
    "POLL_CLOSE",
    ELECTION_NIGHT_POLL_CLOSE_MS[stateCode],
  ));
  seeds.push(...replay.events.map(returnEvent));
  for (const stateCode of STATE_CODES) {
    const stateEvents = replay.events.filter((event) => event.stateCode === stateCode);
    const completedAt = Math.max(...stateEvents.map((event) => event.atMs));
    seeds.push(controlEvent(stateCode, "REPLAY_COMPLETED", completedAt));
  }
  seeds.sort((left, right) => (
    left.absoluteReplayTimeMs - right.absoluteReplayTimeMs
    || timelinePriority(left) - timelinePriority(right)
    || left.jurisdictionId.localeCompare(right.jurisdictionId)
    || left.eventId.localeCompare(right.eventId)
  ));
  const jurisdictionSequence = new Map<DetailedStateCode, number>();
  const events = seeds.map((event, sequence): ComposedReplayEvent => {
    const localSequence = jurisdictionSequence.get(event.jurisdictionId as DetailedStateCode) ?? 0;
    jurisdictionSequence.set(event.jurisdictionId as DetailedStateCode, localSequence + 1);
    return Object.freeze({
      ...event,
      sequence,
      jurisdictionSequence: localSequence,
      orderTieBreaker: sequence,
    });
  });
  const modeledBallots = Object.fromEntries(STATE_CODES.map((stateCode) => [
    stateCode,
    replay.events
      .filter((event) => event.stateCode === stateCode)
      .reduce((sum, event) => sum + event.totalVotes, 0),
  ])) as Record<DetailedStateCode, number>;
  return Object.freeze({
    replayStartTimeMs: Math.min(...Object.values(ELECTION_NIGHT_POLL_CLOSE_MS)),
    events: Object.freeze(events),
    modeledBallots: Object.freeze(modeledBallots),
    expectedReturns: Object.freeze({ ...replay.stateReturnTotals }),
  });
}

function upperBound(events: readonly ComposedReplayEvent[], logicalReplayTimeMs: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (events[middle].absoluteReplayTimeMs <= logicalReplayTimeMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

function zeroVector() {
  return canonicalCandidateVector({ harris: 0, trump: 0, stein: 0, oliver: 0, other: 0 });
}

function addVectors(left: CandidateVoteVector, right: CandidateVoteVector): CandidateVoteVector {
  return left.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    votes: candidate.votes + right[index].votes,
  }));
}

function mappedTotals(units: readonly NightPublishedUnit[], stateCode: DetailedStateCode, mapped: boolean) {
  const matching = units.filter((unit) => (
    unit.jurisdictionId === stateCode && (unit.geometryId !== null) === mapped
  ));
  let candidateVotes: CandidateVoteVector = zeroVector();
  for (const unit of matching) {
    candidateVotes = addVectors(candidateVotes, aggregateCandidateVector(unit));
  }
  return {
    candidateVotes,
    totalVotes: matching.reduce((sum, unit) => sum + unit.totalReportedVotes, 0),
  };
}

function observableState(
  input: DeriveVisibleReplayAnalyticsInput,
  observedEvents: readonly ComposedReplayEvent[],
): ReplayObservableState {
  const last = observedEvents.at(-1) ?? null;
  const completed = new Set(observedEvents
    .filter((event) => event.eventType === "REPLAY_COMPLETED")
    .map((event) => event.jurisdictionId));
  const pollClosed = new Set(observedEvents
    .filter((event) => event.eventType === "POLL_CLOSE")
    .map((event) => event.jurisdictionId));
  const reportedByJurisdiction = Object.fromEntries(input.jurisdictions.map((state) => {
    const mapped = mappedTotals(input.units, state.jurisdictionId, true);
    const offMap = mappedTotals(input.units, state.jurisdictionId, false);
    return [state.jurisdictionId, {
      jurisdictionId: state.jurisdictionId,
      candidateVotes: aggregateCandidateVector(state),
      totalVotes: state.totalReportedVotes,
      returnsPublished: state.returnsPublished,
      pollClosed: pollClosed.has(state.jurisdictionId),
      completed: completed.has(state.jurisdictionId),
      mappedCandidateVotes: mapped.candidateVotes,
      mappedTotalVotes: mapped.totalVotes,
      offMapCandidateVotes: offMap.candidateVotes,
      offMapTotalVotes: offMap.totalVotes,
    }];
  }));
  const reportedByCounty = Object.fromEntries(input.counties.map((county) => [
    `${county.jurisdictionId}/${county.countyId}`,
    {
      jurisdictionId: county.jurisdictionId,
      countyId: county.countyId,
      candidateVotes: aggregateCandidateVector(county),
      totalVotes: county.totalReportedVotes,
      returnsPublished: county.returnsPublished,
    },
  ]));
  const unitBucket = Object.fromEntries(input.units.map((unit) => [
    `${unit.jurisdictionId}/${unit.unitId}`,
    {
      jurisdictionId: unit.jurisdictionId,
      unitId: unit.unitId,
      countyId: unit.countyId,
      unitType: unitType(unit.jurisdictionId),
      geometryStatus: unit.geometryId === null ? "off-map" : "mapped",
      candidateVotes: aggregateCandidateVector(unit),
      totalVotes: unit.totalReportedVotes,
      returnsPublished: unit.returnsPublished,
    },
  ]));
  return {
    position: {
      eventsApplied: observedEvents.length,
      lastAppliedSequence: last?.sequence ?? null,
      lastAppliedEventId: last?.eventId ?? null,
      absoluteReplayTimeMs: last?.absoluteReplayTimeMs ?? null,
    },
    national: {
      candidateVotes: aggregateCandidateVector(input.national),
      totalVotes: input.national.totalReportedVotes,
      returnsPublished: input.national.returnsPublished,
    },
    reportedByJurisdiction,
    reportedByCounty,
    reportedByUnit: {
      bucketCount: REPLAY_UNIT_BUCKET_COUNT,
      buckets: [unitBucket, ...Array.from({ length: REPLAY_UNIT_BUCKET_COUNT - 1 }, () => ({}))],
    },
    jurisdictionsCompleted: completed.size,
    complete: completed.size === STATE_CODES.length,
  };
}

export function deriveVisibleReplayAnalytics(
  input: DeriveVisibleReplayAnalyticsInput,
): ReplayDescriptiveAnalytics {
  const observedCount = upperBound(input.index.events, input.logicalReplayTimeMs);
  const observedEvents = input.index.events.slice(0, observedCount);
  return deriveReplayDescriptiveAnalytics({
    observable: observableState(input, observedEvents),
    observedEvents,
    logicalReplayTimeMs: input.logicalReplayTimeMs,
    replayStartTimeMs: input.index.replayStartTimeMs,
    denominators: STATE_CODES.map((jurisdictionId) => ({
      jurisdictionId,
      expectedReturns: input.index.expectedReturns[jurisdictionId],
      modeledBallots: input.index.modeledBallots[jurisdictionId],
    })),
    stallThresholdMs: input.stallThresholdMs,
    rankingLimit: 12,
    sourceIds: SOURCE_IDS,
  });
}
