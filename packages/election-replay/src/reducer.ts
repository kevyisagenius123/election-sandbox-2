import {
  type CandidateVoteVector,
  type LockedElectionEndpoint,
  type LockedGeometryStatus,
  type LockedReportingUnitType,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import { sha256Fingerprint } from "./hash.ts";
import {
  auditCompiledNationalReplay,
  type CompiledNationalReplay,
} from "./nationalComposition.ts";
import type { ComposedReplayEvent } from "./jurisdictionComposition.ts";

export const REPLAY_REDUCER_SCHEMA_VERSION = "rme-reducer-state-v1" as const;
export const REPLAY_REDUCER_VERSION = "rme-headless-reducer-v1" as const;
export const REPLAY_UNIT_BUCKET_COUNT = 257 as const;

const AUTHORIZED_EVENT_TYPES = new Set([
  "POLL_CLOSE",
  "RETURN_PUBLISHED",
  "REPLAY_COMPLETED",
]);

export interface ReportedAggregateState {
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  returnsPublished: number;
}

export interface ReportedJurisdictionState extends ReportedAggregateState {
  jurisdictionId: string;
  pollClosed: boolean;
  completed: boolean;
  mappedCandidateVotes: CandidateVoteVector;
  mappedTotalVotes: number;
  offMapCandidateVotes: CandidateVoteVector;
  offMapTotalVotes: number;
}

export interface ReportedCountyState extends ReportedAggregateState {
  jurisdictionId: string;
  countyId: string;
}

export interface ReportedUnitState extends ReportedAggregateState {
  jurisdictionId: string;
  unitId: string;
  countyId: string | null;
  unitType: LockedReportingUnitType;
  geometryStatus: LockedGeometryStatus;
}

export interface SparseReportedUnitStore {
  bucketCount: typeof REPLAY_UNIT_BUCKET_COUNT;
  buckets: readonly Readonly<Record<string, ReportedUnitState>>[];
}

export interface ReplayReducerPosition {
  eventsApplied: number;
  lastAppliedSequence: number | null;
  lastAppliedEventId: string | null;
  absoluteReplayTimeMs: number | null;
}

export interface ReplayObservableState {
  position: ReplayReducerPosition;
  national: ReportedAggregateState;
  reportedByJurisdiction: Readonly<Record<string, ReportedJurisdictionState>>;
  reportedByCounty: Readonly<Record<string, ReportedCountyState>>;
  reportedByUnit: SparseReportedUnitStore;
  jurisdictionsCompleted: number;
  complete: boolean;
}

export interface ReplayReducerState {
  schemaVersion: typeof REPLAY_REDUCER_SCHEMA_VERSION;
  reducerVersion: typeof REPLAY_REDUCER_VERSION;
  sourceStreamFingerprint: string;
  observable: ReplayObservableState;
}

interface ReducerCountyContract {
  jurisdictionId: string;
  countyId: string;
}

interface ReducerUnitContract {
  jurisdictionId: string;
  unitId: string;
  countyId: string | null;
  unitType: LockedReportingUnitType;
  geometryStatus: LockedGeometryStatus;
}

interface ReducerJurisdictionContract {
  jurisdictionId: string;
  capabilityKind: "detailed" | "coarse" | "hybrid";
  expectedCandidateVotes: CandidateVoteVector;
  expectedTotalVotes: number;
  expectedReturnCount: number;
}

export interface ReplayReducerContext {
  schemaVersion: typeof REPLAY_REDUCER_SCHEMA_VERSION;
  reducerVersion: typeof REPLAY_REDUCER_VERSION;
  sourceStreamFingerprint: string;
  endpointContentFingerprint: string;
  candidateIds: readonly string[];
  jurisdictionIds: readonly string[];
  events: readonly ComposedReplayEvent[];
  jurisdictions: Readonly<Record<string, ReducerJurisdictionContract>>;
  counties: Readonly<Record<string, ReducerCountyContract>>;
  units: Readonly<Record<string, ReducerUnitContract>>;
  nationalCandidateVotes: CandidateVoteVector;
  nationalTotalVotes: number;
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function freezeVector(vector: CandidateVoteVector) {
  return Object.freeze(vector.map((candidate) => Object.freeze({ ...candidate })));
}

function freezeAggregate<T extends ReportedAggregateState>(aggregate: T): T {
  Object.freeze(aggregate.candidateVotes);
  return Object.freeze(aggregate);
}

function canonicalEntityKey(jurisdictionId: string, localId: string) {
  return `${jurisdictionId.length}:${jurisdictionId}${localId}`;
}

function countyKey(jurisdictionId: string, countyId: string) {
  return canonicalEntityKey(jurisdictionId, countyId);
}

function unitKey(jurisdictionId: string, unitId: string) {
  return canonicalEntityKey(jurisdictionId, unitId);
}

function bucketFor(key: string) {
  let hash = 0x811c9dc5;
  for (const character of key) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % REPLAY_UNIT_BUCKET_COUNT;
}

function zeroVector(candidateIds: readonly string[]) {
  return Object.freeze(candidateIds.map((candidateId) => Object.freeze({ candidateId, votes: 0 })));
}

function vectorTotal(vector: CandidateVoteVector) {
  let total = 0;
  for (const candidate of vector) {
    if (!Number.isSafeInteger(candidate.votes) || candidate.votes < 0) {
      throw new Error(`Candidate ${candidate.candidateId} votes must be a non-negative safe integer`);
    }
    total += candidate.votes;
    if (!Number.isSafeInteger(total)) throw new Error("Candidate vector total overflowed");
  }
  return total;
}

function addSafeInteger(left: number, right: number, label: string) {
  if (!Number.isSafeInteger(left) || left < 0 || !Number.isSafeInteger(right) || right < 0) {
    throw new Error(`${label} values must be non-negative safe integers`);
  }
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error(`${label} overflowed`);
  return value;
}

function assertVectorShape(
  vector: CandidateVoteVector,
  candidateIds: readonly string[],
  label: string,
) {
  if (
    vector.length !== candidateIds.length
    || vector.some((candidate, index) => candidate.candidateId !== candidateIds[index])
  ) {
    throw new Error(`${label} does not preserve the canonical five-candidate vector`);
  }
  vectorTotal(vector);
}

function addVectors(
  current: CandidateVoteVector,
  delta: CandidateVoteVector,
  candidateIds: readonly string[],
  label: string,
) {
  assertVectorShape(current, candidateIds, `${label} current vector`);
  assertVectorShape(delta, candidateIds, `${label} delta vector`);
  return Object.freeze(current.map((candidate, index) => {
    const votes = candidate.votes + delta[index].votes;
    if (!Number.isSafeInteger(votes) || votes < 0) {
      throw new Error(`${label} candidate total overflowed`);
    }
    return Object.freeze({ candidateId: candidate.candidateId, votes });
  }));
}

function vectorsEqual(left: CandidateVoteVector, right: CandidateVoteVector) {
  return left.length === right.length && left.every((candidate, index) => (
    candidate.candidateId === right[index]?.candidateId
    && candidate.votes === right[index]?.votes
  ));
}

function addAggregate<T extends ReportedAggregateState>(
  current: T,
  delta: CandidateVoteVector,
  totalDelta: number,
  candidateIds: readonly string[],
  label: string,
): T {
  if (!Number.isSafeInteger(current.totalVotes) || current.totalVotes < 0) {
    throw new Error(`${label} current total must be a non-negative safe integer`);
  }
  if (!Number.isSafeInteger(current.returnsPublished) || current.returnsPublished < 0) {
    throw new Error(`${label} return count must be a non-negative safe integer`);
  }
  if (!Number.isSafeInteger(totalDelta) || totalDelta < 0 || vectorTotal(delta) !== totalDelta) {
    throw new Error(`${label} return total does not reconcile`);
  }
  const totalVotes = current.totalVotes + totalDelta;
  const returnsPublished = current.returnsPublished + 1;
  if (!Number.isSafeInteger(totalVotes) || !Number.isSafeInteger(returnsPublished)) {
    throw new Error(`${label} aggregate overflowed`);
  }
  return freezeAggregate({
    ...current,
    candidateVotes: addVectors(current.candidateVotes, delta, candidateIds, label),
    totalVotes,
    returnsPublished,
  });
}

function emptyUnitStore(): SparseReportedUnitStore {
  return Object.freeze({
    bucketCount: REPLAY_UNIT_BUCKET_COUNT,
    buckets: Object.freeze(Array.from(
      { length: REPLAY_UNIT_BUCKET_COUNT },
      () => Object.freeze({}) as Readonly<Record<string, ReportedUnitState>>,
    )),
  });
}

function unitFromStore(store: SparseReportedUnitStore, key: string) {
  return store.buckets[bucketFor(key)]?.[key];
}

function insertUnit(store: SparseReportedUnitStore, key: string, unit: ReportedUnitState) {
  const bucketIndex = bucketFor(key);
  const currentBucket = store.buckets[bucketIndex];
  if (currentBucket[key]) throw new Error(`Return for ${unit.jurisdictionId}/${unit.unitId} was duplicated`);
  const buckets = [...store.buckets];
  buckets[bucketIndex] = Object.freeze({ ...currentBucket, [key]: Object.freeze(unit) });
  return Object.freeze({
    bucketCount: REPLAY_UNIT_BUCKET_COUNT,
    buckets: Object.freeze(buckets),
  });
}

function assertStateEnvelope(context: ReplayReducerContext, state: ReplayReducerState) {
  if (
    state.schemaVersion !== REPLAY_REDUCER_SCHEMA_VERSION
    || state.reducerVersion !== REPLAY_REDUCER_VERSION
    || state.sourceStreamFingerprint !== context.sourceStreamFingerprint
  ) {
    throw new Error("Reducer state is incompatible with this replay stream");
  }
  const position = state.observable.position;
  if (!Number.isSafeInteger(position.eventsApplied) || position.eventsApplied < 0) {
    throw new Error("Reducer event position is invalid");
  }
  if (position.eventsApplied > context.events.length) {
    throw new Error("Reducer state is beyond the source stream");
  }
  const expectedSequence = position.eventsApplied === 0 ? null : position.eventsApplied - 1;
  if (position.lastAppliedSequence !== expectedSequence) {
    throw new Error("Reducer state sequence does not reconcile with events applied");
  }
  assertVectorShape(state.observable.national.candidateVotes, context.candidateIds, "National state");
}

export async function createReplayReducerContext(
  endpoint: LockedElectionEndpoint,
  replay: CompiledNationalReplay,
): Promise<ReplayReducerContext> {
  await auditCompiledNationalReplay(endpoint, replay);
  const candidateIds = Object.freeze(
    endpoint.content.nationalTotals.map((candidate) => candidate.candidateId),
  );
  const admissions = new Map(replay.admissions.map((admission) => [
    admission.jurisdictionId,
    admission,
  ]));
  const jurisdictions: Record<string, ReducerJurisdictionContract> = {};
  const counties: Record<string, ReducerCountyContract> = {};
  const units: Record<string, ReducerUnitContract> = {};
  for (const jurisdiction of endpoint.content.jurisdictions) {
    const admission = admissions.get(jurisdiction.jurisdictionId);
    if (!admission) throw new Error(`Reducer context is missing ${jurisdiction.jurisdictionId}`);
    jurisdictions[jurisdiction.jurisdictionId] = Object.freeze({
      jurisdictionId: jurisdiction.jurisdictionId,
      capabilityKind: admission.capability.kind,
      expectedCandidateVotes: freezeVector(admission.candidateVotes),
      expectedTotalVotes: admission.totalVotes,
      expectedReturnCount: admission.audit.returnEventCount,
    });
    if (admission.capability.kind === "coarse") continue;
    for (const county of jurisdiction.counties) {
      const key = countyKey(jurisdiction.jurisdictionId, county.countyId);
      if (counties[key]) throw new Error(`Reducer context duplicates county ${key}`);
      counties[key] = Object.freeze({
        jurisdictionId: jurisdiction.jurisdictionId,
        countyId: county.countyId,
      });
    }
    for (const unit of jurisdiction.reportingUnits) {
      const key = unitKey(jurisdiction.jurisdictionId, unit.unitId);
      if (units[key]) throw new Error(`Reducer context duplicates unit ${key}`);
      units[key] = Object.freeze({
        jurisdictionId: jurisdiction.jurisdictionId,
        unitId: unit.unitId,
        countyId: unit.countyId,
        unitType: unit.unitType,
        geometryStatus: unit.geometryStatus,
      });
    }
  }
  return Object.freeze({
    schemaVersion: REPLAY_REDUCER_SCHEMA_VERSION,
    reducerVersion: REPLAY_REDUCER_VERSION,
    sourceStreamFingerprint: replay.nationalStreamFingerprint,
    endpointContentFingerprint: endpoint.contentFingerprint,
    candidateIds,
    jurisdictionIds: Object.freeze(Object.keys(jurisdictions).sort(canonicalStringCompare)),
    events: replay.composition.events,
    jurisdictions: Object.freeze(jurisdictions),
    counties: Object.freeze(counties),
    units: Object.freeze(units),
    nationalCandidateVotes: freezeVector(endpoint.content.nationalTotals),
    nationalTotalVotes: endpoint.content.reconciliation.nationalVotes,
  });
}

export function createReplayZeroState(context: ReplayReducerContext): ReplayReducerState {
  const reportedByJurisdiction: Record<string, ReportedJurisdictionState> = {};
  for (const jurisdictionId of context.jurisdictionIds) {
    reportedByJurisdiction[jurisdictionId] = {
      jurisdictionId,
      candidateVotes: zeroVector(context.candidateIds),
      totalVotes: 0,
      returnsPublished: 0,
      pollClosed: false,
      completed: false,
      mappedCandidateVotes: zeroVector(context.candidateIds),
      mappedTotalVotes: 0,
      offMapCandidateVotes: zeroVector(context.candidateIds),
      offMapTotalVotes: 0,
    };
  }
  const reportedByCounty: Record<string, ReportedCountyState> = {};
  for (const [key, county] of Object.entries(context.counties).sort(([left], [right]) => (
    canonicalStringCompare(left, right)
  ))) {
    reportedByCounty[key] = {
      jurisdictionId: county.jurisdictionId,
      countyId: county.countyId,
      candidateVotes: zeroVector(context.candidateIds),
      totalVotes: 0,
      returnsPublished: 0,
    };
  }
  return deepFreeze({
    schemaVersion: REPLAY_REDUCER_SCHEMA_VERSION,
    reducerVersion: REPLAY_REDUCER_VERSION,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    observable: {
      position: {
        eventsApplied: 0,
        lastAppliedSequence: null,
        lastAppliedEventId: null,
        absoluteReplayTimeMs: null,
      },
      national: {
        candidateVotes: zeroVector(context.candidateIds),
        totalVotes: 0,
        returnsPublished: 0,
      },
      reportedByJurisdiction,
      reportedByCounty,
      reportedByUnit: emptyUnitStore(),
      jurisdictionsCompleted: 0,
      complete: false,
    },
  });
}

function assertCanonicalEvent(
  context: ReplayReducerContext,
  state: ReplayReducerState,
  event: ComposedReplayEvent,
) {
  const expectedSequence = state.observable.position.eventsApplied;
  if (!Number.isSafeInteger(event.sequence) || event.sequence !== expectedSequence) {
    throw new Error(`Expected canonical sequence ${expectedSequence}, received ${event.sequence}`);
  }
  const expected = context.events[expectedSequence];
  if (!expected) throw new Error("Reducer cannot apply beyond the complete source stream");
  if (
    canonicalSerialize(event as unknown as CanonicalValue)
    !== canonicalSerialize(expected as unknown as CanonicalValue)
  ) {
    throw new Error(`Event ${event.sequence} does not match the admitted canonical stream`);
  }
  if (!AUTHORIZED_EVENT_TYPES.has(event.eventType)) {
    throw new Error(`Reducer does not authorize event type ${event.eventType}`);
  }
}

function applyPollClose(
  state: ReplayObservableState,
  event: ComposedReplayEvent,
): Pick<ReplayObservableState, "reportedByJurisdiction"> {
  const current = state.reportedByJurisdiction[event.jurisdictionId];
  if (!current) throw new Error(`Poll close references unknown jurisdiction ${event.jurisdictionId}`);
  if (current.pollClosed) throw new Error(`${event.jurisdictionId} poll close was duplicated`);
  if (current.returnsPublished !== 0 || current.completed) {
    throw new Error(`${event.jurisdictionId} poll close violates lifecycle order`);
  }
  return {
    reportedByJurisdiction: Object.freeze({
      ...state.reportedByJurisdiction,
      [event.jurisdictionId]: Object.freeze({ ...current, pollClosed: true }),
    }),
  };
}

function applyReturn(
  context: ReplayReducerContext,
  state: ReplayObservableState,
  event: ComposedReplayEvent,
): Pick<ReplayObservableState,
  "national" | "reportedByJurisdiction" | "reportedByCounty" | "reportedByUnit"
  > {
  const delta = event.candidateDelta;
  if (delta == null || vectorTotal(delta) !== event.totalDelta) {
    throw new Error(`Return ${event.eventId} has no exact candidate vector`);
  }
  const contract = context.jurisdictions[event.jurisdictionId];
  const current = state.reportedByJurisdiction[event.jurisdictionId];
  if (!contract || !current) throw new Error(`Return references unknown jurisdiction ${event.jurisdictionId}`);
  if (!current.pollClosed || current.completed) {
    throw new Error(`${event.jurisdictionId} return violates lifecycle order`);
  }
  let jurisdiction = addAggregate(
    current,
    delta,
    event.totalDelta,
    context.candidateIds,
    `${event.jurisdictionId} reported`,
  ) as ReportedJurisdictionState;
  let reportedByCounty = state.reportedByCounty;
  let reportedByUnit = state.reportedByUnit;
  if (contract.capabilityKind === "coarse") {
    if (
      event.countyId !== null
      || event.unitType !== "jurisdiction-total"
      || event.geometryStatus !== "none"
      || current.returnsPublished !== 0
    ) {
      throw new Error(`${event.jurisdictionId} coarse return claims unauthorized local detail`);
    }
  } else {
    if (event.unitId == null || event.unitType == null || event.geometryStatus == null) {
      throw new Error(`${event.jurisdictionId} detailed return lacks unit identity`);
    }
    const key = unitKey(event.jurisdictionId, event.unitId);
    const unitContract = context.units[key];
    if (
      !unitContract
      || unitContract.countyId !== event.countyId
      || unitContract.unitType !== event.unitType
      || unitContract.geometryStatus !== event.geometryStatus
    ) {
      throw new Error(`${event.jurisdictionId}/${event.unitId} violates its detailed hierarchy`);
    }
    if (unitFromStore(reportedByUnit, key)) {
      throw new Error(`Return for ${event.jurisdictionId}/${event.unitId} was duplicated`);
    }
    const unit = freezeAggregate({
      jurisdictionId: event.jurisdictionId,
      unitId: event.unitId,
      countyId: event.countyId,
      unitType: event.unitType,
      geometryStatus: event.geometryStatus,
      candidateVotes: freezeVector(delta),
      totalVotes: event.totalDelta,
      returnsPublished: 1,
    });
    reportedByUnit = insertUnit(reportedByUnit, key, unit);
    if (event.countyId != null) {
      const localCountyKey = countyKey(event.jurisdictionId, event.countyId);
      const county = reportedByCounty[localCountyKey];
      if (!county) throw new Error(`Return references unknown county ${event.countyId}`);
      reportedByCounty = Object.freeze({
        ...reportedByCounty,
        [localCountyKey]: addAggregate(
          county,
          delta,
          event.totalDelta,
          context.candidateIds,
          `${event.jurisdictionId}/${event.countyId} reported`,
        ),
      });
    }
    if (event.geometryStatus === "mapped") {
      jurisdiction = Object.freeze({
        ...jurisdiction,
        mappedCandidateVotes: addVectors(
          current.mappedCandidateVotes,
          delta,
          context.candidateIds,
          `${event.jurisdictionId} mapped`,
        ),
        mappedTotalVotes: addSafeInteger(
          current.mappedTotalVotes,
          event.totalDelta,
          `${event.jurisdictionId} mapped total`,
        ),
      });
    } else if (event.geometryStatus === "off-map") {
      jurisdiction = Object.freeze({
        ...jurisdiction,
        offMapCandidateVotes: addVectors(
          current.offMapCandidateVotes,
          delta,
          context.candidateIds,
          `${event.jurisdictionId} off-map`,
        ),
        offMapTotalVotes: addSafeInteger(
          current.offMapTotalVotes,
          event.totalDelta,
          `${event.jurisdictionId} off-map total`,
        ),
      });
    }
  }
  return {
    national: addAggregate(
      state.national,
      delta,
      event.totalDelta,
      context.candidateIds,
      "National reported",
    ),
    reportedByJurisdiction: Object.freeze({
      ...state.reportedByJurisdiction,
      [event.jurisdictionId]: jurisdiction,
    }),
    reportedByCounty,
    reportedByUnit,
  };
}

function applyCompletion(
  context: ReplayReducerContext,
  state: ReplayObservableState,
  event: ComposedReplayEvent,
): Pick<ReplayObservableState, "reportedByJurisdiction" | "jurisdictionsCompleted"> {
  const contract = context.jurisdictions[event.jurisdictionId];
  const current = state.reportedByJurisdiction[event.jurisdictionId];
  if (!contract || !current) throw new Error(`Completion references unknown jurisdiction ${event.jurisdictionId}`);
  if (!current.pollClosed || current.completed) {
    throw new Error(`${event.jurisdictionId} completion violates lifecycle order`);
  }
  if (
    current.returnsPublished !== contract.expectedReturnCount
    || current.totalVotes !== contract.expectedTotalVotes
    || !vectorsEqual(current.candidateVotes, contract.expectedCandidateVotes)
  ) {
    throw new Error(`${event.jurisdictionId} cannot complete before exact reconciliation`);
  }
  const jurisdictionsCompleted = state.jurisdictionsCompleted + 1;
  if (!Number.isSafeInteger(jurisdictionsCompleted)) {
    throw new Error("Completed jurisdiction count overflowed");
  }
  return {
    reportedByJurisdiction: Object.freeze({
      ...state.reportedByJurisdiction,
      [event.jurisdictionId]: Object.freeze({ ...current, completed: true }),
    }),
    jurisdictionsCompleted,
  };
}

export function reduceReplayEvent(
  context: ReplayReducerContext,
  previousState: ReplayReducerState,
  event: ComposedReplayEvent,
): ReplayReducerState {
  assertStateEnvelope(context, previousState);
  assertCanonicalEvent(context, previousState, event);
  const previous = previousState.observable;
  let transition: Partial<ReplayObservableState>;
  switch (event.eventType) {
    case "POLL_CLOSE":
      transition = applyPollClose(previous, event);
      break;
    case "RETURN_PUBLISHED":
      transition = applyReturn(context, previous, event);
      break;
    case "REPLAY_COMPLETED":
      transition = applyCompletion(context, previous, event);
      break;
    default:
      throw new Error(`Reducer does not authorize event type ${event.eventType}`);
  }
  const eventsApplied = previous.position.eventsApplied + 1;
  const jurisdictionsCompleted = transition.jurisdictionsCompleted
    ?? previous.jurisdictionsCompleted;
  const national = transition.national ?? previous.national;
  const complete = jurisdictionsCompleted === context.jurisdictionIds.length
    && eventsApplied === context.events.length
    && national.totalVotes === context.nationalTotalVotes
    && vectorsEqual(national.candidateVotes, context.nationalCandidateVotes);
  if (eventsApplied === context.events.length && !complete) {
    throw new Error("National replay consumed its stream without exact completion");
  }
  if (complete && jurisdictionsCompleted !== 51) {
    throw new Error("National replay cannot complete without all 51 jurisdictions");
  }
  const observable = Object.freeze({
    ...previous,
    ...transition,
    position: Object.freeze({
      eventsApplied,
      lastAppliedSequence: event.sequence,
      lastAppliedEventId: event.eventId,
      absoluteReplayTimeMs: event.absoluteReplayTimeMs,
    }),
    jurisdictionsCompleted,
    complete,
  });
  return Object.freeze({
    schemaVersion: REPLAY_REDUCER_SCHEMA_VERSION,
    reducerVersion: REPLAY_REDUCER_VERSION,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    observable,
  });
}

export function reduceReplayToEventCount(
  context: ReplayReducerContext,
  eventCount: number,
  initialState = createReplayZeroState(context),
) {
  if (!Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > context.events.length) {
    throw new Error("Reducer target event count is outside the canonical stream");
  }
  if (initialState.observable.position.eventsApplied > eventCount) {
    throw new Error("Sequential reduction cannot move backward");
  }
  let state = initialState;
  for (let sequence = state.observable.position.eventsApplied; sequence < eventCount; sequence += 1) {
    state = reduceReplayEvent(context, state, context.events[sequence]);
  }
  return state;
}

export function reduceCanonicalEventSet(
  context: ReplayReducerContext,
  events: readonly ComposedReplayEvent[],
) {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  if (new Set(ordered.map((event) => event.sequence)).size !== ordered.length) {
    throw new Error("Canonical reconstruction event set contains duplicate sequences");
  }
  let state = createReplayZeroState(context);
  for (const event of ordered) state = reduceReplayEvent(context, state, event);
  return state;
}

export function reportedUnitState(
  context: ReplayReducerContext,
  state: ReplayReducerState,
  jurisdictionId: string,
  unitId: string,
): ReportedUnitState {
  assertStateEnvelope(context, state);
  const key = unitKey(jurisdictionId, unitId);
  const contract = context.units[key];
  if (!contract) throw new Error(`Unknown detailed unit ${jurisdictionId}/${unitId}`);
  return unitFromStore(state.observable.reportedByUnit, key) ?? Object.freeze({
    ...contract,
    candidateVotes: zeroVector(context.candidateIds),
    totalVotes: 0,
    returnsPublished: 0,
  });
}

export function reportedCountyState(
  context: ReplayReducerContext,
  state: ReplayReducerState,
  jurisdictionId: string,
  countyId: string,
) {
  assertStateEnvelope(context, state);
  const county = state.observable.reportedByCounty[countyKey(jurisdictionId, countyId)];
  if (!county) throw new Error(`Unknown detailed county ${jurisdictionId}/${countyId}`);
  return county;
}

export function serializeReplayReducerState(state: ReplayReducerState) {
  return canonicalSerialize(state as unknown as CanonicalValue);
}

export async function replayReducerStateFingerprint(state: ReplayReducerState) {
  return sha256Fingerprint(serializeReplayReducerState(state));
}

export function deserializeReplayReducerState(
  context: ReplayReducerContext,
  serialized: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Reducer state is not valid JSON");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Reducer state must be an object");
  }
  const state = parsed as ReplayReducerState;
  assertStateEnvelope(context, state);
  canonicalSerialize(state as unknown as CanonicalValue);
  const reconstructed = reduceReplayToEventCount(
    context,
    state.observable.position.eventsApplied,
  );
  if (serializeReplayReducerState(reconstructed) !== serializeReplayReducerState(state)) {
    throw new Error("Serialized reducer state does not equal its canonical event prefix");
  }
  return deepFreeze(state);
}

export function eventCountAtOrBeforeAbsoluteTime(
  context: ReplayReducerContext,
  absoluteReplayTimeMs: number,
) {
  if (!Number.isSafeInteger(absoluteReplayTimeMs)) {
    throw new Error("Replay seek time must be a safe integer");
  }
  let low = 0;
  let high = context.events.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (context.events[middle].absoluteReplayTimeMs <= absoluteReplayTimeMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}
