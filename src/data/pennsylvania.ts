import type { CountyPresidentialResult } from "../../packages/election-model/src/scenario.ts";
import sourceDocument from "./pa-2024-counties.json" with { type: "json" };

export interface PennsylvaniaCountyResult extends CountyPresidentialResult {
  code: number;
  electionDayVotes: number;
  mailVotes: number;
  provisionalVotes: number;
  reportingUnitCount: number;
  residualVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
}

export interface PennsylvaniaCandidateResult {
  id: string;
  name: string;
  partyCode: string | null;
  bucket: string;
  votes: number;
}

interface PennsylvaniaSource {
  id: string;
  publisher: string;
  title: string;
  sourceUrl: string;
  retrievedAt: string;
  checksumSha256?: string;
  limitations: string[];
}

interface PennsylvaniaCountyDocument {
  schemaVersion: number;
  electionId: string;
  stateCode: "PA";
  stateFips: "42";
  generatedAt: string;
  sources: PennsylvaniaSource[];
  totals: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  mappedCountyTotals: {
    harrisVotes: number;
    trumpVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  unassignedStatewideVotes: number;
  candidates: PennsylvaniaCandidateResult[];
  counties: PennsylvaniaCountyResult[];
}

export const pennsylvania2024 = sourceDocument as PennsylvaniaCountyDocument;
export const pennsylvaniaCounties2024 = pennsylvania2024.counties;
export const pennsylvaniaCandidates2024 = pennsylvania2024.candidates;
export const pennsylvaniaCountyByFips = new Map(
  pennsylvaniaCounties2024.map((county) => [county.fips, county]),
);
export const pennsylvaniaCountySource = pennsylvania2024.sources[0];
