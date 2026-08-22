import {
  COMPILED_EVENT_STREAM_SCHEMA_VERSION,
  REPLAY_SCHEMA_VERSION,
  type CandidateVote,
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
import {
  auditCompiledJurisdictionReplay,
  type JurisdictionReplayCapability,
} from "./jurisdictionContracts.ts";
import { createNamedReplayRandomStream } from "./prng.ts";

export const MICHIGAN_REPLAY_COMPILER_VERSION = "mi-atomic-event-compiler-v1" as const;
export const MICHIGAN_REPLAY_TIME_ZONE = "America/Detroit" as const;
export const MICHIGAN_REPLAY_POLL_CLOSE_INSTANT = "2024-11-06T01:00:00.000Z" as const;

export type MichiganReportingProfileId =
  | "mi-synthetic-uniform-wave-v1"
  | "mi-synthetic-metropolitan-late-v1";

export interface MichiganReplayDefinition {
  profileId: MichiganReportingProfileId;
  rootSeed: string;
}

export interface MichiganProfile {
  id: MichiganReportingProfileId;
  timezone: typeof MICHIGAN_REPLAY_TIME_ZONE;
  pollCloseInstant: typeof MICHIGAN_REPLAY_POLL_CLOSE_INSTANT;
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
  centralCountDelayMs: number;
  centralTimeCountyDelayMs: number;
  statewideResidualDelayMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const CENTRAL_TIME_COUNTY_FIPS = new Set(["26043", "26053", "26071", "26109"]);
const LOCKED_REPORTING_UNIT_TYPES = new Set<LockedReportingUnitType>([
  "precinct",
  "vtd",
  "ward",
  "central-count",
  "residual",
  "jurisdiction-total",
]);

const MICHIGAN_PROFILES: Readonly<Record<MichiganReportingProfileId, MichiganProfile>> = Object.freeze({
  "mi-synthetic-uniform-wave-v1": Object.freeze({
    id: "mi-synthetic-uniform-wave-v1",
    timezone: MICHIGAN_REPLAY_TIME_ZONE,
    pollCloseInstant: MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
    minimumReturnDelayMs: 12 * MINUTE,
    countyBaseDelayMs: 12 * MINUTE,
    countySizeDelayMs: 75 * MINUTE,
    countyJitterMs: 22 * MINUTE,
    countySpreadBaseMs: 28 * MINUTE,
    countySpreadPerUnitMs: 22_000,
    countySpreadMaximumMs: 150 * MINUTE,
    mediumCountyThresholdPpm: 180_000,
    largeCountyThresholdPpm: 500_000,
    mediumCountyExtraDelayMs: 0,
    largeCountyExtraDelayMs: 0,
    centralCountDelayMs: 90 * MINUTE,
    centralTimeCountyDelayMs: 60 * MINUTE,
    statewideResidualDelayMs: 7 * HOUR,
  }),
  "mi-synthetic-metropolitan-late-v1": Object.freeze({
    id: "mi-synthetic-metropolitan-late-v1",
    timezone: MICHIGAN_REPLAY_TIME_ZONE,
    pollCloseInstant: MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
    minimumReturnDelayMs: 18 * MINUTE,
    countyBaseDelayMs: 18 * MINUTE,
    countySizeDelayMs: 90 * MINUTE,
    countyJitterMs: 30 * MINUTE,
    countySpreadBaseMs: 36 * MINUTE,
    countySpreadPerUnitMs: 28_000,
    countySpreadMaximumMs: 210 * MINUTE,
    mediumCountyThresholdPpm: 180_000,
    largeCountyThresholdPpm: 500_000,
    mediumCountyExtraDelayMs: 70 * MINUTE,
    largeCountyExtraDelayMs: 155 * MINUTE,
    centralCountDelayMs: 150 * MINUTE,
    centralTimeCountyDelayMs: 60 * MINUTE,
    statewideResidualDelayMs: 9 * HOUR,
  }),
});

export const MICHIGAN_REPLAY_CAPABILITY: JurisdictionReplayCapability = Object.freeze({
  kind: "detailed",
  sourceUnitLabel: "2024 Michigan geometry-linked precinct result unit",
  mapUnitLabel: "2024 Michigan precinct reporting-unit geometry",
  residualTreatment: "explicit-off-map",
  methodologyNote: "Exact-cycle mapped precinct result units report atomically; unmatched precincts, central-count units, and the statewide adjustment remain explicit off-map returns. The replay clock begins at Michigan's first statewide poll-close boundary, while four Central Time counties are administratively gated for one additional hour.",
});

export interface MichiganScheduleCounty {
  countyId: string;
  totalVotes: number;
  unitCount: number;
}

export interface MichiganScheduleUnit {
  unitId: string;
  countyId: string | null;
  unitType: LockedReportingUnitType;
  totalVotes: number;
}

export interface ScheduledMichiganUnit {
  unitId: string;
  replayTimeMs: number;
  orderTieBreaker: number;
  eventId: string;
}

export interface CompiledMichiganReplay
  extends CompiledJurisdictionReplay<MichiganReplayDefinition, MichiganProfile> {
  schemaVersion: typeof COMPILED_EVENT_STREAM_SCHEMA_VERSION;
  compilerVersion: typeof MICHIGAN_REPLAY_COMPILER_VERSION;
  replaySchemaVersion: typeof REPLAY_SCHEMA_VERSION;
  endpointContentFingerprint: string;
  definition: MichiganReplayDefinition;
  profile: MichiganProfile;
  events: readonly CompiledReportingEvent[];
  eventStreamFingerprint: string;
}

function requireString(value: string, label: string) {
  const normalized = value.normalize("NFC");
  if (normalized.length === 0) throw new Error(`${label} cannot be empty`);
  return normalized;
}

function requireInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function profileFor(profileId: MichiganReportingProfileId) {
  const profile = MICHIGAN_PROFILES[profileId];
  if (!profile) throw new Error(`Unsupported Michigan reporting profile ${profileId}`);
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

function normalizedScheduleInputs(
  units: readonly MichiganScheduleUnit[],
  counties: readonly MichiganScheduleCounty[],
) {
  const normalizedCounties = counties.map((county) => ({
    countyId: requireString(county.countyId, "Schedule county identifier"),
    totalVotes: requireInteger(county.totalVotes, `${county.countyId} schedule votes`),
    unitCount: requireInteger(county.unitCount, `${county.countyId} schedule unit count`),
  })).sort((left, right) => canonicalStringCompare(left.countyId, right.countyId));
  const countyIds = new Set<string>();
  for (const county of normalizedCounties) {
    if (countyIds.has(county.countyId)) throw new Error(`Duplicate schedule county ${county.countyId}`);
    countyIds.add(county.countyId);
  }
  const normalizedUnits = units.map((unit) => ({
    unitId: requireString(unit.unitId, "Schedule unit identifier"),
    countyId: unit.countyId == null ? null : requireString(unit.countyId, "Schedule county"),
    unitType: unit.unitType,
    totalVotes: requireInteger(unit.totalVotes, `${unit.unitId} schedule votes`),
  })).sort((left, right) => canonicalStringCompare(left.unitId, right.unitId));
  const unitIds = new Set<string>();
  for (const unit of normalizedUnits) {
    if (unitIds.has(unit.unitId)) throw new Error(`Duplicate schedule unit ${unit.unitId}`);
    if (!LOCKED_REPORTING_UNIT_TYPES.has(unit.unitType)) {
      throw new Error(`Schedule unit ${unit.unitId} has unsupported type ${unit.unitType}`);
    }
    if (unit.countyId != null && !countyIds.has(unit.countyId)) {
      throw new Error(`Schedule unit ${unit.unitId} references unknown county ${unit.countyId}`);
    }
    unitIds.add(unit.unitId);
  }
  for (const county of normalizedCounties) {
    const local = normalizedUnits.filter((unit) => unit.countyId === county.countyId);
    if (local.length !== county.unitCount) {
      throw new Error(`${county.countyId} schedule unit count does not reconcile`);
    }
    if (local.reduce((sum, unit) => sum + unit.totalVotes, 0) !== county.totalVotes) {
      throw new Error(`${county.countyId} schedule vote workload does not reconcile`);
    }
  }
  return { units: normalizedUnits, counties: normalizedCounties };
}

export async function scheduleMichiganReportingUnits(
  units: readonly MichiganScheduleUnit[],
  counties: readonly MichiganScheduleCounty[],
  definition: MichiganReplayDefinition,
): Promise<ScheduledMichiganUnit[]> {
  const profile = profileFor(definition.profileId);
  const rootSeed = requireString(definition.rootSeed, "Replay root seed");
  const normalized = normalizedScheduleInputs(units, counties);
  const maximumCountyVotes = Math.max(1, ...normalized.counties.map((county) => county.totalVotes));
  const countySchedule = new Map<string, { activationMs: number; spreadMs: number }>();
  await Promise.all(normalized.counties.map(async (county) => {
    const stream = await createNamedReplayRandomStream(
      rootSeed,
      `activation/county/MI/${county.countyId}`,
      profile.id,
    );
    const workloadPpm = Math.round(county.totalVotes / maximumCountyVotes * 1_000_000);
    const sizeDelay = Math.round(Math.sqrt(workloadPpm / 1_000_000) * profile.countySizeDelayMs);
    const profileExtra = workloadPpm >= profile.largeCountyThresholdPpm
      ? profile.largeCountyExtraDelayMs
      : workloadPpm >= profile.mediumCountyThresholdPpm
        ? profile.mediumCountyExtraDelayMs
        : 0;
    const localPollCloseGate = CENTRAL_TIME_COUNTY_FIPS.has(county.countyId)
      ? profile.centralTimeCountyDelayMs
      : 0;
    countySchedule.set(county.countyId, {
      activationMs: Math.max(
        localPollCloseGate + profile.minimumReturnDelayMs,
        profile.minimumReturnDelayMs
          + profile.countyBaseDelayMs
          + sizeDelay
          + profileExtra
          + Math.floor(stream.nextFloat() * profile.countyJitterMs),
      ),
      spreadMs: Math.min(
        profile.countySpreadMaximumMs,
        profile.countySpreadBaseMs + county.unitCount * profile.countySpreadPerUnitMs,
      ),
    });
  }));
  return Promise.all(normalized.units.map(async (unit) => {
    const residual = unit.countyId == null;
    const stream = await createNamedReplayRandomStream(
      rootSeed,
      residual
        ? `timing/residual/MI/${unit.unitId}`
        : `timing/unit/MI/${unit.unitId}`,
      profile.id,
    );
    const county = unit.countyId == null ? null : countySchedule.get(unit.countyId);
    if (unit.countyId != null && !county) throw new Error(`Missing county schedule ${unit.countyId}`);
    const unitTypeDelay = unit.unitType === "central-count" ? profile.centralCountDelayMs : 0;
    const replayTimeMs = residual
      ? profile.statewideResidualDelayMs + Math.floor(stream.nextFloat() * profile.countyJitterMs)
      : (county?.activationMs ?? 0)
        + unitTypeDelay
        + Math.floor(stream.nextFloat() * (county?.spreadMs ?? 0));
    return {
      unitId: unit.unitId,
      replayTimeMs,
      orderTieBreaker: stream.nextUint32(),
      eventId: await deriveReplayEventId({
        replaySchemaVersion: REPLAY_SCHEMA_VERSION,
        jurisdictionId: "MI",
        unitId: unit.unitId,
        eventType: "RETURN_PUBLISHED",
        batchOrdinal: 0,
      }),
    };
  }));
}

function michiganJurisdiction(endpoint: LockedElectionEndpoint) {
  const jurisdictions = endpoint.content.jurisdictions.filter(
    (jurisdiction) => jurisdiction.jurisdictionId === "MI",
  );
  if (jurisdictions.length !== 1 || jurisdictions[0].reportingUnits.length === 0) {
    throw new Error("Locked endpoint must contain one detailed Michigan jurisdiction");
  }
  return jurisdictions[0];
}

function schedulingInputs(michigan: LockedJurisdictionEndpointInput) {
  return {
    counties: michigan.counties.map((county) => ({
      countyId: county.countyId,
      totalVotes: county.totalVotes,
      unitCount: michigan.reportingUnits.filter((unit) => unit.countyId === county.countyId).length,
    })),
    units: michigan.reportingUnits.map((unit) => ({
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
    jurisdictionId: "MI",
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

function streamPreimage(stream: Omit<CompiledMichiganReplay, "eventStreamFingerprint">) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export function serializeCompiledMichiganReplay(stream: CompiledMichiganReplay) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export async function compileMichiganEventStream(
  endpoint: LockedElectionEndpoint,
  definition: MichiganReplayDefinition,
): Promise<CompiledMichiganReplay> {
  const before = serializeLockedElectionEndpoint(endpoint);
  const verifiedEndpoint = await deserializeLockedElectionEndpoint(before);
  const michigan = michiganJurisdiction(verifiedEndpoint);
  const profile = profileFor(definition.profileId);
  const normalizedDefinition: MichiganReplayDefinition = {
    profileId: profile.id,
    rootSeed: requireString(definition.rootSeed, "Replay root seed"),
  };
  const scheduleInput = schedulingInputs(michigan);
  const scheduledUnits = await scheduleMichiganReportingUnits(
    scheduleInput.units,
    scheduleInput.counties,
    normalizedDefinition,
  );
  const unitById = new Map(michigan.reportingUnits.map((unit) => [unit.unitId, unit]));
  const returnEvents: Array<Omit<CompiledReportingEvent, "sequence">> = scheduledUnits.map(
    (scheduled) => {
      const unit = unitById.get(scheduled.unitId);
      if (!unit) throw new Error(`Scheduled unknown Michigan unit ${scheduled.unitId}`);
      return {
        eventId: scheduled.eventId,
        replaySchemaVersion: REPLAY_SCHEMA_VERSION,
        jurisdictionId: "MI",
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
  const [pollCloseId, completeId] = await Promise.all([
    deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId: "MI",
      unitId: null,
      eventType: "POLL_CLOSE",
      batchOrdinal: 0,
    }),
    deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId: "MI",
      unitId: null,
      eventType: "REPLAY_COMPLETED",
      batchOrdinal: 0,
    }),
  ]);
  const lastReturnTimeMs = Math.max(...returnEvents.map((event) => event.replayTimeMs));
  const events = [
    zeroControlEvent(pollCloseId, "POLL_CLOSE", 0),
    ...returnEvents,
    zeroControlEvent(completeId, "REPLAY_COMPLETED", lastReturnTimeMs + 1),
  ].sort(compareEvents).map((event, sequence) => ({ ...event, sequence }));
  const withoutFingerprint = {
    schemaVersion: COMPILED_EVENT_STREAM_SCHEMA_VERSION,
    compilerVersion: MICHIGAN_REPLAY_COMPILER_VERSION,
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    endpointContentFingerprint: verifiedEndpoint.contentFingerprint,
    definition: normalizedDefinition,
    profile,
    events,
  } as const;
  const compiled = Object.freeze({
    ...withoutFingerprint,
    eventStreamFingerprint: await sha256Fingerprint(streamPreimage(withoutFingerprint)),
  }) satisfies CompiledMichiganReplay;
  await auditMichiganEventStream(verifiedEndpoint, compiled);
  if (serializeLockedElectionEndpoint(endpoint) !== before) {
    throw new Error("Michigan compiler mutated the locked endpoint");
  }
  return compiled;
}

export async function auditMichiganEventStream(
  endpoint: LockedElectionEndpoint,
  stream: CompiledMichiganReplay,
) {
  if (stream.compilerVersion !== MICHIGAN_REPLAY_COMPILER_VERSION) {
    throw new Error(`Unsupported Michigan compiler ${stream.compilerVersion}`);
  }
  const expectedProfile = profileFor(stream.definition.profileId);
  requireString(stream.definition.rootSeed, "Replay root seed");
  if (canonicalSerialize(stream.profile as unknown as CanonicalValue)
    !== canonicalSerialize(expectedProfile as unknown as CanonicalValue)) {
    throw new Error("Michigan stream profile does not match its versioned definition");
  }
  const { eventStreamFingerprint, ...withoutFingerprint } = stream;
  const expectedFingerprint = await sha256Fingerprint(
    streamPreimage(withoutFingerprint as Omit<CompiledMichiganReplay, "eventStreamFingerprint">),
  );
  if (eventStreamFingerprint !== expectedFingerprint) {
    throw new Error("Michigan compiled stream fingerprint mismatch");
  }
  return auditCompiledJurisdictionReplay(
    endpoint,
    stream,
    "MI",
    MICHIGAN_REPLAY_CAPABILITY,
    MICHIGAN_REPLAY_TIME_ZONE,
    MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
  );
}
