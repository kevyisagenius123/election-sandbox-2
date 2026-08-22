import {
  LOCKED_ENDPOINT_SCHEMA_VERSION,
  type CandidateDefinition,
  type CandidateVote,
  type CandidateVoteVector,
  type ElectoralAllocationEntry,
  type EndpointLockMetadata,
  type EndpointReconciliation,
  type EvidenceReference,
  type EvidenceStatus,
  type LockedCountyEndpointInput,
  type LockedElectionContent,
  type LockedElectionContentInput,
  type LockedElectionEndpoint,
  type LockedElectionEndpointInput,
  type LockedGeometryStatus,
  type LockedJurisdictionEndpointInput,
  type LockedReportingUnitEndpointInput,
  type LockedReportingUnitType,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import { isSha256Fingerprint, sha256Fingerprint } from "./hash.ts";

type UnknownRecord = Record<string, unknown>;

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

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
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

function requireIsoInstant(value: unknown, label: string) {
  const instant = requireString(value, label);
  const parsed = new Date(instant);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== instant) {
    throw new Error(`${label} must be a canonical ISO-8601 UTC instant`);
  }
  return instant;
}

function compareById<T extends { id: string }>(left: T, right: T) {
  return canonicalStringCompare(left.id, right.id);
}

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} contains duplicate identifier ${value}`);
    seen.add(value);
  }
}

function normalizeStringSet(value: unknown, label: string) {
  const normalized = requireArray(value, label)
    .map((entry, index) => requireString(entry, `${label}[${index}]`))
    .sort(canonicalStringCompare);
  assertUnique(normalized, label);
  return normalized;
}

function normalizeCandidateDefinitions(value: unknown) {
  const candidates = requireArray(value, "Endpoint candidates").map((candidate, index) => {
    const record = requireRecord(candidate, `Endpoint candidate ${index}`);
    requireOnlyKeys(
      record,
      ["id", "name", "shortName", "partyId", "displayOrder"],
      [],
      `Endpoint candidate ${index}`,
    );
    return {
      id: requireString(record.id, `Endpoint candidate ${index} identifier`),
      name: requireString(record.name, `Endpoint candidate ${index} name`),
      shortName: requireString(record.shortName, `Endpoint candidate ${index} short name`),
      partyId: requireNullableString(record.partyId, `Endpoint candidate ${index} party`),
      displayOrder: requireNonnegativeInteger(
        record.displayOrder,
        `Endpoint candidate ${index} display order`,
      ),
    } satisfies CandidateDefinition;
  }).sort(compareById);
  if (candidates.length === 0) throw new Error("Endpoint must define at least one candidate");
  assertUnique(candidates.map((candidate) => candidate.id), "Endpoint candidates");
  assertUnique(
    candidates.map((candidate) => String(candidate.displayOrder)),
    "Endpoint candidate display orders",
  );
  return candidates;
}

function normalizeCandidateVotes(
  value: unknown,
  candidateIds: readonly string[],
  label: string,
): CandidateVote[] {
  const votes = requireArray(value, label).map((candidateVote, index) => {
    const record = requireRecord(candidateVote, `${label}[${index}]`);
    requireOnlyKeys(record, ["candidateId", "votes"], [], `${label}[${index}]`);
    return {
      candidateId: requireString(record.candidateId, `${label}[${index}] candidate`),
      votes: requireNonnegativeInteger(record.votes, `${label}[${index}] votes`),
    };
  }).sort((left, right) => canonicalStringCompare(left.candidateId, right.candidateId));
  assertUnique(votes.map((candidate) => candidate.candidateId), label);
  const actualIds = votes.map((candidate) => candidate.candidateId);
  if (
    actualIds.length !== candidateIds.length
    || actualIds.some((candidateId, index) => candidateId !== candidateIds[index])
  ) {
    const unknown = actualIds.filter((candidateId) => !candidateIds.includes(candidateId));
    const missing = candidateIds.filter((candidateId) => !actualIds.includes(candidateId));
    throw new Error(
      `${label} must contain every endpoint candidate exactly once`
      + `${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}`
      + `${missing.length ? `; missing: ${missing.join(", ")}` : ""}`,
    );
  }
  return votes;
}

function totalVector(votes: CandidateVoteVector) {
  return votes.reduce((sum, candidate) => sum + candidate.votes, 0);
}

function emptyVector(candidateIds: readonly string[]) {
  return new Map(candidateIds.map((candidateId) => [candidateId, 0]));
}

function addVector(target: Map<string, number>, votes: CandidateVoteVector) {
  for (const candidate of votes) {
    const next = (target.get(candidate.candidateId) ?? 0) + candidate.votes;
    if (!Number.isSafeInteger(next)) throw new Error("Candidate vote aggregation overflowed");
    target.set(candidate.candidateId, next);
  }
}

function mapAsVector(target: ReadonlyMap<string, number>, candidateIds: readonly string[]) {
  return candidateIds.map((candidateId) => ({
    candidateId,
    votes: target.get(candidateId) ?? 0,
  }));
}

function assertVectorEquals(
  expected: CandidateVoteVector,
  actual: CandidateVoteVector,
  label: string,
) {
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

function normalizeEvidence(value: unknown) {
  const evidence = requireArray(value, "Endpoint evidence").map((item, index) => {
    const record = requireRecord(item, `Endpoint evidence ${index}`);
    requireOnlyKeys(
      record,
      ["id", "publisher", "title", "sourceUrl", "retrievedAt", "status", "limitations"],
      ["artifactSha256"],
      `Endpoint evidence ${index}`,
    );
    const status = requireString(record.status, `Endpoint evidence ${index} status`);
    if (!EVIDENCE_STATUSES.has(status as EvidenceStatus)) {
      throw new Error(`Endpoint evidence ${index} has unknown status ${status}`);
    }
    const artifactSha256 = Object.hasOwn(record, "artifactSha256")
      ? requireString(record.artifactSha256, `Endpoint evidence ${index} checksum`).toLowerCase()
      : undefined;
    if (artifactSha256 != null && !/^[0-9a-f]{64}$/.test(artifactSha256)) {
      throw new Error(`Endpoint evidence ${index} checksum must be 64 lowercase hex characters`);
    }
    const normalized: EvidenceReference = {
      id: requireString(record.id, `Endpoint evidence ${index} identifier`),
      publisher: requireString(record.publisher, `Endpoint evidence ${index} publisher`),
      title: requireString(record.title, `Endpoint evidence ${index} title`),
      sourceUrl: requireString(record.sourceUrl, `Endpoint evidence ${index} source URL`),
      retrievedAt: record.retrievedAt == null
        ? null
        : requireString(record.retrievedAt, `Endpoint evidence ${index} retrieval date`),
      status: status as EvidenceStatus,
      limitations: normalizeStringSet(
        record.limitations,
        `Endpoint evidence ${index} limitations`,
      ),
    };
    if (artifactSha256 != null) normalized.artifactSha256 = artifactSha256;
    return normalized;
  }).sort(compareById);
  assertUnique(evidence.map((item) => item.id), "Endpoint evidence");
  return evidence;
}

function assertEvidenceIds(
  evidenceIds: readonly string[],
  knownEvidenceIds: ReadonlySet<string>,
  label: string,
) {
  for (const evidenceId of evidenceIds) {
    if (!knownEvidenceIds.has(evidenceId)) {
      throw new Error(`${label} references unknown evidence ${evidenceId}`);
    }
  }
}

function normalizeCounty(
  value: unknown,
  jurisdictionId: string,
  candidateIds: readonly string[],
  knownEvidenceIds: ReadonlySet<string>,
  index: number,
): LockedCountyEndpointInput {
  const label = `${jurisdictionId} county ${index}`;
  const record = requireRecord(value, label);
  requireOnlyKeys(
    record,
    ["countyId", "name", "jurisdictionId", "candidateVotes", "totalVotes", "evidenceIds"],
    [],
    label,
  );
  const normalizedJurisdictionId = requireString(record.jurisdictionId, `${label} jurisdiction`);
  if (normalizedJurisdictionId !== jurisdictionId) {
    throw new Error(`${label} belongs to ${normalizedJurisdictionId}, not ${jurisdictionId}`);
  }
  const candidateVotes = normalizeCandidateVotes(
    record.candidateVotes,
    candidateIds,
    `${label} candidate votes`,
  );
  const totalVotes = requireNonnegativeInteger(record.totalVotes, `${label} total votes`);
  if (totalVector(candidateVotes) !== totalVotes) {
    throw new Error(`${label} candidate votes do not equal its total votes`);
  }
  const evidenceIds = normalizeStringSet(record.evidenceIds, `${label} evidence`);
  assertEvidenceIds(evidenceIds, knownEvidenceIds, label);
  return {
    countyId: requireString(record.countyId, `${label} identifier`),
    name: requireString(record.name, `${label} name`),
    jurisdictionId,
    candidateVotes,
    totalVotes,
    evidenceIds,
  };
}

function normalizeReportingUnit(
  value: unknown,
  jurisdictionId: string,
  candidateIds: readonly string[],
  knownEvidenceIds: ReadonlySet<string>,
  index: number,
): LockedReportingUnitEndpointInput {
  const label = `${jurisdictionId} reporting unit ${index}`;
  const record = requireRecord(value, label);
  requireOnlyKeys(
    record,
    [
      "unitId",
      "name",
      "jurisdictionId",
      "countyId",
      "unitType",
      "geometryStatus",
      "candidateVotes",
      "totalVotes",
      "evidenceIds",
    ],
    [],
    label,
  );
  const normalizedJurisdictionId = requireString(record.jurisdictionId, `${label} jurisdiction`);
  if (normalizedJurisdictionId !== jurisdictionId) {
    throw new Error(`${label} belongs to ${normalizedJurisdictionId}, not ${jurisdictionId}`);
  }
  const unitType = requireString(record.unitType, `${label} type`);
  if (!UNIT_TYPES.has(unitType as LockedReportingUnitType)) {
    throw new Error(`${label} has unknown unit type ${unitType}`);
  }
  const geometryStatus = requireString(record.geometryStatus, `${label} geometry status`);
  if (!GEOMETRY_STATUSES.has(geometryStatus as LockedGeometryStatus)) {
    throw new Error(`${label} has unknown geometry status ${geometryStatus}`);
  }
  const candidateVotes = normalizeCandidateVotes(
    record.candidateVotes,
    candidateIds,
    `${label} candidate votes`,
  );
  const totalVotes = requireNonnegativeInteger(record.totalVotes, `${label} total votes`);
  if (totalVector(candidateVotes) !== totalVotes) {
    throw new Error(`${label} candidate votes do not equal its total votes`);
  }
  const evidenceIds = normalizeStringSet(record.evidenceIds, `${label} evidence`);
  assertEvidenceIds(evidenceIds, knownEvidenceIds, label);
  return {
    unitId: requireString(record.unitId, `${label} identifier`),
    name: requireString(record.name, `${label} name`),
    jurisdictionId,
    countyId: requireNullableString(record.countyId, `${label} county`),
    unitType: unitType as LockedReportingUnitType,
    geometryStatus: geometryStatus as LockedGeometryStatus,
    candidateVotes,
    totalVotes,
    evidenceIds,
  };
}

function normalizeJurisdiction(
  value: unknown,
  candidateIds: readonly string[],
  knownEvidenceIds: ReadonlySet<string>,
  index: number,
): LockedJurisdictionEndpointInput {
  const record = requireRecord(value, `Endpoint jurisdiction ${index}`);
  requireOnlyKeys(
    record,
    [
      "jurisdictionId",
      "name",
      "electoralVotes",
      "candidateVotes",
      "totalVotes",
      "counties",
      "reportingUnits",
      "evidenceIds",
    ],
    [],
    `Endpoint jurisdiction ${index}`,
  );
  const jurisdictionId = requireString(
    record.jurisdictionId,
    `Endpoint jurisdiction ${index} identifier`,
  );
  const label = `Endpoint jurisdiction ${jurisdictionId}`;
  const candidateVotes = normalizeCandidateVotes(
    record.candidateVotes,
    candidateIds,
    `${label} candidate votes`,
  );
  const totalVotes = requireNonnegativeInteger(record.totalVotes, `${label} total votes`);
  if (totalVector(candidateVotes) !== totalVotes) {
    throw new Error(`${label} candidate votes do not equal its total votes`);
  }
  const counties = requireArray(record.counties, `${label} counties`)
    .map((county, countyIndex) => normalizeCounty(
      county,
      jurisdictionId,
      candidateIds,
      knownEvidenceIds,
      countyIndex,
    ))
    .sort((left, right) => canonicalStringCompare(left.countyId, right.countyId));
  assertUnique(counties.map((county) => county.countyId), `${label} counties`);
  const countyIds = new Set(counties.map((county) => county.countyId));
  const reportingUnits = requireArray(record.reportingUnits, `${label} reporting units`)
    .map((unit, unitIndex) => normalizeReportingUnit(
      unit,
      jurisdictionId,
      candidateIds,
      knownEvidenceIds,
      unitIndex,
    ))
    .sort((left, right) => canonicalStringCompare(left.unitId, right.unitId));
  if (reportingUnits.length === 0) throw new Error(`${label} must contain a reporting unit`);
  assertUnique(reportingUnits.map((unit) => unit.unitId), `${label} reporting units`);
  for (const unit of reportingUnits) {
    if (unit.countyId != null && !countyIds.has(unit.countyId)) {
      throw new Error(`${label} reporting unit ${unit.unitId} references unknown county ${unit.countyId}`);
    }
  }
  for (const county of counties) {
    const countyAggregate = emptyVector(candidateIds);
    for (const unit of reportingUnits) {
      if (unit.countyId === county.countyId) addVector(countyAggregate, unit.candidateVotes);
    }
    assertVectorEquals(
      county.candidateVotes,
      mapAsVector(countyAggregate, candidateIds),
      `${label} county ${county.countyId}`,
    );
  }
  const jurisdictionAggregate = emptyVector(candidateIds);
  for (const unit of reportingUnits) addVector(jurisdictionAggregate, unit.candidateVotes);
  assertVectorEquals(
    candidateVotes,
    mapAsVector(jurisdictionAggregate, candidateIds),
    label,
  );
  const evidenceIds = normalizeStringSet(record.evidenceIds, `${label} evidence`);
  assertEvidenceIds(evidenceIds, knownEvidenceIds, label);
  return {
    jurisdictionId,
    name: requireString(record.name, `${label} name`),
    electoralVotes: requireNonnegativeInteger(record.electoralVotes, `${label} electoral votes`),
    candidateVotes,
    totalVotes,
    counties,
    reportingUnits,
    evidenceIds,
  };
}

function normalizeAllocation(
  value: unknown,
  candidateIds: ReadonlySet<string>,
  jurisdictionIds: ReadonlySet<string>,
  index: number,
): ElectoralAllocationEntry {
  const label = `Electoral allocation ${index}`;
  const record = requireRecord(value, label);
  requireOnlyKeys(
    record,
    ["jurisdictionId", "candidateId", "electoralVotes", "allocationDistrict"],
    [],
    label,
  );
  const jurisdictionId = requireString(record.jurisdictionId, `${label} jurisdiction`);
  const candidateId = requireString(record.candidateId, `${label} candidate`);
  if (!jurisdictionIds.has(jurisdictionId)) {
    throw new Error(`${label} references unknown jurisdiction ${jurisdictionId}`);
  }
  if (!candidateIds.has(candidateId)) {
    throw new Error(`${label} references unknown candidate ${candidateId}`);
  }
  const electoralVotes = requireNonnegativeInteger(record.electoralVotes, `${label} votes`);
  if (electoralVotes === 0) throw new Error(`${label} cannot allocate zero electoral votes`);
  return {
    jurisdictionId,
    candidateId,
    electoralVotes,
    allocationDistrict: requireNullableString(record.allocationDistrict, `${label} district`),
  };
}

function allocationCompare(left: ElectoralAllocationEntry, right: ElectoralAllocationEntry) {
  return canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
    || canonicalStringCompare(left.candidateId, right.candidateId)
    || canonicalStringCompare(left.allocationDistrict ?? "", right.allocationDistrict ?? "");
}

function normalizeMetadata(value: unknown): EndpointLockMetadata {
  const record = requireRecord(value, "Endpoint lock metadata");
  requireOnlyKeys(
    record,
    ["scenarioId", "scenarioFingerprint", "createdAt"],
    [],
    "Endpoint lock metadata",
  );
  return {
    scenarioId: requireString(record.scenarioId, "Endpoint scenario identifier"),
    scenarioFingerprint: requireString(
      record.scenarioFingerprint,
      "Endpoint scenario fingerprint",
    ),
    createdAt: requireIsoInstant(record.createdAt, "Endpoint lock creation time"),
  };
}

function assertSuppliedReconciliation(
  value: unknown,
  expected: EndpointReconciliation,
) {
  const record = requireRecord(value, "Endpoint reconciliation");
  const fields = [
    "candidateVotes",
    "reportingUnitVotes",
    "countyVotes",
    "jurisdictionVotes",
    "nationalVotes",
    "electoralVotes",
  ] as const;
  requireOnlyKeys(record, fields, [], "Endpoint reconciliation");
  for (const field of fields) {
    const supplied = requireNonnegativeInteger(record[field], `Endpoint reconciliation ${field}`);
    if (supplied !== expected[field]) {
      throw new Error(
        `Endpoint reconciliation ${field} mismatch: expected ${expected[field]}, received ${supplied}`,
      );
    }
  }
}

function normalizeContent(value: unknown): LockedElectionContent {
  const record = requireRecord(value, "Endpoint content");
  requireOnlyKeys(
    record,
    [
      "electionId",
      "dataCompatibilityVersion",
      "scenarioEngineVersion",
      "candidates",
      "evidence",
      "jurisdictions",
      "nationalTotals",
      "electoralAllocation",
    ],
    ["reconciliation"],
    "Endpoint content",
  );
  const candidates = normalizeCandidateDefinitions(record.candidates);
  const candidateIds = candidates.map((candidate) => candidate.id);
  const candidateIdSet = new Set(candidateIds);
  const evidence = normalizeEvidence(record.evidence);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const jurisdictions = requireArray(record.jurisdictions, "Endpoint jurisdictions")
    .map((jurisdiction, index) => normalizeJurisdiction(
      jurisdiction,
      candidateIds,
      evidenceIds,
      index,
    ))
    .sort((left, right) => canonicalStringCompare(
      left.jurisdictionId,
      right.jurisdictionId,
    ));
  if (jurisdictions.length === 0) throw new Error("Endpoint must contain a jurisdiction");
  assertUnique(
    jurisdictions.map((jurisdiction) => jurisdiction.jurisdictionId),
    "Endpoint jurisdictions",
  );
  const jurisdictionIdSet = new Set(
    jurisdictions.map((jurisdiction) => jurisdiction.jurisdictionId),
  );
  const nationalTotals = normalizeCandidateVotes(
    record.nationalTotals,
    candidateIds,
    "Endpoint national totals",
  );
  const nationalAggregate = emptyVector(candidateIds);
  for (const jurisdiction of jurisdictions) addVector(nationalAggregate, jurisdiction.candidateVotes);
  assertVectorEquals(
    nationalTotals,
    mapAsVector(nationalAggregate, candidateIds),
    "Endpoint national totals",
  );
  const electoralAllocation = requireArray(
    record.electoralAllocation,
    "Endpoint electoral allocation",
  ).map((allocation, index) => normalizeAllocation(
    allocation,
    candidateIdSet,
    jurisdictionIdSet,
    index,
  )).sort(allocationCompare);
  const allocationKeys = electoralAllocation.map((allocation) => [
    allocation.jurisdictionId,
    allocation.candidateId,
    allocation.allocationDistrict ?? "",
  ].join("|"));
  assertUnique(allocationKeys, "Endpoint electoral allocation");
  const jurisdictionElectoralVotes = new Map<string, number>();
  let electoralVotes = 0;
  for (const allocation of electoralAllocation) {
    jurisdictionElectoralVotes.set(
      allocation.jurisdictionId,
      (jurisdictionElectoralVotes.get(allocation.jurisdictionId) ?? 0)
        + allocation.electoralVotes,
    );
    electoralVotes += allocation.electoralVotes;
  }
  for (const jurisdiction of jurisdictions) {
    if ((jurisdictionElectoralVotes.get(jurisdiction.jurisdictionId) ?? 0)
      !== jurisdiction.electoralVotes) {
      throw new Error(
        `${jurisdiction.jurisdictionId} electoral allocation does not reconcile to `
        + `${jurisdiction.electoralVotes}`,
      );
    }
  }
  if (electoralVotes !== 538) {
    throw new Error(`Endpoint electoral allocation must total 538, received ${electoralVotes}`);
  }
  const nationalVotes = totalVector(nationalTotals);
  const reportingUnitVotes = jurisdictions.reduce(
    (sum, jurisdiction) => sum + jurisdiction.reportingUnits.reduce(
      (unitSum, unit) => unitSum + unit.totalVotes,
      0,
    ),
    0,
  );
  const countyVotes = jurisdictions.reduce(
    (sum, jurisdiction) => sum + jurisdiction.counties.reduce(
      (countySum, county) => countySum + county.totalVotes,
      0,
    ),
    0,
  );
  const jurisdictionVotes = jurisdictions.reduce(
    (sum, jurisdiction) => sum + jurisdiction.totalVotes,
    0,
  );
  const reconciliation: EndpointReconciliation = {
    candidateVotes: nationalVotes,
    reportingUnitVotes,
    countyVotes,
    jurisdictionVotes,
    nationalVotes,
    electoralVotes,
  };
  if (reportingUnitVotes !== nationalVotes || jurisdictionVotes !== nationalVotes) {
    throw new Error("Endpoint reporting units, jurisdictions, and national totals do not reconcile");
  }
  if (Object.hasOwn(record, "reconciliation")) {
    assertSuppliedReconciliation(record.reconciliation, reconciliation);
  }
  return {
    electionId: requireString(record.electionId, "Endpoint election identifier"),
    dataCompatibilityVersion: requireString(
      record.dataCompatibilityVersion,
      "Endpoint data compatibility version",
    ),
    scenarioEngineVersion: requireString(
      record.scenarioEngineVersion,
      "Endpoint scenario engine version",
    ),
    candidates,
    evidence,
    jurisdictions,
    nationalTotals,
    electoralAllocation,
    reconciliation,
  };
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fingerprintPreimage(content: LockedElectionContent) {
  return canonicalSerialize({
    schemaVersion: LOCKED_ENDPOINT_SCHEMA_VERSION,
    content,
  } as unknown as CanonicalValue);
}

export function canonicalSerializeEndpointContent(content: LockedElectionContentInput) {
  return fingerprintPreimage(normalizeContent(content));
}

export async function lockElectionEndpoint(
  input: LockedElectionEndpointInput,
): Promise<LockedElectionEndpoint> {
  const metadata = normalizeMetadata(input.metadata);
  const content = normalizeContent(input.content);
  const contentFingerprint = await sha256Fingerprint(fingerprintPreimage(content));
  return deepFreeze({
    schemaVersion: LOCKED_ENDPOINT_SCHEMA_VERSION,
    metadata,
    content,
    contentFingerprint,
  });
}

export function serializeLockedElectionEndpoint(endpoint: LockedElectionEndpoint) {
  if (endpoint.schemaVersion !== LOCKED_ENDPOINT_SCHEMA_VERSION) {
    throw new Error(`Unsupported endpoint schema ${endpoint.schemaVersion}`);
  }
  return canonicalSerialize(endpoint as unknown as CanonicalValue);
}

export async function deserializeLockedElectionEndpoint(serialized: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Locked endpoint is not valid JSON");
  }
  const record = requireRecord(parsed, "Locked endpoint");
  requireOnlyKeys(
    record,
    ["schemaVersion", "metadata", "content", "contentFingerprint"],
    [],
    "Locked endpoint",
  );
  if (record.schemaVersion !== LOCKED_ENDPOINT_SCHEMA_VERSION) {
    throw new Error(`Unsupported endpoint schema ${String(record.schemaVersion)}`);
  }
  const suppliedFingerprint = requireString(
    record.contentFingerprint,
    "Endpoint content fingerprint",
  );
  if (!isSha256Fingerprint(suppliedFingerprint)) {
    throw new Error("Endpoint content fingerprint is not a SHA-256 fingerprint");
  }
  const locked = await lockElectionEndpoint({
    metadata: record.metadata as unknown as EndpointLockMetadata,
    content: record.content as unknown as LockedElectionContentInput,
  });
  if (locked.contentFingerprint !== suppliedFingerprint) {
    throw new Error(
      `Endpoint content fingerprint mismatch: expected ${locked.contentFingerprint}, `
      + `received ${suppliedFingerprint}`,
    );
  }
  return locked;
}
