import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type {
  CompiledThreeStateNight,
  ThreeStateReturnEvent,
} from "./threeStateElectionNight.ts";

const STATE_CODES: readonly DetailedStateCode[] = ["PA", "MI", "WI"];
const DEFAULT_MAX_POINTS = 320;

interface MutableMarginAggregate {
  harrisVotes: number;
  trumpVotes: number;
  totalVotes: number;
}

export interface NightMarginTimelinePoint {
  eventId: string;
  atMs: number;
  progressMillionths: number;
  returningJurisdictionId: DetailedStateCode;
  countyId: string | null;
  unitId: string;
  ballotsPublished: number;
  nationalMarginPartsPerMillion: number | null;
  jurisdictionMarginPartsPerMillion: Readonly<Record<DetailedStateCode, number | null>>;
}

export interface NightMarginTimeline {
  startsAtMs: number;
  endsAtMs: number;
  currentTimeMs: number;
  observedReturnCount: number;
  sampled: boolean;
  points: readonly NightMarginTimelinePoint[];
}

export interface NightMarginTimelineIndex {
  startsAtMs: number;
  endsAtMs: number;
  points: readonly NightMarginTimelinePoint[];
}

function zeroAggregate(): MutableMarginAggregate {
  return { harrisVotes: 0, trumpVotes: 0, totalVotes: 0 };
}

function addReturn(target: MutableMarginAggregate, event: ThreeStateReturnEvent) {
  target.harrisVotes += event.harrisVotes;
  target.trumpVotes += event.trumpVotes;
  target.totalVotes += event.totalVotes;
}

function marginPartsPerMillion(value: MutableMarginAggregate): number | null {
  if (value.totalVotes === 0) return null;
  return Math.round((value.harrisVotes - value.trumpVotes) * 1_000_000 / value.totalVotes);
}

function progressMillionths(atMs: number, startsAtMs: number, endsAtMs: number) {
  const duration = endsAtMs - startsAtMs;
  if (duration <= 0) return 1_000_000;
  return Math.max(0, Math.min(
    1_000_000,
    Math.round((atMs - startsAtMs) * 1_000_000 / duration),
  ));
}

export function buildNightMarginTimelineIndex(
  replay: CompiledThreeStateNight,
): NightMarginTimelineIndex {
  const national = zeroAggregate();
  const jurisdictions = new Map<DetailedStateCode, MutableMarginAggregate>(
    STATE_CODES.map((stateCode) => [stateCode, zeroAggregate()]),
  );
  const points = replay.events.map((event): NightMarginTimelinePoint => {
    addReturn(national, event);
    addReturn(jurisdictions.get(event.stateCode)!, event);
    return Object.freeze({
      eventId: event.eventId,
      atMs: event.atMs,
      progressMillionths: progressMillionths(event.atMs, replay.startsAtMs, replay.endsAtMs),
      returningJurisdictionId: event.stateCode,
      countyId: event.countyId,
      unitId: event.unitId,
      ballotsPublished: event.totalVotes,
      nationalMarginPartsPerMillion: marginPartsPerMillion(national),
      jurisdictionMarginPartsPerMillion: Object.freeze(Object.fromEntries(
        STATE_CODES.map((stateCode) => [
          stateCode,
          marginPartsPerMillion(jurisdictions.get(stateCode)!),
        ]),
      ) as Record<DetailedStateCode, number | null>),
    });
  });
  return Object.freeze({
    startsAtMs: replay.startsAtMs,
    endsAtMs: replay.endsAtMs,
    points: Object.freeze(points),
  });
}

function sampledPoints(
  points: readonly NightMarginTimelinePoint[],
  maximum: number,
): readonly NightMarginTimelinePoint[] {
  if (points.length <= maximum) return points;
  const leadChanges = new Set<number>([0, points.length - 1]);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const nationalChangedLead = previous.nationalMarginPartsPerMillion !== null
      && current.nationalMarginPartsPerMillion !== null
      && Math.sign(previous.nationalMarginPartsPerMillion) !== Math.sign(current.nationalMarginPartsPerMillion);
    const stateChangedLead = STATE_CODES.some((stateCode) => {
      const previousMargin = previous.jurisdictionMarginPartsPerMillion[stateCode];
      const currentMargin = current.jurisdictionMarginPartsPerMillion[stateCode];
      return previousMargin !== null
        && currentMargin !== null
        && Math.sign(previousMargin) !== Math.sign(currentMargin);
    });
    if (nationalChangedLead || stateChangedLead) leadChanges.add(index);
  }
  const selected = new Set<number>();
  const orderedLeadChanges = [...leadChanges].sort((left, right) => left - right);
  if (orderedLeadChanges.length > maximum) {
    for (let slot = 0; slot < maximum; slot += 1) {
      selected.add(orderedLeadChanges[Math.round(
        slot * (orderedLeadChanges.length - 1) / (maximum - 1),
      )]);
    }
  } else {
    for (const index of orderedLeadChanges) selected.add(index);
  }
  const remainingSlots = Math.max(0, maximum - selected.size);
  if (remainingSlots > 0) {
    for (let slot = 1; slot <= remainingSlots; slot += 1) {
      selected.add(Math.round(slot * (points.length - 1) / (remainingSlots + 1)));
    }
  }
  const ordered = [...selected].sort((left, right) => left - right);
  return Object.freeze(ordered.map((index) => points[index]));
}

export function deriveNightMarginTimeline(
  index: NightMarginTimelineIndex,
  observedReturnCount: number,
  currentTimeMs: number,
  maximumPoints = DEFAULT_MAX_POINTS,
): NightMarginTimeline {
  if (!Number.isSafeInteger(observedReturnCount)
    || observedReturnCount < 0
    || observedReturnCount > index.points.length) {
    throw new Error("Observed return count is outside the timeline index");
  }
  if (!Number.isFinite(currentTimeMs)
    || currentTimeMs < index.startsAtMs
    || currentTimeMs > index.endsAtMs) {
    throw new Error("Current replay time is outside the timeline bounds");
  }
  if (!Number.isSafeInteger(maximumPoints) || maximumPoints < 16 || maximumPoints > 2_000) {
    throw new Error("Timeline point limit must be an integer between 16 and 2000");
  }
  const observed = index.points.slice(0, observedReturnCount);
  const points = sampledPoints(observed, maximumPoints);
  return Object.freeze({
    startsAtMs: index.startsAtMs,
    endsAtMs: index.endsAtMs,
    currentTimeMs,
    observedReturnCount,
    sampled: points.length < observed.length,
    points,
  });
}
