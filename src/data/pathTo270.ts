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

function stateMargin(state: StatewidePresidentialResult) {
  return (state.harrisVotes - state.trumpVotes) / state.totalVotes * 100;
}

function targetSignedMargin(state: StatewidePresidentialResult, target: MajorCandidate) {
  const margin = stateMargin(state);
  return target === "harris" ? margin : -margin;
}

function routeKey(route: PartialRoute) {
  return route.states.map((state) => state.stateCode).sort().join("+");
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
    excludedSplitAllocationStates: excludedSplitAllocationStates.sort(),
  };
}
