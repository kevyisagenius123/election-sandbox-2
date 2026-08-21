import type { CountyPresidentialResult } from "../../packages/election-model/src/scenario.ts";
import sourceDocument from "./wi-2024-counties.json";

export interface WisconsinCountyResult extends CountyPresidentialResult {
  code: number;
  reportingUnitCount: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
}

interface WisconsinCountyDocument {
  schemaVersion: number;
  electionId: string;
  stateCode: "WI";
  stateFips: "55";
  generatedAt: string;
  sources: Array<{
    id: string;
    publisher: string;
    title: string;
    sourceUrl: string;
    retrievedAt: string;
    limitations: string[];
  }>;
  totals: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  counties: WisconsinCountyResult[];
}

export const wisconsin2024 = sourceDocument as WisconsinCountyDocument;
export const wisconsinCounties2024 = wisconsin2024.counties;
export const wisconsinCountySource = wisconsin2024.sources[0];
