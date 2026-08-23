import type { CandidateVoteVector } from "../../election-replay/src/contracts.ts";
import type { ComposedReplayEvent } from "../../election-replay/src/jurisdictionComposition.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "../../election-replay/src/canonical.ts";
import { isSha256Fingerprint, sha256Fingerprint } from "../../election-replay/src/hash.ts";
import { deriveReportedVoteAnalytics } from "../../election-replay/src/reportedAnalytics.ts";
import type {
  ReplayObservableState,
  ReportedAggregateState,
  ReportedUnitState,
} from "../../election-replay/src/reducer.ts";
import {
  buildProgressAnalyticEnvelopes,
  buildReportedAnalyticEnvelopes,
} from "./builders.ts";
import { createAnalyticCollection, type AnalyticEnvelope } from "./contracts.ts";
import {
  REPLAY_DESCRIPTIVE_ANALYTICS_VERSION,
  REPLAY_DESCRIPTIVE_SCHEMA_VERSION,
  REPLAY_DESCRIPTIVE_WINDOWS_MINUTES,
  REPLAY_RECENT_MOVER_WINDOW_MINUTES,
  type CreateReplayDescriptiveAnalyticsInput,
  type FingerprintedReplayDescriptiveAnalytics,
  type ReplayChronologyStatus,
  type ReplayDescriptiveAnalytics,
  type ReplayExplicitRatio,
  type ReplayJurisdictionProgress,
  type ReplayLocalMarginRow,
  type ReplayMathematicalOpenness,
  type ReplayMovement,
  type ReplayNewestReturn,
  type ReplayProgressDenominator,
  type ReplayRecentMoverRow,
  type ReplayWindowAnalytics,
  type ReplayWindowJurisdictionMovement,
} from "./replayDescriptiveContracts.ts";
import { ANALYTIC_REGISTRY_VERSION } from "./registry.ts";

const AUTHORIZED_EVENT_TYPES = new Set(["POLL_CLOSE", "RETURN_PUBLISHED", "REPLAY_COMPLETED"]);

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireText(value: string, label: string) {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) throw new Error(`${label} must be nonempty`);
  return normalized;
}

function requireSafeInteger(value: number, label: string, nonnegative = false) {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) {
    throw new Error(`${label} must be ${nonnegative ? "a non-negative " : "a "}safe integer`);
  }
  return value;
}

function candidateIds(observable: ReplayObservableState) {
  const ids = observable.national.candidateVotes.map((candidate) => requireText(
    candidate.candidateId,
    "Candidate identity",
  ));
  if (ids.length !== 5 || new Set(ids).size !== ids.length) {
    throw new Error("Replay descriptive analytics require five unique candidates");
  }
  if (!ids.includes("harris") || !ids.includes("trump")) {
    throw new Error("Replay descriptive analytics require Harris and Trump candidates");
  }
  return Object.freeze(ids);
}

function zeroVector(ids: readonly string[]): CandidateVoteVector {
  return Object.freeze(ids.map((candidateId) => Object.freeze({ candidateId, votes: 0 })));
}

function vectorTotal(vector: CandidateVoteVector, ids: readonly string[], label: string) {
  if (vector.length !== ids.length
    || vector.some((candidate, index) => candidate.candidateId !== ids[index])) {
    throw new Error(`${label} does not preserve the canonical candidate vector`);
  }
  return vector.reduce((sum, candidate) => {
    const next = sum + requireSafeInteger(candidate.votes, `${label} ${candidate.candidateId}`, true);
    if (!Number.isSafeInteger(next)) throw new Error(`${label} overflowed`);
    return next;
  }, 0);
}

function addVector(
  current: CandidateVoteVector,
  delta: CandidateVoteVector,
  ids: readonly string[],
  label: string,
) {
  vectorTotal(current, ids, `${label} current`);
  vectorTotal(delta, ids, `${label} delta`);
  return Object.freeze(current.map((candidate, index) => {
    const votes = candidate.votes + delta[index].votes;
    if (!Number.isSafeInteger(votes) || votes < 0) throw new Error(`${label} overflowed`);
    return Object.freeze({ candidateId: candidate.candidateId, votes });
  }));
}

function vectorsEqual(left: CandidateVoteVector, right: CandidateVoteVector) {
  return left.length === right.length && left.every((candidate, index) => (
    candidate.candidateId === right[index]?.candidateId && candidate.votes === right[index]?.votes
  ));
}

function margin(vector: CandidateVoteVector) {
  const harris = vector.find((candidate) => candidate.candidateId === "harris")?.votes ?? 0;
  const trump = vector.find((candidate) => candidate.candidateId === "trump")?.votes ?? 0;
  return harris - trump;
}

function flattenUnits(observable: ReplayObservableState) {
  return observable.reportedByUnit.buckets.flatMap((bucket) => Object.values(bucket));
}

interface ObservedPrefixAudit {
  ids: readonly string[];
  returnEvents: readonly ComposedReplayEvent[];
  pollCloseByJurisdiction: ReadonlyMap<string, number>;
  lastReturnByJurisdiction: ReadonlyMap<string, number>;
}

function validateObservedPrefix(input: CreateReplayDescriptiveAnalyticsInput): ObservedPrefixAudit {
  const { observable, observedEvents } = input;
  requireSafeInteger(input.logicalReplayTimeMs, "Logical replay time");
  requireSafeInteger(input.replayStartTimeMs, "Replay start time");
  if (input.logicalReplayTimeMs < input.replayStartTimeMs) {
    throw new Error("Logical replay time cannot precede replay start");
  }
  if (observedEvents.length !== observable.position.eventsApplied) {
    throw new Error("Observed event prefix does not match reducer position");
  }
  const ids = candidateIds(observable);
  const returnEvents: ComposedReplayEvent[] = [];
  const eventIds = new Set<string>();
  const pollCloseByJurisdiction = new Map<string, number>();
  const lastReturnByJurisdiction = new Map<string, number>();
  let nationalVector = zeroVector(ids);
  let nationalTotal = 0;
  const jurisdictionVectors = new Map<string, CandidateVoteVector>();
  const jurisdictionTotals = new Map<string, number>();
  const jurisdictionReturns = new Map<string, number>();
  const mappedVectors = new Map<string, CandidateVoteVector>();
  const mappedTotals = new Map<string, number>();
  const offMapVectors = new Map<string, CandidateVoteVector>();
  const offMapTotals = new Map<string, number>();
  const countyVectors = new Map<string, CandidateVoteVector>();
  const countyTotals = new Map<string, number>();
  const countyReturns = new Map<string, number>();
  const unitEvents = new Map<string, ComposedReplayEvent>();
  const completed = new Set<string>();
  let previousTime = Number.MIN_SAFE_INTEGER;

  for (let index = 0; index < observedEvents.length; index += 1) {
    const event = observedEvents[index];
    if (event.sequence !== index) throw new Error("Observed event prefix sequence is not canonical");
    if (eventIds.has(event.eventId)) throw new Error("Observed event prefix duplicates an event identity");
    eventIds.add(requireText(event.eventId, "Observed event identity"));
    if (!AUTHORIZED_EVENT_TYPES.has(event.eventType)) {
      throw new Error(`Observed event prefix contains unauthorized ${event.eventType}`);
    }
    requireSafeInteger(event.absoluteReplayTimeMs, "Observed event time");
    if (event.absoluteReplayTimeMs < previousTime
      || event.absoluteReplayTimeMs < input.replayStartTimeMs
      || event.absoluteReplayTimeMs > input.logicalReplayTimeMs) {
      throw new Error("Observed event prefix time is outside the observable interval");
    }
    previousTime = event.absoluteReplayTimeMs;
    const jurisdictionId = requireText(event.jurisdictionId, "Observed jurisdiction identity");
    if (!observable.reportedByJurisdiction[jurisdictionId]) {
      throw new Error(`Observed event prefix contains unknown jurisdiction ${jurisdictionId}`);
    }
    if (event.eventType === "RETURN_PUBLISHED") {
      if (!pollCloseByJurisdiction.has(jurisdictionId) || completed.has(jurisdictionId)) {
        throw new Error(`${jurisdictionId} observed return violates lifecycle order`);
      }
      if (!event.candidateDelta) throw new Error("Observed return is missing its candidate vector");
      const total = vectorTotal(event.candidateDelta, ids, "Observed return");
      if (total !== event.totalDelta) throw new Error("Observed return total does not reconcile");
      nationalVector = addVector(nationalVector, event.candidateDelta, ids, "Observed national prefix");
      nationalTotal += total;
      if (!Number.isSafeInteger(nationalTotal)) throw new Error("Observed national total overflowed");
      const current = jurisdictionVectors.get(jurisdictionId) ?? zeroVector(ids);
      jurisdictionVectors.set(
        jurisdictionId,
        addVector(current, event.candidateDelta, ids, `${jurisdictionId} observed prefix`),
      );
      jurisdictionTotals.set(jurisdictionId, (jurisdictionTotals.get(jurisdictionId) ?? 0) + total);
      jurisdictionReturns.set(jurisdictionId, (jurisdictionReturns.get(jurisdictionId) ?? 0) + 1);
      if (event.geometryStatus === "mapped" || event.geometryStatus === "off-map") {
        const vectors = event.geometryStatus === "mapped" ? mappedVectors : offMapVectors;
        const totals = event.geometryStatus === "mapped" ? mappedTotals : offMapTotals;
        vectors.set(
          jurisdictionId,
          addVector(
            vectors.get(jurisdictionId) ?? zeroVector(ids),
            event.candidateDelta,
            ids,
            `${jurisdictionId} ${event.geometryStatus} observed prefix`,
          ),
        );
        totals.set(jurisdictionId, (totals.get(jurisdictionId) ?? 0) + total);
      }
      if (event.countyId !== null) {
        const key = `${jurisdictionId}\u0000${event.countyId}`;
        countyVectors.set(
          key,
          addVector(
            countyVectors.get(key) ?? zeroVector(ids),
            event.candidateDelta,
            ids,
            `${jurisdictionId}/${event.countyId} observed prefix`,
          ),
        );
        countyTotals.set(key, (countyTotals.get(key) ?? 0) + total);
        countyReturns.set(key, (countyReturns.get(key) ?? 0) + 1);
      }
      if (event.unitId !== null) {
        const key = `${jurisdictionId}\u0000${event.unitId}`;
        if (unitEvents.has(key)) throw new Error(`Observed return duplicates unit ${jurisdictionId}/${event.unitId}`);
        unitEvents.set(key, event);
      }
      lastReturnByJurisdiction.set(jurisdictionId, event.absoluteReplayTimeMs);
      returnEvents.push(event);
    } else {
      if (event.candidateDelta !== null || event.totalDelta !== 0) {
        throw new Error("Observed control event cannot contain votes");
      }
      if (event.eventType === "POLL_CLOSE") {
        if (pollCloseByJurisdiction.has(jurisdictionId)) throw new Error("Jurisdiction poll close is duplicated");
        pollCloseByJurisdiction.set(jurisdictionId, event.absoluteReplayTimeMs);
      }
      if (event.eventType === "REPLAY_COMPLETED") {
        if (!pollCloseByJurisdiction.has(jurisdictionId) || completed.has(jurisdictionId)) {
          throw new Error(`${jurisdictionId} observed completion violates lifecycle order`);
        }
        completed.add(jurisdictionId);
      }
    }
  }
  if (observedEvents.length === 0) {
    if (observable.position.lastAppliedSequence !== null
      || observable.position.lastAppliedEventId !== null
      || observable.position.absoluteReplayTimeMs !== null) {
      throw new Error("Zero observed prefix has a nonzero reducer position");
    }
  } else {
    const last = observedEvents.at(-1)!;
    if (observable.position.lastAppliedSequence !== last.sequence
      || observable.position.lastAppliedEventId !== last.eventId
      || observable.position.absoluteReplayTimeMs !== last.absoluteReplayTimeMs) {
      throw new Error("Observed prefix endpoint does not match reducer position");
    }
  }
  if (!vectorsEqual(nationalVector, observable.national.candidateVotes)
    || nationalTotal !== observable.national.totalVotes
    || returnEvents.length !== observable.national.returnsPublished) {
    throw new Error("Observed return prefix does not reconcile to national reducer state");
  }
  for (const [jurisdictionId, state] of Object.entries(observable.reportedByJurisdiction)) {
    const expectedVector = jurisdictionVectors.get(jurisdictionId) ?? zeroVector(ids);
    if (!vectorsEqual(expectedVector, state.candidateVotes)
      || (jurisdictionTotals.get(jurisdictionId) ?? 0) !== state.totalVotes
      || (jurisdictionReturns.get(jurisdictionId) ?? 0) !== state.returnsPublished
      || state.pollClosed !== pollCloseByJurisdiction.has(jurisdictionId)
      || state.completed !== completed.has(jurisdictionId)
      || !vectorsEqual(mappedVectors.get(jurisdictionId) ?? zeroVector(ids), state.mappedCandidateVotes)
      || (mappedTotals.get(jurisdictionId) ?? 0) !== state.mappedTotalVotes
      || !vectorsEqual(offMapVectors.get(jurisdictionId) ?? zeroVector(ids), state.offMapCandidateVotes)
      || (offMapTotals.get(jurisdictionId) ?? 0) !== state.offMapTotalVotes) {
      throw new Error(`${jurisdictionId} observed prefix does not reconcile to reducer state`);
    }
  }
  const observedCountyKeys = new Set<string>();
  for (const state of Object.values(observable.reportedByCounty)) {
    const key = `${state.jurisdictionId}\u0000${state.countyId}`;
    if (observedCountyKeys.has(key)) throw new Error(`Reducer state duplicates county ${key}`);
    observedCountyKeys.add(key);
    if (!vectorsEqual(countyVectors.get(key) ?? zeroVector(ids), state.candidateVotes)
      || (countyTotals.get(key) ?? 0) !== state.totalVotes
      || (countyReturns.get(key) ?? 0) !== state.returnsPublished) {
      throw new Error(`${state.jurisdictionId}/${state.countyId} observed prefix does not reconcile`);
    }
  }
  for (const key of countyVectors.keys()) {
    if (!observedCountyKeys.has(key)) throw new Error(`Observed county return ${key} is absent from reducer state`);
  }
  const observedUnitKeys = new Set<string>();
  for (const state of flattenUnits(observable)) {
    const key = `${state.jurisdictionId}\u0000${state.unitId}`;
    if (observedUnitKeys.has(key)) throw new Error(`Reducer state duplicates unit ${key}`);
    observedUnitKeys.add(key);
    const event = unitEvents.get(key);
    if (!event?.candidateDelta
      || !vectorsEqual(event.candidateDelta, state.candidateVotes)
      || event.totalDelta !== state.totalVotes
      || state.returnsPublished !== 1
      || event.countyId !== state.countyId
      || event.unitType !== state.unitType
      || event.geometryStatus !== state.geometryStatus) {
      throw new Error(`${state.jurisdictionId}/${state.unitId} observed prefix does not reconcile`);
    }
  }
  for (const key of unitEvents.keys()) {
    if (!observedUnitKeys.has(key)) throw new Error(`Observed unit return ${key} is absent from reducer state`);
  }
  if (observable.jurisdictionsCompleted !== completed.size) {
    throw new Error("Observed completions do not reconcile to reducer state");
  }
  if (observable.complete && completed.size !== Object.keys(observable.reportedByJurisdiction).length) {
    throw new Error("Complete reducer state has incomplete jurisdictions");
  }
  return deepFreeze({ ids, returnEvents, pollCloseByJurisdiction, lastReturnByJurisdiction });
}

function movement(events: readonly ComposedReplayEvent[], ids: readonly string[]): ReplayMovement {
  let candidateVotes = zeroVector(ids);
  let ballotsPublished = 0;
  for (const event of events) {
    if (!event.candidateDelta) throw new Error("Movement input contains a non-return event");
    candidateVotes = addVector(candidateVotes, event.candidateDelta, ids, "Replay movement");
    ballotsPublished += event.totalDelta;
    if (!Number.isSafeInteger(ballotsPublished)) throw new Error("Replay movement overflowed");
  }
  return deepFreeze({
    candidateVotes,
    ballotsPublished,
    returnsPublished: events.length,
    signedHarrisMinusTrumpMovement: margin(candidateVotes),
  });
}

function scaledRate(count: number, durationMs: number, targetDurationMs: number) {
  if (durationMs === 0) return null;
  const numerator = BigInt(count) * BigInt(targetDurationMs) * 1_000n;
  const denominator = BigInt(durationMs);
  const rounded = Number((numerator * 2n + denominator) / (denominator * 2n));
  requireSafeInteger(rounded, "Replay publication rate", true);
  return rounded;
}

function buildWindows(
  input: CreateReplayDescriptiveAnalyticsInput,
  audit: ObservedPrefixAudit,
  jurisdictionIds: readonly string[],
): readonly ReplayWindowAnalytics[] {
  return Object.freeze(REPLAY_DESCRIPTIVE_WINDOWS_MINUTES.map((windowMinutes) => {
    const windowMs = windowMinutes * 60_000;
    const startExclusiveMs = input.logicalReplayTimeMs - windowMs;
    const events = audit.returnEvents.filter((event) => (
      event.absoluteReplayTimeMs > startExclusiveMs
      && event.absoluteReplayTimeMs <= input.logicalReplayTimeMs
    ));
    const national = movement(events, audit.ids);
    const jurisdictions = Object.freeze(jurisdictionIds.map((jurisdictionId): ReplayWindowJurisdictionMovement => ({
      jurisdictionId,
      ...movement(events.filter((event) => event.jurisdictionId === jurisdictionId), audit.ids),
    })));
    const observedDurationMs = Math.min(
      windowMs,
      input.logicalReplayTimeMs - input.replayStartTimeMs,
    );
    return deepFreeze({
      windowMinutes,
      startExclusiveMs,
      endInclusiveMs: input.logicalReplayTimeMs,
      observedDurationMs,
      national,
      jurisdictions,
      returnsPerHourMilli: scaledRate(national.returnsPublished, observedDurationMs, 3_600_000),
      ballotsPerMinuteMilli: scaledRate(national.ballotsPublished, observedDurationMs, 60_000),
    });
  }));
}

function explicitRatio(numerator: number, denominator: number, label: string): ReplayExplicitRatio {
  requireSafeInteger(numerator, `${label} numerator`, true);
  requireSafeInteger(denominator, `${label} denominator`, true);
  if (denominator <= 0 || numerator > denominator) {
    throw new Error(`${label} requires a positive denominator bounding the current prefix`);
  }
  const scaledNumerator = BigInt(numerator) * 1_000_000n;
  const scaledDenominator = BigInt(denominator);
  return deepFreeze({
    numerator,
    denominator,
    partsPerMillion: Number(
      (scaledNumerator * 2n + scaledDenominator) / (scaledDenominator * 2n),
    ),
  });
}

function denominatorMap(
  input: CreateReplayDescriptiveAnalyticsInput,
  jurisdictionIds: readonly string[],
) {
  const map = new Map<string, ReplayProgressDenominator>();
  for (const denominator of input.denominators) {
    const jurisdictionId = requireText(denominator.jurisdictionId, "Progress jurisdiction identity");
    if (map.has(jurisdictionId)) throw new Error(`Duplicate progress denominator ${jurisdictionId}`);
    if (!jurisdictionIds.includes(jurisdictionId)) {
      throw new Error(`Progress denominator contains unknown jurisdiction ${jurisdictionId}`);
    }
    if (denominator.expectedReturns !== null) {
      requireSafeInteger(denominator.expectedReturns, `${jurisdictionId} expected returns`, true);
      if (denominator.expectedReturns === 0) throw new Error("Expected return count must be positive");
    }
    if (denominator.modeledBallots !== null) {
      requireSafeInteger(denominator.modeledBallots, `${jurisdictionId} modeled ballots`, true);
      if (denominator.modeledBallots === 0) throw new Error("Modeled ballot denominator must be positive");
    }
    map.set(jurisdictionId, deepFreeze({ ...denominator, jurisdictionId }));
  }
  if (map.size !== jurisdictionIds.length) {
    throw new Error("Progress denominators must cover every observable jurisdiction");
  }
  return map;
}

function buildProgress(
  observable: ReplayObservableState,
  jurisdictionIds: readonly string[],
  denominators: ReadonlyMap<string, ReplayProgressDenominator>,
): readonly ReplayJurisdictionProgress[] {
  return Object.freeze(jurisdictionIds.map((jurisdictionId) => {
    const state = observable.reportedByJurisdiction[jurisdictionId];
    const denominator = denominators.get(jurisdictionId)!;
    if (state.completed
      && ((denominator.expectedReturns !== null && denominator.expectedReturns !== state.returnsPublished)
        || (denominator.modeledBallots !== null && denominator.modeledBallots !== state.totalVotes))) {
      throw new Error(`${jurisdictionId} completed state does not equal its progress denominators`);
    }
    return deepFreeze({
      jurisdictionId,
      returns: denominator.expectedReturns === null
        ? null
        : explicitRatio(state.returnsPublished, denominator.expectedReturns, `${jurisdictionId} return progress`),
      representedBallots: denominator.modeledBallots === null
        ? null
        : explicitRatio(state.totalVotes, denominator.modeledBallots, `${jurisdictionId} ballot progress`),
    });
  }));
}

function buildOpenness(
  observable: ReplayObservableState,
  jurisdictionIds: readonly string[],
  denominators: ReadonlyMap<string, ReplayProgressDenominator>,
): readonly ReplayMathematicalOpenness[] {
  return Object.freeze(jurisdictionIds.map((jurisdictionId): ReplayMathematicalOpenness => {
    const state = observable.reportedByJurisdiction[jurisdictionId];
    const modeledBallots = denominators.get(jurisdictionId)!.modeledBallots;
    const signedMargin = margin(state.candidateVotes);
    const currentLeader = state.totalVotes === 0
      ? null
      : signedMargin > 0 ? "harris" : signedMargin < 0 ? "trump" : "tie";
    if (modeledBallots === null) {
      return deepFreeze({
        jurisdictionId,
        status: "unavailable",
        currentLeader,
        signedHarrisMinusTrumpMargin: signedMargin,
        modeledOutstandingBallots: null,
        votesRequiredToOvertake: null,
        surplusOrShortfallBallots: null,
      });
    }
    if (state.totalVotes > modeledBallots) throw new Error(`${jurisdictionId} over-reports modeled ballots`);
    const outstanding = modeledBallots - state.totalVotes;
    if (state.totalVotes === 0) {
      return deepFreeze({
        jurisdictionId,
        status: "no-returns",
        currentLeader,
        signedHarrisMinusTrumpMargin: signedMargin,
        modeledOutstandingBallots: outstanding,
        votesRequiredToOvertake: null,
        surplusOrShortfallBallots: null,
      });
    }
    if (state.completed || outstanding === 0) {
      return deepFreeze({
        jurisdictionId,
        status: "complete",
        currentLeader,
        signedHarrisMinusTrumpMargin: signedMargin,
        modeledOutstandingBallots: outstanding,
        votesRequiredToOvertake: 0,
        surplusOrShortfallBallots: 0,
      });
    }
    const required = Math.abs(signedMargin) + 1;
    const surplus = outstanding - required;
    return deepFreeze({
      jurisdictionId,
      status: surplus >= 0 ? "open" : "exhausted",
      currentLeader,
      signedHarrisMinusTrumpMargin: signedMargin,
      modeledOutstandingBallots: outstanding,
      votesRequiredToOvertake: required,
      surplusOrShortfallBallots: surplus,
    });
  }));
}

function buildChronology(
  input: CreateReplayDescriptiveAnalyticsInput,
  audit: ObservedPrefixAudit,
  jurisdictionIds: readonly string[],
): readonly ReplayChronologyStatus[] {
  return Object.freeze(jurisdictionIds.map((jurisdictionId): ReplayChronologyStatus => {
    const state = input.observable.reportedByJurisdiction[jurisdictionId];
    const pollCloseTimeMs = audit.pollCloseByJurisdiction.get(jurisdictionId) ?? null;
    const lastReturnTimeMs = audit.lastReturnByJurisdiction.get(jurisdictionId) ?? null;
    const phase = state.completed
      ? "complete"
      : pollCloseTimeMs === null
        ? "not-open"
        : lastReturnTimeMs === null
          ? "awaiting-first-return"
          : "counting";
    const activityTime = lastReturnTimeMs ?? pollCloseTimeMs;
    const elapsedSinceActivityMs = activityTime === null
      ? null
      : input.logicalReplayTimeMs - activityTime;
    const stalled = (phase === "awaiting-first-return" || phase === "counting")
      && elapsedSinceActivityMs !== null
      && elapsedSinceActivityMs >= input.stallThresholdMs;
    return deepFreeze({
      jurisdictionId,
      phase,
      pollCloseTimeMs,
      lastReturnTimeMs,
      elapsedSinceActivityMs,
      stallThresholdMs: input.stallThresholdMs,
      stalled,
    });
  }));
}

function localMargin(
  jurisdictionId: string,
  geographyLevel: ReplayLocalMarginRow["geographyLevel"],
  geographyId: string,
  countyId: string | null,
  aggregate: Pick<ReportedAggregateState, "candidateVotes" | "totalVotes">,
): ReplayLocalMarginRow {
  return deepFreeze({
    jurisdictionId,
    geographyLevel,
    geographyId,
    countyId,
    totalReportedVotes: aggregate.totalVotes,
    signedHarrisMinusTrumpMargin: margin(aggregate.candidateVotes),
  });
}

function rankLocalMargins(rows: readonly ReplayLocalMarginRow[], limit: number) {
  return Object.freeze([...rows].sort((left, right) => (
    Math.abs(right.signedHarrisMinusTrumpMargin) - Math.abs(left.signedHarrisMinusTrumpMargin)
    || right.signedHarrisMinusTrumpMargin - left.signedHarrisMinusTrumpMargin
    || canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
    || canonicalStringCompare(left.geographyId, right.geographyId)
  )).slice(0, limit));
}

function buildLocalMargins(observable: ReplayObservableState, limit: number) {
  const counties = Object.values(observable.reportedByCounty)
    .filter((county) => county.returnsPublished > 0)
    .map((county) => localMargin(
      county.jurisdictionId,
      "county",
      county.countyId,
      county.countyId,
      county,
    ));
  const units = flattenUnits(observable).map((unit: ReportedUnitState) => localMargin(
    unit.jurisdictionId,
    "reporting-unit",
    unit.unitId,
    unit.countyId,
    unit,
  ));
  return {
    counties: rankLocalMargins(counties, limit),
    units: rankLocalMargins(units, limit),
  };
}

function recentMoverRows(
  events: readonly ComposedReplayEvent[],
  level: "county" | "reporting-unit",
  ids: readonly string[],
  limit: number,
) {
  const grouped = new Map<string, {
    jurisdictionId: string;
    geographyId: string;
    countyId: string | null;
    events: ComposedReplayEvent[];
  }>();
  for (const event of events) {
    const geographyId = level === "county" ? event.countyId : event.unitId;
    if (!geographyId) continue;
    const key = `${event.jurisdictionId.length}:${event.jurisdictionId}${geographyId}`;
    const group = grouped.get(key) ?? {
      jurisdictionId: event.jurisdictionId,
      geographyId,
      countyId: event.countyId,
      events: [],
    };
    group.events.push(event);
    grouped.set(key, group);
  }
  const rows = [...grouped.values()].map((group): ReplayRecentMoverRow => {
    const aggregate = movement(group.events, ids);
    return deepFreeze({
      jurisdictionId: group.jurisdictionId,
      geographyLevel: level,
      geographyId: group.geographyId,
      countyId: group.countyId,
      returnsPublished: aggregate.returnsPublished,
      ballotsPublished: aggregate.ballotsPublished,
      signedHarrisMinusTrumpMovement: aggregate.signedHarrisMinusTrumpMovement,
    });
  });
  return Object.freeze(rows.sort((left, right) => (
    Math.abs(right.signedHarrisMinusTrumpMovement) - Math.abs(left.signedHarrisMinusTrumpMovement)
    || right.signedHarrisMinusTrumpMovement - left.signedHarrisMinusTrumpMovement
    || canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
    || canonicalStringCompare(left.geographyId, right.geographyId)
  )).slice(0, limit));
}

function newestReturn(events: readonly ComposedReplayEvent[]): ReplayNewestReturn | null {
  const event = events.at(-1);
  if (!event) return null;
  if (!event.candidateDelta) throw new Error("Newest observed return is missing votes");
  return deepFreeze({
    eventId: event.eventId,
    sequence: event.sequence,
    absoluteReplayTimeMs: event.absoluteReplayTimeMs,
    jurisdictionId: event.jurisdictionId,
    countyId: event.countyId,
    unitId: event.unitId,
    candidateVotes: Object.freeze(event.candidateDelta.map((candidate) => Object.freeze({ ...candidate }))),
    totalVotes: event.totalDelta,
    signedHarrisMinusTrumpMovement: margin(event.candidateDelta),
  });
}

function buildAnalyticCollection(
  input: CreateReplayDescriptiveAnalyticsInput,
  jurisdictionIds: readonly string[],
  denominators: ReadonlyMap<string, ReplayProgressDenominator>,
) {
  const analytics: AnalyticEnvelope[] = [];
  const context = {
    sourceIds: input.sourceIds,
    transformVersion: REPLAY_DESCRIPTIVE_ANALYTICS_VERSION,
  } as const;
  analytics.push(...buildReportedAnalyticEnvelopes(
    deriveReportedVoteAnalytics(input.observable.national),
    { level: "national", id: "US" },
    context,
  ));
  for (const jurisdictionId of jurisdictionIds) {
    const state = input.observable.reportedByJurisdiction[jurisdictionId];
    const denominator = denominators.get(jurisdictionId)!;
    analytics.push(
      ...buildReportedAnalyticEnvelopes(
        deriveReportedVoteAnalytics(state),
        { level: "state", id: jurisdictionId },
        context,
      ),
      ...buildProgressAnalyticEnvelopes(
        { totalReportedVotes: state.totalVotes, returnsPublished: state.returnsPublished },
        { returns: denominator.expectedReturns, ballots: denominator.modeledBallots },
        { level: "state", id: jurisdictionId },
        context,
      ),
    );
  }
  const denominatorValues = [...denominators.values()];
  const nationalExpectedReturns = denominatorValues.every((entry) => entry.expectedReturns !== null)
    ? denominatorValues.reduce((sum, entry) => sum + entry.expectedReturns!, 0)
    : null;
  const nationalModeledBallots = denominatorValues.every((entry) => entry.modeledBallots !== null)
    ? denominatorValues.reduce((sum, entry) => sum + entry.modeledBallots!, 0)
    : null;
  analytics.push(...buildProgressAnalyticEnvelopes(
    {
      totalReportedVotes: input.observable.national.totalVotes,
      returnsPublished: input.observable.national.returnsPublished,
    },
    { returns: nationalExpectedReturns, ballots: nationalModeledBallots },
    { level: "national", id: "US" },
    context,
  ));
  return createAnalyticCollection(analytics);
}

export function deriveReplayDescriptiveAnalytics(
  input: CreateReplayDescriptiveAnalyticsInput,
): ReplayDescriptiveAnalytics {
  requireSafeInteger(input.stallThresholdMs, "Stall threshold", true);
  if (input.stallThresholdMs === 0) throw new Error("Stall threshold must be positive");
  const rankingLimit = input.rankingLimit ?? 10;
  requireSafeInteger(rankingLimit, "Ranking limit", true);
  if (rankingLimit < 1 || rankingLimit > 100) throw new Error("Ranking limit must be between one and 100");
  const sourceIds = Object.freeze(input.sourceIds
    .map((source) => requireText(source, "Replay analytic source identity"))
    .sort(canonicalStringCompare));
  if (sourceIds.length === 0 || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Replay analytic source identities must be nonempty and unique");
  }
  const normalizedInput = { ...input, sourceIds, rankingLimit };
  const audit = validateObservedPrefix(normalizedInput);
  const jurisdictionIds = Object.freeze(
    Object.keys(input.observable.reportedByJurisdiction).sort(canonicalStringCompare),
  );
  const denominators = denominatorMap(normalizedInput, jurisdictionIds);
  const windows = buildWindows(normalizedInput, audit, jurisdictionIds);
  const recentStart = input.logicalReplayTimeMs - REPLAY_RECENT_MOVER_WINDOW_MINUTES * 60_000;
  const recentEvents = audit.returnEvents.filter((event) => (
    event.absoluteReplayTimeMs > recentStart && event.absoluteReplayTimeMs <= input.logicalReplayTimeMs
  ));
  const localMargins = buildLocalMargins(input.observable, rankingLimit);
  return deepFreeze({
    schemaVersion: REPLAY_DESCRIPTIVE_SCHEMA_VERSION,
    analyticsVersion: REPLAY_DESCRIPTIVE_ANALYTICS_VERSION,
    registryVersion: ANALYTIC_REGISTRY_VERSION,
    sourceIds,
    logicalReplayTimeMs: input.logicalReplayTimeMs,
    replayStartTimeMs: input.replayStartTimeMs,
    observedEventCount: input.observedEvents.length,
    observedReturnCount: audit.returnEvents.length,
    stallThresholdMs: input.stallThresholdMs,
    newestReturn: newestReturn(audit.returnEvents),
    windows,
    progress: buildProgress(input.observable, jurisdictionIds, denominators),
    mathematicalOpenness: buildOpenness(input.observable, jurisdictionIds, denominators),
    chronology: buildChronology(normalizedInput, audit, jurisdictionIds),
    largestCurrentCountyMargins: localMargins.counties,
    largestCurrentUnitMargins: localMargins.units,
    recentCountyMovers: recentMoverRows(recentEvents, "county", audit.ids, rankingLimit),
    recentUnitMovers: recentMoverRows(recentEvents, "reporting-unit", audit.ids, rankingLimit),
    analytics: buildAnalyticCollection(normalizedInput, jurisdictionIds, denominators),
  });
}

export function serializeReplayDescriptiveAnalytics(analytics: ReplayDescriptiveAnalytics) {
  return canonicalSerialize(analytics as unknown as CanonicalValue);
}

export async function fingerprintReplayDescriptiveAnalytics(
  analytics: ReplayDescriptiveAnalytics,
): Promise<FingerprintedReplayDescriptiveAnalytics> {
  return deepFreeze({
    analytics,
    fingerprint: await sha256Fingerprint(serializeReplayDescriptiveAnalytics(analytics)),
  });
}

export function serializeFingerprintedReplayDescriptiveAnalytics(
  value: FingerprintedReplayDescriptiveAnalytics,
) {
  return canonicalSerialize(value as unknown as CanonicalValue);
}

export async function deserializeFingerprintedReplayDescriptiveAnalytics(
  serialized: string,
  input: CreateReplayDescriptiveAnalyticsInput,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Replay descriptive analytics are not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Replay descriptive analytics are malformed");
  const candidate = parsed as FingerprintedReplayDescriptiveAnalytics;
  if (!isSha256Fingerprint(candidate.fingerprint)) {
    throw new Error("Replay descriptive analytics fingerprint is invalid");
  }
  const expected = await fingerprintReplayDescriptiveAnalytics(deriveReplayDescriptiveAnalytics(input));
  if (canonicalSerialize(candidate as unknown as CanonicalValue)
    !== canonicalSerialize(expected as unknown as CanonicalValue)) {
    throw new Error("Replay descriptive analytics do not match the current observed prefix");
  }
  return expected;
}
