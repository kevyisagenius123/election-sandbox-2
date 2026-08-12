import type { CountyPresidentialResult } from "../../packages/election-model/src/scenario.ts";
import sourceDocument from "./mi-2024-counties.json";

export interface MichiganCountyResult extends CountyPresidentialResult {
  code: number;
  reportingUnitCount: number;
  geographicReportingUnitCount: number;
  centralCountUnitCount: number;
  statisticalAdjustmentUnitCount: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
}

interface MichiganCountyDocument {
  schemaVersion: number;
  electionId: string;
  stateCode: "MI";
  stateFips: "26";
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
  counties: MichiganCountyResult[];
}

export const michigan2024 = sourceDocument as MichiganCountyDocument;
export const michiganCounties2024 = michigan2024.counties;
export const michiganCountySource = michigan2024.sources[0];
