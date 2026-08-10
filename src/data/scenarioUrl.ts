import type { ThirdPartyCandidate } from "../../packages/election-model/src/scenario.ts";

export const SCENARIO_URL_SCHEMA_VERSION = "1";
export const SCENARIO_DATA_VERSION = "us2024-pa-vtd2020-v2";
export const SCENARIO_ENGINE_VERSION = "pa-behavior-v1";

export type ScenarioViewMode = "actual" | "scenario" | "difference";
export type ScenarioEditorMode = "turnout" | "preference" | "third-party";
export type ScenarioContributionScope = "county" | "vtd";

export interface ScenarioUrlState {
  turnoutIncreasePoints: number;
  addedVoterHarrisShare: number;
  preferenceShiftPoints: number;
  thirdPartyCandidate: ThirdPartyCandidate;
  thirdPartyShiftPoints: number;
  thirdPartyHarrisExchangeShare: number;
  viewMode: ScenarioViewMode;
  behaviorEditorMode: ScenarioEditorMode;
  contributionScope: ScenarioContributionScope;
  selectedStateCode: string | null;
  selectedCountyFips: string | null;
  selectedVtdGeoid: string | null;
}

export type ScenarioUrlLoadStatus = "none" | "valid" | "invalid" | "unsupported";

export interface ScenarioUrlLoadResult {
  status: ScenarioUrlLoadStatus;
  state: ScenarioUrlState;
  message: string | null;
}

export interface BuildScenarioUrlOptions {
  force?: boolean;
  clearHash?: boolean;
}

export const DEFAULT_SCENARIO_URL_STATE: Readonly<ScenarioUrlState> = Object.freeze({
  turnoutIncreasePoints: 0,
  addedVoterHarrisShare: 55,
  preferenceShiftPoints: 0,
  thirdPartyCandidate: "stein",
  thirdPartyShiftPoints: 0,
  thirdPartyHarrisExchangeShare: 50,
  viewMode: "scenario",
  behaviorEditorMode: "turnout",
  contributionScope: "county",
  selectedStateCode: null,
  selectedCountyFips: null,
  selectedVtdGeoid: null,
});

const stateCodes = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX",
  "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const scenarioParameterNames = [
  "scenario",
  "data",
  "engine",
  "turnout",
  "turnoutHarris",
  "preference",
  "thirdParty",
  "thirdPartyShift",
  "thirdPartyHarris",
  "view",
  "editor",
  "rank",
  "state",
  "county",
  "vtd",
] as const;

class InvalidScenarioUrlError extends Error {}

function defaultState(): ScenarioUrlState {
  return { ...DEFAULT_SCENARIO_URL_STATE };
}

function canonicalNumber(value: number) {
  const normalized = Object.is(value, -0) ? 0 : value;
  return String(Number(normalized.toFixed(4)));
}

function parseNumber(
  params: URLSearchParams,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  integer = false,
) {
  const raw = params.get(name);
  if (raw == null) return fallback;
  if (raw.trim() === "") throw new InvalidScenarioUrlError(`${name} is empty`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new InvalidScenarioUrlError(`${name} is outside its supported range`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new InvalidScenarioUrlError(`${name} must be a whole number`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function parseChoice<T extends string>(
  params: URLSearchParams,
  name: string,
  choices: readonly T[],
  fallback: T,
) {
  const raw = params.get(name);
  if (raw == null) return fallback;
  if (!choices.includes(raw as T)) {
    throw new InvalidScenarioUrlError(`${name} is not recognized`);
  }
  return raw as T;
}

function validateGeography(params: URLSearchParams) {
  const state = params.get("state");
  const county = params.get("county");
  const vtd = params.get("vtd");

  if (state != null && !stateCodes.has(state)) {
    throw new InvalidScenarioUrlError("state is not recognized");
  }
  if (county != null) {
    if (!/^42\d{3}$/.test(county)) {
      throw new InvalidScenarioUrlError("county is not a Pennsylvania county FIPS");
    }
    if (state !== "PA") {
      throw new InvalidScenarioUrlError("county selection requires Pennsylvania state context");
    }
  }
  if (vtd != null) {
    if (!/^42\d{3}[0-9A-Z]{6}$/.test(vtd)) {
      throw new InvalidScenarioUrlError("vtd is not a Pennsylvania Census VTD GEOID");
    }
    if (county == null || !vtd.startsWith(county)) {
      throw new InvalidScenarioUrlError("vtd selection does not belong to the selected county");
    }
  }
  return {
    selectedStateCode: state,
    selectedCountyFips: county,
    selectedVtdGeoid: vtd,
  };
}

export function isDefaultScenarioUrlState(state: ScenarioUrlState) {
  return scenarioParameterNames.every((name) => {
    if (["scenario", "data", "engine"].includes(name)) return true;
    switch (name) {
      case "turnout": return state.turnoutIncreasePoints === DEFAULT_SCENARIO_URL_STATE.turnoutIncreasePoints;
      case "turnoutHarris": return state.addedVoterHarrisShare === DEFAULT_SCENARIO_URL_STATE.addedVoterHarrisShare;
      case "preference": return state.preferenceShiftPoints === DEFAULT_SCENARIO_URL_STATE.preferenceShiftPoints;
      case "thirdParty": return state.thirdPartyCandidate === DEFAULT_SCENARIO_URL_STATE.thirdPartyCandidate;
      case "thirdPartyShift": return state.thirdPartyShiftPoints === DEFAULT_SCENARIO_URL_STATE.thirdPartyShiftPoints;
      case "thirdPartyHarris": return state.thirdPartyHarrisExchangeShare === DEFAULT_SCENARIO_URL_STATE.thirdPartyHarrisExchangeShare;
      case "view": return state.viewMode === DEFAULT_SCENARIO_URL_STATE.viewMode;
      case "editor": return state.behaviorEditorMode === DEFAULT_SCENARIO_URL_STATE.behaviorEditorMode;
      case "rank": return state.contributionScope === DEFAULT_SCENARIO_URL_STATE.contributionScope;
      case "state": return state.selectedStateCode === null;
      case "county": return state.selectedCountyFips === null;
      case "vtd": return state.selectedVtdGeoid === null;
    }
  });
}

export function decodeScenarioSearch(search: string): ScenarioUrlLoadResult {
  const params = new URLSearchParams(search);
  if (!params.has("scenario")) {
    return { status: "none", state: defaultState(), message: null };
  }

  for (const name of scenarioParameterNames) {
    if (params.getAll(name).length > 1) {
      return {
        status: "invalid",
        state: defaultState(),
        message: `Shared scenario ignored because ${name} appears more than once.`,
      };
    }
  }

  const schemaVersion = params.get("scenario");
  if (schemaVersion !== SCENARIO_URL_SCHEMA_VERSION) {
    return {
      status: "unsupported",
      state: defaultState(),
      message: `Shared scenario URL version ${schemaVersion ?? "missing"} is not supported.`,
    };
  }
  const dataVersion = params.get("data");
  const engineVersion = params.get("engine");
  if (dataVersion == null || engineVersion == null) {
    return {
      status: "invalid",
      state: defaultState(),
      message: "Shared scenario ignored because its data or engine version is missing.",
    };
  }
  if (dataVersion !== SCENARIO_DATA_VERSION || engineVersion !== SCENARIO_ENGINE_VERSION) {
    return {
      status: "unsupported",
      state: defaultState(),
      message: "Shared scenario uses a data or engine version that this build cannot replay.",
    };
  }

  try {
    const geography = validateGeography(params);
    return {
      status: "valid",
      state: {
        turnoutIncreasePoints: parseNumber(params, "turnout", 0, 0, 1.5),
        addedVoterHarrisShare: parseNumber(params, "turnoutHarris", 55, 0, 100, true),
        preferenceShiftPoints: parseNumber(params, "preference", 0, -200, 200),
        thirdPartyCandidate: parseChoice(
          params,
          "thirdParty",
          ["stein", "oliver", "residual_other"] as const,
          "stein",
        ),
        thirdPartyShiftPoints: parseNumber(params, "thirdPartyShift", 0, -100, 100),
        thirdPartyHarrisExchangeShare: parseNumber(
          params,
          "thirdPartyHarris",
          50,
          0,
          100,
          true,
        ),
        viewMode: parseChoice(
          params,
          "view",
          ["actual", "scenario", "difference"] as const,
          "scenario",
        ),
        behaviorEditorMode: parseChoice(
          params,
          "editor",
          ["turnout", "preference", "third-party"] as const,
          "turnout",
        ),
        contributionScope: parseChoice(
          params,
          "rank",
          ["county", "vtd"] as const,
          "county",
        ),
        ...geography,
      },
      message: "Shared scenario restored from a compatible deterministic URL.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "the payload is malformed";
    return {
      status: "invalid",
      state: defaultState(),
      message: `Shared scenario ignored because ${detail}.`,
    };
  }
}

function setScenarioParameters(
  params: URLSearchParams,
  state: ScenarioUrlState,
  force: boolean,
) {
  scenarioParameterNames.forEach((name) => params.delete(name));
  if (!force && isDefaultScenarioUrlState(state)) return;

  params.set("scenario", SCENARIO_URL_SCHEMA_VERSION);
  params.set("data", SCENARIO_DATA_VERSION);
  params.set("engine", SCENARIO_ENGINE_VERSION);
  params.set("turnout", canonicalNumber(state.turnoutIncreasePoints));
  params.set("turnoutHarris", canonicalNumber(state.addedVoterHarrisShare));
  params.set("preference", canonicalNumber(state.preferenceShiftPoints));
  params.set("thirdParty", state.thirdPartyCandidate);
  params.set("thirdPartyShift", canonicalNumber(state.thirdPartyShiftPoints));
  params.set("thirdPartyHarris", canonicalNumber(state.thirdPartyHarrisExchangeShare));
  params.set("view", state.viewMode);
  params.set("editor", state.behaviorEditorMode);
  params.set("rank", state.contributionScope);
  if (state.selectedStateCode) params.set("state", state.selectedStateCode);
  if (state.selectedCountyFips) params.set("county", state.selectedCountyFips);
  if (state.selectedVtdGeoid) params.set("vtd", state.selectedVtdGeoid);
}

export function buildScenarioUrl(
  currentHref: string,
  state: ScenarioUrlState,
  options: BuildScenarioUrlOptions = {},
) {
  const url = new URL(currentHref);
  setScenarioParameters(url.searchParams, state, options.force ?? false);
  if (options.clearHash) url.hash = "";
  return url.toString();
}
