import {
  type CandidateVoteVector,
  type LockedElectionEndpoint,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import {
  compileAtomicCoarseJurisdictionFixture,
  COARSE_FIXTURE_PROFILE_ID,
} from "./coarseFixtureCompiler.ts";
import { serializeLockedElectionEndpoint } from "./endpoint.ts";
import { sha256Fingerprint } from "./hash.ts";
import {
  admitCompiledJurisdictionReplay,
  verifyLockedEndpointForReplay,
  type AdmittedJurisdictionReplay,
  type JurisdictionReplayCapability,
} from "./jurisdictionContracts.ts";
import {
  composeJurisdictionReplays,
  serializeComposedJurisdictionReplay,
  type ComposedJurisdictionReplay,
} from "./jurisdictionComposition.ts";
import {
  compileMichiganEventStream,
  MICHIGAN_REPLAY_CAPABILITY,
  type MichiganReplayDefinition,
} from "./michiganCompiler.ts";
import {
  NATIONAL_REPLAY_CLOCK_CONTRACT_VERSION,
  NATIONAL_REPLAY_JURISDICTION_IDS,
  nationalReplayClockFor,
} from "./nationalClock.ts";
import {
  compilePennsylvaniaEventStream,
  PENNSYLVANIA_REPLAY_CAPABILITY,
  type PennsylvaniaReplayDefinition,
} from "./pennsylvaniaCompiler.ts";

export const NATIONAL_REPLAY_SCHEMA_VERSION = "rme-national-replay-v1" as const;
export const NATIONAL_REPLAY_COMPILER_VERSION = "rme-national-composition-v1" as const;
export const NATIONAL_REPLAY_PROFILE_ID = "us-synthetic-jurisdiction-wave-v1" as const;

export const NATIONAL_COARSE_REPLAY_CAPABILITY: JurisdictionReplayCapability = Object.freeze({
  kind: "coarse",
  sourceUnitLabel: null,
  mapUnitLabel: null,
  residualTreatment: "none",
  methodologyNote: "Unsupported detailed geography is represented by one exact statewide five-candidate return. No county, precinct, batch, or reporting-percentage geography is claimed.",
});

export interface NationalReplayDefinition {
  profileId: typeof NATIONAL_REPLAY_PROFILE_ID;
  rootSeed: string;
  clockContractVersion: typeof NATIONAL_REPLAY_CLOCK_CONTRACT_VERSION;
  pennsylvania: PennsylvaniaReplayDefinition;
  michigan: MichiganReplayDefinition;
  coarseMinimumReturnDelayMs: number;
  coarseReturnJitterMs: number;
}

export interface CompiledNationalReplay {
  schemaVersion: typeof NATIONAL_REPLAY_SCHEMA_VERSION;
  compilerVersion: typeof NATIONAL_REPLAY_COMPILER_VERSION;
  endpointContentFingerprint: string;
  definition: NationalReplayDefinition;
  admissions: readonly AdmittedJurisdictionReplay[];
  composition: ComposedJurisdictionReplay;
  nationalStreamFingerprint: string;
}

export interface NationalReplayAudit {
  jurisdictionCount: 51;
  detailedJurisdictionCount: 2;
  coarseJurisdictionCount: 49;
  returnEventCount: number;
  controlEventCount: number;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  electoralVotes: 538;
  firstAbsoluteEventTimeMs: number;
  lastAbsoluteEventTimeMs: number;
}

function requireString(value: string, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
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

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function normalizeDefinition(definition: NationalReplayDefinition): NationalReplayDefinition {
  if (definition.profileId !== NATIONAL_REPLAY_PROFILE_ID) {
    throw new Error(`Unsupported national replay profile ${definition.profileId}`);
  }
  if (definition.clockContractVersion !== NATIONAL_REPLAY_CLOCK_CONTRACT_VERSION) {
    throw new Error(`Unsupported national replay clock ${definition.clockContractVersion}`);
  }
  return {
    profileId: NATIONAL_REPLAY_PROFILE_ID,
    rootSeed: requireString(definition.rootSeed, "National replay root seed"),
    clockContractVersion: NATIONAL_REPLAY_CLOCK_CONTRACT_VERSION,
    pennsylvania: {
      profileId: definition.pennsylvania.profileId,
      rootSeed: requireString(definition.pennsylvania.rootSeed, "Pennsylvania replay root seed"),
    },
    michigan: {
      profileId: definition.michigan.profileId,
      rootSeed: requireString(definition.michigan.rootSeed, "Michigan replay root seed"),
    },
    coarseMinimumReturnDelayMs: requireInteger(
      definition.coarseMinimumReturnDelayMs,
      "Coarse national return delay",
    ),
    coarseReturnJitterMs: requireInteger(
      definition.coarseReturnJitterMs,
      "Coarse national return jitter",
    ),
  };
}

function assertExactNationalJurisdictions(endpoint: LockedElectionEndpoint) {
  const expected = [...NATIONAL_REPLAY_JURISDICTION_IDS].sort(canonicalStringCompare);
  const actual = endpoint.content.jurisdictions
    .map((jurisdiction) => jurisdiction.jurisdictionId)
    .sort(canonicalStringCompare);
  if (
    expected.length !== 51
    || actual.length !== expected.length
    || actual.some((jurisdictionId, index) => jurisdictionId !== expected[index])
  ) {
    throw new Error("National replay requires exactly the 50 states and District of Columbia");
  }
}

function assertVectorEqual(
  expected: CandidateVoteVector,
  actual: CandidateVoteVector,
  label: string,
) {
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

function nationalPreimage(replay: Omit<CompiledNationalReplay, "nationalStreamFingerprint">) {
  return canonicalSerialize(replay as unknown as CanonicalValue);
}

export function serializeCompiledNationalReplay(replay: CompiledNationalReplay) {
  return canonicalSerialize(replay as unknown as CanonicalValue);
}

async function admissionFor(
  endpoint: LockedElectionEndpoint,
  jurisdictionId: string,
  stream: AdmittedJurisdictionReplay["stream"],
) {
  const clock = nationalReplayClockFor(jurisdictionId);
  const capability = jurisdictionId === "PA"
    ? PENNSYLVANIA_REPLAY_CAPABILITY
    : jurisdictionId === "MI"
      ? MICHIGAN_REPLAY_CAPABILITY
      : NATIONAL_COARSE_REPLAY_CAPABILITY;
  return admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId,
    capability,
    timeZone: clock.timeZone,
    pollCloseInstant: clock.pollCloseInstant,
    returnEligibilityInstant: jurisdictionId === "MI" || jurisdictionId === "PA"
      ? clock.pollCloseInstant
      : clock.returnEligibilityInstant,
  });
}

export async function composeNationalReplay(
  endpointValue: LockedElectionEndpoint,
  definitionValue: NationalReplayDefinition,
  admissionsValue: readonly AdmittedJurisdictionReplay[],
): Promise<CompiledNationalReplay> {
  const endpoint = await verifyLockedEndpointForReplay(endpointValue);
  assertExactNationalJurisdictions(endpoint);
  const definition = normalizeDefinition(definitionValue);
  if (admissionsValue.length !== 51) {
    throw new Error("Complete national replay requires 51 jurisdiction admissions");
  }
  const admissions = [...admissionsValue].sort((left, right) => (
    canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
  ));
  const actualIds = admissions.map((admission) => admission.jurisdictionId);
  const expectedIds = [...NATIONAL_REPLAY_JURISDICTION_IDS].sort(canonicalStringCompare);
  if (
    new Set(actualIds).size !== 51
    || actualIds.some((jurisdictionId, index) => jurisdictionId !== expectedIds[index])
  ) {
    throw new Error("Complete national replay must admit every expected jurisdiction exactly once");
  }
  const composition = await composeJurisdictionReplays(endpoint, admissions);
  if (
    composition.coverage !== "complete"
    || composition.jurisdictions.length !== 51
    || composition.acceptedElectoralVotes !== 538
    || composition.lockedElectionElectoralVotes !== 538
  ) {
    throw new Error("National replay composition is not complete");
  }
  assertVectorEqual(
    endpoint.content.nationalTotals,
    composition.composedCandidateVotes,
    "National composition",
  );
  const withoutFingerprint = {
    schemaVersion: NATIONAL_REPLAY_SCHEMA_VERSION,
    compilerVersion: NATIONAL_REPLAY_COMPILER_VERSION,
    endpointContentFingerprint: endpoint.contentFingerprint,
    definition,
    admissions,
    composition,
  } as const;
  return deepFreeze({
    ...withoutFingerprint,
    nationalStreamFingerprint: await sha256Fingerprint(nationalPreimage(withoutFingerprint)),
  });
}

export async function compileNationalReplay(
  endpointValue: LockedElectionEndpoint,
  definitionValue: NationalReplayDefinition,
): Promise<CompiledNationalReplay> {
  const before = serializeLockedElectionEndpoint(endpointValue);
  const endpoint = await verifyLockedEndpointForReplay(endpointValue);
  assertExactNationalJurisdictions(endpoint);
  const definition = normalizeDefinition(definitionValue);
  const streams = await Promise.all(endpoint.content.jurisdictions.map(async (jurisdiction) => {
    if (jurisdiction.jurisdictionId === "PA") {
      return compilePennsylvaniaEventStream(endpoint, definition.pennsylvania);
    }
    if (jurisdiction.jurisdictionId === "MI") {
      return compileMichiganEventStream(endpoint, definition.michigan);
    }
    const clock = nationalReplayClockFor(jurisdiction.jurisdictionId);
    return compileAtomicCoarseJurisdictionFixture(endpoint, jurisdiction.jurisdictionId, {
      profileId: COARSE_FIXTURE_PROFILE_ID,
      rootSeed: definition.rootSeed,
      timeZone: clock.timeZone,
      pollCloseInstant: clock.pollCloseInstant,
      returnEligibilityInstant: clock.returnEligibilityInstant,
      minimumReturnDelayMs: definition.coarseMinimumReturnDelayMs,
      returnJitterMs: definition.coarseReturnJitterMs,
    });
  }));
  const admissions = await Promise.all(streams.map((stream) => (
    admissionFor(endpoint, stream.events[0]?.jurisdictionId ?? "", stream)
  )));
  const replay = await composeNationalReplay(endpoint, definition, admissions);
  if (serializeLockedElectionEndpoint(endpointValue) !== before) {
    throw new Error("National replay compiler mutated the locked endpoint");
  }
  return replay;
}

export async function auditCompiledNationalReplay(
  endpointValue: LockedElectionEndpoint,
  replay: CompiledNationalReplay,
): Promise<NationalReplayAudit> {
  const endpoint = await verifyLockedEndpointForReplay(endpointValue);
  if (
    replay.schemaVersion !== NATIONAL_REPLAY_SCHEMA_VERSION
    || replay.compilerVersion !== NATIONAL_REPLAY_COMPILER_VERSION
    || replay.endpointContentFingerprint !== endpoint.contentFingerprint
  ) {
    throw new Error("National replay envelope is incompatible with the locked endpoint");
  }
  normalizeDefinition(replay.definition);
  const { nationalStreamFingerprint, ...withoutFingerprint } = replay;
  const expectedFingerprint = await sha256Fingerprint(nationalPreimage(withoutFingerprint));
  if (nationalStreamFingerprint !== expectedFingerprint) {
    throw new Error("National replay fingerprint mismatch");
  }
  const rebuilt = await composeNationalReplay(endpoint, replay.definition, replay.admissions);
  if (
    rebuilt.nationalStreamFingerprint !== replay.nationalStreamFingerprint
    || serializeComposedJurisdictionReplay(rebuilt.composition)
      !== serializeComposedJurisdictionReplay(replay.composition)
  ) {
    throw new Error("National replay does not reproduce from admitted jurisdiction streams");
  }
  const candidateIds = endpoint.content.nationalTotals.map((candidate) => candidate.candidateId);
  const prefix = new Map(candidateIds.map((candidateId) => [candidateId, 0]));
  let returnEventCount = 0;
  let controlEventCount = 0;
  for (const event of replay.composition.events) {
    if (event.eventType !== "RETURN_PUBLISHED") {
      controlEventCount += 1;
      continue;
    }
    returnEventCount += 1;
    if (event.candidateDelta == null) throw new Error("National return is missing votes");
    for (const candidate of event.candidateDelta) {
      const next = (prefix.get(candidate.candidateId) ?? 0) + candidate.votes;
      const locked = endpoint.content.nationalTotals.find(
        (item) => item.candidateId === candidate.candidateId,
      )?.votes;
      if (locked == null || next > locked) {
        throw new Error(`National prefix over-reports ${candidate.candidateId}`);
      }
      prefix.set(candidate.candidateId, next);
    }
  }
  const candidateVotes = candidateIds.map((candidateId) => ({
    candidateId,
    votes: prefix.get(candidateId) ?? 0,
  }));
  assertVectorEqual(endpoint.content.nationalTotals, candidateVotes, "National final replay");
  const detailed = replay.admissions.filter((admission) => admission.capability.kind === "detailed");
  const coarse = replay.admissions.filter((admission) => admission.capability.kind === "coarse");
  if (
    detailed.length !== 2
    || coarse.length !== 49
    || !detailed.some((admission) => admission.jurisdictionId === "PA")
    || !detailed.some((admission) => admission.jurisdictionId === "MI")
  ) {
    throw new Error("National replay capability coverage is incorrect");
  }
  for (const admission of coarse) {
    if (
      admission.audit.returnEventCount !== 1
      || admission.audit.reportingUnitCount !== 1
      || admission.audit.countyCount !== 0
      || admission.capability.sourceUnitLabel !== null
      || admission.capability.mapUnitLabel !== null
    ) {
      throw new Error(`${admission.jurisdictionId} is not an honest coarse admission`);
    }
  }
  return deepFreeze({
    jurisdictionCount: 51,
    detailedJurisdictionCount: 2,
    coarseJurisdictionCount: 49,
    returnEventCount,
    controlEventCount,
    candidateVotes,
    totalVotes: candidateVotes.reduce((sum, candidate) => sum + candidate.votes, 0),
    electoralVotes: 538,
    firstAbsoluteEventTimeMs: replay.composition.events[0]?.absoluteReplayTimeMs ?? 0,
    lastAbsoluteEventTimeMs: replay.composition.events.at(-1)?.absoluteReplayTimeMs ?? 0,
  });
}

export async function deserializeCompiledNationalReplay(
  endpoint: LockedElectionEndpoint,
  serialized: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("National replay serialization is not valid JSON");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("National replay serialization must contain an object");
  }
  await auditCompiledNationalReplay(endpoint, parsed as CompiledNationalReplay);
  return deepFreeze(parsed as CompiledNationalReplay);
}
