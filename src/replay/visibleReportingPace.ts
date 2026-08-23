import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type {
  CompiledThreeStateNight,
  ThreeStateReturnEvent,
} from "./threeStateElectionNight.ts";

const STATE_CODES: readonly DetailedStateCode[] = ["PA", "MI", "WI"];
const DEFAULT_WINDOW_MINUTES = 15;
const DEFAULT_MAX_POINTS = 320;

export interface NightPaceMeasure {
  ballotsPerMinuteMilli: number;
  returnsPerMinuteMilli: number;
}

export interface NightReportingPacePoint {
  eventId: string | null;
  atMs: number;
  progressMillionths: number;
  returningJurisdictionId: DetailedStateCode | null;
  national: NightPaceMeasure;
  jurisdictions: Readonly<Record<DetailedStateCode, NightPaceMeasure>>;
}

export type NightStateCountStatus = "waiting" | "active" | "stalled" | "complete";

export interface NightStatePaceComparison {
  jurisdictionId: DetailedStateCode;
  status: NightStateCountStatus;
  firstReturnAtMs: number | null;
  latestReturnAtMs: number | null;
  elapsedSinceActivityMs: number | null;
  ballotsPublished: number;
  modeledBallots: number;
  ballotProgressMillionths: number;
  returnsPublished: number;
  expectedReturns: number;
  returnProgressMillionths: number;
  currentPace: NightPaceMeasure;
}

export interface NightReportingPace {
  startsAtMs: number;
  endsAtMs: number;
  currentTimeMs: number;
  observedReturnCount: number;
  windowMinutes: number;
  sampled: boolean;
  points: readonly NightReportingPacePoint[];
  comparisons: readonly NightStatePaceComparison[];
}

interface ReportingPaceEvent {
  eventId: string;
  atMs: number;
  stateCode: DetailedStateCode;
  totalVotes: number;
}

export interface NightReportingPaceIndex {
  startsAtMs: number;
  endsAtMs: number;
  events: readonly ReportingPaceEvent[];
  points: readonly NightReportingPacePoint[];
  modeledBallots: Readonly<Record<DetailedStateCode, number>>;
  expectedReturns: Readonly<Record<DetailedStateCode, number>>;
}

function progressMillionths(atMs: number, startsAtMs: number, endsAtMs: number) {
  const duration = endsAtMs - startsAtMs;
  if (duration <= 0) return 1_000_000;
  return Math.max(0, Math.min(
    1_000_000,
    Math.round((atMs - startsAtMs) * 1_000_000 / duration),
  ));
}

function paceMeasure(events: readonly ReportingPaceEvent[], windowMinutes: number): NightPaceMeasure {
  return paceMeasureFromTotals(
    events.reduce((sum, event) => sum + event.totalVotes, 0),
    events.length,
    windowMinutes,
  );
}

function paceMeasureFromTotals(
  ballots: number,
  returns: number,
  windowMinutes: number,
): NightPaceMeasure {
  return Object.freeze({
    ballotsPerMinuteMilli: Math.round(ballots * 1_000 / windowMinutes),
    returnsPerMinuteMilli: Math.round(returns * 1_000 / windowMinutes),
  });
}

function pacePoint(
  events: readonly ReportingPaceEvent[],
  atMs: number,
  startsAtMs: number,
  endsAtMs: number,
  windowMinutes: number,
  sourceEvent: ReportingPaceEvent | null,
): NightReportingPacePoint {
  const windowStartMs = atMs - windowMinutes * 60_000;
  const visibleWindow = events.filter((event) => event.atMs > windowStartMs && event.atMs <= atMs);
  return Object.freeze({
    eventId: sourceEvent?.eventId ?? null,
    atMs,
    progressMillionths: progressMillionths(atMs, startsAtMs, endsAtMs),
    returningJurisdictionId: sourceEvent?.stateCode ?? null,
    national: paceMeasure(visibleWindow, windowMinutes),
    jurisdictions: Object.freeze(Object.fromEntries(STATE_CODES.map((stateCode) => [
      stateCode,
      paceMeasure(visibleWindow.filter((event) => event.stateCode === stateCode), windowMinutes),
    ])) as Record<DetailedStateCode, NightPaceMeasure>),
  });
}

function samplePoints(
  points: readonly NightReportingPacePoint[],
  maximum: number,
): readonly NightReportingPacePoint[] {
  if (points.length <= maximum) return points;
  const selected = new Set<number>([0, points.length - 1]);
  const peakKeys = ["national", ...STATE_CODES] as const;
  for (const key of peakKeys) {
    let ballotPeakIndex = 0;
    let ballotPeakValue = -1;
    let returnPeakIndex = 0;
    let returnPeakValue = -1;
    for (let index = 0; index < points.length; index += 1) {
      const measure = key === "national"
        ? points[index].national
        : points[index].jurisdictions[key];
      if (measure.ballotsPerMinuteMilli > ballotPeakValue) {
        ballotPeakValue = measure.ballotsPerMinuteMilli;
        ballotPeakIndex = index;
      }
      if (measure.returnsPerMinuteMilli > returnPeakValue) {
        returnPeakValue = measure.returnsPerMinuteMilli;
        returnPeakIndex = index;
      }
    }
    selected.add(ballotPeakIndex);
    selected.add(returnPeakIndex);
  }
  const remainingSlots = Math.max(0, maximum - selected.size);
  for (let slot = 1; slot <= remainingSlots; slot += 1) {
    selected.add(Math.round(slot * (points.length - 1) / (remainingSlots + 1)));
  }
  return Object.freeze([...selected]
    .sort((left, right) => left - right)
    .slice(0, maximum)
    .map((index) => points[index]));
}

function buildRollingPoints(
  events: readonly ReportingPaceEvent[],
  startsAtMs: number,
  endsAtMs: number,
  windowMinutes: number,
): NightReportingPacePoint[] {
  let windowStartIndex = 0;
  let nationalBallots = 0;
  let nationalReturns = 0;
  const stateBallots = new Map<DetailedStateCode, number>(STATE_CODES.map((stateCode) => [stateCode, 0]));
  const stateReturns = new Map<DetailedStateCode, number>(STATE_CODES.map((stateCode) => [stateCode, 0]));
  return events.map((event): NightReportingPacePoint => {
    const minimumTimeMs = event.atMs - windowMinutes * 60_000;
    while (windowStartIndex < events.length && events[windowStartIndex].atMs <= minimumTimeMs) {
      const expired = events[windowStartIndex];
      nationalBallots -= expired.totalVotes;
      nationalReturns -= 1;
      stateBallots.set(expired.stateCode, stateBallots.get(expired.stateCode)! - expired.totalVotes);
      stateReturns.set(expired.stateCode, stateReturns.get(expired.stateCode)! - 1);
      windowStartIndex += 1;
    }
    nationalBallots += event.totalVotes;
    nationalReturns += 1;
    stateBallots.set(event.stateCode, stateBallots.get(event.stateCode)! + event.totalVotes);
    stateReturns.set(event.stateCode, stateReturns.get(event.stateCode)! + 1);
    return Object.freeze({
      eventId: event.eventId,
      atMs: event.atMs,
      progressMillionths: progressMillionths(event.atMs, startsAtMs, endsAtMs),
      returningJurisdictionId: event.stateCode,
      national: paceMeasureFromTotals(nationalBallots, nationalReturns, windowMinutes),
      jurisdictions: Object.freeze(Object.fromEntries(STATE_CODES.map((stateCode) => [
        stateCode,
        paceMeasureFromTotals(
          stateBallots.get(stateCode)!,
          stateReturns.get(stateCode)!,
          windowMinutes,
        ),
      ])) as Record<DetailedStateCode, NightPaceMeasure>),
    });
  });
}

function ratioMillionths(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1_000_000, Math.round(numerator * 1_000_000 / denominator)));
}

export function buildNightReportingPaceIndex(
  replay: CompiledThreeStateNight,
): NightReportingPaceIndex {
  const events = replay.events.map((event: ThreeStateReturnEvent): ReportingPaceEvent => Object.freeze({
    eventId: event.eventId,
    atMs: event.atMs,
    stateCode: event.stateCode,
    totalVotes: event.totalVotes,
  }));
  const modeledBallots = Object.fromEntries(STATE_CODES.map((stateCode) => [
    stateCode,
    events
      .filter((event) => event.stateCode === stateCode)
      .reduce((sum, event) => sum + event.totalVotes, 0),
  ])) as Record<DetailedStateCode, number>;
  return Object.freeze({
    startsAtMs: replay.startsAtMs,
    endsAtMs: replay.endsAtMs,
    events: Object.freeze(events),
    points: Object.freeze(buildRollingPoints(
      events,
      replay.startsAtMs,
      replay.endsAtMs,
      DEFAULT_WINDOW_MINUTES,
    )),
    modeledBallots: Object.freeze(modeledBallots),
    expectedReturns: Object.freeze({ ...replay.stateReturnTotals }),
  });
}

export function deriveNightReportingPace(
  index: NightReportingPaceIndex,
  observedReturnCount: number,
  currentTimeMs: number,
  stallThresholdMs: number,
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  maximumPoints = DEFAULT_MAX_POINTS,
): NightReportingPace {
  if (!Number.isSafeInteger(observedReturnCount)
    || observedReturnCount < 0
    || observedReturnCount > index.events.length) {
    throw new Error("Observed return count is outside the reporting pace index");
  }
  if (!Number.isFinite(currentTimeMs)
    || currentTimeMs < index.startsAtMs
    || currentTimeMs > index.endsAtMs) {
    throw new Error("Current replay time is outside the reporting pace bounds");
  }
  if (!Number.isFinite(stallThresholdMs) || stallThresholdMs < 0) {
    throw new Error("Stall threshold must be a non-negative duration");
  }
  if (!Number.isSafeInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 120) {
    throw new Error("Reporting pace window must be an integer between 1 and 120 minutes");
  }
  if (!Number.isSafeInteger(maximumPoints) || maximumPoints < 16 || maximumPoints > 2_000) {
    throw new Error("Reporting pace point limit must be an integer between 16 and 2000");
  }

  const observed = index.events.slice(0, observedReturnCount);
  const rawPoints = windowMinutes === DEFAULT_WINDOW_MINUTES
    ? [...index.points.slice(0, observedReturnCount)]
    : buildRollingPoints(observed, index.startsAtMs, index.endsAtMs, windowMinutes);
  if (currentTimeMs > (observed.at(-1)?.atMs ?? index.startsAtMs)) {
    rawPoints.push(pacePoint(
      observed,
      currentTimeMs,
      index.startsAtMs,
      index.endsAtMs,
      windowMinutes,
      null,
    ));
  }
  const currentPace = pacePoint(
    observed,
    currentTimeMs,
    index.startsAtMs,
    index.endsAtMs,
    windowMinutes,
    null,
  );
  const comparisons = STATE_CODES.map((stateCode): NightStatePaceComparison => {
    const stateEvents = observed.filter((event) => event.stateCode === stateCode);
    const firstReturnAtMs = stateEvents[0]?.atMs ?? null;
    const latestReturnAtMs = stateEvents.at(-1)?.atMs ?? null;
    const elapsedSinceActivityMs = latestReturnAtMs === null
      ? null
      : Math.max(0, currentTimeMs - latestReturnAtMs);
    const returnsPublished = stateEvents.length;
    const expectedReturns = index.expectedReturns[stateCode];
    const ballotsPublished = stateEvents.reduce((sum, event) => sum + event.totalVotes, 0);
    const modeledBallots = index.modeledBallots[stateCode];
    const complete = returnsPublished >= expectedReturns;
    const stalled = !complete
      && latestReturnAtMs !== null
      && elapsedSinceActivityMs !== null
      && elapsedSinceActivityMs >= stallThresholdMs;
    return Object.freeze({
      jurisdictionId: stateCode,
      status: complete ? "complete" : stalled ? "stalled" : returnsPublished > 0 ? "active" : "waiting",
      firstReturnAtMs,
      latestReturnAtMs,
      elapsedSinceActivityMs,
      ballotsPublished,
      modeledBallots,
      ballotProgressMillionths: ratioMillionths(ballotsPublished, modeledBallots),
      returnsPublished,
      expectedReturns,
      returnProgressMillionths: ratioMillionths(returnsPublished, expectedReturns),
      currentPace: currentPace.jurisdictions[stateCode],
    });
  });
  const points = samplePoints(rawPoints, maximumPoints);
  return Object.freeze({
    startsAtMs: index.startsAtMs,
    endsAtMs: index.endsAtMs,
    currentTimeMs,
    observedReturnCount,
    windowMinutes,
    sampled: points.length < rawPoints.length,
    points,
    comparisons: Object.freeze(comparisons),
  });
}
