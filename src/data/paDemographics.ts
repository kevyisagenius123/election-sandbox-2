import type {
  BehaviorModelUnit,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";

export interface PennsylvaniaVtdDemographicRecord {
  geoid: string;
  countyFips: string;
  vtdCode: string;
  censusName: string;
  displayName: string;
  votingAgePopulation: number;
  hispanicAnyRace: number;
  nonHispanicWhite: number;
  nonHispanicBlack: number;
  nonHispanicAsian: number;
  nonHispanicOther: number;
  hasMappedResult: boolean;
  baselineVotes: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  turnoutCapacity: number;
  denominatorStatus:
    | "available"
    | "ballots_exceed_2020_vap"
    | "no_mapped_2024_result";
}

export interface PennsylvaniaResidualModelUnit {
  id: string;
  countyFips: string | null;
  name: string;
  type: string;
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface PennsylvaniaDemographicFoundation {
  schemaVersion: number;
  generatedAt: string;
  electionId: string;
  source: {
    id: string;
    publisher: string;
    title: string;
    sourceUrl: string;
    documentationUrl: string;
    geographyVintage: string;
    table: string;
    limitations: string[];
  };
  join: {
    method: string;
    demographicVintage: string;
    geometryVintage: string;
    electionVintage: string;
    geometryFeatureCount: number;
    mappedElectionGeometryCount: number;
    unavailableElectionGeometryCount: number;
    resultReportingUnitCoveragePct: number;
  };
  totals: {
    statewideDemographics: {
      votingAgePopulation: number;
      hispanicAnyRace: number;
      nonHispanicWhite: number;
      nonHispanicBlack: number;
      nonHispanicAsian: number;
      nonHispanicOther: number;
    };
    turnoutCapacity: number;
    denominatorStatus: {
      availableVtdCount: number;
      ballotsExceed2020VapVtdCount: number;
      noMappedResultVtdCount: number;
    };
  };
  vtds: PennsylvaniaVtdDemographicRecord[];
  residualUnits: PennsylvaniaResidualModelUnit[];
}

let demographicFoundationPromise: Promise<PennsylvaniaDemographicFoundation> | null = null;

function publicUrl(path: string) {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}

export function loadPennsylvaniaDemographicFoundation() {
  if (!demographicFoundationPromise) {
    demographicFoundationPromise = fetch(publicUrl("data/pa/2020/vtd-demographics.json"))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Demographic foundation request failed with ${response.status}`);
        }
        return response.json() as Promise<PennsylvaniaDemographicFoundation>;
      })
      .catch((error: unknown) => {
        demographicFoundationPromise = null;
        throw error;
      });
  }
  return demographicFoundationPromise;
}

export function toBehaviorModelUnits(
  foundation: PennsylvaniaDemographicFoundation,
): BehaviorModelUnit[] {
  const mappedVtds: BehaviorModelUnit[] = foundation.vtds
    .filter((vtd) => vtd.hasMappedResult)
    .map((vtd) => ({
      id: `vtd-${vtd.geoid}`,
      countyFips: vtd.countyFips,
      geometryId: vtd.geoid,
      ...vtd.baselineVotes,
      turnoutDenominator: vtd.denominatorStatus === "available"
        ? vtd.votingAgePopulation
        : null,
      turnoutCapacity: vtd.denominatorStatus === "available"
        ? vtd.turnoutCapacity
        : 0,
    }));
  const residuals: BehaviorModelUnit[] = foundation.residualUnits.map((unit) => ({
    id: unit.id,
    countyFips: unit.countyFips,
    geometryId: null,
    harrisVotes: unit.harrisVotes,
    trumpVotes: unit.trumpVotes,
    steinVotes: unit.steinVotes,
    oliverVotes: unit.oliverVotes,
    residualOtherVotes: unit.residualOtherVotes,
    otherVotes: unit.otherVotes,
    totalVotes: unit.totalVotes,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  }));
  return [...mappedVtds, ...residuals];
}

export function scenarioVtdMap(units: readonly BehaviorScenarioUnit[]) {
  return new Map(
    units
      .filter((unit): unit is BehaviorScenarioUnit & { geometryId: string } =>
        unit.geometryId != null)
      .map((unit) => [unit.geometryId, unit]),
  );
}
