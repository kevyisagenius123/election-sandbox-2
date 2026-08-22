import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import type { CandidateVoteVector } from "./contracts.ts";
import { sha256Fingerprint } from "./hash.ts";
import {
  validateReplayPlaybackCursor,
  type ReplayPlaybackCursor,
  type ReplayPlaybackStatus,
} from "./playbackCursor.ts";
import {
  REPORTED_ANALYTICS_VERSION,
  deriveJurisdictionReportedAnalytics,
  deriveNationalReportedAnalytics,
  type JurisdictionReportedAnalytics,
  type ReportedVoteAnalytics,
} from "./reportedAnalytics.ts";
import type {
  ReplayObservableState,
  ReplayReducerContext,
  ReportedCountyState,
  ReportedUnitState,
} from "./reducer.ts";

export const PLAYBACK_OBSERVATION_SCHEMA_VERSION = "rme-playback-observation-v1" as const;
export const PLAYBACK_OBSERVATION_VERSION = "rme-headless-sanitized-observation-v1" as const;

export interface SanitizedControllerObservation {
  status: ReplayPlaybackStatus;
  logicalReplayTimeMs: number;
  appliedEventCount: number;
}

export interface SanitizedReportedCounty {
  jurisdictionId: string;
  countyId: string;
  candidateVotes: CandidateVoteVector;
  totalReportedVotes: number;
  returnsPublished: number;
}

export interface SanitizedPublishedUnit {
  jurisdictionId: string;
  unitId: string;
  countyId: string | null;
  unitType: ReportedUnitState["unitType"];
  geometryStatus: ReportedUnitState["geometryStatus"];
  candidateVotes: CandidateVoteVector;
  totalReportedVotes: number;
}

export interface SanitizedElectionObservation {
  analyticsVersion: typeof REPORTED_ANALYTICS_VERSION;
  national: ReportedVoteAnalytics;
  jurisdictions: readonly JurisdictionReportedAnalytics[];
  reportedCounties: readonly SanitizedReportedCounty[];
  publishedUnits: readonly SanitizedPublishedUnit[];
  jurisdictionsCompleted: number;
  complete: boolean;
}

export interface SanitizedPlaybackSnapshot {
  schemaVersion: typeof PLAYBACK_OBSERVATION_SCHEMA_VERSION;
  observationVersion: typeof PLAYBACK_OBSERVATION_VERSION;
  controller: SanitizedControllerObservation;
  election: SanitizedElectionObservation;
}

/**
 * The small current-state snapshot used between full synchronization
 * snapshots. It deliberately excludes county and reporting-unit rows.
 */
export interface SanitizedPlaybackHeadline {
  schemaVersion: typeof PLAYBACK_OBSERVATION_SCHEMA_VERSION;
  observationVersion: typeof PLAYBACK_OBSERVATION_VERSION;
  controller: SanitizedControllerObservation;
  election: Readonly<Pick<SanitizedElectionObservation,
    "analyticsVersion" | "national" | "jurisdictions" | "jurisdictionsCompleted" | "complete"
  >>;
}

export interface NewlyObservedTimestampGroup {
  absoluteReplayTimeMs: number;
  firstAppliedEventCount: number;
  lastAppliedEventCount: number;
  changedJurisdictionIds: readonly string[];
}

export interface SanitizedPlaybackTransition {
  schemaVersion: typeof PLAYBACK_OBSERVATION_SCHEMA_VERSION;
  observationVersion: typeof PLAYBACK_OBSERVATION_VERSION;
  direction: "stationary" | "forward" | "backward";
  previousController: SanitizedControllerObservation;
  currentController: SanitizedControllerObservation;
  newlyObservedTimestampGroups: readonly NewlyObservedTimestampGroup[];
  changedJurisdictionIds: readonly string[];
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function copyCandidateVotes(candidateVotes: CandidateVoteVector) {
  return Object.freeze(candidateVotes.map((candidate) => Object.freeze({
    candidateId: candidate.candidateId,
    votes: candidate.votes,
  })));
}

function controllerObservation(cursor: ReplayPlaybackCursor): SanitizedControllerObservation {
  return Object.freeze({
    status: cursor.status,
    logicalReplayTimeMs: cursor.playheadAbsoluteTimeMs,
    appliedEventCount: cursor.eventsApplied,
  });
}

function reportedCounties(observable: ReplayObservableState) {
  return Object.values(observable.reportedByCounty)
    .filter((county) => county.returnsPublished > 0)
    .sort((left, right) => (
      canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
      || canonicalStringCompare(left.countyId, right.countyId)
    ))
    .map((county: ReportedCountyState): SanitizedReportedCounty => Object.freeze({
      jurisdictionId: county.jurisdictionId,
      countyId: county.countyId,
      candidateVotes: copyCandidateVotes(county.candidateVotes),
      totalReportedVotes: county.totalVotes,
      returnsPublished: county.returnsPublished,
    }));
}

function publishedUnits(observable: ReplayObservableState) {
  return observable.reportedByUnit.buckets
    .flatMap((bucket) => Object.values(bucket))
    .sort((left, right) => (
      canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
      || canonicalStringCompare(left.unitId, right.unitId)
    ))
    .map((unit): SanitizedPublishedUnit => Object.freeze({
      jurisdictionId: unit.jurisdictionId,
      unitId: unit.unitId,
      countyId: unit.countyId,
      unitType: unit.unitType,
      geometryStatus: unit.geometryStatus,
      candidateVotes: copyCandidateVotes(unit.candidateVotes),
      totalReportedVotes: unit.totalVotes,
    }));
}

function electionObservation(observable: ReplayObservableState): SanitizedElectionObservation {
  const jurisdictions = Object.keys(observable.reportedByJurisdiction)
    .sort(canonicalStringCompare)
    .map((jurisdictionId) => deriveJurisdictionReportedAnalytics(observable, jurisdictionId));
  return deepFreeze({
    analyticsVersion: REPORTED_ANALYTICS_VERSION,
    national: deriveNationalReportedAnalytics(observable),
    jurisdictions,
    reportedCounties: reportedCounties(observable),
    publishedUnits: publishedUnits(observable),
    jurisdictionsCompleted: observable.jurisdictionsCompleted,
    complete: observable.complete,
  });
}

export function createSanitizedPlaybackSnapshot(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
): SanitizedPlaybackSnapshot {
  validateReplayPlaybackCursor(context, cursor);
  return deepFreeze({
    schemaVersion: PLAYBACK_OBSERVATION_SCHEMA_VERSION,
    observationVersion: PLAYBACK_OBSERVATION_VERSION,
    controller: controllerObservation(cursor),
    election: electionObservation(cursor.reducerState.observable),
  });
}

export function createSanitizedPlaybackHeadline(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
): SanitizedPlaybackHeadline {
  validateReplayPlaybackCursor(context, cursor);
  const observable = cursor.reducerState.observable;
  const jurisdictions = Object.keys(observable.reportedByJurisdiction)
    .sort(canonicalStringCompare)
    .map((jurisdictionId) => deriveJurisdictionReportedAnalytics(observable, jurisdictionId));
  return deepFreeze({
    schemaVersion: PLAYBACK_OBSERVATION_SCHEMA_VERSION,
    observationVersion: PLAYBACK_OBSERVATION_VERSION,
    controller: controllerObservation(cursor),
    election: {
      analyticsVersion: REPORTED_ANALYTICS_VERSION,
      national: deriveNationalReportedAnalytics(observable),
      jurisdictions,
      jurisdictionsCompleted: observable.jurisdictionsCompleted,
      complete: observable.complete,
    },
  });
}

function jurisdictionChanged(
  previous: ReplayObservableState,
  current: ReplayObservableState,
  jurisdictionId: string,
) {
  return canonicalSerialize(
    previous.reportedByJurisdiction[jurisdictionId] as unknown as CanonicalValue,
  ) !== canonicalSerialize(
    current.reportedByJurisdiction[jurisdictionId] as unknown as CanonicalValue,
  );
}

function changedJurisdictionIds(
  previous: ReplayObservableState,
  current: ReplayObservableState,
) {
  return Object.keys(current.reportedByJurisdiction)
    .filter((jurisdictionId) => jurisdictionChanged(previous, current, jurisdictionId))
    .sort(canonicalStringCompare);
}

function newlyObservedTimestampGroups(
  context: ReplayReducerContext,
  previousEventCount: number,
  currentEventCount: number,
) {
  if (currentEventCount <= previousEventCount) return [];
  const groups: NewlyObservedTimestampGroup[] = [];
  let sequence = previousEventCount;
  while (sequence < currentEventCount) {
    const firstSequence = sequence;
    const absoluteReplayTimeMs = context.events[sequence].absoluteReplayTimeMs;
    const jurisdictionIds = new Set<string>();
    while (
      sequence < currentEventCount
      && context.events[sequence].absoluteReplayTimeMs === absoluteReplayTimeMs
    ) {
      jurisdictionIds.add(context.events[sequence].jurisdictionId);
      sequence += 1;
    }
    groups.push(Object.freeze({
      absoluteReplayTimeMs,
      firstAppliedEventCount: firstSequence + 1,
      lastAppliedEventCount: sequence,
      changedJurisdictionIds: Object.freeze([...jurisdictionIds].sort(canonicalStringCompare)),
    }));
  }
  return groups;
}

export function createSanitizedPlaybackTransition(
  context: ReplayReducerContext,
  previous: ReplayPlaybackCursor,
  current: ReplayPlaybackCursor,
): SanitizedPlaybackTransition {
  validateReplayPlaybackCursor(context, previous);
  validateReplayPlaybackCursor(context, current);
  const direction = current.playheadAbsoluteTimeMs === previous.playheadAbsoluteTimeMs
    ? "stationary"
    : current.playheadAbsoluteTimeMs > previous.playheadAbsoluteTimeMs
      ? "forward"
      : "backward";
  return deepFreeze({
    schemaVersion: PLAYBACK_OBSERVATION_SCHEMA_VERSION,
    observationVersion: PLAYBACK_OBSERVATION_VERSION,
    direction,
    previousController: controllerObservation(previous),
    currentController: controllerObservation(current),
    newlyObservedTimestampGroups: newlyObservedTimestampGroups(
      context,
      previous.eventsApplied,
      current.eventsApplied,
    ),
    changedJurisdictionIds: changedJurisdictionIds(
      previous.reducerState.observable,
      current.reducerState.observable,
    ),
  });
}

export function serializeSanitizedPlaybackSnapshot(snapshot: SanitizedPlaybackSnapshot) {
  return canonicalSerialize(snapshot as unknown as CanonicalValue);
}

export function serializeSanitizedPlaybackTransition(transition: SanitizedPlaybackTransition) {
  return canonicalSerialize(transition as unknown as CanonicalValue);
}

export async function sanitizedPlaybackSnapshotFingerprint(snapshot: SanitizedPlaybackSnapshot) {
  return sha256Fingerprint(serializeSanitizedPlaybackSnapshot(snapshot));
}

export async function sanitizedPlaybackTransitionFingerprint(
  transition: SanitizedPlaybackTransition,
) {
  return sha256Fingerprint(serializeSanitizedPlaybackTransition(transition));
}

export function deserializeSanitizedPlaybackSnapshot(
  serialized: string,
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Sanitized playback snapshot is not valid JSON");
  }
  const expected = createSanitizedPlaybackSnapshot(context, cursor);
  if (canonicalSerialize(parsed as CanonicalValue) !== serializeSanitizedPlaybackSnapshot(expected)) {
    throw new Error("Sanitized playback snapshot does not match current observable state");
  }
  return deepFreeze(parsed as SanitizedPlaybackSnapshot);
}

export function deserializeSanitizedPlaybackTransition(
  serialized: string,
  context: ReplayReducerContext,
  previous: ReplayPlaybackCursor,
  current: ReplayPlaybackCursor,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Sanitized playback transition is not valid JSON");
  }
  const expected = createSanitizedPlaybackTransition(context, previous, current);
  if (canonicalSerialize(parsed as CanonicalValue) !== serializeSanitizedPlaybackTransition(expected)) {
    throw new Error("Sanitized playback transition does not match observable cursor movement");
  }
  return deepFreeze(parsed as SanitizedPlaybackTransition);
}
