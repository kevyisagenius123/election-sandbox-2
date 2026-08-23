import type { StateBehaviorRecipeSettings } from "../data/scenarioPortfolio.ts";
import type {
  DetailedStateCode,
  DetailedStateRuntimeLoader,
} from "../data/detailedStateManifest.ts";
import type { ElectionNightBehavior } from "../replay/threeStateElectionNight.ts";

export const THREE_STATE_NIGHT_PROTOCOL = "three-state-night-worker-v1" as const;
export const NIGHT_PROGRESS_MAX = 1_000_000 as const;

export interface NightCandidateVote {
  candidateId: "harris" | "trump" | "stein" | "oliver" | "other-residual";
  votes: number;
}

export interface NightAggregate {
  candidateVotes: readonly NightCandidateVote[];
  totalReportedVotes: number;
  returnsPublished: number;
}

export interface NightJurisdiction extends NightAggregate {
  jurisdictionId: DetailedStateCode;
  geographyAvailability: "detailed";
  expectedReturns: number;
}

export interface NightHeadline {
  controller: {
    status: "paused" | "playing" | "complete";
    logicalReplayTimeMs: number;
    appliedEventCount: number;
  };
  election: {
    national: NightAggregate;
    jurisdictions: readonly NightJurisdiction[];
    complete: boolean;
  };
}

export interface NightReportedCounty extends NightAggregate {
  jurisdictionId: DetailedStateCode;
  countyId: string;
}

export interface NightPublishedUnit extends NightAggregate {
  jurisdictionId: DetailedStateCode;
  unitId: string;
  countyId: string | null;
  geometryId: string | null;
}

export interface NightCurrentReturn {
  eventId: string;
  atMs: number;
  jurisdictionId: DetailedStateCode;
  countyId: string | null;
  unitId: string;
  geometryId: string | null;
  totalVotes: number;
  harrisVotes: number;
  trumpVotes: number;
  netHarrisMarginVotes: number;
  stateMarginBeforeVotes: number;
  stateMarginAfterVotes: number;
  countyMarginBeforeVotes: number | null;
  countyMarginAfterVotes: number | null;
}

export interface NightStateInitialization {
  stateCode: DetailedStateCode;
  loader: DetailedStateRuntimeLoader;
  artifactUrl: string;
  settings: StateBehaviorRecipeSettings;
}

export type ThreeStateNightWorkerRequest =
  | {
      protocolVersion: typeof THREE_STATE_NIGHT_PROTOCOL;
      requestId: number;
      type: "INITIALIZE";
      states: readonly NightStateInitialization[];
      behavior: ElectionNightBehavior;
    }
  | {
      protocolVersion: typeof THREE_STATE_NIGHT_PROTOCOL;
      requestId: number;
      type: "COMMAND";
      command:
        | { type: "PLAY" }
        | { type: "PAUSE" }
        | { type: "RESET" }
        | { type: "STEP_NEXT_EVENT_TIME" }
        | { type: "ADVANCE_LOGICAL_TIME"; deltaMs: number }
        | { type: "SEEK_PROGRESS"; progressMillionths: number };
    };

interface ResponseEnvelope {
  protocolVersion: typeof THREE_STATE_NIGHT_PROTOCOL;
  requestId: number;
}

export type ThreeStateNightWorkerResponse =
  | ResponseEnvelope & {
      type: "READY" | "UPDATE";
      current: NightHeadline;
      reportedCounties: readonly NightReportedCounty[];
      publishedUnits: readonly NightPublishedUnit[];
      currentReturn: NightCurrentReturn | null;
      recentReturns: readonly NightCurrentReturn[];
      replaceLocalState: boolean;
      timelineProgressMillionths: number;
    }
  | ResponseEnvelope & { type: "ERROR"; message: string };
