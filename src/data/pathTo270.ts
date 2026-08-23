import type { StatewidePresidentialResult } from "../../packages/election-model/src/scenario.ts";
import type { MajorCandidate } from "./electoralConsequences.ts";

export type RouteMetric = "fewest-states" | "margin-movement" | "margin-votes";
export type ScenarioClassification = "actual" | "modeled" | "required";

export interface RouteStateRequirement {
  stateCode: string;
  stateName: string;
  electoralVotes: number;
  currentClassification: Exclude<ScenarioClassification, "required">;
  routeClassification: "required";
  currentMargin: number;
  requiredMarginPoints: number;
  requiredNetMarginVotes: number;
  detailedModelAvailable: boolean;
}

export interface PathTo270Route {
  id: string;
  states: RouteStateRequirement[];
  electoralVotesGained: number;
  projectedTargetElectoralVotes: number;
  stateCount: number;
  totalRequiredMarginPoints: number;
  totalRequiredNetMarginVotes: number;
  completeness: "mathematical" | "partially-modeled" | "fully-modeled";
}

export interface PathTo270Model {
  targetCandidate: MajorCandidate;
  metric: RouteMetric;
  majorityThreshold: number;
  targetElectoralVotes: number;
  electoralVotesNeeded: number;
  routes: PathTo270Route[];
  excludedSplitAllocationStates: string[];
}

export type RouteConstructionStatus = "required" | "modeled" | "satisfied";

export interface StateFlipRequirement {
  stateCode: string;
  stateName: string;
  targetCandidate: MajorCandidate;
  certifiedRequiredNetMarginVotes: number;
  modeledNetMarginMovement: number;
  remainingNetMarginVotes: number;
  actualTargetMarginVotes: number;
  scenarioTargetMarginVotes: number;
  satisfied: boolean;
}

export interface RouteConstructionState {
  stateCode: string;
  stateName: string;
  electoralVotes: number;
  status: RouteConstructionStatus;
  detailedModelAvailable: boolean;
  certifiedRequiredNetMarginVotes: number;
  modeledNetMarginMovement: number;
  remainingNetMarginVotes: number;
  progressPct: number;
  actualTargetMargin: number;
  scenarioTargetMargin: number;
}

export interface RouteConstructionPlan {
  id: string;
  targetCandidate: MajorCandidate;
  states: RouteConstructionState[];
  status: "required" | "in-progress" | "complete" | "insufficient";
  satisfiedStateCount: number;
  modeledStateCount: number;
  electoralVotesSatisfied: number;
  targetElectoralVotes: number;
  projectedTargetElectoralVotes: number;
  majorityThreshold: number;
}

type NamedStateResult = StatewidePresidentialResult & { name?: string };

interface PartialRoute {
  states: RouteStateRequirement[];
  electoralVotes: number;
  marginPoints: number;
  marginVotes: number;
}

const MAX_PARTIALS_PER_EV = 48;
const SPLIT_ALLOCATION_STATES = new Set(["ME", "NE"]);

function targetVotes(state: StatewidePresidentialResult, target: MajorCandidate) {
  return target === "harris" ? state.harrisVotes : state.trumpVotes;
}

function opponentVotes(state: StatewidePresidentialResult, target: MajorCandidate) {
  return target === "harris" ? state.trumpVotes : state.harrisVotes;
}

function targetElectoralVotes(state: StatewidePresidentialResult, target: MajorCandidate) {
  return target === "harris" ? state.harrisElectoralVotes : state.trumpElectoralVotes;
}

function targetMarginVotes(state: StatewidePresidentialResult, target: MajorCandidate) {
  return targetVotes(state, target) - opponentVotes(state, target);
}

export function buildStateFlipRequirement(
  actual: NamedStateResult,
  scenario: NamedStateResult,
  targetCandidate: MajorCandidate,
): StateFlipRequirement {
  if (actual.code !== scenario.code) {
    throw new Error(`State flip requirement cannot compare ${actual.code} with ${scenario.code}`);
  }
  const actualTargetMarginVotes = targetMarginVotes(actual, targetCandidate);
  const scenarioTargetMarginVotes = targetMarginVotes(scenario, targetCandidate);
  return {
    stateCode: actual.code,
    stateName: actual.name ?? actual.code,
    targetCandidate,
    certifiedRequiredNetMarginVotes: Math.max(0, 1 - actualTargetMarginVotes),
    modeledNetMarginMovement: scenarioTargetMarginVotes - actualTargetMarginVotes,
    remainingNetMarginVotes: Math.max(0, 1 - scenarioTargetMarginVotes),
    actualTargetMarginVotes,
    scenarioTargetMarginVotes,
    satisfied: scenarioTargetMarginVotes > 0,
  };
}

function stateMargin(state: StatewidePresidentialResult) {
  return (state.harrisVotes - state.trumpVotes) / state.totalVotes * 100;
}

function targetSignedMargin(state: StatewidePresidentialResult, target: MajorCandidate) {
  const margin = stateMargin(state);
  return target === "harris" ? margin : -margin;
}

function routeKey(route: PartialRoute) {
  return route.states
    .map((state) => state.stateCode)
    .sort((left, right) => left.localeCompare(right))
    .join("+");
}

function dominates(left: PartialRoute, right: PartialRoute) {
  const noWorse = left.states.length <= right.states.length
    && left.marginPoints <= right.marginPoints
    && left.marginVotes <= right.marginVotes;
  const better = left.states.length < right.states.length
    || left.marginPoints < right.marginPoints
    || left.marginVotes < right.marginVotes;
  return noWorse && better;
}

function comparePartial(left: PartialRoute, right: PartialRoute) {
  return left.states.length - right.states.length
    || left.marginVotes - right.marginVotes
    || left.marginPoints - right.marginPoints
    || routeKey(left).localeCompare(routeKey(right));
}

function boundedPareto(routes: PartialRoute[]) {
  const deduplicated = [...new Map(routes.map((route) => [routeKey(route), route])).values()];
  const frontier = deduplicated.filter((candidate, index) => (
    !deduplicated.some((other, otherIndex) => otherIndex !== index && dominates(other, candidate))
  ));
  const selected = new Map<string, PartialRoute>();
  for (const route of frontier) selected.set(routeKey(route), route);
  const orderings = [
    comparePartial,
    (left: PartialRoute, right: PartialRoute) => left.marginPoints - right.marginPoints || comparePartial(left, right),
    (left: PartialRoute, right: PartialRoute) => left.marginVotes - right.marginVotes || comparePartial(left, right),
  ];
  for (const ordering of orderings) {
    for (const route of [...frontier].sort(ordering).slice(0, 16)) selected.set(routeKey(route), route);
    for (const route of [...deduplicated].sort(ordering).slice(0, 12)) selected.set(routeKey(route), route);
  }
  const candidates = [...selected.values()];
  if (candidates.length <= MAX_PARTIALS_PER_EV) return candidates.sort(comparePartial);
  const bounded = new Map<string, PartialRoute>();
  for (const ordering of orderings) {
    for (const route of [...candidates].sort(ordering).slice(0, 16)) bounded.set(routeKey(route), route);
  }
  return [...bounded.values()].sort(comparePartial);
}

function compareRoutes(metric: RouteMetric) {
  return (left: PathTo270Route, right: PathTo270Route) => {
    const overage = (route: PathTo270Route) => route.projectedTargetElectoralVotes - 270;
    if (metric === "margin-movement") {
      return left.totalRequiredMarginPoints - right.totalRequiredMarginPoints
        || left.stateCount - right.stateCount
        || left.totalRequiredNetMarginVotes - right.totalRequiredNetMarginVotes
        || overage(left) - overage(right)
        || left.id.localeCompare(right.id);
    }
    if (metric === "margin-votes") {
      return left.totalRequiredNetMarginVotes - right.totalRequiredNetMarginVotes
        || left.stateCount - right.stateCount
        || left.totalRequiredMarginPoints - right.totalRequiredMarginPoints
        || overage(left) - overage(right)
        || left.id.localeCompare(right.id);
    }
    return left.stateCount - right.stateCount
      || left.totalRequiredNetMarginVotes - right.totalRequiredNetMarginVotes
      || left.totalRequiredMarginPoints - right.totalRequiredMarginPoints
      || overage(left) - overage(right)
      || left.id.localeCompare(right.id);
  };
}

export function buildPathTo270Model(
  scenarioStates: readonly NamedStateResult[],
  activeStateCodes: readonly string[],
  detailedStateCodes: readonly string[],
  modeledTargetGainStateCodes: readonly string[],
  targetCandidate: MajorCandidate,
  metric: RouteMetric,
  routeLimit = 5,
): PathTo270Model {
  const totalElectoralVotes = scenarioStates.reduce(
    (sum, state) => sum + state.harrisElectoralVotes + state.trumpElectoralVotes,
    0,
  );
  const majorityThreshold = Math.floor(totalElectoralVotes / 2) + 1;
  const targetCurrentElectoralVotes = scenarioStates.reduce(
    (sum, state) => sum + targetElectoralVotes(state, targetCandidate),
    0,
  );
  const electoralVotesNeeded = Math.max(0, majorityThreshold - targetCurrentElectoralVotes);
  const active = new Set(activeStateCodes);
  const detailed = new Set(detailedStateCodes);
  const hasModeledTargetGain = modeledTargetGainStateCodes.length > 0;
  const excludedSplitAllocationStates: string[] = [];

  if (electoralVotesNeeded === 0) {
    return {
      targetCandidate,
      metric,
      majorityThreshold,
      targetElectoralVotes: targetCurrentElectoralVotes,
      electoralVotesNeeded,
      routes: [],
      excludedSplitAllocationStates,
    };
  }

  const requirements = scenarioStates.flatMap((state): RouteStateRequirement[] => {
    const totalStateElectoralVotes = state.harrisElectoralVotes + state.trumpElectoralVotes;
    const targetStateElectoralVotes = targetElectoralVotes(state, targetCandidate);
    if (targetStateElectoralVotes >= totalStateElectoralVotes) return [];
    if (SPLIT_ALLOCATION_STATES.has(state.code)) {
      excludedSplitAllocationStates.push(state.code);
      return [];
    }
    const netVotes = opponentVotes(state, targetCandidate) - targetVotes(state, targetCandidate) + 1;
    if (netVotes <= 0) return [];
    return [{
      stateCode: state.code,
      stateName: state.name ?? state.code,
      electoralVotes: totalStateElectoralVotes - targetStateElectoralVotes,
      currentClassification: active.has(state.code) ? "modeled" : "actual",
      routeClassification: "required",
      currentMargin: targetSignedMargin(state, targetCandidate),
      requiredMarginPoints: netVotes / state.totalVotes * 100,
      requiredNetMarginVotes: netVotes,
      detailedModelAvailable: detailed.has(state.code),
    }];
  }).sort((left, right) => left.stateCode.localeCompare(right.stateCode));

  const buckets: PartialRoute[][] = Array.from(
    { length: electoralVotesNeeded + 1 },
    () => [],
  );
  buckets[0] = [{ states: [], electoralVotes: 0, marginPoints: 0, marginVotes: 0 }];
  for (const requirement of requirements) {
    const previous = buckets.map((bucket) => [...bucket]);
    for (let electoralVotes = 0; electoralVotes <= electoralVotesNeeded; electoralVotes += 1) {
      if (previous[electoralVotes].length === 0) continue;
      const nextElectoralVotes = Math.min(
        electoralVotesNeeded,
        electoralVotes + requirement.electoralVotes,
      );
      const additions = previous[electoralVotes].map((route): PartialRoute => ({
        states: [...route.states, requirement],
        electoralVotes: route.electoralVotes + requirement.electoralVotes,
        marginPoints: route.marginPoints + requirement.requiredMarginPoints,
        marginVotes: route.marginVotes + requirement.requiredNetMarginVotes,
      }));
      buckets[nextElectoralVotes] = boundedPareto([...buckets[nextElectoralVotes], ...additions]);
    }
  }

  const routes = buckets[electoralVotesNeeded].map((partial): PathTo270Route => {
    return {
      id: routeKey(partial),
      states: [...partial.states].sort((left, right) => (
        right.electoralVotes - left.electoralVotes || left.stateCode.localeCompare(right.stateCode)
      )),
      electoralVotesGained: partial.electoralVotes,
      projectedTargetElectoralVotes: targetCurrentElectoralVotes + partial.electoralVotes,
      stateCount: partial.states.length,
      totalRequiredMarginPoints: partial.marginPoints,
      totalRequiredNetMarginVotes: partial.marginVotes,
      completeness: hasModeledTargetGain ? "partially-modeled" : "mathematical",
    };
  }).sort(compareRoutes(metric)).slice(0, routeLimit);

  return {
    targetCandidate,
    metric,
    majorityThreshold,
    targetElectoralVotes: targetCurrentElectoralVotes,
    electoralVotesNeeded,
    routes,
    excludedSplitAllocationStates: excludedSplitAllocationStates.sort(
      (left, right) => left.localeCompare(right),
    ),
  };
}

export function buildRouteConstructionPlan(
  actualStates: readonly NamedStateResult[],
  scenarioStates: readonly NamedStateResult[],
  activeStateCodes: readonly string[],
  detailedStateCodes: readonly string[],
  selectedRouteStateCodes: readonly string[],
  targetCandidate: MajorCandidate,
): RouteConstructionPlan | null {
  const selectedCodes = [...new Set(selectedRouteStateCodes)].sort(
    (left, right) => left.localeCompare(right),
  );
  if (selectedCodes.length === 0) return null;
  const actualByCode = new Map(actualStates.map((state) => [state.code, state]));
  const scenarioByCode = new Map(scenarioStates.map((state) => [state.code, state]));
  const active = new Set(activeStateCodes);
  const detailed = new Set(detailedStateCodes);
  const states = selectedCodes.map((stateCode): RouteConstructionState => {
    const actual = actualByCode.get(stateCode);
    const scenario = scenarioByCode.get(stateCode);
    if (!actual || !scenario) throw new Error(`Route construction state ${stateCode} is unavailable`);
    const totalElectoralVotes = scenario.harrisElectoralVotes + scenario.trumpElectoralVotes;
    const flipRequirement = buildStateFlipRequirement(actual, scenario, targetCandidate);
    const satisfied = targetElectoralVotes(scenario, targetCandidate) === totalElectoralVotes;
    const isModeled = active.has(stateCode);
    const certifiedRequiredNetMarginVotes = flipRequirement.certifiedRequiredNetMarginVotes;
    const modeledNetMarginMovement = flipRequirement.modeledNetMarginMovement;
    const remainingNetMarginVotes = satisfied ? 0 : flipRequirement.remainingNetMarginVotes;
    return {
      stateCode,
      stateName: actual.name ?? stateCode,
      electoralVotes: totalElectoralVotes,
      status: satisfied ? "satisfied" : isModeled ? "modeled" : "required",
      detailedModelAvailable: detailed.has(stateCode),
      certifiedRequiredNetMarginVotes,
      modeledNetMarginMovement,
      remainingNetMarginVotes,
      progressPct: certifiedRequiredNetMarginVotes === 0
        ? 100
        : Math.max(0, Math.min(100, modeledNetMarginMovement / certifiedRequiredNetMarginVotes * 100)),
      actualTargetMargin: targetSignedMargin(actual, targetCandidate),
      scenarioTargetMargin: targetSignedMargin(scenario, targetCandidate),
    };
  });
  const totalElectoralVotes = scenarioStates.reduce(
    (sum, state) => sum + state.harrisElectoralVotes + state.trumpElectoralVotes,
    0,
  );
  const majorityThreshold = Math.floor(totalElectoralVotes / 2) + 1;
  const currentTargetElectoralVotes = scenarioStates.reduce(
    (sum, state) => sum + targetElectoralVotes(state, targetCandidate),
    0,
  );
  const unsatisfiedElectoralVotes = states.reduce(
    (sum, state) => sum + (state.status === "satisfied" ? 0 : state.electoralVotes),
    0,
  );
  const satisfiedStateCount = states.filter((state) => state.status === "satisfied").length;
  const modeledStateCount = states.filter((state) => state.status !== "required").length;
  const projectedTargetElectoralVotes = currentTargetElectoralVotes + unsatisfiedElectoralVotes;
  return {
    id: selectedCodes.join("+"),
    targetCandidate,
    states,
    status: projectedTargetElectoralVotes < majorityThreshold
      ? "insufficient"
      : satisfiedStateCount === states.length
        ? "complete"
        : modeledStateCount > 0
          ? "in-progress"
          : "required",
    satisfiedStateCount,
    modeledStateCount,
    electoralVotesSatisfied: states.reduce(
      (sum, state) => sum + (state.status === "satisfied" ? state.electoralVotes : 0),
      0,
    ),
    targetElectoralVotes: currentTargetElectoralVotes,
    projectedTargetElectoralVotes,
    majorityThreshold,
  };
}
