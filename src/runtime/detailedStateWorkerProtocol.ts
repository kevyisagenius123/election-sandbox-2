import type {
  BehaviorScenarioResult,
  BehaviorScenarioSettings,
} from "../../packages/election-model/src/scenario.ts";
import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type { PennsylvaniaDemographicFoundation } from "../data/paDemographics.ts";

export interface InitializeDetailedStateRequest {
  type: "initialize";
  requestId: number;
  stateCode: DetailedStateCode;
  artifactUrl: string;
  settings: BehaviorScenarioSettings;
}

export interface CalculateDetailedStateRequest {
  type: "calculate";
  requestId: number;
  settings: BehaviorScenarioSettings;
}

export type DetailedStateWorkerRequest =
  | InitializeDetailedStateRequest
  | CalculateDetailedStateRequest;

export interface DetailedStateReadyResponse {
  type: "ready";
  requestId: number;
  stateCode: DetailedStateCode;
  foundation: PennsylvaniaDemographicFoundation;
  scenario: BehaviorScenarioResult;
}

export interface DetailedStateScenarioResponse {
  type: "scenario";
  requestId: number;
  stateCode: DetailedStateCode;
  scenario: BehaviorScenarioResult;
}

export interface DetailedStateErrorResponse {
  type: "error";
  requestId: number;
  stateCode: DetailedStateCode | null;
  message: string;
}

export type DetailedStateWorkerResponse =
  | DetailedStateReadyResponse
  | DetailedStateScenarioResponse
  | DetailedStateErrorResponse;
