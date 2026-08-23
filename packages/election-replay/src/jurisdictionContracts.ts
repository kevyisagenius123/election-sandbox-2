import {
  COMPILED_EVENT_STREAM_SCHEMA_VERSION,
  REPLAY_SCHEMA_VERSION,
  type CandidateVote,
  type CandidateVoteVector,
  type CompiledJurisdictionReplay,
  type CompiledReportingEvent,
  type EvidenceStatus,
  type LockedElectionEndpoint,
  type LockedGeometryStatus,
  type LockedReportingUnitType,
  type ReplayEventType,
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
import { isSha256Fingerprint, sha256Fingerprint } from "./hash.ts";

export const JURISDICTION_REPLAY_ADMISSION_SCHEMA_VERSION = "rme-jurisdiction-admission-v1" as const;
export const REPLAY_ABSOLUTE_EPOCH = "1970-01-01T00:00:00.000Z" as const;

export type JurisdictionReplayCapabilityKind = "detailed" | "coarse" | "hybrid";
export type ReplayResidualTreatment = "none" | "explicit-off-map";

export interface JurisdictionReplayCapability {
  kind: JurisdictionReplayCapabilityKind;
  sourceUnitLabel: string | null;
  mapUnitLabel: string | null;
  residualTreatment: ReplayResidualTreatment;
  methodologyNote: string;
}

export interface JurisdictionReplayClock {
  epoch: typeof REPLAY_ABSOLUTE_EPOCH;
  timeZone: string;
  pollCloseInstant: string;
  pollCloseEpochMs: number;
  returnEligibilityInstant: string;
  returnEligibilityEpochMs: number;
}

export interface JurisdictionReplayEvidenceTrace {
  endpointContentFingerprint: string;
  compilerVersion: string;
  profileId: string;
  replayDefinitionFingerprint: string;
  eventStreamFingerprint: string;
  evidenceIds: readonly string[];
}

export interface JurisdictionReplayAudit {
  jurisdictionId: string;
  capabilityKind: JurisdictionReplayCapabilityKind;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  electoralVotes: number;
  reportingUnitCount: number;
  countyCount: number;
  returnEventCount: number;
  controlEventCount: number;
  offMapReturnCount: number;
  firstAbsoluteEventTimeMs: number;
  lastAbsoluteEventTimeMs: number;
}

export interface AdmittedJurisdictionReplay {
  schemaVersion: typeof JURISDICTION_REPLAY_ADMISSION_SCHEMA_VERSION;
  jurisdictionId: string;
  capability: JurisdictionReplayCapability;
  clock: JurisdictionReplayClock;
  evidence: JurisdictionReplayEvidenceTrace;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  electoralVotes: number;
  stream: CompiledJurisdictionReplay;
  audit: JurisdictionReplayAudit;
}

interface AdmissionInput {
  endpoint: LockedElectionEndpoint;
  stream: CompiledJurisdictionReplay;
  jurisdictionId: string;
  capability: JurisdictionReplayCapability;
  timeZone: string;
  pollCloseInstant: string;
  returnEligibilityInstant?: string;
}

type UnknownRecord = Record<string, unknown>;
const verifiedEndpointCache = new WeakMap<object, Promise<LockedElectionEndpoint>>();

const EVENT_TYPES = new Set<ReplayEventType>([
  "REPLAY_STARTED",
  "POLL_CLOSE",
  "REPORTING_OPENED",
  "RETURN_PUBLISHED",
  "RETURN_REPLACED",
  "COUNTY_STATUS_CHANGED",
  "LEAD_CHANGED",
  "OUTSTANDING_ESTIMATE_UPDATED",
  "CALL_STATUS_CHANGED",
  "ELECTORAL_SCORE_CHANGED",
  "PATH_STATUS_CHANGED",
  "REPLAY_COMPLETED",
]);
const EVIDENCE_STATUSES = new Set<EvidenceStatus>([
  "documented",
  "reconstructed",
  "modeled",
  "user_defined",
  "synthetic",
  "exact_endpoint",
]);
const UNIT_TYPES = new Set<LockedReportingUnitType>([
  "precinct",
  "vtd",
  "ward",
  "central-count",
  "residual",
  "jurisdiction-total",
]);
const GEOMETRY_STATUSES = new Set<LockedGeometryStatus>([
  "mapped",
  "off-map",
  "approximate",
  "none",
]);

function requireRecord(value: unknown, label: string): UnknownRecord {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
  return value as UnknownRecord;
}

function requireOnlyKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  label: string,
) {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}`);
    if (value[key] === undefined) throw new Error(`${label}.${key} cannot be undefined`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) throw new Error(`${label} is missing ${key}`);
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.normalize("NFC");
  if (normalized.length === 0) throw new Error(`${label} cannot be empty`);
  return normalized;
}

function requireNullableString(value: unknown, label: string) {
  return value == null ? null : requireString(value, label);
}

function requireNonnegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return Object.is(value, -0) ? 0 : value as number;
}

function requireUint32(value: unknown, label: string) {
  const integer = requireNonnegativeInteger(value, label);
  if (integer > 0xffff_ffff) throw new Error(`${label} must be an unsigned 32-bit integer`);
  return integer;
}

function requireIsoInstant(value: unknown, label: string) {
  const instant = requireString(value, label);
  const parsed = new Date(instant);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== instant) {
    throw new Error(`${label} must be a canonical ISO-8601 UTC instant`);
  }
  return instant;
}

function requireTimeZone(value: unknown, label: string) {
  const timeZone = requireString(value, label);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new Error(`${label} must be a valid IANA time zone`);
  }
  return timeZone;
}

function requireEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${label} is unsupported`);
  }
  return value as T;
}

function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const strings = value.map((entry, index) => requireString(entry, `${label}[${index}]`));
  if (new Set(strings).size !== strings.length) throw new Error(`${label} contains duplicates`);
  return strings;
}

function requireCandidateVector(value: unknown, label: string): CandidateVote[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array or null`);
  const vector = value.map((entry, index) => {
    const record = requireRecord(entry, `${label}[${index}]`);
    requireOnlyKeys(record, ["candidateId", "votes"], [], `${label}[${index}]`);
    return {
      candidateId: requireString(record.candidateId, `${label}[${index}].candidateId`),
      votes: requireNonnegativeInteger(record.votes, `${label}[${index}].votes`),
    };
  });
  if (new Set(vector.map((candidate) => candidate.candidateId)).size !== vector.length) {
    throw new Error(`${label} contains duplicate candidates`);
  }
  return vector;
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function verifyLockedEndpointForReplay(endpoint: LockedElectionEndpoint) {
  const verify = () => deserializeLockedElectionEndpoint(serializeLockedElectionEndpoint(endpoint));
  if (!Object.isFrozen(endpoint) || !Object.isFrozen(endpoint.content)) return verify();
  const cached = verifiedEndpointCache.get(endpoint);
  if (cached) return cached;
  const pending = verify();
  verifiedEndpointCache.set(endpoint, pending);
  return pending;
}

function normalizeCompiledEvent(value: unknown, index: number): CompiledReportingEvent {
  const label = `Compiled event ${index}`;
  const record = requireRecord(value, label);
  requireOnlyKeys(record, [
    "eventId",
    "replaySchemaVersion",
    "jurisdictionId",
    "unitId",
    "eventType",
    "batchOrdinal",
    "sequence",
    "replayTimeMs",
    "evidenceStatus",
    "countyId",
    "unitType",
    "geometryStatus",
    "candidateDelta",
    "totalDelta",
    "voteEvidenceIds",
    "orderTieBreaker",
  ], [], label);
  const unitType = record.unitType == null
    ? null
    : requireEnum(record.unitType, UNIT_TYPES, `${label}.unitType`);
  const geometryStatus = record.geometryStatus == null
    ? null
    : requireEnum(record.geometryStatus, GEOMETRY_STATUSES, `${label}.geometryStatus`);
  return {
    eventId: requireString(record.eventId, `${label}.eventId`),
    replaySchemaVersion: requireString(record.replaySchemaVersion, `${label}.replaySchemaVersion`),
    jurisdictionId: requireString(record.jurisdictionId, `${label}.jurisdictionId`),
    unitId: requireNullableString(record.unitId, `${label}.unitId`),
    eventType: requireEnum(record.eventType, EVENT_TYPES, `${label}.eventType`),
    batchOrdinal: requireNonnegativeInteger(record.batchOrdinal, `${label}.batchOrdinal`),
    sequence: requireNonnegativeInteger(record.sequence, `${label}.sequence`),
    replayTimeMs: requireNonnegativeInteger(record.replayTimeMs, `${label}.replayTimeMs`),
    evidenceStatus: requireEnum(
      record.evidenceStatus,
      EVIDENCE_STATUSES,
      `${label}.evidenceStatus`,
    ),
    countyId: requireNullableString(record.countyId, `${label}.countyId`),
    unitType,
    geometryStatus,
    candidateDelta: requireCandidateVector(record.candidateDelta, `${label}.candidateDelta`),
    totalDelta: requireNonnegativeInteger(record.totalDelta, `${label}.totalDelta`),
    voteEvidenceIds: requireStringArray(record.voteEvidenceIds, `${label}.voteEvidenceIds`),
    orderTieBreaker: requireUint32(record.orderTieBreaker, `${label}.orderTieBreaker`),
  };
}

function normalizeCompiledStream(value: unknown): CompiledJurisdictionReplay {
  const record = requireRecord(value, "Compiled jurisdiction replay");
  requireOnlyKeys(record, [
    "schemaVersion",
    "compilerVersion",
    "replaySchemaVersion",
    "endpointContentFingerprint",
    "definition",
    "profile",
    "events",
    "eventStreamFingerprint",
  ], [], "Compiled jurisdiction replay");
  if (record.schemaVersion !== COMPILED_EVENT_STREAM_SCHEMA_VERSION) {
    throw new Error(`Unsupported compiled stream schema ${String(record.schemaVersion)}`);
  }
  if (record.replaySchemaVersion !== REPLAY_SCHEMA_VERSION) {
    throw new Error(`Unsupported replay schema ${String(record.replaySchemaVersion)}`);
  }
  const endpointContentFingerprint = requireString(
    record.endpointContentFingerprint,
    "Compiled endpoint fingerprint",
  );
  const eventStreamFingerprint = requireString(
    record.eventStreamFingerprint,
    "Compiled stream fingerprint",
  );
  if (!isSha256Fingerprint(endpointContentFingerprint) || !isSha256Fingerprint(eventStreamFingerprint)) {
    throw new Error("Compiled replay fingerprints must be SHA-256 fingerprints");
  }
  requireRecord(record.definition, "Compiled replay definition");
  requireRecord(record.profile, "Compiled replay profile");
  canonicalSerialize(record.definition as CanonicalValue);
  canonicalSerialize(record.profile as CanonicalValue);
  if (!Array.isArray(record.events)) throw new Error("Compiled replay events must be an array");
  return {
    schemaVersion: COMPILED_EVENT_STREAM_SCHEMA_VERSION,
    compilerVersion: requireString(record.compilerVersion, "Compiled compiler version"),
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    endpointContentFingerprint,
    definition: record.definition,
    profile: record.profile,
    events: record.events.map((event, index) => normalizeCompiledEvent(event, index)),
    eventStreamFingerprint,
  };
}

export function serializeCompiledJurisdictionReplay(stream: CompiledJurisdictionReplay) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export async function compiledJurisdictionReplayFingerprint(stream: CompiledJurisdictionReplay) {
  const withoutFingerprint = Object.fromEntries(
    Object.entries(stream).filter(([key]) => key !== "eventStreamFingerprint"),
  );
  return sha256Fingerprint(canonicalSerialize(withoutFingerprint as unknown as CanonicalValue));
}

export async function deserializeCompiledJurisdictionReplay(serialized: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Compiled jurisdiction replay is not valid JSON");
  }
  const stream = normalizeCompiledStream(parsed);
  const expected = await compiledJurisdictionReplayFingerprint(stream);
  if (stream.eventStreamFingerprint !== expected) {
    throw new Error(
      `Compiled stream fingerprint mismatch: expected ${expected}, `
      + `received ${stream.eventStreamFingerprint}`,
    );
  }
  return deepFreeze(stream);
}

function compareEvents(left: CompiledReportingEvent, right: CompiledReportingEvent) {
  return left.replayTimeMs - right.replayTimeMs
    || left.orderTieBreaker - right.orderTieBreaker
    || canonicalStringCompare(left.eventId, right.eventId);
}

function assertVectorEqual(expected: CandidateVoteVector, actual: CandidateVoteVector, label: string) {
  if (
    expected.length !== actual.length
    || expected.some((candidate, index) => (
      candidate.candidateId !== actual[index]?.candidateId
      || candidate.votes !== actual[index]?.votes
    ))
  ) {
    throw new Error(`${label} candidate vector does not reconcile`);
  }
}

function assertStringArrayEqual(expected: readonly string[], actual: readonly string[], label: string) {
  if (
    expected.length !== actual.length
    || expected.some((value, index) => value !== actual[index])
  ) {
    throw new Error(`${label} does not reconcile`);
  }
}

function vectorMap(candidateIds: readonly string[]) {
  return new Map(candidateIds.map((candidateId) => [candidateId, 0]));
}

function addVector(target: Map<string, number>, vector: CandidateVoteVector) {
  for (const candidate of vector) {
    if (!target.has(candidate.candidateId)) {
      throw new Error(`Compiled return contains unknown candidate ${candidate.candidateId}`);
    }
    const next = (target.get(candidate.candidateId) ?? 0) + candidate.votes;
    if (!Number.isSafeInteger(next)) throw new Error("Compiled candidate total overflowed");
    target.set(candidate.candidateId, next);
  }
}

function mapVector(target: ReadonlyMap<string, number>, ids: readonly string[]) {
  return ids.map((candidateId) => ({ candidateId, votes: target.get(candidateId) ?? 0 }));
}

function validateCapability(
  capability: JurisdictionReplayCapability,
  jurisdiction: LockedElectionEndpoint["content"]["jurisdictions"][number],
) {
  const localUnits = jurisdiction.reportingUnits.filter(
    (unit) => unit.unitType !== "jurisdiction-total",
  );
  const residualUnits = jurisdiction.reportingUnits.filter(
    (unit) => unit.geometryStatus === "off-map" || unit.geometryStatus === "none",
  );
  if (capability.kind === "coarse") {
    if (
      jurisdiction.counties.length !== 0
      || jurisdiction.reportingUnits.length !== 1
      || jurisdiction.reportingUnits[0].unitType !== "jurisdiction-total"
      || jurisdiction.reportingUnits[0].countyId !== null
      || jurisdiction.reportingUnits[0].geometryStatus !== "none"
      || capability.sourceUnitLabel !== null
      || capability.mapUnitLabel !== null
      || capability.residualTreatment !== "none"
    ) {
      throw new Error(`${jurisdiction.jurisdictionId} is not compatible with coarse replay`);
    }
    return;
  }
  if (jurisdiction.counties.length === 0 || localUnits.length === 0) {
    throw new Error(`${jurisdiction.jurisdictionId} lacks detailed replay geography`);
  }
  if (capability.sourceUnitLabel == null || capability.mapUnitLabel == null) {
    throw new Error(`${jurisdiction.jurisdictionId} detailed capability requires geography labels`);
  }
  if (capability.kind === "hybrid" && residualUnits.length === 0) {
    throw new Error(`${jurisdiction.jurisdictionId} hybrid capability requires explicit residuals`);
  }
  const expectedResidualTreatment = residualUnits.length > 0 ? "explicit-off-map" : "none";
  if (capability.residualTreatment !== expectedResidualTreatment) {
    throw new Error(`${jurisdiction.jurisdictionId} residual treatment is not explicit`);
  }
}

function normalizeCapability(capability: JurisdictionReplayCapability) {
  const kinds = new Set<JurisdictionReplayCapabilityKind>(["detailed", "coarse", "hybrid"]);
  const residuals = new Set<ReplayResidualTreatment>(["none", "explicit-off-map"]);
  return {
    kind: requireEnum(capability.kind, kinds, "Replay capability kind"),
    sourceUnitLabel: requireNullableString(capability.sourceUnitLabel, "Source unit label"),
    mapUnitLabel: requireNullableString(capability.mapUnitLabel, "Map unit label"),
    residualTreatment: requireEnum(
      capability.residualTreatment,
      residuals,
      "Residual treatment",
    ),
    methodologyNote: requireString(capability.methodologyNote, "Capability methodology note"),
  } satisfies JurisdictionReplayCapability;
}

function clockFor(
  timeZoneValue: string,
  pollCloseInstantValue: string,
  returnEligibilityInstantValue?: string,
): JurisdictionReplayClock {
  const timeZone = requireTimeZone(timeZoneValue, "Jurisdiction replay time zone");
  const pollCloseInstant = requireIsoInstant(
    pollCloseInstantValue,
    "Jurisdiction poll-close instant",
  );
  const returnEligibilityInstant = requireIsoInstant(
    returnEligibilityInstantValue ?? pollCloseInstant,
    "Jurisdiction return-eligibility instant",
  );
  const pollCloseEpochMs = new Date(pollCloseInstant).getTime();
  const returnEligibilityEpochMs = new Date(returnEligibilityInstant).getTime();
  if (returnEligibilityEpochMs < pollCloseEpochMs) {
    throw new Error("Jurisdiction return eligibility cannot precede poll close");
  }
  return {
    epoch: REPLAY_ABSOLUTE_EPOCH,
    timeZone,
    pollCloseInstant,
    pollCloseEpochMs,
    returnEligibilityInstant,
    returnEligibilityEpochMs,
  };
}

function profileIdentity(stream: CompiledJurisdictionReplay) {
  const profile = requireRecord(stream.profile, "Compiled replay profile");
  const definition = requireRecord(stream.definition, "Compiled replay definition");
  const profileId = requireString(
    definition.profileId ?? profile.id,
    "Compiled replay profile identifier",
  );
  return { profile, definition, profileId };
}

export async function auditCompiledJurisdictionReplay(
  endpoint: LockedElectionEndpoint,
  streamValue: CompiledJurisdictionReplay,
  jurisdictionIdValue: string,
  capabilityValue: JurisdictionReplayCapability,
  timeZone: string,
  pollCloseInstant: string,
  returnEligibilityInstant?: string,
): Promise<JurisdictionReplayAudit> {
  const verifiedEndpoint = await verifyLockedEndpointForReplay(endpoint);
  const stream = await deserializeCompiledJurisdictionReplay(
    serializeCompiledJurisdictionReplay(streamValue),
  );
  const jurisdictionId = requireString(jurisdictionIdValue, "Jurisdiction identifier");
  const jurisdiction = verifiedEndpoint.content.jurisdictions.find(
    (candidate) => candidate.jurisdictionId === jurisdictionId,
  );
  if (!jurisdiction) throw new Error(`Locked endpoint does not contain ${jurisdictionId}`);
  if (stream.endpointContentFingerprint !== verifiedEndpoint.contentFingerprint) {
    throw new Error(`${jurisdictionId} stream references another locked endpoint`);
  }
  const capability = normalizeCapability(capabilityValue);
  validateCapability(capability, jurisdiction);
  const clock = clockFor(timeZone, pollCloseInstant, returnEligibilityInstant);
  const { profile } = profileIdentity(stream);
  if (
    profile.timezone !== clock.timeZone
    || profile.pollCloseInstant !== clock.pollCloseInstant
    || (profile.returnEligibilityInstant ?? profile.pollCloseInstant)
      !== clock.returnEligibilityInstant
  ) {
    throw new Error(`${jurisdictionId} stream clock does not match its profile`);
  }
  const expectedIds = await Promise.all(stream.events.map((event) => deriveReplayEventId({
    replaySchemaVersion: event.replaySchemaVersion,
    jurisdictionId: event.jurisdictionId,
    unitId: event.unitId,
    eventType: event.eventType,
    batchOrdinal: event.batchOrdinal,
  })));
  const seenEvents = new Set<string>();
  for (let index = 0; index < stream.events.length; index += 1) {
    const event = stream.events[index];
    if (event.jurisdictionId !== jurisdictionId) {
      throw new Error(`${jurisdictionId} stream contains an event for ${event.jurisdictionId}`);
    }
    if (event.replaySchemaVersion !== REPLAY_SCHEMA_VERSION) {
      throw new Error(`${event.eventId} uses an unsupported replay schema`);
    }
    if (event.sequence !== index) throw new Error(`${event.eventId} has invalid local sequence`);
    if (index > 0 && compareEvents(stream.events[index - 1], event) >= 0) {
      throw new Error(`${jurisdictionId} stream order is not canonical`);
    }
    if (seenEvents.has(event.eventId)) throw new Error(`Duplicate event identity ${event.eventId}`);
    if (expectedIds[index] !== event.eventId) throw new Error(`Invalid event identity ${event.eventId}`);
    seenEvents.add(event.eventId);
  }
  if (
    stream.events[0]?.eventType !== "POLL_CLOSE"
    || stream.events[0].replayTimeMs !== 0
    || stream.events[0].totalDelta !== 0
  ) {
    throw new Error(`${jurisdictionId} replay must begin at poll close with zero votes`);
  }
  if (stream.events.at(-1)?.eventType !== "REPLAY_COMPLETED") {
    throw new Error(`${jurisdictionId} replay must end with replay completion`);
  }

  const candidateIds = jurisdiction.candidateVotes.map((candidate) => candidate.candidateId);
  const stateAggregate = vectorMap(candidateIds);
  const countyAggregates = new Map(
    jurisdiction.counties.map((county) => [county.countyId, vectorMap(candidateIds)]),
  );
  const unitById = new Map(jurisdiction.reportingUnits.map((unit) => [unit.unitId, unit]));
  const seenUnits = new Set<string>();
  let returnEventCount = 0;
  let controlEventCount = 0;
  let offMapReturnCount = 0;
  let lastReturnTime = 0;
  for (const event of stream.events) {
    if (event.eventType !== "RETURN_PUBLISHED") {
      controlEventCount += 1;
      if (
        (event.eventType !== "POLL_CLOSE" && event.eventType !== "REPLAY_COMPLETED")
        || event.unitId !== null
        || event.candidateDelta !== null
        || event.totalDelta !== 0
        || event.voteEvidenceIds.length !== 0
      ) {
        throw new Error(`${jurisdictionId} contains an unsupported control event`);
      }
      continue;
    }
    returnEventCount += 1;
    if (event.unitId == null || event.candidateDelta == null || event.batchOrdinal !== 0) {
      throw new Error(`${event.eventId} is not an atomic reporting-unit return`);
    }
    if (seenUnits.has(event.unitId)) throw new Error(`${event.unitId} reports more than once`);
    if (clock.pollCloseEpochMs + event.replayTimeMs < clock.returnEligibilityEpochMs) {
      throw new Error(`${event.eventId} reports before its jurisdiction is eligible`);
    }
    const unit = unitById.get(event.unitId);
    if (!unit) throw new Error(`${event.eventId} references an unknown reporting unit`);
    if (
      event.countyId !== unit.countyId
      || event.unitType !== unit.unitType
      || event.geometryStatus !== unit.geometryStatus
    ) {
      throw new Error(`${event.eventId} changed reporting-unit geography`);
    }
    assertVectorEqual(unit.candidateVotes, event.candidateDelta, unit.unitId);
    assertStringArrayEqual(unit.evidenceIds, event.voteEvidenceIds, `${unit.unitId} evidence`);
    const eventTotal = event.candidateDelta.reduce((sum, candidate) => sum + candidate.votes, 0);
    if (eventTotal !== event.totalDelta || event.totalDelta !== unit.totalVotes) {
      throw new Error(`${event.eventId} vote total does not reconcile`);
    }
    addVector(stateAggregate, event.candidateDelta);
    for (const candidate of jurisdiction.candidateVotes) {
      if ((stateAggregate.get(candidate.candidateId) ?? 0) > candidate.votes) {
        throw new Error(`${jurisdictionId} prefix over-reports ${candidate.candidateId}`);
      }
    }
    if (event.countyId != null) {
      const county = countyAggregates.get(event.countyId);
      if (!county) throw new Error(`${event.eventId} references an unknown county`);
      addVector(county, event.candidateDelta);
    }
    if (event.geometryStatus === "off-map" || event.geometryStatus === "none") {
      offMapReturnCount += 1;
    }
    lastReturnTime = Math.max(lastReturnTime, event.replayTimeMs);
    seenUnits.add(event.unitId);
  }
  if (seenUnits.size !== jurisdiction.reportingUnits.length) {
    throw new Error(`${jurisdictionId} did not report every locked unit`);
  }
  if (controlEventCount !== 2 || stream.events.at(-1)?.replayTimeMs !== lastReturnTime + 1) {
    throw new Error(`${jurisdictionId} lifecycle controls do not reconcile`);
  }
  for (const county of jurisdiction.counties) {
    assertVectorEqual(
      county.candidateVotes,
      mapVector(countyAggregates.get(county.countyId) ?? new Map(), candidateIds),
      county.countyId,
    );
  }
  const candidateVotes = mapVector(stateAggregate, candidateIds);
  assertVectorEqual(jurisdiction.candidateVotes, candidateVotes, jurisdictionId);
  const totalVotes = candidateVotes.reduce((sum, candidate) => sum + candidate.votes, 0);
  if (totalVotes !== jurisdiction.totalVotes) throw new Error(`${jurisdictionId} total does not reconcile`);
  return deepFreeze({
    jurisdictionId,
    capabilityKind: capability.kind,
    candidateVotes,
    totalVotes,
    electoralVotes: jurisdiction.electoralVotes,
    reportingUnitCount: jurisdiction.reportingUnits.length,
    countyCount: jurisdiction.counties.length,
    returnEventCount,
    controlEventCount,
    offMapReturnCount,
    firstAbsoluteEventTimeMs: clock.pollCloseEpochMs + (stream.events[0]?.replayTimeMs ?? 0),
    lastAbsoluteEventTimeMs: clock.pollCloseEpochMs + (stream.events.at(-1)?.replayTimeMs ?? 0),
  });
}

export async function admitCompiledJurisdictionReplay(
  input: AdmissionInput,
): Promise<AdmittedJurisdictionReplay> {
  const capability = normalizeCapability(input.capability);
  const clock = clockFor(
    input.timeZone,
    input.pollCloseInstant,
    input.returnEligibilityInstant,
  );
  const audit = await auditCompiledJurisdictionReplay(
    input.endpoint,
    input.stream,
    input.jurisdictionId,
    capability,
    clock.timeZone,
    clock.pollCloseInstant,
    clock.returnEligibilityInstant,
  );
  const verifiedEndpoint = await verifyLockedEndpointForReplay(input.endpoint);
  const jurisdiction = verifiedEndpoint.content.jurisdictions.find(
    (candidate) => candidate.jurisdictionId === audit.jurisdictionId,
  );
  if (!jurisdiction) throw new Error(`Missing admitted jurisdiction ${audit.jurisdictionId}`);
  const { definition, profileId } = profileIdentity(input.stream);
  const evidenceIds = [...new Set([
    ...jurisdiction.evidenceIds,
    ...jurisdiction.counties.flatMap((county) => county.evidenceIds),
    ...jurisdiction.reportingUnits.flatMap((unit) => unit.evidenceIds),
    ...input.stream.events.flatMap((event) => event.voteEvidenceIds),
  ])].sort(canonicalStringCompare);
  const knownEvidence = new Set(verifiedEndpoint.content.evidence.map((evidence) => evidence.id));
  for (const evidenceId of evidenceIds) {
    if (!knownEvidence.has(evidenceId)) throw new Error(`Unknown replay evidence ${evidenceId}`);
  }
  return deepFreeze({
    schemaVersion: JURISDICTION_REPLAY_ADMISSION_SCHEMA_VERSION,
    jurisdictionId: audit.jurisdictionId,
    capability,
    clock,
    evidence: {
      endpointContentFingerprint: verifiedEndpoint.contentFingerprint,
      compilerVersion: input.stream.compilerVersion,
      profileId,
      replayDefinitionFingerprint: await sha256Fingerprint(
        canonicalSerialize(definition as CanonicalValue),
      ),
      eventStreamFingerprint: input.stream.eventStreamFingerprint,
      evidenceIds,
    },
    candidateVotes: jurisdiction.candidateVotes.map((candidate) => ({ ...candidate })),
    totalVotes: jurisdiction.totalVotes,
    electoralVotes: jurisdiction.electoralVotes,
    stream: input.stream,
    audit,
  });
}
