import type { CandidateVoteVector } from "../../election-replay/src/contracts.ts";
import type { ComposedReplayEvent } from "../../election-replay/src/jurisdictionComposition.ts";
import type { ReplayObservableState } from "../../election-replay/src/reducer.ts";
import type { AnalyticCollection } from "./contracts.ts";
import { ANALYTIC_REGISTRY_VERSION } from "./registry.ts";

export const REPLAY_DESCRIPTIVE_SCHEMA_VERSION = "sandbox-replay-descriptive-v1" as const;
export const REPLAY_DESCRIPTIVE_ANALYTICS_VERSION = "sandbox-replay-descriptive-v1" as const;
export const REPLAY_DESCRIPTIVE_WINDOWS_MINUTES = [5, 15, 30] as const;
export const REPLAY_RECENT_MOVER_WINDOW_MINUTES = 15 as const;

export interface ReplayProgressDenominator {
  jurisdictionId: string;
  expectedReturns: number | null;
  modeledBallots: number | null;
}

export interface CreateReplayDescriptiveAnalyticsInput {
  observable: ReplayObservableState;
  observedEvents: readonly ComposedReplayEvent[];
  logicalReplayTimeMs: number;
  replayStartTimeMs: number;
  denominators: readonly ReplayProgressDenominator[];
  stallThresholdMs: number;
  rankingLimit?: number;
  sourceIds: readonly string[];
}

export interface ReplayMovement {
  candidateVotes: CandidateVoteVector;
  ballotsPublished: number;
  returnsPublished: number;
  signedHarrisMinusTrumpMovement: number;
}

export interface ReplayWindowJurisdictionMovement extends ReplayMovement {
  jurisdictionId: string;
}

export interface ReplayWindowAnalytics {
  windowMinutes: 5 | 15 | 30;
  startExclusiveMs: number;
  endInclusiveMs: number;
  observedDurationMs: number;
  national: ReplayMovement;
  jurisdictions: readonly ReplayWindowJurisdictionMovement[];
  returnsPerHourMilli: number | null;
  ballotsPerMinuteMilli: number | null;
}

export interface ReplayNewestReturn {
  eventId: string;
  sequence: number;
  absoluteReplayTimeMs: number;
  jurisdictionId: string;
  countyId: string | null;
  unitId: string | null;
  candidateVotes: CandidateVoteVector;
  totalVotes: number;
  signedHarrisMinusTrumpMovement: number;
}

export interface ReplayExplicitRatio {
  numerator: number;
  denominator: number;
  partsPerMillion: number;
}

export interface ReplayJurisdictionProgress {
  jurisdictionId: string;
  returns: ReplayExplicitRatio | null;
  representedBallots: ReplayExplicitRatio | null;
}

export type ReplayMathematicalStatus =
  | "unavailable"
  | "no-returns"
  | "open"
  | "exhausted"
  | "complete";

export interface ReplayMathematicalOpenness {
  jurisdictionId: string;
  status: ReplayMathematicalStatus;
  currentLeader: "harris" | "trump" | "tie" | null;
  signedHarrisMinusTrumpMargin: number;
  modeledOutstandingBallots: number | null;
  votesRequiredToOvertake: number | null;
  surplusOrShortfallBallots: number | null;
}

export type ReplayCountPhase = "not-open" | "awaiting-first-return" | "counting" | "complete";

export interface ReplayChronologyStatus {
  jurisdictionId: string;
  phase: ReplayCountPhase;
  pollCloseTimeMs: number | null;
  lastReturnTimeMs: number | null;
  elapsedSinceActivityMs: number | null;
  stallThresholdMs: number;
  stalled: boolean;
}

export interface ReplayLocalMarginRow {
  jurisdictionId: string;
  geographyLevel: "county" | "reporting-unit";
  geographyId: string;
  countyId: string | null;
  totalReportedVotes: number;
  signedHarrisMinusTrumpMargin: number;
}

export interface ReplayRecentMoverRow {
  jurisdictionId: string;
  geographyLevel: "county" | "reporting-unit";
  geographyId: string;
  countyId: string | null;
  returnsPublished: number;
  ballotsPublished: number;
  signedHarrisMinusTrumpMovement: number;
}

export interface ReplayDescriptiveAnalytics {
  schemaVersion: typeof REPLAY_DESCRIPTIVE_SCHEMA_VERSION;
  analyticsVersion: typeof REPLAY_DESCRIPTIVE_ANALYTICS_VERSION;
  registryVersion: typeof ANALYTIC_REGISTRY_VERSION;
  sourceIds: readonly string[];
  logicalReplayTimeMs: number;
  replayStartTimeMs: number;
  observedEventCount: number;
  observedReturnCount: number;
  stallThresholdMs: number;
  newestReturn: ReplayNewestReturn | null;
  windows: readonly ReplayWindowAnalytics[];
  progress: readonly ReplayJurisdictionProgress[];
  mathematicalOpenness: readonly ReplayMathematicalOpenness[];
  chronology: readonly ReplayChronologyStatus[];
  largestCurrentCountyMargins: readonly ReplayLocalMarginRow[];
  largestCurrentUnitMargins: readonly ReplayLocalMarginRow[];
  recentCountyMovers: readonly ReplayRecentMoverRow[];
  recentUnitMovers: readonly ReplayRecentMoverRow[];
  analytics: AnalyticCollection;
}

export interface FingerprintedReplayDescriptiveAnalytics {
  analytics: ReplayDescriptiveAnalytics;
  fingerprint: string;
}
