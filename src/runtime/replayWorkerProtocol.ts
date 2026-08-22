import type {
  LockedElectionEndpoint,
  NationalReplayDefinition,
  ReplayPlaybackCommand,
  SanitizedPlaybackHeadline,
  SanitizedPlaybackSnapshot,
  SanitizedPlaybackTransition,
  SanitizedPublishedUnit,
  SanitizedReportedCounty,
} from "../../packages/election-replay/src/index.ts";

export const REPLAY_WORKER_PROTOCOL_VERSION = "rme-browser-worker-v1" as const;
export const REPLAY_WORKER_PROGRESS_MAX = 1_000_000 as const;

export type ReplayWorkerCommand = ReplayPlaybackCommand | Readonly<{
  type: "SEEK_PROGRESS";
  progressMillionths: number;
}>;

interface ReplayWorkerRequestEnvelope {
  protocolVersion: typeof REPLAY_WORKER_PROTOCOL_VERSION;
  requestId: number;
}

export interface InitializeReplayWorkerRequest extends ReplayWorkerRequestEnvelope {
  type: "INITIALIZE";
  endpoint: LockedElectionEndpoint;
  definition: NationalReplayDefinition;
  checkpointCadenceEvents?: number;
}

export interface CommandReplayWorkerRequest extends ReplayWorkerRequestEnvelope {
  type: "COMMAND";
  command: ReplayWorkerCommand;
}

export interface ResynchronizeReplayWorkerRequest extends ReplayWorkerRequestEnvelope {
  type: "RESYNCHRONIZE";
}

export type ReplayWorkerRequest =
  | InitializeReplayWorkerRequest
  | CommandReplayWorkerRequest
  | ResynchronizeReplayWorkerRequest;

interface ReplayWorkerResponseEnvelope {
  protocolVersion: typeof REPLAY_WORKER_PROTOCOL_VERSION;
  requestId: number;
}

export interface ReplayWorkerReadyResponse extends ReplayWorkerResponseEnvelope {
  type: "READY";
  snapshot: SanitizedPlaybackSnapshot;
  timelineProgressMillionths: number;
}

export interface ReplayWorkerUpdateResponse extends ReplayWorkerResponseEnvelope {
  type: "UPDATE";
  transition: SanitizedPlaybackTransition;
  current: SanitizedPlaybackHeadline;
  reportedCounties: readonly SanitizedReportedCounty[];
  publishedUnits: readonly SanitizedPublishedUnit[];
  resynchronizationRecommended: boolean;
  timelineProgressMillionths: number;
}

export interface ReplayWorkerResynchronizedResponse extends ReplayWorkerResponseEnvelope {
  type: "RESYNCHRONIZED";
  snapshot: SanitizedPlaybackSnapshot;
  timelineProgressMillionths: number;
}

export interface ReplayWorkerErrorResponse extends ReplayWorkerResponseEnvelope {
  type: "ERROR";
  message: string;
}

export type ReplayWorkerResponse =
  | ReplayWorkerReadyResponse
  | ReplayWorkerUpdateResponse
  | ReplayWorkerResynchronizedResponse
  | ReplayWorkerErrorResponse;
