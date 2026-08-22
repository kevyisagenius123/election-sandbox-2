import {
  COMPILED_EVENT_STREAM_SCHEMA_VERSION,
  REPLAY_SCHEMA_VERSION,
  type CandidateVote,
  type CandidateVoteVector,
  type CompiledJurisdictionReplay,
  type CompiledReportingEvent,
  type LockedElectionEndpoint,
  type LockedJurisdictionEndpointInput,
  type LockedReportingUnitType,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import {
  deserializeLockedElectionEndpoint,
  serializeLockedElectionEndpoint,
} from "./endpoint.ts";
import { deriveReplayEventId } from "./eventIdentity.ts";
import { sha256Fingerprint } from "./hash.ts";
import { createNamedReplayRandomStream } from "./prng.ts";
import type { JurisdictionReplayCapability } from "./jurisdictionContracts.ts";

export const PENNSYLVANIA_REPLAY_COMPILER_VERSION = "pa-atomic-event-compiler-v1" as const;
export const PENNSYLVANIA_REPLAY_CAPABILITY: JurisdictionReplayCapability = Object.freeze({
  kind: "detailed",
  sourceUnitLabel: "2024 Pennsylvania election reporting unit",
  mapUnitLabel: "2020 Census VTD terrain",
  residualTreatment: "explicit-off-map",
  methodologyNote: "2024 reporting units are linked to 2020 Census VTD terrain; unmatched units remain explicit off-map returns.",
});

export type PennsylvaniaReportingProfileId =
  | "pa-synthetic-rural-first-v1"
  | "pa-synthetic-metropolitan-late-v1";

export interface PennsylvaniaReplayDefinition {
  profileId: PennsylvaniaReportingProfileId;
  rootSeed: string;
}

export interface PennsylvaniaProfile {
  id: PennsylvaniaReportingProfileId;
  timezone: "America/New_York";
  pollCloseInstant: "2024-11-06T01:00:00.000Z";
  minimumReturnDelayMs: number;
  countyBaseDelayMs: number;
  countySizeDelayMs: number;
  countyJitterMs: number;
  countySpreadBaseMs: number;
  countySpreadPerUnitMs: number;
  countySpreadMaximumMs: number;
  mediumCountyThresholdPpm: number;
  largeCountyThresholdPpm: number;
  mediumCountyExtraDelayMs: number;
  largeCountyExtraDelayMs: number;
  statewideResidualDelayMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LOCKED_REPORTING_UNIT_TYPES = new Set<LockedReportingUnitType>([
  "precinct",
  "vtd",
  "ward",
  "central-count",
  "residual",
  "jurisdiction-total",
]);

const PENNSYLVANIA_PROFILES: Readonly<Record<PennsylvaniaReportingProfileId, PennsylvaniaProfile>> = Object.freeze({
  "pa-synthetic-rural-first-v1": Object.freeze({
    id: "pa-synthetic-rural-first-v1",
    timezone: "America/New_York",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
    minimumReturnDelayMs: 15 * MINUTE,
    countyBaseDelayMs: 12 * MINUTE,
    countySizeDelayMs: 135 * MINUTE,
    countyJitterMs: 18 * MINUTE,
    countySpreadBaseMs: 24 * MINUTE,
    countySpreadPerUnitMs: 18_000,
    countySpreadMaximumMs: 150 * MINUTE,
    mediumCountyThresholdPpm: 180_000,
    largeCountyThresholdPpm: 500_000,
    mediumCountyExtraDelayMs: 0,
    largeCountyExtraDelayMs: 0,
    statewideResidualDelayMs: 7 * HOUR,
  }),
  "pa-synthetic-metropolitan-late-v1": Object.freeze({
    id: "pa-synthetic-metropolitan-late-v1",
    timezone: "America/New_York",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
    minimumReturnDelayMs: 20 * MINUTE,
    countyBaseDelayMs: 20 * MINUTE,
    countySizeDelayMs: 105 * MINUTE,
    countyJitterMs: 28 * MINUTE,
    countySpreadBaseMs: 35 * MINUTE,
    countySpreadPerUnitMs: 24_000,
    countySpreadMaximumMs: 210 * MINUTE,
    mediumCountyThresholdPpm: 180_000,
    largeCountyThresholdPpm: 500_000,
    mediumCountyExtraDelayMs: 75 * MINUTE,
    largeCountyExtraDelayMs: 165 * MINUTE,
    statewideResidualDelayMs: 9 * HOUR,
  }),
});

export interface PennsylvaniaScheduleCounty {
  countyId: string;
  totalVotes: number;
  unitCount: number;
}

export interface PennsylvaniaScheduleUnit {
  unitId: string;
  countyId: string | null;
  unitType: LockedReportingUnitType;
  totalVotes: number;
}

export interface ScheduledPennsylvaniaUnit {
  unitId: string;
  replayTimeMs: number;
  orderTieBreaker: number;
  eventId: string;
}

export interface CompiledPennsylvaniaReplay
  extends CompiledJurisdictionReplay<PennsylvaniaReplayDefinition, PennsylvaniaProfile> {
  schemaVersion: typeof COMPILED_EVENT_STREAM_SCHEMA_VERSION;
  compilerVersion: typeof PENNSYLVANIA_REPLAY_COMPILER_VERSION;
  replaySchemaVersion: typeof REPLAY_SCHEMA_VERSION;
  endpointContentFingerprint: string;
  definition: PennsylvaniaReplayDefinition;
  profile: PennsylvaniaProfile;
  events: readonly CompiledReportingEvent[];
  eventStreamFingerprint: string;
}

export interface PennsylvaniaReplayAudit {
  returnEventCount: number;
  controlEventCount: number;
  countyCount: number;
  reportingUnitCount: number;
  offMapReturnCount: number;
  offMapVotes: number;
  finalCandidateTotals: CandidateVoteVector;
  finalTotalVotes: number;
  firstReturnTimeMs: number;
  lastReturnTimeMs: number;
}

function requireDefinitionString(value: string, label: string) {
  const normalized = value.normalize("NFC");
  if (normalized.length === 0) throw new Error(`${label} cannot be empty`);
  return normalized;
}

function requireScheduleInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function profileFor(profileId: PennsylvaniaReportingProfileId) {
  const profile = PENNSYLVANIA_PROFILES[profileId];
  if (!profile) throw new Error(`Unsupported Pennsylvania reporting profile ${profileId}`);
  return profile;
}

function compareEvents(
  left: Pick<CompiledReportingEvent, "replayTimeMs" | "orderTieBreaker" | "eventId">,
  right: Pick<CompiledReportingEvent, "replayTimeMs" | "orderTieBreaker" | "eventId">,
) {
  return left.replayTimeMs - right.replayTimeMs
    || left.orderTieBreaker - right.orderTieBreaker
    || canonicalStringCompare(left.eventId, right.eventId);
}

function candidateVectorMap(candidateIds: readonly string[]) {
  return new Map(candidateIds.map((candidateId) => [candidateId, 0]));
}

function addCandidateVector(target: Map<string, number>, vector: CandidateVoteVector) {
  for (const candidate of vector) {
    const value = (target.get(candidate.candidateId) ?? 0) + candidate.votes;
    if (!Number.isSafeInteger(value)) throw new Error("Compiled candidate total overflowed");
    target.set(candidate.candidateId, value);
  }
}

function mapAsCandidateVector(target: ReadonlyMap<string, number>, candidateIds: readonly string[]) {
  return candidateIds.map((candidateId) => ({
    candidateId,
    votes: target.get(candidateId) ?? 0,
  }));
}

function assertCandidateVectorsEqual(
  expected: CandidateVoteVector,
  actual: CandidateVoteVector,
  label: string,
) {
  if (expected.length !== actual.length) throw new Error(`${label} candidate count does not reconcile`);
  for (let index = 0; index < expected.length; index += 1) {
    if (
      expected[index].candidateId !== actual[index].candidateId
      || expected[index].votes !== actual[index].votes
    ) {
      throw new Error(
        `${label} does not reconcile for ${expected[index].candidateId}: `
        + `expected ${expected[index].votes}, received ${actual[index].votes}`,
      );
    }
  }
}

function assertStringArraysEqual(
  expected: readonly string[],
  actual: readonly string[],
  label: string,
) {
  if (
    expected.length !== actual.length
    || expected.some((value, index) => value !== actual[index])
  ) {
    throw new Error(`${label} does not reconcile`);
  }
}

function eventStreamPreimage(
  stream: Omit<CompiledPennsylvaniaReplay, "eventStreamFingerprint">,
) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

async function eventStreamFingerprint(
  stream: Omit<CompiledPennsylvaniaReplay, "eventStreamFingerprint">,
) {
  return sha256Fingerprint(eventStreamPreimage(stream));
}

function normalizedScheduleInputs(
  units: readonly PennsylvaniaScheduleUnit[],
  counties: readonly PennsylvaniaScheduleCounty[],
) {
  const normalizedCounties = counties.map((county) => ({
    countyId: requireDefinitionString(county.countyId, "Schedule county identifier"),
    totalVotes: requireScheduleInteger(county.totalVotes, `${county.countyId} schedule votes`),
    unitCount: requireScheduleInteger(county.unitCount, `${county.countyId} schedule unit count`),
  })).sort((left, right) => canonicalStringCompare(left.countyId, right.countyId));
  const countyIds = new Set<string>();
  for (const county of normalizedCounties) {
    if (countyIds.has(county.countyId)) {
      throw new Error(`Schedule contains duplicate county ${county.countyId}`);
    }
    countyIds.add(county.countyId);
  }
  const normalizedUnits = units.map((unit) => ({
    unitId: requireDefinitionString(unit.unitId, "Schedule unit identifier"),
    countyId: unit.countyId == null
      ? null
      : requireDefinitionString(unit.countyId, `${unit.unitId} schedule county`),
    unitType: unit.unitType,
    totalVotes: requireScheduleInteger(unit.totalVotes, `${unit.unitId} schedule votes`),
  })).sort((left, right) => canonicalStringCompare(left.unitId, right.unitId));
  const unitIds = new Set<string>();
  for (const unit of normalizedUnits) {
    if (unitIds.has(unit.unitId)) throw new Error(`Schedule contains duplicate unit ${unit.unitId}`);
    if (!LOCKED_REPORTING_UNIT_TYPES.has(unit.unitType)) {
      throw new Error(`Schedule unit ${unit.unitId} has unsupported type ${unit.unitType}`);
    }
    if (unit.countyId != null && !countyIds.has(unit.countyId)) {
      throw new Error(`Schedule unit ${unit.unitId} references unknown county ${unit.countyId}`);
    }
    unitIds.add(unit.unitId);
  }
  for (const county of normalizedCounties) {
    const countyUnits = normalizedUnits.filter((unit) => unit.countyId === county.countyId);
    if (countyUnits.length !== county.unitCount) {
      throw new Error(`${county.countyId} schedule unit count does not reconcile`);
    }
    const countyVotes = countyUnits.reduce((sum, unit) => sum + unit.totalVotes, 0);
    if (countyVotes !== county.totalVotes) {
      throw new Error(`${county.countyId} schedule vote workload does not reconcile`);
    }
  }
  return { units: normalizedUnits, counties: normalizedCounties };
}

export async function schedulePennsylvaniaReportingUnits(
  units: readonly PennsylvaniaScheduleUnit[],
  counties: readonly PennsylvaniaScheduleCounty[],
  definition: PennsylvaniaReplayDefinition,
): Promise<ScheduledPennsylvaniaUnit[]> {
  const profile = profileFor(definition.profileId);
  const rootSeed = requireDefinitionString(definition.rootSeed, "Replay root seed");
  const normalized = normalizedScheduleInputs(units, counties);
  const maximumCountyVotes = Math.max(
    1,
    ...normalized.counties.map((county) => county.totalVotes),
  );
  const countySchedule = new Map<string, { activationMs: number; spreadMs: number }>();
  await Promise.all(normalized.counties.map(async (county) => {
    const stream = await createNamedReplayRandomStream(
      rootSeed,
      `activation/county/${county.countyId}`,
      profile.id,
    );
    const workloadPpm = Math.round(county.totalVotes / maximumCountyVotes * 1_000_000);
    const sizeDelay = Math.round(
      Math.sqrt(workloadPpm / 1_000_000) * profile.countySizeDelayMs,
    );
    const profileExtra = workloadPpm >= profile.largeCountyThresholdPpm
      ? profile.largeCountyExtraDelayMs
      : workloadPpm >= profile.mediumCountyThresholdPpm
        ? profile.mediumCountyExtraDelayMs
        : 0;
    const activationMs = profile.minimumReturnDelayMs
      + profile.countyBaseDelayMs
      + sizeDelay
      + profileExtra
      + Math.floor(stream.nextFloat() * profile.countyJitterMs);
    const spreadMs = Math.min(
      profile.countySpreadMaximumMs,
      profile.countySpreadBaseMs + county.unitCount * profile.countySpreadPerUnitMs,
    );
    countySchedule.set(county.countyId, { activationMs, spreadMs });
  }));

  return Promise.all(normalized.units.map(async (unit) => {
    const stream = await createNamedReplayRandomStream(
      rootSeed,
      unit.countyId == null
        ? `timing/statewide-residual/${unit.unitId}`
        : `timing/unit/${unit.unitId}`,
      profile.id,
    );
    const county = unit.countyId == null ? null : countySchedule.get(unit.countyId);
    if (unit.countyId != null && !county) {
      throw new Error(`Schedule is missing county activation for ${unit.countyId}`);
    }
    const replayTimeMs = unit.countyId == null
      ? profile.statewideResidualDelayMs + Math.floor(stream.nextFloat() * profile.countyJitterMs)
      : (county?.activationMs ?? 0) + Math.floor(stream.nextFloat() * (county?.spreadMs ?? 0));
    const orderTieBreaker = stream.nextUint32();
    const eventId = await deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId: "PA",
      unitId: unit.unitId,
      eventType: "RETURN_PUBLISHED",
      batchOrdinal: 0,
    });
    return {
      unitId: unit.unitId,
      replayTimeMs,
      orderTieBreaker,
      eventId,
    };
  }));
}

function pennsylvaniaJurisdiction(endpoint: LockedElectionEndpoint) {
  const jurisdictions = endpoint.content.jurisdictions.filter(
    (jurisdiction) => jurisdiction.jurisdictionId === "PA",
  );
  if (jurisdictions.length !== 1) {
    throw new Error("Locked endpoint must contain exactly one Pennsylvania jurisdiction");
  }
  if (jurisdictions[0].reportingUnits.length === 0) {
    throw new Error("Locked Pennsylvania endpoint contains no reporting units");
  }
  return jurisdictions[0];
}

function schedulingInputs(pa: LockedJurisdictionEndpointInput) {
  return {
    counties: pa.counties.map((county) => ({
      countyId: county.countyId,
      totalVotes: county.totalVotes,
      unitCount: pa.reportingUnits.filter((unit) => unit.countyId === county.countyId).length,
    })),
    units: pa.reportingUnits.map((unit) => ({
      unitId: unit.unitId,
      countyId: unit.countyId,
      unitType: unit.unitType,
      totalVotes: unit.totalVotes,
    })),
  };
}

function zeroControlEvent(
  eventId: string,
  eventType: "POLL_CLOSE" | "REPLAY_COMPLETED",
  replayTimeMs: number,
): Omit<CompiledReportingEvent, "sequence"> {
  return {
    eventId,
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId: "PA",
    unitId: null,
    eventType,
    batchOrdinal: 0,
    replayTimeMs,
    evidenceStatus: "synthetic",
    countyId: null,
    unitType: null,
    geometryStatus: null,
    candidateDelta: null,
    totalDelta: 0,
    voteEvidenceIds: [],
    orderTieBreaker: 0,
  };
}

export async function compilePennsylvaniaEventStream(
  endpoint: LockedElectionEndpoint,
  definition: PennsylvaniaReplayDefinition,
): Promise<CompiledPennsylvaniaReplay> {
  const before = serializeLockedElectionEndpoint(endpoint);
  const verifiedEndpoint = await deserializeLockedElectionEndpoint(before);
  const pa = pennsylvaniaJurisdiction(verifiedEndpoint);
  const profile = profileFor(definition.profileId);
  const normalizedDefinition: PennsylvaniaReplayDefinition = {
    profileId: profile.id,
    rootSeed: requireDefinitionString(definition.rootSeed, "Replay root seed"),
  };
  const scheduleInput = schedulingInputs(pa);
  const scheduledUnits = await schedulePennsylvaniaReportingUnits(
    scheduleInput.units,
    scheduleInput.counties,
    normalizedDefinition,
  );
  const unitById = new Map(pa.reportingUnits.map((unit) => [unit.unitId, unit]));
  const returnEvents: Array<Omit<CompiledReportingEvent, "sequence">> = scheduledUnits.map(
    (scheduled) => {
      const unit = unitById.get(scheduled.unitId);
      if (!unit) throw new Error(`Scheduled unknown Pennsylvania unit ${scheduled.unitId}`);
      return {
        eventId: scheduled.eventId,
        replaySchemaVersion: REPLAY_SCHEMA_VERSION,
        jurisdictionId: "PA",
        unitId: unit.unitId,
        eventType: "RETURN_PUBLISHED",
        batchOrdinal: 0,
        replayTimeMs: scheduled.replayTimeMs,
        evidenceStatus: "synthetic",
        countyId: unit.countyId,
        unitType: unit.unitType,
        geometryStatus: unit.geometryStatus,
        candidateDelta: unit.candidateVotes.map((candidate): CandidateVote => ({ ...candidate })),
        totalDelta: unit.totalVotes,
        voteEvidenceIds: [...unit.evidenceIds],
        orderTieBreaker: scheduled.orderTieBreaker,
      };
    },
  );
  const pollCloseId = await deriveReplayEventId({
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId: "PA",
    unitId: null,
    eventType: "POLL_CLOSE",
    batchOrdinal: 0,
  });
  const completeId = await deriveReplayEventId({
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId: "PA",
    unitId: null,
    eventType: "REPLAY_COMPLETED",
    batchOrdinal: 0,
  });
  const lastReturnTimeMs = Math.max(...returnEvents.map((event) => event.replayTimeMs));
  const unordered = [
    zeroControlEvent(pollCloseId, "POLL_CLOSE", 0),
    ...returnEvents,
    zeroControlEvent(completeId, "REPLAY_COMPLETED", lastReturnTimeMs + 1),
  ];
  const events = unordered.sort(compareEvents).map((event, sequence) => ({
    ...event,
    sequence,
  }));
  const streamWithoutFingerprint = {
    schemaVersion: COMPILED_EVENT_STREAM_SCHEMA_VERSION,
    compilerVersion: PENNSYLVANIA_REPLAY_COMPILER_VERSION,
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    endpointContentFingerprint: verifiedEndpoint.contentFingerprint,
    definition: normalizedDefinition,
    profile,
    events,
  } as const;
  const compiled: CompiledPennsylvaniaReplay = Object.freeze({
    ...streamWithoutFingerprint,
    eventStreamFingerprint: await eventStreamFingerprint(streamWithoutFingerprint),
  });
  await auditPennsylvaniaEventStream(verifiedEndpoint, compiled);
  if (serializeLockedElectionEndpoint(endpoint) !== before) {
    throw new Error("Pennsylvania compiler mutated the locked endpoint");
  }
  return compiled;
}

export function serializeCompiledPennsylvaniaReplay(stream: CompiledPennsylvaniaReplay) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export async function auditPennsylvaniaEventStream(
  endpoint: LockedElectionEndpoint,
  stream: CompiledPennsylvaniaReplay,
): Promise<PennsylvaniaReplayAudit> {
  const verifiedEndpoint = await deserializeLockedElectionEndpoint(
    serializeLockedElectionEndpoint(endpoint),
  );
  const pa = pennsylvaniaJurisdiction(verifiedEndpoint);
  if (stream.schemaVersion !== COMPILED_EVENT_STREAM_SCHEMA_VERSION) {
    throw new Error(`Unsupported compiled stream schema ${stream.schemaVersion}`);
  }
  if (stream.compilerVersion !== PENNSYLVANIA_REPLAY_COMPILER_VERSION) {
    throw new Error(`Unsupported Pennsylvania compiler ${stream.compilerVersion}`);
  }
  if (stream.replaySchemaVersion !== REPLAY_SCHEMA_VERSION) {
    throw new Error(`Unsupported replay schema ${stream.replaySchemaVersion}`);
  }
  if (stream.endpointContentFingerprint !== verifiedEndpoint.contentFingerprint) {
    throw new Error("Compiled stream endpoint fingerprint does not match the locked endpoint");
  }
  const expectedProfile = profileFor(stream.definition.profileId);
  requireDefinitionString(stream.definition.rootSeed, "Replay root seed");
  if (canonicalSerialize(stream.profile as unknown as CanonicalValue)
    !== canonicalSerialize(expectedProfile as unknown as CanonicalValue)) {
    throw new Error("Compiled stream reporting profile does not match its versioned definition");
  }
  const { eventStreamFingerprint: suppliedFingerprint, ...withoutFingerprint } = stream;
  const expectedFingerprint = await eventStreamFingerprint(withoutFingerprint);
  if (suppliedFingerprint !== expectedFingerprint) {
    throw new Error(
      `Compiled stream fingerprint mismatch: expected ${expectedFingerprint}, `
      + `received ${suppliedFingerprint}`,
    );
  }
  const expectedEventIds = await Promise.all(stream.events.map((event) => deriveReplayEventId({
    replaySchemaVersion: event.replaySchemaVersion,
    jurisdictionId: event.jurisdictionId,
    unitId: event.unitId,
    eventType: event.eventType,
    batchOrdinal: event.batchOrdinal,
  })));
  const eventIds = new Set<string>();
  for (let index = 0; index < stream.events.length; index += 1) {
    const event = stream.events[index];
    if (event.replaySchemaVersion !== REPLAY_SCHEMA_VERSION) {
      throw new Error(`Compiled event ${event.eventId} uses an unsupported replay schema`);
    }
    if (event.jurisdictionId !== "PA") {
      throw new Error(`Compiled event ${event.eventId} left Pennsylvania`);
    }
    if (
      !Number.isSafeInteger(event.replayTimeMs)
      || event.replayTimeMs < 0
      || !Number.isSafeInteger(event.orderTieBreaker)
      || event.orderTieBreaker < 0
      || event.orderTieBreaker > 0xffff_ffff
    ) {
      throw new Error(`Compiled event ${event.eventId} has an invalid deterministic schedule`);
    }
    if (event.sequence !== index) throw new Error(`Compiled event ${event.eventId} has invalid sequence`);
    if (index > 0 && compareEvents(stream.events[index - 1], event) >= 0) {
      throw new Error(`Compiled event order is not strictly canonical at sequence ${index}`);
    }
    if (eventIds.has(event.eventId)) throw new Error(`Duplicate compiled event identity ${event.eventId}`);
    eventIds.add(event.eventId);
    if (expectedEventIds[index] !== event.eventId) {
      throw new Error(`Compiled event identity mismatch for ${event.eventId}`);
    }
  }
  if (stream.events[0]?.eventType !== "POLL_CLOSE" || stream.events[0].totalDelta !== 0) {
    throw new Error("Compiled Pennsylvania replay must begin at zero with poll close");
  }
  if (stream.events.at(-1)?.eventType !== "REPLAY_COMPLETED") {
    throw new Error("Compiled Pennsylvania replay must end with replay completion");
  }
  const candidateIds = pa.candidateVotes.map((candidate) => candidate.candidateId);
  const stateAggregate = candidateVectorMap(candidateIds);
  const countyAggregates = new Map(
    pa.counties.map((county) => [county.countyId, candidateVectorMap(candidateIds)]),
  );
  const unitById = new Map(pa.reportingUnits.map((unit) => [unit.unitId, unit]));
  const unitEvents = new Map<string, CompiledReportingEvent>();
  let returnEventCount = 0;
  let controlEventCount = 0;
  let offMapReturnCount = 0;
  let offMapVotes = 0;
  let firstReturnTimeMs = Number.POSITIVE_INFINITY;
  let lastReturnTimeMs = 0;
  for (const event of stream.events) {
    if (event.eventType !== "RETURN_PUBLISHED") {
      controlEventCount += 1;
      if (
        (event.eventType !== "POLL_CLOSE" && event.eventType !== "REPLAY_COMPLETED")
        || event.unitId != null
        || event.countyId != null
        || event.unitType != null
        || event.geometryStatus != null
        || event.candidateDelta != null
        || event.totalDelta !== 0
        || event.batchOrdinal !== 0
        || event.evidenceStatus !== "synthetic"
        || event.voteEvidenceIds.length !== 0
      ) {
        throw new Error(`Control event ${event.eventId} violates the compiler contract`);
      }
      continue;
    }
    returnEventCount += 1;
    if (event.unitId == null || event.candidateDelta == null) {
      throw new Error(`Return event ${event.eventId} is missing unit votes`);
    }
    if (event.batchOrdinal !== 0) {
      throw new Error(`Atomic return ${event.eventId} has a fabricated batch ordinal`);
    }
    if (event.evidenceStatus !== "synthetic") {
      throw new Error(`Return event ${event.eventId} changed its evidence status`);
    }
    if (unitEvents.has(event.unitId)) {
      throw new Error(`Reporting unit ${event.unitId} reports more than once`);
    }
    const unit = unitById.get(event.unitId);
    if (!unit) throw new Error(`Return event ${event.eventId} references unknown unit`);
    if (
      event.countyId !== unit.countyId
      || event.unitType !== unit.unitType
      || event.geometryStatus !== unit.geometryStatus
    ) {
      throw new Error(`Return event ${event.eventId} changed unit geography`);
    }
    if (event.replayTimeMs < stream.profile.minimumReturnDelayMs) {
      throw new Error(`Return event ${event.eventId} occurs before reporting opens`);
    }
    if (
      !Number.isSafeInteger(event.totalDelta)
      || event.totalDelta < 0
      || event.candidateDelta.some((candidate) => (
        !Number.isSafeInteger(candidate.votes) || candidate.votes < 0
      ))
    ) {
      throw new Error(`Return event ${event.eventId} contains fractional or negative votes`);
    }
    assertCandidateVectorsEqual(unit.candidateVotes, event.candidateDelta, `Unit ${unit.unitId}`);
    assertStringArraysEqual(unit.evidenceIds, event.voteEvidenceIds, `Unit ${unit.unitId} evidence`);
    const candidateTotal = event.candidateDelta.reduce((sum, candidate) => sum + candidate.votes, 0);
    if (candidateTotal !== event.totalDelta || event.totalDelta !== unit.totalVotes) {
      throw new Error(`Return event ${event.eventId} total does not reconcile`);
    }
    addCandidateVector(stateAggregate, event.candidateDelta);
    for (const candidate of pa.candidateVotes) {
      if ((stateAggregate.get(candidate.candidateId) ?? 0) > candidate.votes) {
        throw new Error(`Replay prefix over-reports ${candidate.candidateId}`);
      }
    }
    if (event.countyId != null) {
      const countyAggregate = countyAggregates.get(event.countyId);
      if (!countyAggregate) throw new Error(`Return event references unknown county ${event.countyId}`);
      addCandidateVector(countyAggregate, event.candidateDelta);
    }
    if (event.geometryStatus === "off-map" || event.geometryStatus === "none") {
      offMapReturnCount += 1;
      offMapVotes += event.totalDelta;
    }
    firstReturnTimeMs = Math.min(firstReturnTimeMs, event.replayTimeMs);
    lastReturnTimeMs = Math.max(lastReturnTimeMs, event.replayTimeMs);
    unitEvents.set(event.unitId, event);
  }
  if (unitEvents.size !== pa.reportingUnits.length) {
    throw new Error(
      `Compiled ${unitEvents.size} reporting units, expected ${pa.reportingUnits.length}`,
    );
  }
  if (controlEventCount !== 2) {
    throw new Error(`Compiled replay contains ${controlEventCount} control events; expected 2`);
  }
  if (stream.events.at(-1)?.replayTimeMs !== lastReturnTimeMs + 1) {
    throw new Error("Replay completion must immediately follow the final atomic return");
  }
  for (const county of pa.counties) {
    assertCandidateVectorsEqual(
      county.candidateVotes,
      mapAsCandidateVector(countyAggregates.get(county.countyId) ?? new Map(), candidateIds),
      `County ${county.countyId}`,
    );
  }
  const finalCandidateTotals = mapAsCandidateVector(stateAggregate, candidateIds);
  assertCandidateVectorsEqual(pa.candidateVotes, finalCandidateTotals, "Pennsylvania final result");
  const finalTotalVotes = finalCandidateTotals.reduce((sum, candidate) => sum + candidate.votes, 0);
  if (finalTotalVotes !== pa.totalVotes) {
    throw new Error("Pennsylvania compiled total does not equal its endpoint");
  }
  return Object.freeze({
    returnEventCount,
    controlEventCount,
    countyCount: pa.counties.length,
    reportingUnitCount: pa.reportingUnits.length,
    offMapReturnCount,
    offMapVotes,
    finalCandidateTotals,
    finalTotalVotes,
    firstReturnTimeMs,
    lastReturnTimeMs,
  });
}
