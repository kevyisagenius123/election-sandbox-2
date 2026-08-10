import type {
  BehaviorScenarioUnit,
  ThirdPartyCandidate,
} from "../../packages/election-model/src/scenario.ts";
import type {
  PennsylvaniaDemographicFoundation,
  PennsylvaniaVtdDemographicRecord,
} from "./paDemographics.ts";
import type { PennsylvaniaCountyResult } from "./pennsylvania.ts";

export interface InspectorVotes {
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface GeographyInspectorModel {
  kind: "county" | "vtd";
  id: string;
  name: string;
  context: string;
  actualVotes: InspectorVotes;
  scenarioVotes: InspectorVotes;
  votingAgePopulation: number;
  turnoutRatePct: number | null;
  turnoutCapacity: number;
  denominatorStatus:
    | "available"
    | "mixed"
    | "ballots_exceed_2020_vap"
    | "no_mapped_2024_result";
  operations: {
    turnoutAddedVotes: number;
    preferenceNetHarrisGain: number;
    thirdPartyCandidate: ThirdPartyCandidate;
    thirdPartyCandidateDelta: number;
    ballotDelta: number;
    marginDelta: number;
  };
  coverage: {
    mappedBallots: number;
    officialBallots: number;
    mappedBallotPct: number | null;
    exactSourceUnitCount: number;
    canonicalSourceUnitCount: number;
    unmatchedVtdCount: number;
    sourceUnitCount: number;
    residualBallots: number;
    resultMatchMethod: PennsylvaniaVtdDemographicRecord["resultMatchMethod"];
  };
}

type CountyScenarioResult = PennsylvaniaCountyResult & { netHarrisGain: number };

function votesOf(result: InspectorVotes): InspectorVotes {
  return {
    harrisVotes: result.harrisVotes,
    trumpVotes: result.trumpVotes,
    steinVotes: result.steinVotes,
    oliverVotes: result.oliverVotes,
    residualOtherVotes: result.residualOtherVotes,
    otherVotes: result.otherVotes,
    totalVotes: result.totalVotes,
  };
}

function operationTotals(
  units: readonly BehaviorScenarioUnit[],
  actualVotes: InspectorVotes,
  scenarioVotes: InspectorVotes,
  thirdPartyCandidate: ThirdPartyCandidate,
) {
  return {
    turnoutAddedVotes: units.reduce((sum, unit) => sum + unit.turnoutAddedVotes, 0),
    preferenceNetHarrisGain: units.reduce(
      (sum, unit) => sum + unit.preferenceNetHarrisGain,
      0,
    ),
    thirdPartyCandidate,
    thirdPartyCandidateDelta: units.reduce(
      (sum, unit) => sum + unit.thirdPartyCandidateDelta,
      0,
    ),
    ballotDelta: scenarioVotes.totalVotes - actualVotes.totalVotes,
    marginDelta:
      (scenarioVotes.harrisVotes - scenarioVotes.trumpVotes)
      - (actualVotes.harrisVotes - actualVotes.trumpVotes),
  };
}

export function buildCountyInspector(
  actual: PennsylvaniaCountyResult,
  scenario: CountyScenarioResult,
  foundation: PennsylvaniaDemographicFoundation,
  scenarioUnits: readonly BehaviorScenarioUnit[],
  thirdPartyCandidate: ThirdPartyCandidate,
): GeographyInspectorModel {
  const summary = foundation.counties.find((county) => county.countyFips === actual.fips);
  if (!summary) throw new Error(`Missing demographic summary for county ${actual.fips}`);
  const countyVtds = foundation.vtds.filter((vtd) => vtd.countyFips === actual.fips);
  const actualVotes = votesOf(actual);
  const scenarioVotes = votesOf(scenario);
  const availableCount = countyVtds.filter(
    (vtd) => vtd.denominatorStatus === "available",
  ).length;
  const overCapacityCount = countyVtds.filter(
    (vtd) => vtd.denominatorStatus === "ballots_exceed_2020_vap",
  ).length;
  const noResultCount = countyVtds.filter(
    (vtd) => vtd.denominatorStatus === "no_mapped_2024_result",
  ).length;
  const denominatorStatus = overCapacityCount === 0 && noResultCount === 0
    ? "available"
    : availableCount === 0 && noResultCount === countyVtds.length
      ? "no_mapped_2024_result"
      : "mixed";

  return {
    kind: "county",
    id: actual.fips,
    name: actual.name,
    context: "Pennsylvania county",
    actualVotes,
    scenarioVotes,
    votingAgePopulation: summary.demographics.votingAgePopulation,
    turnoutRatePct: summary.demographics.votingAgePopulation > 0
      ? actual.totalVotes / summary.demographics.votingAgePopulation * 100
      : null,
    turnoutCapacity: summary.turnoutCapacity,
    denominatorStatus,
    operations: operationTotals(
      scenarioUnits.filter((unit) => unit.countyFips === actual.fips),
      actualVotes,
      scenarioVotes,
      thirdPartyCandidate,
    ),
    coverage: {
      mappedBallots: summary.mappedVotes.totalVotes,
      officialBallots: actual.totalVotes,
      mappedBallotPct: actual.totalVotes > 0
        ? summary.mappedVotes.totalVotes / actual.totalVotes * 100
        : null,
      exactSourceUnitCount: countyVtds.reduce(
        (sum, vtd) => sum + vtd.exactSourceUnitCount,
        0,
      ),
      canonicalSourceUnitCount: countyVtds.reduce(
        (sum, vtd) => sum + vtd.canonicalSourceUnitCount,
        0,
      ),
      unmatchedVtdCount: countyVtds.filter((vtd) => !vtd.hasMappedResult).length,
      sourceUnitCount: actual.reportingUnitCount,
      residualBallots: actual.residualVotes,
      resultMatchMethod: null,
    },
  };
}

export function buildVtdInspector(
  vtd: PennsylvaniaVtdDemographicRecord,
  scenarioUnit: BehaviorScenarioUnit | undefined,
  countyName: string,
  thirdPartyCandidate: ThirdPartyCandidate,
): GeographyInspectorModel {
  const actualVotes = votesOf(vtd.baselineVotes);
  const scenarioVotes = votesOf(scenarioUnit ?? vtd.baselineVotes);
  return {
    kind: "vtd",
    id: vtd.geoid,
    name: vtd.displayName || vtd.censusName,
    context: `${countyName} · Census VTD ${vtd.vtdCode}`,
    actualVotes,
    scenarioVotes,
    votingAgePopulation: vtd.votingAgePopulation,
    turnoutRatePct: vtd.hasMappedResult && vtd.votingAgePopulation > 0
      ? vtd.baselineVotes.totalVotes / vtd.votingAgePopulation * 100
      : null,
    turnoutCapacity: vtd.turnoutCapacity,
    denominatorStatus: vtd.denominatorStatus,
    operations: operationTotals(
      scenarioUnit ? [scenarioUnit] : [],
      actualVotes,
      scenarioVotes,
      thirdPartyCandidate,
    ),
    coverage: {
      mappedBallots: vtd.baselineVotes.totalVotes,
      officialBallots: vtd.baselineVotes.totalVotes,
      mappedBallotPct: vtd.hasMappedResult ? 100 : null,
      exactSourceUnitCount: vtd.exactSourceUnitCount,
      canonicalSourceUnitCount: vtd.canonicalSourceUnitCount,
      unmatchedVtdCount: vtd.hasMappedResult ? 0 : 1,
      sourceUnitCount: vtd.sourceUnitCount,
      residualBallots: 0,
      resultMatchMethod: vtd.resultMatchMethod,
    },
  };
}
