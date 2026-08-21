import type {
  BehaviorModelUnit,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";
import type { DetailedStateFoundation } from "./detailedStateFoundation.ts";
import { isMichiganFoundation, isWisconsinFoundation } from "./detailedStateFoundation.ts";
import type { DetailedStateCode } from "./detailedStateManifest.ts";
import { getDetailedStateManifest } from "./detailedStateManifest.ts";
import { getDetailedStateRuntimeAdapter } from "./detailedStateRuntimeLoaders.ts";
import { michigan2024, michiganCounties2024, michiganCountySource } from "./michigan.ts";
import { pennsylvania2024, pennsylvaniaCounties2024, pennsylvaniaCountySource } from "./pennsylvania.ts";
import { wisconsin2024, wisconsinCounties2024, wisconsinCountySource } from "./wisconsin.ts";

export interface DetailedCountyResult {
  fips: string;
  code: number;
  name: string;
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
  reportingUnitCount: number;
}

export interface DetailedScenarioCountyResult extends DetailedCountyResult {
  netHarrisGain: number;
}

export interface DetailedGeographyRecord {
  id: string;
  countyFips: string;
  name: string;
  code: string;
  geographyLabel: "Precinct" | "VTD" | "Ward";
  baselineVotes: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  votingAgePopulation: number;
  turnoutCapacity: number;
  denominatorStatus: string;
  hasMappedResult: boolean;
  sourceUnitCount: number;
  exactSourceUnitCount: number;
  canonicalSourceUnitCount: number;
  resultMatchMethod: string | null;
  demographicMatchMethod: string | null;
}

export function getDetailedStateCounties(code: DetailedStateCode): DetailedCountyResult[] {
  const counties = code === "MI"
    ? michiganCounties2024
    : code === "WI"
      ? wisconsinCounties2024
      : pennsylvaniaCounties2024;
  return counties.map((county) => ({
    fips: county.fips,
    code: county.code,
    name: county.name,
    harrisVotes: county.harrisVotes,
    trumpVotes: county.trumpVotes,
    steinVotes: county.steinVotes,
    oliverVotes: county.oliverVotes,
    residualOtherVotes: county.residualOtherVotes,
    otherVotes: county.otherVotes,
    totalVotes: county.totalVotes,
    reportingUnitCount: county.reportingUnitCount,
  }));
}

export function getDetailedStateElection(code: DetailedStateCode) {
  if (code === "MI") return michigan2024;
  if (code === "WI") return wisconsin2024;
  return pennsylvania2024;
}

export function getDetailedStateSource(code: DetailedStateCode) {
  if (code === "MI") return michiganCountySource;
  if (code === "WI") return wisconsinCountySource;
  return pennsylvaniaCountySource;
}

export function getDetailedStateGeographies(
  foundation: DetailedStateFoundation,
): DetailedGeographyRecord[] {
  if (isMichiganFoundation(foundation)) {
    return foundation.precincts.map((precinct) => ({
      id: precinct.geometryId,
      countyFips: precinct.countyFips,
      name: precinct.precinctName,
      code: precinct.geometryId,
      geographyLabel: "Precinct",
      baselineVotes: precinct.baselineVotes,
      votingAgePopulation: precinct.votingAgePopulation,
      turnoutCapacity: precinct.turnoutCapacity,
      denominatorStatus: precinct.denominatorStatus,
      hasMappedResult: precinct.hasMappedResult,
      sourceUnitCount: precinct.sourceUnitCount,
      exactSourceUnitCount: precinct.exactSourceUnitCount,
      canonicalSourceUnitCount: precinct.canonicalSourceUnitCount,
      resultMatchMethod: precinct.resultMatchMethod,
      demographicMatchMethod: precinct.demographicMatchMethod,
    }));
  }
  if (isWisconsinFoundation(foundation)) {
    return foundation.wards.map((ward) => ({
      id: ward.geometryId,
      countyFips: ward.countyFips,
      name: ward.wardName,
      code: ward.geometryId,
      geographyLabel: "Ward",
      baselineVotes: ward.baselineVotes,
      votingAgePopulation: ward.votingAgePopulation,
      turnoutCapacity: ward.turnoutCapacity,
      denominatorStatus: ward.denominatorStatus,
      hasMappedResult: ward.hasMappedResult,
      sourceUnitCount: ward.sourceUnitCount,
      exactSourceUnitCount: ward.exactSourceUnitCount,
      canonicalSourceUnitCount: ward.canonicalSourceUnitCount,
      resultMatchMethod: ward.resultMatchMethod,
      demographicMatchMethod: ward.demographicMatchMethod,
    }));
  }
  return foundation.vtds.map((vtd) => ({
    id: vtd.geoid,
    countyFips: vtd.countyFips,
    name: vtd.displayName || vtd.censusName,
    code: vtd.vtdCode,
    geographyLabel: "VTD",
    baselineVotes: vtd.baselineVotes,
    votingAgePopulation: vtd.votingAgePopulation,
    turnoutCapacity: vtd.turnoutCapacity,
    denominatorStatus: vtd.denominatorStatus,
    hasMappedResult: vtd.hasMappedResult,
    sourceUnitCount: vtd.sourceUnitCount,
    exactSourceUnitCount: vtd.exactSourceUnitCount,
    canonicalSourceUnitCount: vtd.canonicalSourceUnitCount,
    resultMatchMethod: vtd.resultMatchMethod,
    demographicMatchMethod: "direct_census_vtd",
  }));
}

export function toDetailedBehaviorModelUnits(
  foundation: DetailedStateFoundation,
): BehaviorModelUnit[] {
  const loader = getDetailedStateManifest(foundation.stateCode).runtime.loader;
  return getDetailedStateRuntimeAdapter(loader).toBehaviorModelUnits(foundation);
}

export function scenarioDetailedGeographyMap(units: readonly BehaviorScenarioUnit[]) {
  return new Map(
    units
      .filter((unit): unit is BehaviorScenarioUnit & { geometryId: string } => unit.geometryId != null)
      .map((unit) => [unit.geometryId, unit]),
  );
}

export function buildDetailedScenarioCounties(
  counties: readonly DetailedCountyResult[],
  baselineUnits: readonly BehaviorModelUnit[] | null,
  scenarioUnits: readonly BehaviorScenarioUnit[] | null,
): DetailedScenarioCountyResult[] {
  if (!baselineUnits || !scenarioUnits) {
    return counties.map((county) => ({ ...county, netHarrisGain: 0 }));
  }
  const baselineById = new Map(baselineUnits.map((unit) => [unit.id, unit]));
  const deltas = new Map<string, { harris: number; trump: number; other: number; total: number }>();
  for (const unit of scenarioUnits) {
    if (!unit.countyFips) continue;
    const baseline = baselineById.get(unit.id);
    if (!baseline) throw new Error(`Scenario unit ${unit.id} is missing its baseline`);
    const delta = deltas.get(unit.countyFips) ?? { harris: 0, trump: 0, other: 0, total: 0 };
    delta.harris += unit.harrisVotes - baseline.harrisVotes;
    delta.trump += unit.trumpVotes - baseline.trumpVotes;
    delta.other += unit.otherVotes - baseline.otherVotes;
    delta.total += unit.totalVotes - baseline.totalVotes;
    deltas.set(unit.countyFips, delta);
  }
  return counties.map((county) => {
    const delta = deltas.get(county.fips) ?? { harris: 0, trump: 0, other: 0, total: 0 };
    return {
      ...county,
      harrisVotes: county.harrisVotes + delta.harris,
      trumpVotes: county.trumpVotes + delta.trump,
      otherVotes: county.otherVotes + delta.other,
      totalVotes: county.totalVotes + delta.total,
      netHarrisGain: delta.harris,
    };
  });
}
