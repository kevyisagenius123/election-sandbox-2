import {
  COMPILED_EVENT_STREAM_SCHEMA_VERSION,
  REPLAY_SCHEMA_VERSION,
  type CandidateVote,
  type CompiledJurisdictionReplay,
  type CompiledReportingEvent,
  type LockedElectionEndpoint,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import { serializeLockedElectionEndpoint } from "./endpoint.ts";
import { deriveReplayEventId } from "./eventIdentity.ts";
import { sha256Fingerprint } from "./hash.ts";
import { verifyLockedEndpointForReplay } from "./jurisdictionContracts.ts";
import { createNamedReplayRandomStream } from "./prng.ts";

export const COARSE_FIXTURE_COMPILER_VERSION = "coarse-atomic-contract-fixture-v2" as const;
export const COARSE_FIXTURE_PROFILE_ID = "coarse-synthetic-atomic-v1" as const;

export interface CoarseFixtureReplayDefinition {
  profileId: typeof COARSE_FIXTURE_PROFILE_ID;
  rootSeed: string;
  timeZone: string;
  pollCloseInstant: string;
  returnEligibilityInstant?: string;
  minimumReturnDelayMs: number;
  returnJitterMs: number;
}

export interface CoarseFixtureReplayProfile {
  id: typeof COARSE_FIXTURE_PROFILE_ID;
  timezone: string;
  pollCloseInstant: string;
  returnEligibilityInstant: string;
  minimumReturnDelayMs: number;
  returnJitterMs: number;
  geographyClaim: "jurisdiction-total-only";
}

export interface CompiledCoarseFixtureReplay
  extends CompiledJurisdictionReplay<CoarseFixtureReplayDefinition, CoarseFixtureReplayProfile> {
  schemaVersion: typeof COMPILED_EVENT_STREAM_SCHEMA_VERSION;
  compilerVersion: typeof COARSE_FIXTURE_COMPILER_VERSION;
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

function requireIsoInstant(value: string, label = "Coarse fixture poll-close instant") {
  const normalized = requireString(value, label);
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) {
    throw new Error(`${label} must be canonical UTC`);
  }
  return normalized;
}

function requireTimeZone(value: string) {
  const normalized = requireString(value, "Coarse fixture time zone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
  } catch {
    throw new Error("Coarse fixture time zone must be a valid IANA zone");
  }
  return normalized;
}

function compareEvents(
  left: Pick<CompiledReportingEvent, "replayTimeMs" | "orderTieBreaker" | "eventId">,
  right: Pick<CompiledReportingEvent, "replayTimeMs" | "orderTieBreaker" | "eventId">,
) {
  return left.replayTimeMs - right.replayTimeMs
    || left.orderTieBreaker - right.orderTieBreaker
    || canonicalStringCompare(left.eventId, right.eventId);
}

async function controlEvent(
  jurisdictionId: string,
  eventType: "POLL_CLOSE" | "REPLAY_COMPLETED",
  replayTimeMs: number,
): Promise<Omit<CompiledReportingEvent, "sequence">> {
  return {
    eventId: await deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId,
      unitId: null,
      eventType,
      batchOrdinal: 0,
    }),
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId,
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

export async function compileAtomicCoarseJurisdictionFixture(
  endpoint: LockedElectionEndpoint,
  jurisdictionIdValue: string,
  definitionValue: CoarseFixtureReplayDefinition,
): Promise<CompiledCoarseFixtureReplay> {
  const before = Object.isFrozen(endpoint) ? null : serializeLockedElectionEndpoint(endpoint);
  const verifiedEndpoint = await verifyLockedEndpointForReplay(endpoint);
  const jurisdictionId = requireString(jurisdictionIdValue, "Coarse jurisdiction identifier");
  const jurisdiction = verifiedEndpoint.content.jurisdictions.find(
    (candidate) => candidate.jurisdictionId === jurisdictionId,
  );
  if (!jurisdiction) throw new Error(`Locked endpoint does not contain ${jurisdictionId}`);
  if (
    jurisdiction.counties.length !== 0
    || jurisdiction.reportingUnits.length !== 1
    || jurisdiction.reportingUnits[0].unitType !== "jurisdiction-total"
    || jurisdiction.reportingUnits[0].countyId !== null
    || jurisdiction.reportingUnits[0].geometryStatus !== "none"
  ) {
    throw new Error(`${jurisdictionId} is not an honest coarse jurisdiction-total endpoint`);
  }
  const definition: CoarseFixtureReplayDefinition = {
    profileId: COARSE_FIXTURE_PROFILE_ID,
    rootSeed: requireString(definitionValue.rootSeed, "Coarse fixture root seed"),
    timeZone: requireTimeZone(definitionValue.timeZone),
    pollCloseInstant: requireIsoInstant(definitionValue.pollCloseInstant),
    returnEligibilityInstant: requireIsoInstant(
      definitionValue.returnEligibilityInstant ?? definitionValue.pollCloseInstant,
      "Coarse fixture return-eligibility instant",
    ),
    minimumReturnDelayMs: requireInteger(
      definitionValue.minimumReturnDelayMs,
      "Coarse minimum return delay",
    ),
    returnJitterMs: requireInteger(definitionValue.returnJitterMs, "Coarse return jitter"),
  };
  if (definitionValue.profileId !== COARSE_FIXTURE_PROFILE_ID) {
    throw new Error(`Unsupported coarse fixture profile ${definitionValue.profileId}`);
  }
  const eligibilityDelayMs = new Date(definition.returnEligibilityInstant ?? "").getTime()
    - new Date(definition.pollCloseInstant).getTime();
  if (eligibilityDelayMs < 0) {
    throw new Error("Coarse return eligibility cannot precede poll close");
  }
  const profile: CoarseFixtureReplayProfile = {
    id: COARSE_FIXTURE_PROFILE_ID,
    timezone: definition.timeZone,
    pollCloseInstant: definition.pollCloseInstant,
    returnEligibilityInstant: definition.returnEligibilityInstant ?? definition.pollCloseInstant,
    minimumReturnDelayMs: definition.minimumReturnDelayMs,
    returnJitterMs: definition.returnJitterMs,
    geographyClaim: "jurisdiction-total-only",
  };
  const unit = jurisdiction.reportingUnits[0];

  // Scheduling is complete before the endpoint candidate vector is attached.
  const activation = await createNamedReplayRandomStream(
    definition.rootSeed,
    `activation/state/${jurisdictionId}`,
    profile.id,
  );
  const ordering = await createNamedReplayRandomStream(
    definition.rootSeed,
    `ordering/unit/${jurisdictionId}/${unit.unitId}`,
    profile.id,
  );
  const replayTimeMs = eligibilityDelayMs
    + definition.minimumReturnDelayMs
    + Math.floor(activation.nextFloat() * definition.returnJitterMs);
  const returnIdentity = {
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId,
    unitId: unit.unitId,
    eventType: "RETURN_PUBLISHED" as const,
    batchOrdinal: 0,
  };
  const scheduledReturn = {
    eventId: await deriveReplayEventId(returnIdentity),
    replayTimeMs,
    orderTieBreaker: ordering.nextUint32(),
  };
  const returnEvent: Omit<CompiledReportingEvent, "sequence"> = {
    ...returnIdentity,
    ...scheduledReturn,
    evidenceStatus: "synthetic",
    countyId: null,
    unitType: "jurisdiction-total",
    geometryStatus: "none",
    candidateDelta: unit.candidateVotes.map((candidate): CandidateVote => ({ ...candidate })),
    totalDelta: unit.totalVotes,
    voteEvidenceIds: [...unit.evidenceIds],
  };
  const unordered = [
    await controlEvent(jurisdictionId, "POLL_CLOSE", 0),
    returnEvent,
    await controlEvent(jurisdictionId, "REPLAY_COMPLETED", replayTimeMs + 1),
  ];
  const events = unordered.sort(compareEvents).map((event, sequence) => ({ ...event, sequence }));
  const withoutFingerprint = {
    schemaVersion: COMPILED_EVENT_STREAM_SCHEMA_VERSION,
    compilerVersion: COARSE_FIXTURE_COMPILER_VERSION,
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    endpointContentFingerprint: verifiedEndpoint.contentFingerprint,
    definition,
    profile,
    events,
  } as const;
  const compiled = Object.freeze({
    ...withoutFingerprint,
    eventStreamFingerprint: await sha256Fingerprint(
      canonicalSerialize(withoutFingerprint as unknown as CanonicalValue),
    ),
  });
  if (before != null && serializeLockedElectionEndpoint(endpoint) !== before) {
    throw new Error("Coarse fixture compiler mutated the locked endpoint");
  }
  return compiled;
}
