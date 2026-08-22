export const LOCKED_ENDPOINT_SCHEMA_VERSION = 1 as const;
export const REPLAY_SCHEMA_VERSION = "rme-replay-v1" as const;
export const COMPILED_EVENT_STREAM_SCHEMA_VERSION = "rme-compiled-events-v1" as const;

export type EvidenceStatus =
  | "documented"
  | "reconstructed"
  | "modeled"
  | "user_defined"
  | "synthetic"
  | "exact_endpoint";

export interface CandidateDefinition {
  id: string;
  name: string;
  shortName: string;
  partyId: string | null;
  displayOrder: number;
}

export interface CandidateVote {
  candidateId: string;
  votes: number;
}

export type CandidateVoteVector = readonly CandidateVote[];

export interface EvidenceReference {
  id: string;
  publisher: string;
  title: string;
  sourceUrl: string;
  retrievedAt: string | null;
  artifactSha256?: string;
  status: EvidenceStatus;
  limitations: readonly string[];
}

export type LockedReportingUnitType =
  | "precinct"
  | "vtd"
  | "ward"
  | "central-count"
  | "residual"
  | "jurisdiction-total";

export type LockedGeometryStatus = "mapped" | "off-map" | "approximate" | "none";

export interface LockedReportingUnitEndpointInput {
  unitId: string;
  name: string;
  jurisdictionId: string;
  countyId: string | null;
  unitType: LockedReportingUnitType;
  geometryStatus: LockedGeometryStatus;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  evidenceIds: readonly string[];
}

export interface LockedCountyEndpointInput {
  countyId: string;
  name: string;
  jurisdictionId: string;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  evidenceIds: readonly string[];
}

export interface LockedJurisdictionEndpointInput {
  jurisdictionId: string;
  name: string;
  electoralVotes: number;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  counties: readonly LockedCountyEndpointInput[];
  reportingUnits: readonly LockedReportingUnitEndpointInput[];
  evidenceIds: readonly string[];
}

export interface ElectoralAllocationEntry {
  jurisdictionId: string;
  candidateId: string;
  electoralVotes: number;
  allocationDistrict: string | null;
}

export interface EndpointReconciliation {
  candidateVotes: number;
  reportingUnitVotes: number;
  countyVotes: number;
  jurisdictionVotes: number;
  nationalVotes: number;
  electoralVotes: number;
}

export interface LockedElectionContentInput {
  electionId: string;
  dataCompatibilityVersion: string;
  scenarioEngineVersion: string;
  candidates: readonly CandidateDefinition[];
  evidence: readonly EvidenceReference[];
  jurisdictions: readonly LockedJurisdictionEndpointInput[];
  nationalTotals: CandidateVoteVector;
  electoralAllocation: readonly ElectoralAllocationEntry[];
}

export interface EndpointLockMetadata {
  scenarioId: string;
  scenarioFingerprint: string;
  createdAt: string;
}

export interface LockedElectionEndpointInput {
  metadata: EndpointLockMetadata;
  content: LockedElectionContentInput;
}

export interface LockedElectionContent extends LockedElectionContentInput {
  reconciliation: EndpointReconciliation;
}

export interface LockedElectionEndpoint {
  schemaVersion: typeof LOCKED_ENDPOINT_SCHEMA_VERSION;
  metadata: EndpointLockMetadata;
  content: LockedElectionContent;
  contentFingerprint: string;
}

export type ReplayEventType =
  | "REPLAY_STARTED"
  | "POLL_CLOSE"
  | "REPORTING_OPENED"
  | "RETURN_PUBLISHED"
  | "RETURN_REPLACED"
  | "COUNTY_STATUS_CHANGED"
  | "LEAD_CHANGED"
  | "OUTSTANDING_ESTIMATE_UPDATED"
  | "CALL_STATUS_CHANGED"
  | "ELECTORAL_SCORE_CHANGED"
  | "PATH_STATUS_CHANGED"
  | "REPLAY_COMPLETED";

export interface ReplayEventIdentityInput {
  replaySchemaVersion: string;
  jurisdictionId: string;
  unitId: string | null;
  eventType: ReplayEventType;
  batchOrdinal: number;
}

export interface ReplayEvent extends ReplayEventIdentityInput {
  eventId: string;
  sequence: number;
  replayTimeMs: number;
  evidenceStatus: EvidenceStatus;
}

export interface CompiledReportingEvent extends ReplayEvent {
  countyId: string | null;
  unitType: LockedReportingUnitType | null;
  geometryStatus: LockedGeometryStatus | null;
  candidateDelta: CandidateVoteVector | null;
  totalDelta: number;
  voteEvidenceIds: readonly string[];
  orderTieBreaker: number;
}

export interface CompiledJurisdictionReplay<TDefinition = unknown, TProfile = unknown> {
  schemaVersion: string;
  compilerVersion: string;
  replaySchemaVersion: typeof REPLAY_SCHEMA_VERSION;
  endpointContentFingerprint: string;
  definition: TDefinition;
  profile: TProfile;
  events: readonly CompiledReportingEvent[];
  eventStreamFingerprint: string;
}
