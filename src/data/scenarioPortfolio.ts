import type {
  BehaviorScenarioResult,
  BehaviorScenarioSettings,
  StatewidePresidentialResult,
  ThirdPartyCandidate,
} from "../../packages/election-model/src/scenario.ts";
import {
  getDetailedStateManifest,
  type DetailedStateCode,
} from "./detailedStateManifest.ts";

export interface StateBehaviorRecipeSettings {
  turnoutIncreasePoints: number;
  addedVoterHarrisShare: number;
  preferenceShiftPoints: number;
  thirdPartyCandidate: ThirdPartyCandidate;
  thirdPartyShiftPoints: number;
  thirdPartyHarrisExchangeShare: number;
}

export interface StateScenarioRecipe {
  stateCode: DetailedStateCode;
  electionId: string;
  dataVersion: string;
  engineVersion: string;
  settings: StateBehaviorRecipeSettings;
}

export interface StateScenarioSummary {
  stateCode: DetailedStateCode;
  electionId: string;
  dataVersion: string;
  engineVersion: string;
  recipeFingerprint: string;
  actualMargin: number;
  scenarioMargin: number;
  actualWinner: "HARRIS" | "TRUMP";
  scenarioWinner: "HARRIS" | "TRUMP";
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  totalVotes: number;
  electoralVotes: number;
  harrisElectoralVotes: number;
  trumpElectoralVotes: number;
  flipped: boolean;
}

export const DEFAULT_STATE_BEHAVIOR_SETTINGS: Readonly<StateBehaviorRecipeSettings> = Object.freeze({
  turnoutIncreasePoints: 0,
  addedVoterHarrisShare: 55,
  preferenceShiftPoints: 0,
  thirdPartyCandidate: "stein",
  thirdPartyShiftPoints: 0,
  thirdPartyHarrisExchangeShare: 50,
});

function canonicalNumber(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value;
  return String(Number(normalized.toFixed(4)));
}

export function isDefaultStateBehaviorSettings(settings: StateBehaviorRecipeSettings) {
  return settings.turnoutIncreasePoints === DEFAULT_STATE_BEHAVIOR_SETTINGS.turnoutIncreasePoints
    && settings.addedVoterHarrisShare === DEFAULT_STATE_BEHAVIOR_SETTINGS.addedVoterHarrisShare
    && settings.preferenceShiftPoints === DEFAULT_STATE_BEHAVIOR_SETTINGS.preferenceShiftPoints
    && settings.thirdPartyCandidate === DEFAULT_STATE_BEHAVIOR_SETTINGS.thirdPartyCandidate
    && settings.thirdPartyShiftPoints === DEFAULT_STATE_BEHAVIOR_SETTINGS.thirdPartyShiftPoints
    && settings.thirdPartyHarrisExchangeShare === DEFAULT_STATE_BEHAVIOR_SETTINGS.thirdPartyHarrisExchangeShare;
}

export function createStateScenarioRecipe(
  stateCode: DetailedStateCode,
  settings: StateBehaviorRecipeSettings,
): StateScenarioRecipe {
  const manifest = getDetailedStateManifest(stateCode);
  return {
    stateCode,
    electionId: manifest.election.contestId,
    dataVersion: manifest.compatibility.dataVersion,
    engineVersion: manifest.compatibility.engineVersion,
    settings: { ...settings },
  };
}

export function stateScenarioRecipeFingerprint(recipe: StateScenarioRecipe) {
  const settings = recipe.settings;
  return [
    recipe.stateCode,
    recipe.electionId,
    recipe.dataVersion,
    recipe.engineVersion,
    canonicalNumber(settings.turnoutIncreasePoints),
    canonicalNumber(settings.addedVoterHarrisShare),
    canonicalNumber(settings.preferenceShiftPoints),
    settings.thirdPartyCandidate,
    canonicalNumber(settings.thirdPartyShiftPoints),
    canonicalNumber(settings.thirdPartyHarrisExchangeShare),
  ].join("|");
}

export function toBehaviorScenarioSettings(
  settings: StateBehaviorRecipeSettings,
): BehaviorScenarioSettings {
  return {
    turnoutIncreasePoints: settings.turnoutIncreasePoints,
    addedVoterHarrisShare: settings.addedVoterHarrisShare / 100,
    preferenceShiftPoints: settings.preferenceShiftPoints,
    thirdPartyCandidate: settings.thirdPartyCandidate,
    thirdPartyShiftPoints: settings.thirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare: settings.thirdPartyHarrisExchangeShare / 100,
  };
}

function signedMargin(result: Pick<StatewidePresidentialResult, "harrisVotes" | "trumpVotes" | "totalVotes">) {
  return (result.harrisVotes - result.trumpVotes) / result.totalVotes * 100;
}

export function buildStateScenarioSummary(
  recipe: StateScenarioRecipe,
  actual: StatewidePresidentialResult,
  scenario: BehaviorScenarioResult,
): StateScenarioSummary {
  const manifest = getDetailedStateManifest(recipe.stateCode);
  const actualWinner = actual.harrisVotes > actual.trumpVotes ? "HARRIS" : "TRUMP";
  const scenarioWinner = scenario.totals.harrisVotes > scenario.totals.trumpVotes
    ? "HARRIS"
    : "TRUMP";
  return {
    stateCode: recipe.stateCode,
    electionId: recipe.electionId,
    dataVersion: recipe.dataVersion,
    engineVersion: recipe.engineVersion,
    recipeFingerprint: stateScenarioRecipeFingerprint(recipe),
    actualMargin: signedMargin(actual),
    scenarioMargin: signedMargin(scenario.totals),
    actualWinner,
    scenarioWinner,
    ...scenario.totals,
    electoralVotes: manifest.election.electoralVotes,
    harrisElectoralVotes: scenarioWinner === "HARRIS" ? manifest.election.electoralVotes : 0,
    trumpElectoralVotes: scenarioWinner === "TRUMP" ? manifest.election.electoralVotes : 0,
    flipped: actualWinner !== scenarioWinner,
  };
}

export function summaryAsStateResult(
  summary: StateScenarioSummary,
  actual: StatewidePresidentialResult,
): StatewidePresidentialResult {
  return {
    ...actual,
    harrisVotes: summary.harrisVotes,
    trumpVotes: summary.trumpVotes,
    otherVotes: summary.otherVotes,
    totalVotes: summary.totalVotes,
    harrisElectoralVotes: summary.harrisElectoralVotes,
    trumpElectoralVotes: summary.trumpElectoralVotes,
  };
}

export function recipesAsRecord(recipes: readonly StateScenarioRecipe[]) {
  return Object.fromEntries(recipes.map((recipe) => [recipe.stateCode, recipe])) as Partial<
    Record<DetailedStateCode, StateScenarioRecipe>
  >;
}
