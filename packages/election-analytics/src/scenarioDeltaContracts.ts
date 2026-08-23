import type {
  BehaviorModelUnit,
  BehaviorScenarioResult,
  StatewidePresidentialResult,
  ThirdPartyCandidate,
} from "../../election-model/src/scenario.ts";
import type { AnalyticCollection } from "./contracts.ts";
import { ANALYTIC_REGISTRY_VERSION } from "./registry.ts";

export const SCENARIO_DELTA_LEDGER_SCHEMA_VERSION = "sandbox-scenario-delta-ledger-v1" as const;
export const SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION = "sandbox-scenario-delta-ledger-v1" as const;

export type ScenarioDeltaOperationId = "turnout" | "preference" | "third-party";
export type ScenarioDeltaMapStatus = "mapped" | "off-map" | "mixed";

export interface ScenarioCandidateVector {
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface ScenarioVoteDelta extends ScenarioCandidateVector {
  harrisTrumpMarginVotes: number;
}

export interface ScenarioOperationDelta {
  operationId: ScenarioDeltaOperationId;
  delta: ScenarioVoteDelta;
}

export interface ScenarioOperationLedgerRow extends ScenarioOperationDelta {
  requestedVolume: number;
  realizedVolume: number;
  selectedCandidate: ThirdPartyCandidate | null;
}

export interface ScenarioUnitDeltaRow {
  id: string;
  countyFips: string | null;
  geometryId: string | null;
  mapStatus: Exclude<ScenarioDeltaMapStatus, "mixed">;
  certified: ScenarioCandidateVector;
  scenario: ScenarioCandidateVector;
  delta: ScenarioVoteDelta;
  operations: readonly ScenarioOperationDelta[];
}

export interface ScenarioCountyDeltaRow {
  id: string;
  countyFips: string;
  mapStatus: ScenarioDeltaMapStatus;
  unitCount: number;
  certified: ScenarioCandidateVector;
  scenario: ScenarioCandidateVector;
  delta: ScenarioVoteDelta;
  operations: readonly ScenarioOperationDelta[];
}

export interface ScenarioResidualDeltaRow {
  id: string;
  mapStatus: "off-map";
  unitCount: number;
  certified: ScenarioCandidateVector;
  scenario: ScenarioCandidateVector;
  delta: ScenarioVoteDelta;
  operations: readonly ScenarioOperationDelta[];
}

export interface ScenarioDeltaPartition {
  id: "mapped" | "off-map" | "statewide-residual";
  unitCount: number;
  delta: ScenarioVoteDelta;
}

export interface ScenarioElectoralConsequence {
  targetCandidate: "harris" | "trump";
  actualHarrisElectoralVotes: number;
  actualTrumpElectoralVotes: number;
  scenarioHarrisElectoralVotes: number;
  scenarioTrumpElectoralVotes: number;
  targetElectoralDelta: number;
  winnerChanged: boolean;
}

export interface ScenarioDeltaLedger {
  schemaVersion: typeof SCENARIO_DELTA_LEDGER_SCHEMA_VERSION;
  registryVersion: typeof ANALYTIC_REGISTRY_VERSION;
  transformVersion: typeof SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION;
  stateCode: string;
  sourceIds: readonly string[];
  contributionDefinitionId: "derived.geography-margin-contribution-votes";
  certified: ScenarioCandidateVector;
  scenario: ScenarioCandidateVector;
  delta: ScenarioVoteDelta;
  operations: readonly ScenarioOperationLedgerRow[];
  units: readonly ScenarioUnitDeltaRow[];
  counties: readonly ScenarioCountyDeltaRow[];
  statewideResidual: ScenarioResidualDeltaRow | null;
  partitions: readonly ScenarioDeltaPartition[];
  electoral: ScenarioElectoralConsequence;
  analytics: AnalyticCollection;
}

export interface FingerprintedScenarioDeltaLedger {
  ledger: ScenarioDeltaLedger;
  fingerprint: string;
}

export interface CreateScenarioDeltaLedgerInput {
  actualState: StatewidePresidentialResult;
  scenarioState: StatewidePresidentialResult;
  baselineUnits: readonly BehaviorModelUnit[];
  scenario: BehaviorScenarioResult;
  targetCandidate: "harris" | "trump";
  sourceIds: readonly string[];
}
