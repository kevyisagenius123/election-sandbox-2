import type {
  BehaviorScenarioUnit,
  ThirdPartyCandidate,
} from "../../packages/election-model/src/scenario.ts";
import type { DetailedStateFoundation } from "./detailedStateFoundation.ts";
import type {
  DetailedCountyResult,
  DetailedGeographyRecord,
  DetailedScenarioCountyResult,
} from "./detailedStateData.ts";

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
  kind: "county" | "precinct";
  geographyLabel: "County" | "Precinct" | "VTD";
  id: string;
  name: string;
  context: string;
  actualVotes: InspectorVotes;
  scenarioVotes: InspectorVotes;
  votingAgePopulation: number;
  turnoutRatePct: number | null;
  turnoutCapacity: number;
  denominatorStatus: string;
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
    unmatchedGeographyCount: number;
    sourceUnitCount: number;
    residualBallots: number;
    resultMatchMethod: string | null;
    demographicMatchMethod: string | null;
  };
}

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
    preferenceNetHarrisGain: units.reduce((sum, unit) => sum + unit.preferenceNetHarrisGain, 0),
    thirdPartyCandidate,
    thirdPartyCandidateDelta: units.reduce((sum, unit) => sum + unit.thirdPartyCandidateDelta, 0),
    ballotDelta: scenarioVotes.totalVotes - actualVotes.totalVotes,
    marginDelta: (scenarioVotes.harrisVotes - scenarioVotes.trumpVotes)
      - (actualVotes.harrisVotes - actualVotes.trumpVotes),
  };
}

export function buildDetailedCountyInspector(
  actual: DetailedCountyResult,
  scenario: DetailedScenarioCountyResult,
  foundation: DetailedStateFoundation,
  geographies: readonly DetailedGeographyRecord[],
  scenarioUnits: readonly BehaviorScenarioUnit[],
  thirdPartyCandidate: ThirdPartyCandidate,
): GeographyInspectorModel {
  const countyGeographies = geographies.filter((item) => item.countyFips === actual.fips);
  const votingAgePopulation = countyGeographies.reduce((sum, item) => sum + item.votingAgePopulation, 0);
  const turnoutCapacity = countyGeographies.reduce((sum, item) => sum + item.turnoutCapacity, 0);
  const mappedBallots = countyGeographies.reduce((sum, item) => sum + item.baselineVotes.totalVotes, 0);
  const readyCount = countyGeographies.filter((item) => item.denominatorStatus === "available").length;
  const denominatorStatus = readyCount === countyGeographies.length
    ? "available"
    : readyCount === 0
      ? "unavailable"
      : "mixed";
  const actualVotes = votesOf(actual);
  const scenarioVotes = votesOf(scenario);
  return {
    kind: "county",
    geographyLabel: "County",
    id: actual.fips,
    name: actual.name,
    context: `${foundation.stateCode} county`,
    actualVotes,
    scenarioVotes,
    votingAgePopulation,
    turnoutRatePct: votingAgePopulation > 0 ? actual.totalVotes / votingAgePopulation * 100 : null,
    turnoutCapacity,
    denominatorStatus,
    operations: operationTotals(
      scenarioUnits.filter((unit) => unit.countyFips === actual.fips),
      actualVotes,
      scenarioVotes,
      thirdPartyCandidate,
    ),
    coverage: {
      mappedBallots,
      officialBallots: actual.totalVotes,
      mappedBallotPct: actual.totalVotes > 0 ? mappedBallots / actual.totalVotes * 100 : null,
      exactSourceUnitCount: countyGeographies.reduce((sum, item) => sum + item.exactSourceUnitCount, 0),
      canonicalSourceUnitCount: countyGeographies.reduce((sum, item) => sum + item.canonicalSourceUnitCount, 0),
      unmatchedGeographyCount: countyGeographies.filter((item) => !item.hasMappedResult).length,
      sourceUnitCount: actual.reportingUnitCount,
      residualBallots: Math.max(0, actual.totalVotes - mappedBallots),
      resultMatchMethod: null,
      demographicMatchMethod: null,
    },
  };
}

export function buildDetailedGeographyInspector(
  geography: DetailedGeographyRecord,
  scenarioUnit: BehaviorScenarioUnit | undefined,
  countyName: string,
  thirdPartyCandidate: ThirdPartyCandidate,
): GeographyInspectorModel {
  const actualVotes = votesOf(geography.baselineVotes);
  const scenarioVotes = votesOf(scenarioUnit ?? geography.baselineVotes);
  return {
    kind: "precinct",
    geographyLabel: geography.geographyLabel,
    id: geography.id,
    name: geography.name,
    context: `${countyName} · ${geography.geographyLabel} ${geography.code}`,
    actualVotes,
    scenarioVotes,
    votingAgePopulation: geography.votingAgePopulation,
    turnoutRatePct: geography.hasMappedResult && geography.votingAgePopulation > 0
      ? geography.baselineVotes.totalVotes / geography.votingAgePopulation * 100
      : null,
    turnoutCapacity: geography.turnoutCapacity,
    denominatorStatus: geography.denominatorStatus,
    operations: operationTotals(scenarioUnit ? [scenarioUnit] : [], actualVotes, scenarioVotes, thirdPartyCandidate),
    coverage: {
      mappedBallots: geography.baselineVotes.totalVotes,
      officialBallots: geography.baselineVotes.totalVotes,
      mappedBallotPct: geography.hasMappedResult ? 100 : null,
      exactSourceUnitCount: geography.exactSourceUnitCount,
      canonicalSourceUnitCount: geography.canonicalSourceUnitCount,
      unmatchedGeographyCount: geography.hasMappedResult ? 0 : 1,
      sourceUnitCount: geography.sourceUnitCount,
      residualBallots: 0,
      resultMatchMethod: geography.resultMatchMethod,
      demographicMatchMethod: geography.demographicMatchMethod,
    },
  };
}
