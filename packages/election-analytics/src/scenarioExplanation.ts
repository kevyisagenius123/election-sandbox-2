import { rankScenarioDeltaRows } from "./scenarioDeltaLedger.ts";
import type {
  ScenarioDeltaLedger,
  ScenarioDeltaMapStatus,
  ScenarioDeltaOperationId,
} from "./scenarioDeltaContracts.ts";

export type ScenarioExplanationDirection = "harris" | "trump" | "none";
export type ScenarioExplanationCandidate = "harris" | "trump";

export interface ScenarioExplanationOperation {
  operationId: ScenarioDeltaOperationId;
  marginVotes: number;
  grossShareMillionths: number;
}

export interface ScenarioExplanationGeography {
  id: string;
  name: string;
  context: string | null;
  marginVotes: number;
  mapStatus: ScenarioDeltaMapStatus;
}

export interface ScenarioExplanationElectoral {
  actualWinner: ScenarioExplanationCandidate;
  scenarioWinner: ScenarioExplanationCandidate;
  electoralVotes: number;
  winnerChanged: boolean;
  targetCandidate: ScenarioExplanationCandidate;
  targetElectoralDelta: number;
}

export interface ScenarioExplanation {
  stateCode: string;
  direction: ScenarioExplanationDirection;
  marginVotes: number;
  dominantOperation: ScenarioExplanationOperation | null;
  largestSupportingCounty: ScenarioExplanationGeography | null;
  largestOpposingCounty: ScenarioExplanationGeography | null;
  largestSupportingUnit: ScenarioExplanationGeography | null;
  electoral: ScenarioExplanationElectoral;
}

export interface ScenarioExplanationInput {
  ledger: ScenarioDeltaLedger;
  countyNames?: Readonly<Record<string, string>>;
  unitNames?: Readonly<Record<string, string>>;
}

const operationOrder: Readonly<Record<ScenarioDeltaOperationId, number>> = {
  turnout: 0,
  preference: 1,
  "third-party": 2,
};

function direction(value: number): ScenarioExplanationDirection {
  return value > 0 ? "harris" : value < 0 ? "trump" : "none";
}

function winner(harrisVotes: number, trumpVotes: number): ScenarioExplanationCandidate {
  return harrisVotes > trumpVotes ? "harris" : "trump";
}

function geographySupports(value: number, statewideDirection: ScenarioExplanationDirection) {
  if (statewideDirection === "harris") return value > 0;
  if (statewideDirection === "trump") return value < 0;
  return value !== 0;
}

function geographyOpposes(value: number, statewideDirection: ScenarioExplanationDirection) {
  if (statewideDirection === "harris") return value < 0;
  if (statewideDirection === "trump") return value > 0;
  return false;
}

export function buildScenarioExplanation(input: ScenarioExplanationInput): ScenarioExplanation {
  const { ledger } = input;
  const statewideDirection = direction(ledger.delta.harrisTrumpMarginVotes);
  const operationGrossMovement = ledger.operations.reduce(
    (sum, operation) => sum + Math.abs(operation.delta.harrisTrumpMarginVotes),
    0,
  );
  const dominantOperationRow = [...ledger.operations]
    .filter((operation) => operation.delta.harrisTrumpMarginVotes !== 0)
    .sort((left, right) => (
      Math.abs(right.delta.harrisTrumpMarginVotes) - Math.abs(left.delta.harrisTrumpMarginVotes)
      || operationOrder[left.operationId] - operationOrder[right.operationId]
    ))[0] ?? null;
  const dominantOperation = dominantOperationRow ? Object.freeze({
    operationId: dominantOperationRow.operationId,
    marginVotes: dominantOperationRow.delta.harrisTrumpMarginVotes,
    grossShareMillionths: operationGrossMovement > 0
      ? Math.round(Math.abs(dominantOperationRow.delta.harrisTrumpMarginVotes) * 1_000_000 / operationGrossMovement)
      : 0,
  }) : null;

  const rankedCounties = rankScenarioDeltaRows(ledger.counties);
  const supportingCounty = rankedCounties.find((county) => (
    geographySupports(county.delta.harrisTrumpMarginVotes, statewideDirection)
  ));
  const opposingCounty = rankedCounties.find((county) => (
    geographyOpposes(county.delta.harrisTrumpMarginVotes, statewideDirection)
  ));
  const rankedUnits = rankScenarioDeltaRows(ledger.units)
    .filter((unit) => unit.geometryId !== null);
  const supportingUnit = rankedUnits.find((unit) => (
    geographySupports(unit.delta.harrisTrumpMarginVotes, statewideDirection)
  ));

  const countyGeography = supportingCounty ? Object.freeze({
    id: supportingCounty.id,
    name: input.countyNames?.[supportingCounty.countyFips] ?? supportingCounty.countyFips,
    context: "County",
    marginVotes: supportingCounty.delta.harrisTrumpMarginVotes,
    mapStatus: supportingCounty.mapStatus,
  }) : null;
  const opposingCountyGeography = opposingCounty ? Object.freeze({
    id: opposingCounty.id,
    name: input.countyNames?.[opposingCounty.countyFips] ?? opposingCounty.countyFips,
    context: "County offset",
    marginVotes: opposingCounty.delta.harrisTrumpMarginVotes,
    mapStatus: opposingCounty.mapStatus,
  }) : null;
  const unitGeography = supportingUnit ? Object.freeze({
    id: supportingUnit.geometryId!,
    name: input.unitNames?.[supportingUnit.geometryId!] ?? supportingUnit.geometryId!,
    context: supportingUnit.countyFips
      ? input.countyNames?.[supportingUnit.countyFips] ?? supportingUnit.countyFips
      : null,
    marginVotes: supportingUnit.delta.harrisTrumpMarginVotes,
    mapStatus: supportingUnit.mapStatus,
  }) : null;

  const electoralVotes = ledger.electoral.actualHarrisElectoralVotes
    + ledger.electoral.actualTrumpElectoralVotes;
  return Object.freeze({
    stateCode: ledger.stateCode,
    direction: statewideDirection,
    marginVotes: ledger.delta.harrisTrumpMarginVotes,
    dominantOperation,
    largestSupportingCounty: countyGeography,
    largestOpposingCounty: opposingCountyGeography,
    largestSupportingUnit: unitGeography,
    electoral: Object.freeze({
      actualWinner: winner(ledger.certified.harrisVotes, ledger.certified.trumpVotes),
      scenarioWinner: winner(ledger.scenario.harrisVotes, ledger.scenario.trumpVotes),
      electoralVotes,
      winnerChanged: ledger.electoral.winnerChanged,
      targetCandidate: ledger.electoral.targetCandidate,
      targetElectoralDelta: ledger.electoral.targetElectoralDelta,
    }),
  });
}
