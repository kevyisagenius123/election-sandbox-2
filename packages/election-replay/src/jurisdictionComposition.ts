import {
  type CandidateVoteVector,
  type CompiledReportingEvent,
  type LockedElectionEndpoint,
} from "./contracts.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "./canonical.ts";
import { sha256Fingerprint } from "./hash.ts";
import {
  admitCompiledJurisdictionReplay,
  verifyLockedEndpointForReplay,
  type AdmittedJurisdictionReplay,
  type JurisdictionReplayCapability,
  type JurisdictionReplayClock,
  type JurisdictionReplayEvidenceTrace,
} from "./jurisdictionContracts.ts";

export const JURISDICTION_COMPOSITION_SCHEMA_VERSION = "rme-jurisdiction-composition-v1" as const;
export const JURISDICTION_COMPOSITOR_VERSION = "rme-canonical-jurisdiction-merge-v1" as const;

export interface ComposedReplayEvent extends CompiledReportingEvent {
  jurisdictionSequence: number;
  absoluteReplayTimeMs: number;
}

export interface ComposedJurisdictionTrace {
  jurisdictionId: string;
  capability: JurisdictionReplayCapability;
  clock: JurisdictionReplayClock;
  evidence: JurisdictionReplayEvidenceTrace;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  electoralVotes: number;
}

export interface ComposedJurisdictionReplay {
  schemaVersion: typeof JURISDICTION_COMPOSITION_SCHEMA_VERSION;
  compositorVersion: typeof JURISDICTION_COMPOSITOR_VERSION;
  endpointContentFingerprint: string;
  coverage: "partial" | "complete";
  jurisdictions: readonly ComposedJurisdictionTrace[];
  events: readonly ComposedReplayEvent[];
  composedCandidateVotes: CandidateVoteVector;
  composedTotalVotes: number;
  acceptedElectoralVotes: number;
  lockedElectionElectoralVotes: 538;
  compositionFingerprint: string;
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareComposedEvents(left: ComposedReplayEvent, right: ComposedReplayEvent) {
  return left.absoluteReplayTimeMs - right.absoluteReplayTimeMs
    || left.orderTieBreaker - right.orderTieBreaker
    || canonicalStringCompare(left.eventId, right.eventId);
}

function candidateMap(candidateIds: readonly string[]) {
  return new Map(candidateIds.map((candidateId) => [candidateId, 0]));
}

function addCandidateVector(target: Map<string, number>, vector: CandidateVoteVector) {
  for (const candidate of vector) {
    if (!target.has(candidate.candidateId)) {
      throw new Error(`Composition contains unknown candidate ${candidate.candidateId}`);
    }
    const next = (target.get(candidate.candidateId) ?? 0) + candidate.votes;
    if (!Number.isSafeInteger(next)) throw new Error("Composed candidate total overflowed");
    target.set(candidate.candidateId, next);
  }
}

function mapCandidateVector(target: ReadonlyMap<string, number>, ids: readonly string[]) {
  return ids.map((candidateId) => ({ candidateId, votes: target.get(candidateId) ?? 0 }));
}

function jurisdictionTrace(admission: AdmittedJurisdictionReplay): ComposedJurisdictionTrace {
  return {
    jurisdictionId: admission.jurisdictionId,
    capability: admission.capability,
    clock: admission.clock,
    evidence: admission.evidence,
    candidateVotes: admission.candidateVotes,
    totalVotes: admission.totalVotes,
    electoralVotes: admission.electoralVotes,
  };
}

function compositionPreimage(
  stream: Omit<ComposedJurisdictionReplay, "compositionFingerprint">,
) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export function serializeComposedJurisdictionReplay(stream: ComposedJurisdictionReplay) {
  return canonicalSerialize(stream as unknown as CanonicalValue);
}

export async function composeJurisdictionReplays(
  endpoint: LockedElectionEndpoint,
  admissions: readonly AdmittedJurisdictionReplay[],
): Promise<ComposedJurisdictionReplay> {
  const verifiedEndpoint = await verifyLockedEndpointForReplay(endpoint);
  if (verifiedEndpoint.content.reconciliation.electoralVotes !== 538) {
    throw new Error("Jurisdiction composition requires an exact 538-EV locked election");
  }
  if (admissions.length === 0) throw new Error("Jurisdiction composition cannot be empty");
  const revalidated = await Promise.all(admissions.map((admission) => (
    admitCompiledJurisdictionReplay({
      endpoint: verifiedEndpoint,
      stream: admission.stream,
      jurisdictionId: admission.jurisdictionId,
      capability: admission.capability,
      timeZone: admission.clock.timeZone,
      pollCloseInstant: admission.clock.pollCloseInstant,
      returnEligibilityInstant: admission.clock.returnEligibilityInstant,
    })
  )));
  for (let index = 0; index < admissions.length; index += 1) {
    if (canonicalSerialize(admissions[index] as unknown as CanonicalValue)
      !== canonicalSerialize(revalidated[index] as unknown as CanonicalValue)) {
      throw new Error(`${admissions[index].jurisdictionId} admission metadata was tampered`);
    }
  }
  const sortedAdmissions = revalidated.sort((left, right) => (
    canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
  ));
  const jurisdictionIds = sortedAdmissions.map((admission) => admission.jurisdictionId);
  if (new Set(jurisdictionIds).size !== jurisdictionIds.length) {
    throw new Error("Jurisdiction composition contains duplicate jurisdictions");
  }
  const endpointJurisdictions = new Set(
    verifiedEndpoint.content.jurisdictions.map((jurisdiction) => jurisdiction.jurisdictionId),
  );
  for (const jurisdictionId of jurisdictionIds) {
    if (!endpointJurisdictions.has(jurisdictionId)) {
      throw new Error(`Composition contains unknown jurisdiction ${jurisdictionId}`);
    }
  }

  const candidateIds = verifiedEndpoint.content.candidates.map((candidate) => candidate.id);
  const aggregate = candidateMap(candidateIds);
  let composedTotalVotes = 0;
  let acceptedElectoralVotes = 0;
  for (const admission of sortedAdmissions) {
    if (admission.candidateVotes.length !== candidateIds.length) {
      throw new Error(`${admission.jurisdictionId} does not preserve the election candidate vector`);
    }
    addCandidateVector(aggregate, admission.candidateVotes);
    composedTotalVotes += admission.totalVotes;
    acceptedElectoralVotes += admission.electoralVotes;
    if (!Number.isSafeInteger(composedTotalVotes) || !Number.isSafeInteger(acceptedElectoralVotes)) {
      throw new Error("Jurisdiction composition totals overflowed");
    }
  }
  const unorderedEvents = sortedAdmissions.flatMap((admission) => (
    admission.stream.events.map((event): ComposedReplayEvent => ({
      ...event,
      jurisdictionSequence: event.sequence,
      absoluteReplayTimeMs: admission.clock.pollCloseEpochMs + event.replayTimeMs,
      sequence: -1,
    }))
  ));
  const events = unorderedEvents.sort(compareComposedEvents).map((event, sequence) => ({
    ...event,
    sequence,
  }));
  const eventIds = events.map((event) => event.eventId);
  if (new Set(eventIds).size !== eventIds.length) {
    throw new Error("Jurisdiction composition contains a global event identity collision");
  }
  const eventAggregate = candidateMap(candidateIds);
  for (const event of events) {
    if (event.eventType === "RETURN_PUBLISHED" && event.candidateDelta != null) {
      addCandidateVector(eventAggregate, event.candidateDelta);
    } else if (event.totalDelta !== 0 || event.candidateDelta !== null) {
      throw new Error("National composition encountered a vote-bearing control event");
    }
  }
  const composedCandidateVotes = mapCandidateVector(aggregate, candidateIds);
  const eventCandidateVotes = mapCandidateVector(eventAggregate, candidateIds);
  if (canonicalSerialize(composedCandidateVotes as unknown as CanonicalValue)
    !== canonicalSerialize(eventCandidateVotes as unknown as CanonicalValue)) {
    throw new Error("National composition changed jurisdiction candidate totals");
  }
  if (composedCandidateVotes.reduce((sum, candidate) => sum + candidate.votes, 0)
    !== composedTotalVotes) {
    throw new Error("National composition total does not equal accepted jurisdiction endpoints");
  }
  const withoutFingerprint = {
    schemaVersion: JURISDICTION_COMPOSITION_SCHEMA_VERSION,
    compositorVersion: JURISDICTION_COMPOSITOR_VERSION,
    endpointContentFingerprint: verifiedEndpoint.contentFingerprint,
    coverage: sortedAdmissions.length === verifiedEndpoint.content.jurisdictions.length
      ? "complete" as const
      : "partial" as const,
    jurisdictions: sortedAdmissions.map(jurisdictionTrace),
    events,
    composedCandidateVotes,
    composedTotalVotes,
    acceptedElectoralVotes,
    lockedElectionElectoralVotes: 538 as const,
  };
  return deepFreeze({
    ...withoutFingerprint,
    compositionFingerprint: await sha256Fingerprint(compositionPreimage(withoutFingerprint)),
  });
}
