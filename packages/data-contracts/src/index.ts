export type Identifier = string;

export type GeographyQuality =
  | "official"
  | "normalized"
  | "approximate"
  | "none";

export type ResultQuality = "official" | "normalized" | "estimated";

export type ReportingUnitType =
  | "precinct"
  | "election_day_precinct"
  | "mail_bucket"
  | "early_vote_bucket"
  | "provisional_bucket"
  | "central_count_bucket"
  | "other_bucket";

export interface Election {
  id: Identifier;
  date: string;
  countryCode: "US";
  office: "president";
  name: string;
  dataVersion: string;
}

export interface Candidate {
  id: Identifier;
  electionId: Identifier;
  name: string;
  shortName: string;
  partyId: Identifier | null;
}

export interface ReportingUnit {
  id: Identifier;
  electionId: Identifier;
  stateFips: string;
  countyFips: string | null;
  sourceKey: string;
  name: string;
  type: ReportingUnitType;
  geometryId: Identifier | null;
  geometryVintage: string | null;
  geometrySourceId: Identifier | null;
  resultSourceId: Identifier;
  geometryQuality: GeographyQuality;
  resultQuality: ResultQuality;
}

export interface CandidateVotes {
  candidateId: Identifier;
  partyId: Identifier | null;
  votes: number;
}

export interface ReportingUnitResult {
  reportingUnitId: Identifier;
  contestId: Identifier;
  votes: CandidateVotes[];
  totalVotes: number;
  ballotMode: string | null;
}

export type GeographySelector =
  | { kind: "national" }
  | { kind: "state"; stateFips: string }
  | { kind: "county"; countyFips: string }
  | { kind: "reporting_units"; ids: Identifier[] }
  | { kind: "custom_region"; id: Identifier };

export interface DemographicSelector {
  age?: "18-29" | "30-44" | "45-64" | "65+";
  education?: "non_college" | "college";
  raceEthnicity?: string;
  sex?: string;
  urbanicity?: "urban_core" | "suburban" | "small_metro" | "rural";
  income?: "low" | "middle" | "high";
}

export interface ScenarioMutation {
  id: Identifier;
  order: number;
  enabled: boolean;
  editor: "behavior" | "population";
  operation: "turnout_shift" | "preference_shift" | "recompose" | "grow" | "shrink";
  demographicSelector: DemographicSelector | null;
  geographySelector: GeographySelector;
  candidateId?: Identifier;
  value: number;
  units: "points" | "percent" | "people" | "share";
}

export interface Scenario {
  id: Identifier;
  electionId: Identifier;
  engineVersion: string;
  dataVersion: string;
  mutations: ScenarioMutation[];
  uncertaintySeed?: string;
}

export interface SourceRegistryEntry {
  id: Identifier;
  publisher: string;
  title: string;
  sourceUrl: string;
  retrievedAt: string;
  electionId: Identifier;
  geographyVintage: string | null;
  licenseStatus: "verified" | "review_required" | "restricted";
  checksumSha256: string;
  pipelineVersion: string;
  limitations: string[];
}
