import type {
  ReplayObservableState,
  ReportedAggregateState,
  ReportedCountyState,
  ReportedUnitState,
} from "./reducer.ts";
import { canonicalSerialize, canonicalStringCompare, type CanonicalValue } from "./canonical.ts";
import { isSha256Fingerprint, sha256Fingerprint } from "./hash.ts";

export const REPORTED_ANALYTICS_SCHEMA_VERSION = "rme-reported-analytics-v1" as const;
export const REPORTED_ANALYTICS_VERSION = "rme-headless-reported-analytics-v1" as const;

export interface ExplicitReportedShare {
  numeratorVotes: number;
  denominatorVotes: number;
  partsPerMillion: number;
}

export interface RankedReportedCandidate {
  candidateId: string;
  votes: number;
  rank: number;
  tied: boolean;
}

export type ReportedVoteLeader =
  | { type: "none" }
  | { type: "candidate"; candidateId: string; votes: number }
  | { type: "tie"; candidateIds: readonly string[]; votes: number };

export type ReportedLeaderMargin =
  | { type: "none" }
  | { type: "tie"; votes: 0 }
  | { type: "candidate"; candidateId: string; votes: number };

export interface HarrisTrumpReportedMargin {
  signedHarrisMinusTrumpVotes: number;
  absoluteVotes: number;
  leader: "harris" | "trump" | "tie";
}

export interface CandidateReportedShares {
  candidateId: string;
  allCandidateReportedShare: ExplicitReportedShare;
}

export interface HarrisTrumpReportedShares {
  denominator: "harris-plus-trump-reported-votes";
  harris: ExplicitReportedShare;
  trump: ExplicitReportedShare;
}

export interface ReportedVoteAnalytics {
  candidateVotes: readonly { candidateId: string; votes: number }[];
  totalReportedVotes: number;
  returnsPublished: number;
  reportedVoteLeader: ReportedVoteLeader;
  reportedLeaderMargin: ReportedLeaderMargin;
  candidateRanking: readonly RankedReportedCandidate[];
  allCandidateReportedShares: readonly CandidateReportedShares[] | null;
  harrisTrumpReportedMargin: HarrisTrumpReportedMargin | null;
  harrisTrumpReportedShares: HarrisTrumpReportedShares | null;
}

export interface RepresentationReportedAnalytics {
  mapped: ReportedVoteAnalytics;
  offMap: ReportedVoteAnalytics;
  mappedReturnsPublished: number;
  offMapReturnsPublished: number;
}

export interface JurisdictionReportedAnalytics extends ReportedVoteAnalytics {
  jurisdictionId: string;
  pollClosed: boolean;
  completed: boolean;
  geographyAvailability: "detailed" | "jurisdiction-only";
  representation: RepresentationReportedAnalytics | null;
}

export interface CountyReportedAnalytics extends ReportedVoteAnalytics {
  jurisdictionId: string;
  countyId: string;
}

export interface UnitReportedAnalytics extends ReportedVoteAnalytics {
  jurisdictionId: string;
  unitId: string;
  countyId: string | null;
  unitType: ReportedUnitState["unitType"];
  geometryStatus: ReportedUnitState["geometryStatus"];
}

export interface DerivedReportedAnalytics {
  schemaVersion: typeof REPORTED_ANALYTICS_SCHEMA_VERSION;
  analyticsVersion: typeof REPORTED_ANALYTICS_VERSION;
  position: ReplayObservableState["position"];
  national: ReportedVoteAnalytics;
  jurisdictions: readonly JurisdictionReportedAnalytics[];
  counties: readonly CountyReportedAnalytics[];
  publishedUnits: readonly UnitReportedAnalytics[];
  jurisdictionsCompleted: number;
  complete: boolean;
}

export interface ReportedAnalyticsEnvelope {
  schemaVersion: typeof REPORTED_ANALYTICS_SCHEMA_VERSION;
  analyticsVersion: typeof REPORTED_ANALYTICS_VERSION;
  sourceStateFingerprint: string;
  analytics: DerivedReportedAnalytics;
  analyticsFingerprint: string;
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function explicitShare(numeratorVotes: number, denominatorVotes: number): ExplicitReportedShare {
  requireSafeInteger(numeratorVotes, "Reported share numerator");
  requireSafeInteger(denominatorVotes, "Reported share denominator");
  if (denominatorVotes === 0 || numeratorVotes > denominatorVotes) {
    throw new Error("Reported share requires a positive reconciled denominator");
  }
  return Object.freeze({
    numeratorVotes,
    denominatorVotes,
    partsPerMillion: Math.round(numeratorVotes * 1_000_000 / denominatorVotes),
  });
}

function freezeCandidateVotes(candidateVotes: ReportedAggregateState["candidateVotes"]) {
  const ids = new Set<string>();
  let total = 0;
  const normalized = candidateVotes.map((candidate) => {
    if (typeof candidate.candidateId !== "string" || candidate.candidateId.length === 0) {
      throw new Error("Reported analytics candidate identity is invalid");
    }
    if (ids.has(candidate.candidateId)) throw new Error("Reported analytics candidates are duplicated");
    ids.add(candidate.candidateId);
    total += requireSafeInteger(candidate.votes, `${candidate.candidateId} reported votes`);
    if (!Number.isSafeInteger(total)) throw new Error("Reported analytics vote total overflowed");
    return Object.freeze({ candidateId: candidate.candidateId, votes: candidate.votes });
  });
  if (normalized.length !== 5) throw new Error("Reported analytics requires five candidates");
  return { candidateVotes: Object.freeze(normalized), total };
}

function rankingFor(candidateVotes: ReportedVoteAnalytics["candidateVotes"]) {
  const ordered = [...candidateVotes].sort((left, right) => (
    right.votes - left.votes || canonicalStringCompare(left.candidateId, right.candidateId)
  ));
  return Object.freeze(ordered.map((candidate, index) => {
    const previous = ordered[index - 1];
    const rank = previous && previous.votes === candidate.votes
      ? (ordered.slice(0, index).findIndex((entry) => entry.votes === candidate.votes) + 1)
      : index + 1;
    const tied = ordered.some((entry, otherIndex) => (
      otherIndex !== index && entry.votes === candidate.votes
    ));
    return Object.freeze({ ...candidate, rank, tied });
  }));
}

function leaderFor(
  ranking: readonly RankedReportedCandidate[],
  totalReportedVotes: number,
): { leader: ReportedVoteLeader; margin: ReportedLeaderMargin } {
  if (totalReportedVotes === 0) {
    return { leader: Object.freeze({ type: "none" }), margin: Object.freeze({ type: "none" }) };
  }
  const topVotes = ranking[0].votes;
  const tied = ranking.filter((candidate) => candidate.votes === topVotes);
  if (tied.length > 1) {
    return {
      leader: Object.freeze({
        type: "tie",
        candidateIds: Object.freeze(tied.map((candidate) => candidate.candidateId).sort(canonicalStringCompare)),
        votes: topVotes,
      }),
      margin: Object.freeze({ type: "tie", votes: 0 }),
    };
  }
  return {
    leader: Object.freeze({
      type: "candidate",
      candidateId: ranking[0].candidateId,
      votes: topVotes,
    }),
    margin: Object.freeze({
      type: "candidate",
      candidateId: ranking[0].candidateId,
      votes: topVotes - (ranking[1]?.votes ?? 0),
    }),
  };
}

export function deriveReportedVoteAnalytics(aggregate: ReportedAggregateState): ReportedVoteAnalytics {
  const { candidateVotes, total } = freezeCandidateVotes(aggregate.candidateVotes);
  const totalReportedVotes = requireSafeInteger(aggregate.totalVotes, "Reported aggregate total");
  const returnsPublished = requireSafeInteger(aggregate.returnsPublished, "Reported return count");
  if (total !== totalReportedVotes) throw new Error("Reported analytics candidate vector does not reconcile");
  const candidateRanking = rankingFor(candidateVotes);
  const { leader, margin } = leaderFor(candidateRanking, totalReportedVotes);
  const allCandidateReportedShares = totalReportedVotes === 0
    ? null
    : Object.freeze(candidateVotes.map((candidate) => Object.freeze({
      candidateId: candidate.candidateId,
      allCandidateReportedShare: explicitShare(candidate.votes, totalReportedVotes),
    })));
  const harris = candidateVotes.find((candidate) => candidate.candidateId === "harris");
  const trump = candidateVotes.find((candidate) => candidate.candidateId === "trump");
  const majorPartyDenominator = (harris?.votes ?? 0) + (trump?.votes ?? 0);
  if (!Number.isSafeInteger(majorPartyDenominator)) throw new Error("Harris-Trump denominator overflowed");
  const signedMargin = harris && trump ? harris.votes - trump.votes : null;
  return deepFreeze({
    candidateVotes,
    totalReportedVotes,
    returnsPublished,
    reportedVoteLeader: leader,
    reportedLeaderMargin: margin,
    candidateRanking,
    allCandidateReportedShares,
    harrisTrumpReportedMargin: signedMargin == null ? null : {
      signedHarrisMinusTrumpVotes: signedMargin,
      absoluteVotes: Math.abs(signedMargin),
      leader: signedMargin > 0 ? "harris" : signedMargin < 0 ? "trump" : "tie",
    },
    harrisTrumpReportedShares: harris && trump && majorPartyDenominator > 0 ? {
      denominator: "harris-plus-trump-reported-votes",
      harris: explicitShare(harris.votes, majorPartyDenominator),
      trump: explicitShare(trump.votes, majorPartyDenominator),
    } : null,
  });
}

function zeroReturnAggregate(
  candidateVotes: ReportedAggregateState["candidateVotes"],
  totalVotes: number,
): ReportedAggregateState {
  return { candidateVotes, totalVotes, returnsPublished: 0 };
}

function publishedUnits(observable: ReplayObservableState) {
  return observable.reportedByUnit.buckets.flatMap((bucket) => Object.values(bucket));
}

function jurisdictionHasCounty(observable: ReplayObservableState, jurisdictionId: string) {
  return Object.values(observable.reportedByCounty).some(
    (county) => county.jurisdictionId === jurisdictionId,
  );
}

export function deriveNationalReportedAnalytics(observable: ReplayObservableState) {
  return deriveReportedVoteAnalytics(observable.national);
}

export function deriveJurisdictionReportedAnalytics(
  observable: ReplayObservableState,
  jurisdictionId: string,
): JurisdictionReportedAnalytics {
  const state = observable.reportedByJurisdiction[jurisdictionId];
  if (!state) throw new Error(`Unknown reported jurisdiction ${jurisdictionId}`);
  const detailed = jurisdictionHasCounty(observable, jurisdictionId);
  let representation: RepresentationReportedAnalytics | null = null;
  if (detailed) {
    let mappedReturnsPublished = 0;
    let offMapReturnsPublished = 0;
    for (const unit of publishedUnits(observable)) {
      if (unit.jurisdictionId !== jurisdictionId) continue;
      if (unit.geometryStatus === "mapped") mappedReturnsPublished += 1;
      if (unit.geometryStatus === "off-map") offMapReturnsPublished += 1;
    }
    representation = {
      mapped: deriveReportedVoteAnalytics({
        ...zeroReturnAggregate(state.mappedCandidateVotes, state.mappedTotalVotes),
        returnsPublished: mappedReturnsPublished,
      }),
      offMap: deriveReportedVoteAnalytics({
        ...zeroReturnAggregate(state.offMapCandidateVotes, state.offMapTotalVotes),
        returnsPublished: offMapReturnsPublished,
      }),
      mappedReturnsPublished,
      offMapReturnsPublished,
    };
  }
  return deepFreeze({
    ...deriveReportedVoteAnalytics(state),
    jurisdictionId,
    pollClosed: state.pollClosed,
    completed: state.completed,
    geographyAvailability: detailed ? "detailed" : "jurisdiction-only",
    representation,
  });
}

export function deriveCountyReportedAnalytics(
  observable: ReplayObservableState,
  jurisdictionId: string,
  countyId: string,
): CountyReportedAnalytics {
  const state = Object.values(observable.reportedByCounty).find((county) => (
    county.jurisdictionId === jurisdictionId && county.countyId === countyId
  ));
  if (!state) throw new Error(`No detailed county analytics exist for ${jurisdictionId}/${countyId}`);
  return deepFreeze({
    ...deriveReportedVoteAnalytics(state),
    jurisdictionId,
    countyId,
  });
}

export function deriveUnitReportedAnalytics(
  observable: ReplayObservableState,
  jurisdictionId: string,
  unitId: string,
): UnitReportedAnalytics {
  const state = publishedUnits(observable).find((unit) => (
    unit.jurisdictionId === jurisdictionId && unit.unitId === unitId
  ));
  if (!state) throw new Error(`No published unit analytics exist for ${jurisdictionId}/${unitId}`);
  return unitAnalytics(state);
}

function unitAnalytics(state: ReportedUnitState): UnitReportedAnalytics {
  return deepFreeze({
    ...deriveReportedVoteAnalytics(state),
    jurisdictionId: state.jurisdictionId,
    unitId: state.unitId,
    countyId: state.countyId,
    unitType: state.unitType,
    geometryStatus: state.geometryStatus,
  });
}

function countyAnalytics(state: ReportedCountyState): CountyReportedAnalytics {
  return deepFreeze({
    ...deriveReportedVoteAnalytics(state),
    jurisdictionId: state.jurisdictionId,
    countyId: state.countyId,
  });
}

export function deriveFullReportedAnalytics(observable: ReplayObservableState): DerivedReportedAnalytics {
  const jurisdictions = Object.keys(observable.reportedByJurisdiction)
    .sort(canonicalStringCompare)
    .map((jurisdictionId) => deriveJurisdictionReportedAnalytics(observable, jurisdictionId));
  const counties = Object.values(observable.reportedByCounty)
    .sort((left, right) => (
      canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
      || canonicalStringCompare(left.countyId, right.countyId)
    ))
    .map(countyAnalytics);
  const units = publishedUnits(observable)
    .sort((left, right) => (
      canonicalStringCompare(left.jurisdictionId, right.jurisdictionId)
      || canonicalStringCompare(left.unitId, right.unitId)
    ))
    .map(unitAnalytics);
  return deepFreeze({
    schemaVersion: REPORTED_ANALYTICS_SCHEMA_VERSION,
    analyticsVersion: REPORTED_ANALYTICS_VERSION,
    position: observable.position,
    national: deriveNationalReportedAnalytics(observable),
    jurisdictions,
    counties,
    publishedUnits: units,
    jurisdictionsCompleted: observable.jurisdictionsCompleted,
    complete: observable.complete,
  });
}

export function serializeDerivedReportedAnalytics(analytics: DerivedReportedAnalytics) {
  return canonicalSerialize(analytics as unknown as CanonicalValue);
}

export function deserializeDerivedReportedAnalytics(
  serialized: string,
  observable: ReplayObservableState,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Reported analytics are not valid JSON");
  }
  const expected = deriveFullReportedAnalytics(observable);
  if (canonicalSerialize(parsed as CanonicalValue) !== serializeDerivedReportedAnalytics(expected)) {
    throw new Error("Reported analytics do not match the observable reducer state");
  }
  return deepFreeze(parsed as DerivedReportedAnalytics);
}

function analyticsEnvelopePreimage(
  envelope: Omit<ReportedAnalyticsEnvelope, "analyticsFingerprint">,
) {
  return canonicalSerialize(envelope as unknown as CanonicalValue);
}

export async function createReportedAnalyticsEnvelope(
  observable: ReplayObservableState,
  sourceStateFingerprint: string,
): Promise<ReportedAnalyticsEnvelope> {
  if (!isSha256Fingerprint(sourceStateFingerprint)) {
    throw new Error("Reported analytics require a reducer-state SHA-256 fingerprint");
  }
  const withoutFingerprint = {
    schemaVersion: REPORTED_ANALYTICS_SCHEMA_VERSION,
    analyticsVersion: REPORTED_ANALYTICS_VERSION,
    sourceStateFingerprint,
    analytics: deriveFullReportedAnalytics(observable),
  } as const;
  return deepFreeze({
    ...withoutFingerprint,
    analyticsFingerprint: await sha256Fingerprint(analyticsEnvelopePreimage(withoutFingerprint)),
  });
}

export function serializeReportedAnalyticsEnvelope(envelope: ReportedAnalyticsEnvelope) {
  return canonicalSerialize(envelope as unknown as CanonicalValue);
}

export async function deserializeReportedAnalyticsEnvelope(
  serialized: string,
  observable: ReplayObservableState,
  sourceStateFingerprint: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Reported analytics envelope is not valid JSON");
  }
  const expected = await createReportedAnalyticsEnvelope(observable, sourceStateFingerprint);
  if (canonicalSerialize(parsed as CanonicalValue) !== serializeReportedAnalyticsEnvelope(expected)) {
    throw new Error("Reported analytics envelope failed observable-state validation");
  }
  return deepFreeze(parsed as ReportedAnalyticsEnvelope);
}
