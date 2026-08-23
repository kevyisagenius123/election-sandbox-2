import type { DetailedStateCode } from "./detailedStateManifest.ts";

export interface StateEvidenceLedger {
  stateCode: DetailedStateCode;
  stateName: string;
  election: {
    publisher: string;
    title: string;
    sourceUrl: string;
    retrievedAt: string;
    artifactVersion: string;
  };
  geography: {
    label: string;
    contract: string;
    method: string;
  };
  coverage: {
    mappedUnits: number;
    totalUnits: number;
    mappedBallots: number;
    certifiedBallots: number;
    unmatchedUnits: number;
    offMapBallots: number;
  };
  treatment: string;
  denominator: string;
  methodologyUrl: string;
}

const ledgers: Record<DetailedStateCode, StateEvidenceLedger> = {
  PA: {
    stateCode: "PA",
    stateName: "Pennsylvania",
    election: {
      publisher: "Commonwealth of Pennsylvania Department of State",
      title: "2024 General Election Precinct Election Returns",
      sourceUrl: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt",
      retrievedAt: "2026-08-09",
      artifactVersion: "pa-pl94-vtd-demographics-v3",
    },
    geography: {
      label: "2020 Census voting districts (VTDs)",
      contract: "Census VTD terrain linked to 2024 Pennsylvania reporting units",
      method: "Exact county-plus-VTD identifiers, then reviewed unique canonical names within county",
    },
    coverage: {
      mappedUnits: 9038,
      totalUnits: 9178,
      mappedBallots: 6933560,
      certifiedBallots: 7058732,
      unmatchedUnits: 140,
      offMapBallots: 125172,
    },
    treatment: "Unmatched reporting units and non-geographic residual ballots remain in electoral totals but are never assigned to invented map polygons.",
    denominator: "2020 population age 18 and over (VAP), not CVAP or a 2024 eligibility estimate.",
    methodologyUrl: "https://github.com/Electaris/election-sandbox-2/blob/main/docs/decisions/0006-pennsylvania-vtd-crosswalk.md",
  },
  MI: {
    stateCode: "MI",
    stateName: "Michigan",
    election: {
      publisher: "Michigan Department of State, Bureau of Elections",
      title: "2024 Michigan Precinct-Level General Election Results",
      sourceUrl: "https://mvic.sos.state.mi.us/votehistory/",
      retrievedAt: "2026-08-10",
      artifactVersion: "mi-pl94-2024-precinct-demographics-v1",
    },
    geography: {
      label: "2024 precinct reporting units",
      contract: "Exact-cycle official 2024 precinct polygons",
      method: "Official ward-and-precinct keys with documented reviewed corrections",
    },
    coverage: {
      mappedUnits: 4339,
      totalUnits: 4340,
      mappedBallots: 5521612,
      certifiedBallots: 5664186,
      unmatchedUnits: 1,
      offMapBallots: 142574,
    },
    treatment: "Central-count votes, statistical adjustments, and unmatched returns remain in aggregate totals and outside precinct terrain.",
    denominator: "2020 VAP bridged to 2024 precincts; weighted splits are documented allocations, not official precinct demographics.",
    methodologyUrl: "https://github.com/Electaris/election-sandbox-2/blob/main/docs/decisions/0015-michigan-source-geometry-and-demographic-audit.md",
  },
  WI: {
    stateCode: "WI",
    stateName: "Wisconsin",
    election: {
      publisher: "Wisconsin Legislative Technology Services Bureau",
      title: "2024 Election Data with 2025 Wards",
      sourceUrl: "https://www.arcgis.com/home/item.html?id=878d8826218f42509e07437a82ef6b6e",
      retrievedAt: "2026-08-20",
      artifactVersion: "wi-ltsb-ward-row-v1",
    },
    geography: {
      label: "January 2025 municipal wards",
      contract: "Official LTSB ward geometry with population-disaggregated 2024 election data",
      method: "One stable LTSB GEOID per ward; no crosswalk or approximate matching",
    },
    coverage: {
      mappedUnits: 6946,
      totalUnits: 7086,
      mappedBallots: 3422918,
      certifiedBallots: 3422918,
      unmatchedUnits: 140,
      offMapBallots: 0,
    },
    treatment: "All certified statewide and county votes are carried by LTSB's reconstructed ward layer. The 140 geometry-only wards have no election row, remain neutral, and receive no modeled turnout capacity.",
    denominator: "LTSB estimate of 2020 population age 18 and over aggregated to 2025 wards; not CVAP or a 2024 eligibility estimate.",
    methodologyUrl: "https://github.com/Electaris/election-sandbox-2/blob/main/docs/decisions/0026-wisconsin-ltsb-admission.md",
  },
};

export function getStateEvidenceLedger(code: DetailedStateCode) {
  return ledgers[code];
}

export const nationalCoverageRows = [
  {
    state: "Pennsylvania",
    electoralModel: "Certified",
    detailedGeography: "Detailed",
    geometryContract: "2020 Census VTD bridge",
    coverage: "9,038 / 9,178 VTDs",
  },
  {
    state: "Michigan",
    electoralModel: "Certified",
    detailedGeography: "Detailed",
    geometryContract: "2024 precinct units",
    coverage: "4,339 / 4,340 polygons",
  },
  {
    state: "Wisconsin",
    electoralModel: "Certified",
    detailedGeography: "Detailed",
    geometryContract: "LTSB 2025 reconstructed wards",
    coverage: "6,946 / 7,086 wards",
  },
  {
    state: "Other 48 jurisdictions",
    electoralModel: "Certified arithmetic",
    detailedGeography: "None",
    geometryContract: "Unsupported",
    coverage: "—",
  },
] as const;
