import type { BehaviorScenarioUnit } from "../../packages/election-model/src/scenario.ts";
import type { DetailedStateCode } from "../data/detailedStateManifest.ts";

export const THREE_STATE_NIGHT_VERSION = "three-state-night-v1" as const;

export type ReportingOrder = "mixed" | "rural-first" | "urban-first";

export interface ElectionNightCountyOverride {
  stateCode: DetailedStateCode;
  countyId: string;
  startOffsetMinutes: number;
  countDurationPercent: number;
}

export interface ElectionNightBehavior {
  durationHours: number;
  reportingOrder: ReportingOrder;
  volatility: number;
  stallIntensity: number;
  seed: number;
  stateDelayMinutes: Readonly<Record<DetailedStateCode, number>>;
  countyOverrides: readonly ElectionNightCountyOverride[];
}

export const DEFAULT_ELECTION_NIGHT_BEHAVIOR: ElectionNightBehavior = Object.freeze({
  durationHours: 12,
  reportingOrder: "mixed",
  volatility: 68,
  stallIntensity: 54,
  seed: 2024,
  stateDelayMinutes: Object.freeze({ PA: 8, MI: 12, WI: 6 }),
  countyOverrides: Object.freeze([]),
});

export interface ElectionNightProfile {
  id: string;
  label: string;
  description: string;
  behavior: ElectionNightBehavior;
}

export const ELECTION_NIGHT_PROFILES: readonly ElectionNightProfile[] = Object.freeze([
  Object.freeze({
    id: "balanced",
    label: "Balanced count",
    description: "Mixed geography with irregular but moderate reporting waves.",
    behavior: DEFAULT_ELECTION_NIGHT_BEHAVIOR,
  }),
  Object.freeze({
    id: "rural-opening",
    label: "Rural opening",
    description: "Smaller counties activate earlier before metropolitan returns accumulate.",
    behavior: Object.freeze({
      durationHours: 14,
      reportingOrder: "rural-first",
      volatility: 62,
      stallIntensity: 58,
      seed: 20241,
      stateDelayMinutes: Object.freeze({ PA: 6, MI: 10, WI: 4 }),
      countyOverrides: Object.freeze([]),
    }),
  }),
  Object.freeze({
    id: "metropolitan-opening",
    label: "Metropolitan opening",
    description: "Higher-volume counties establish the early count while smaller places trail.",
    behavior: Object.freeze({
      durationHours: 12,
      reportingOrder: "urban-first",
      volatility: 56,
      stallIntensity: 44,
      seed: 20242,
      stateDelayMinutes: Object.freeze({ PA: 10, MI: 14, WI: 8 }),
      countyOverrides: Object.freeze([]),
    }),
  }),
  Object.freeze({
    id: "volatile-waves",
    label: "Volatile waves",
    description: "Longer stalls and tighter bursts create a more unsettled early chronology.",
    behavior: Object.freeze({
      durationHours: 18,
      reportingOrder: "mixed",
      volatility: 94,
      stallIntensity: 88,
      seed: 20243,
      stateDelayMinutes: Object.freeze({ PA: 12, MI: 18, WI: 9 }),
      countyOverrides: Object.freeze([]),
    }),
  }),
]);

export interface ElectionNightChronologyPreviewState {
  stateCode: DetailedStateCode;
  pollCloseMs: number;
  activationMs: number;
  plannedFinishMs: number;
  overrideCount: number;
}

export interface ElectionNightChronologyPreview {
  startsAtMs: number;
  endsAtMs: number;
  states: readonly ElectionNightChronologyPreviewState[];
  overrideCount: number;
}

export interface ThreeStateScenarioInput {
  stateCode: DetailedStateCode;
  units: readonly BehaviorScenarioUnit[];
}

export interface ThreeStateReturnEvent {
  eventId: string;
  atMs: number;
  stateCode: DetailedStateCode;
  countyId: string | null;
  unitId: string;
  geometryId: string | null;
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  totalVotes: number;
}

export interface CompiledThreeStateNight {
  version: typeof THREE_STATE_NIGHT_VERSION;
  behavior: ElectionNightBehavior;
  startsAtMs: number;
  endsAtMs: number;
  events: readonly ThreeStateReturnEvent[];
  stateReturnTotals: Readonly<Record<DetailedStateCode, number>>;
}

const POLL_CLOSE_MS: Readonly<Record<DetailedStateCode, number>> = Object.freeze({
  PA: Date.parse("2024-11-06T01:00:00.000Z"),
  MI: Date.parse("2024-11-06T01:00:00.000Z"),
  WI: Date.parse("2024-11-06T02:00:00.000Z"),
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function validateElectionNightBehavior(value: ElectionNightBehavior): ElectionNightBehavior {
  if (!Number.isFinite(value.durationHours) || value.durationHours < 2 || value.durationHours > 36) {
    throw new Error("Election-night duration must be between 2 and 36 hours");
  }
  if (!["mixed", "rural-first", "urban-first"].includes(value.reportingOrder)) {
    throw new Error("Election-night reporting order is invalid");
  }
  if (!Number.isFinite(value.volatility) || value.volatility < 0 || value.volatility > 100) {
    throw new Error("Election-night volatility must be between 0 and 100");
  }
  if (!Number.isFinite(value.stallIntensity) || value.stallIntensity < 0 || value.stallIntensity > 100) {
    throw new Error("Election-night stall intensity must be between 0 and 100");
  }
  if (!Number.isSafeInteger(value.seed)) throw new Error("Election-night seed must be an integer");
  const stateDelayMinutes = { ...value.stateDelayMinutes };
  for (const stateCode of ["PA", "MI", "WI"] as const) {
    const delay = stateDelayMinutes[stateCode];
    if (!Number.isFinite(delay) || delay < 0 || delay > 360) {
      throw new Error(`${stateCode} reporting delay must be between 0 and 360 minutes`);
    }
  }
  const countyOverrides = [...(value.countyOverrides ?? [])].map((override) => {
    if (!["PA", "MI", "WI"].includes(override.stateCode)) {
      throw new Error("County override state is invalid");
    }
    if (typeof override.countyId !== "string" || !/^\d{5}$/.test(override.countyId)) {
      throw new Error("County override requires a five-digit county FIPS");
    }
    if (!Number.isFinite(override.startOffsetMinutes) || override.startOffsetMinutes < -240 || override.startOffsetMinutes > 360) {
      throw new Error("County start offset must be between -240 and 360 minutes");
    }
    if (!Number.isFinite(override.countDurationPercent) || override.countDurationPercent < 25 || override.countDurationPercent > 300) {
      throw new Error("County count duration must be between 25 and 300 percent");
    }
    return { ...override };
  }).sort((left, right) => (
    left.stateCode.localeCompare(right.stateCode) || left.countyId.localeCompare(right.countyId)
  ));
  const countyKeys = countyOverrides.map((override) => `${override.stateCode}:${override.countyId}`);
  if (new Set(countyKeys).size !== countyKeys.length) {
    throw new Error("County timing overrides must be unique");
  }
  return {
    durationHours: value.durationHours,
    reportingOrder: value.reportingOrder,
    volatility: value.volatility,
    stallIntensity: value.stallIntensity,
    seed: value.seed,
    stateDelayMinutes,
    countyOverrides,
  };
}

export function buildElectionNightChronologyPreview(
  behaviorValue: ElectionNightBehavior,
): ElectionNightChronologyPreview {
  const behavior = validateElectionNightBehavior(behaviorValue);
  const durationMs = behavior.durationHours * 3_600_000;
  const states = (["PA", "MI", "WI"] as const).map((stateCode) => {
    const activationMs = POLL_CLOSE_MS[stateCode] + Math.round(behavior.stateDelayMinutes[stateCode] * 60_000);
    return Object.freeze({
      stateCode,
      pollCloseMs: POLL_CLOSE_MS[stateCode],
      activationMs,
      plannedFinishMs: activationMs + durationMs,
      overrideCount: behavior.countyOverrides.filter((override) => override.stateCode === stateCode).length,
    });
  });
  return Object.freeze({
    startsAtMs: Math.min(...states.map((state) => state.pollCloseMs)),
    endsAtMs: Math.max(...states.map((state) => state.plannedFinishMs)),
    states: Object.freeze(states),
    overrideCount: behavior.countyOverrides.length,
  });
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed: number, namespace: string) {
  let state = (hashText(namespace) ^ seed) >>> 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4_294_967_296;
}

function normalizedRank(value: number, minimum: number, maximum: number) {
  return maximum <= minimum ? 0.5 : (value - minimum) / (maximum - minimum);
}

function orderScore(
  behavior: ElectionNightBehavior,
  stateCode: DetailedStateCode,
  identity: string,
  sizeRank: number,
) {
  const random = randomUnit(behavior.seed, `order/${stateCode}/${identity}`);
  if (behavior.reportingOrder === "mixed") return random;
  const geographic = behavior.reportingOrder === "rural-first" ? sizeRank : 1 - sizeRank;
  const randomness = behavior.volatility / 100;
  return geographic * (0.82 - randomness * 0.34) + random * (0.18 + randomness * 0.34);
}

function gapWeight(
  behavior: ElectionNightBehavior,
  stateCode: DetailedStateCode,
  countyId: string,
  unitId: string,
) {
  const roll = randomUnit(behavior.seed, `gap-kind/${stateCode}/${countyId}/${unitId}`);
  const detail = randomUnit(behavior.seed, `gap-value/${stateCode}/${countyId}/${unitId}`);
  const burstChance = 0.10 + behavior.volatility / 500;
  const stallChance = 0.04 + behavior.stallIntensity / 260;
  if (roll < burstChance) return 0.04 + detail * 0.18;
  if (roll < burstChance + stallChance) return 3.2 + detail * (3 + behavior.stallIntensity / 14);
  return 0.55 + detail * (1.15 + behavior.volatility / 95);
}

function compileState(
  input: ThreeStateScenarioInput,
  behavior: ElectionNightBehavior,
): ThreeStateReturnEvent[] {
  const stateCode = input.stateCode;
  const start = POLL_CLOSE_MS[stateCode] + Math.round(behavior.stateDelayMinutes[stateCode] * 60_000);
  const durationMs = behavior.durationHours * 3_600_000;
  const countyGroups = new Map<string, BehaviorScenarioUnit[]>();
  for (const unit of input.units) {
    const countyKey = unit.countyFips ?? `off-map:${unit.id}`;
    const group = countyGroups.get(countyKey) ?? [];
    group.push(unit);
    countyGroups.set(countyKey, group);
  }
  const countyTotals = [...countyGroups].map(([countyId, units]) => ({
    countyId,
    units,
    totalVotes: units.reduce((sum, unit) => sum + unit.totalVotes, 0),
  }));
  const countyMinimum = Math.min(...countyTotals.map((county) => county.totalVotes), 0);
  const countyMaximum = Math.max(...countyTotals.map((county) => county.totalVotes), 1);
  const events: ThreeStateReturnEvent[] = [];
  const countyOverrides = new Map(
    behavior.countyOverrides
      .filter((override) => override.stateCode === stateCode)
      .map((override) => [override.countyId, override]),
  );

  for (const county of countyTotals) {
    const sizeRank = normalizedRank(county.totalVotes, countyMinimum, countyMaximum);
    const countyScore = orderScore(behavior, stateCode, county.countyId, sizeRank);
    const countyOverride = countyOverrides.get(county.countyId);
    const baseCountyStart = start + durationMs * (0.015 + countyScore * 0.39);
    const countyStart = Math.max(
      POLL_CLOSE_MS[stateCode],
      baseCountyStart + (countyOverride?.startOffsetMinutes ?? 0) * 60_000,
    );
    const tailRandom = randomUnit(behavior.seed, `tail/${stateCode}/${county.countyId}`);
    const baseCountyEnd = Math.max(
      baseCountyStart + 60_000,
      start + durationMs * clamp(0.58 + countyScore * 0.30 + tailRandom * 0.12, 0.6, 1),
    );
    const countyEnd = countyStart + Math.max(
      60_000,
      (baseCountyEnd - baseCountyStart) * ((countyOverride?.countDurationPercent ?? 100) / 100),
    );
    const unitMinimum = Math.min(...county.units.map((unit) => unit.totalVotes), 0);
    const unitMaximum = Math.max(...county.units.map((unit) => unit.totalVotes), 1);
    const ordered = [...county.units].sort((left, right) => {
      const leftScore = orderScore(
        behavior,
        stateCode,
        `${county.countyId}/${left.id}`,
        normalizedRank(left.totalVotes, unitMinimum, unitMaximum),
      );
      const rightScore = orderScore(
        behavior,
        stateCode,
        `${county.countyId}/${right.id}`,
        normalizedRank(right.totalVotes, unitMinimum, unitMaximum),
      );
      return leftScore - rightScore || left.id.localeCompare(right.id);
    });
    const weights = ordered.map((unit) => gapWeight(behavior, stateCode, county.countyId, unit.id));
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsedWeight = 0;
    ordered.forEach((unit, index) => {
      elapsedWeight += weights[index];
      const fraction = weightTotal > 0 ? elapsedWeight / weightTotal : (index + 1) / ordered.length;
      const uniqueJitterMs = hashText(`${behavior.seed}/${stateCode}/${unit.id}`) % 45_000;
      events.push({
        eventId: `${THREE_STATE_NIGHT_VERSION}/${stateCode}/${unit.id}`,
        atMs: Math.round(countyStart + (countyEnd - countyStart) * fraction) + uniqueJitterMs,
        stateCode,
        countyId: unit.countyFips,
        unitId: unit.id,
        geometryId: unit.geometryId,
        harrisVotes: unit.harrisVotes,
        trumpVotes: unit.trumpVotes,
        steinVotes: unit.steinVotes,
        oliverVotes: unit.oliverVotes,
        residualOtherVotes: unit.residualOtherVotes,
        totalVotes: unit.totalVotes,
      });
    });
  }
  return events;
}

export function compileThreeStateElectionNight(
  states: readonly ThreeStateScenarioInput[],
  behaviorValue: ElectionNightBehavior,
): CompiledThreeStateNight {
  const behavior = validateElectionNightBehavior(behaviorValue);
  const byCode = new Map(states.map((state) => [state.stateCode, state]));
  for (const stateCode of ["PA", "MI", "WI"] as const) {
    if (!byCode.has(stateCode)) throw new Error(`Election night is missing ${stateCode}`);
  }
  if (byCode.size !== 3) throw new Error("Election night accepts exactly PA, MI, and WI");
  const events = states.flatMap((state) => compileState(state, behavior)).sort((left, right) => (
    left.atMs - right.atMs
    || left.stateCode.localeCompare(right.stateCode)
    || left.unitId.localeCompare(right.unitId)
  ));
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].atMs <= events[index - 1].atMs) {
      events[index].atMs = events[index - 1].atMs + 1;
    }
  }
  if (new Set(events.map((event) => event.eventId)).size !== events.length) {
    throw new Error("Election-night reporting-unit identities are not unique");
  }
  const stateReturnTotals = { PA: 0, MI: 0, WI: 0 };
  for (const event of events) stateReturnTotals[event.stateCode] += 1;
  return Object.freeze({
    version: THREE_STATE_NIGHT_VERSION,
    behavior,
    startsAtMs: Math.min(...Object.values(POLL_CLOSE_MS)),
    endsAtMs: Math.max(...events.map((event) => event.atMs)),
    events: Object.freeze(events),
    stateReturnTotals: Object.freeze(stateReturnTotals),
  });
}
