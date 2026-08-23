import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type {
  CompiledThreeStateNight,
  ThreeStateReturnEvent,
} from "./threeStateElectionNight.ts";

const STATE_CODES: readonly DetailedStateCode[] = ["PA", "MI", "WI"];
const DEFAULT_BIN_COUNT = 48;

export interface CountLandscapePoint {
  stateCode: DetailedStateCode;
  binIndex: number;
  startsAtMs: number;
  endsAtMs: number;
  centerAtMs: number;
  ballotsPublished: number;
  returnsPublished: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  twoPartyMovementVotes: number;
  twoPartyMovementPpm: number;
  latestEventId: string | null;
}

export interface CountLandscapeSummary {
  ballotsPublished: number;
  returnsPublished: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  twoPartyMovementVotes: number;
}

export interface CountLandscapeDataset {
  schemaVersion: 1;
  startsAtMs: number;
  endsAtMs: number;
  visibleThroughMs: number;
  observedReturnCount: number;
  expectedReturnCount: number;
  binCount: number;
  visibleBinCount: number;
  stateCodes: readonly DetailedStateCode[];
  points: readonly CountLandscapePoint[];
  national: CountLandscapeSummary;
  jurisdictions: Readonly<Record<DetailedStateCode, CountLandscapeSummary>>;
}

interface MutablePoint {
  ballotsPublished: number;
  returnsPublished: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  latestEventId: string | null;
}

function emptyPoint(): MutablePoint {
  return {
    ballotsPublished: 0,
    returnsPublished: 0,
    harrisVotes: 0,
    trumpVotes: 0,
    otherVotes: 0,
    latestEventId: null,
  };
}

function addEvent(target: MutablePoint, event: ThreeStateReturnEvent) {
  target.ballotsPublished += event.totalVotes;
  target.returnsPublished += 1;
  target.harrisVotes += event.harrisVotes;
  target.trumpVotes += event.trumpVotes;
  target.otherVotes += event.steinVotes + event.oliverVotes + event.residualOtherVotes;
  target.latestEventId = event.eventId;
}

function summarize(points: readonly CountLandscapePoint[]): CountLandscapeSummary {
  const result = points.reduce((summary, point) => ({
    ballotsPublished: summary.ballotsPublished + point.ballotsPublished,
    returnsPublished: summary.returnsPublished + point.returnsPublished,
    harrisVotes: summary.harrisVotes + point.harrisVotes,
    trumpVotes: summary.trumpVotes + point.trumpVotes,
    otherVotes: summary.otherVotes + point.otherVotes,
    twoPartyMovementVotes: summary.twoPartyMovementVotes + point.twoPartyMovementVotes,
  }), {
    ballotsPublished: 0,
    returnsPublished: 0,
    harrisVotes: 0,
    trumpVotes: 0,
    otherVotes: 0,
    twoPartyMovementVotes: 0,
  });
  return Object.freeze(result);
}

export function buildCountLandscapeDataset(
  replay: CompiledThreeStateNight,
  observedReturnCount = replay.events.length,
  binCount = DEFAULT_BIN_COUNT,
): CountLandscapeDataset {
  if (!Number.isSafeInteger(observedReturnCount)
    || observedReturnCount < 0
    || observedReturnCount > replay.events.length) {
    throw new Error("Observed return count is outside the count landscape replay");
  }
  if (!Number.isSafeInteger(binCount) || binCount < 8 || binCount > 120) {
    throw new Error("Count landscape bin count must be an integer between 8 and 120");
  }
  const durationMs = replay.endsAtMs - replay.startsAtMs;
  if (durationMs <= 0) throw new Error("Count landscape replay requires a positive duration");
  const observed = replay.events.slice(0, observedReturnCount);
  const visibleThroughMs = observed.at(-1)?.atMs ?? replay.startsAtMs;
  const visibleBinCount = observedReturnCount === 0
    ? 0
    : Math.min(binCount, Math.floor(
      (visibleThroughMs - replay.startsAtMs) * binCount / durationMs,
    ) + 1);
  const mutable = new Map<string, MutablePoint>();
  for (let binIndex = 0; binIndex < visibleBinCount; binIndex += 1) {
    for (const stateCode of STATE_CODES) mutable.set(`${stateCode}:${binIndex}`, emptyPoint());
  }
  for (const event of observed) {
    const binIndex = Math.min(binCount - 1, Math.max(0, Math.floor(
      (event.atMs - replay.startsAtMs) * binCount / durationMs,
    )));
    addEvent(mutable.get(`${event.stateCode}:${binIndex}`)!, event);
  }
  const points = Object.freeze([...mutable.entries()].map(([key, value]): CountLandscapePoint => {
    const [stateCode, binText] = key.split(":") as [DetailedStateCode, string];
    const binIndex = Number(binText);
    const startsAtMs = replay.startsAtMs + Math.floor(durationMs * binIndex / binCount);
    const endsAtMs = replay.startsAtMs + Math.floor(durationMs * (binIndex + 1) / binCount);
    const twoPartyVotes = value.harrisVotes + value.trumpVotes;
    const twoPartyMovementVotes = value.harrisVotes - value.trumpVotes;
    return Object.freeze({
      stateCode,
      binIndex,
      startsAtMs,
      endsAtMs,
      centerAtMs: startsAtMs + Math.floor((endsAtMs - startsAtMs) / 2),
      ballotsPublished: value.ballotsPublished,
      returnsPublished: value.returnsPublished,
      harrisVotes: value.harrisVotes,
      trumpVotes: value.trumpVotes,
      otherVotes: value.otherVotes,
      twoPartyMovementVotes,
      twoPartyMovementPpm: twoPartyVotes > 0
        ? Math.round(twoPartyMovementVotes * 1_000_000 / twoPartyVotes)
        : 0,
      latestEventId: value.latestEventId,
    });
  }));
  const jurisdictions = Object.freeze(Object.fromEntries(STATE_CODES.map((stateCode) => [
    stateCode,
    summarize(points.filter((point) => point.stateCode === stateCode)),
  ])) as Record<DetailedStateCode, CountLandscapeSummary>);
  return Object.freeze({
    schemaVersion: 1,
    startsAtMs: replay.startsAtMs,
    endsAtMs: replay.endsAtMs,
    visibleThroughMs,
    observedReturnCount,
    expectedReturnCount: replay.events.length,
    binCount,
    visibleBinCount,
    stateCodes: STATE_CODES,
    points,
    national: summarize(points),
    jurisdictions,
  });
}
