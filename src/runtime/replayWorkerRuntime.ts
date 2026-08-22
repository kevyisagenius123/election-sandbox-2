import {
  applyReplayPlaybackCommand,
  compileNationalReplay,
  createReplayPlaybackCursor,
  createReplayReducerContext,
  createReplaySeekIndex,
  createSanitizedPlaybackHeadline,
  createSanitizedPlaybackSnapshot,
  createSanitizedPlaybackTransition,
  reportedCountyState,
  reportedUnitState,
  seekReplayPlaybackCursorToAbsoluteTime,
  type CandidateVoteVector,
  type ReplayPlaybackCursor,
  type ReplayReducerContext,
  type ReplaySeekIndex,
  type SanitizedPublishedUnit,
  type SanitizedReportedCounty,
} from "../../packages/election-replay/src/index.ts";
import {
  REPLAY_WORKER_PROTOCOL_VERSION,
  REPLAY_WORKER_PROGRESS_MAX,
  type ReplayWorkerRequest,
  type ReplayWorkerResponse,
} from "./replayWorkerProtocol.ts";

const DEFAULT_CHECKPOINT_CADENCE_EVENTS = 250;

function validRequestId(requestId: number) {
  return Number.isSafeInteger(requestId) && requestId >= 0;
}

function errorResponse(requestId: number, error: unknown): ReplayWorkerResponse {
  return {
    protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
    requestId: validRequestId(requestId) ? requestId : 0,
    type: "ERROR",
    message: error instanceof Error ? error.message : "Replay worker request failed",
  };
}

function timelineProgressMillionths(cursor: ReplayPlaybackCursor) {
  const elapsed = cursor.playheadAbsoluteTimeMs - cursor.startBoundaryAbsoluteTimeMs;
  const duration = cursor.endBoundaryAbsoluteTimeMs - cursor.startBoundaryAbsoluteTimeMs;
  if (duration <= 0 || elapsed <= 0) return 0;
  if (elapsed >= duration) return REPLAY_WORKER_PROGRESS_MAX;
  return Math.round((elapsed / duration) * REPLAY_WORKER_PROGRESS_MAX);
}

function copyCandidateVotes(candidateVotes: CandidateVoteVector) {
  return candidateVotes.map((candidate) => ({
    candidateId: candidate.candidateId,
    votes: candidate.votes,
  }));
}

function localUpdates(
  context: ReplayReducerContext,
  previous: ReplayPlaybackCursor,
  current: ReplayPlaybackCursor,
) {
  if (current.eventsApplied <= previous.eventsApplied) {
    return { reportedCounties: [], publishedUnits: [] };
  }
  const countyKeys = new Map<string, { jurisdictionId: string; countyId: string }>();
  const unitKeys = new Map<string, { jurisdictionId: string; unitId: string }>();
  for (const event of context.events.slice(previous.eventsApplied, current.eventsApplied)) {
    if (event.eventType !== "RETURN_PUBLISHED" || event.unitId == null) continue;
    if (context.jurisdictions[event.jurisdictionId]?.capabilityKind === "coarse") continue;
    const unitKey = `${event.jurisdictionId}:${event.unitId}`;
    unitKeys.set(unitKey, { jurisdictionId: event.jurisdictionId, unitId: event.unitId });
    if (event.countyId != null) {
      const countyKey = `${event.jurisdictionId}:${event.countyId}`;
      countyKeys.set(countyKey, { jurisdictionId: event.jurisdictionId, countyId: event.countyId });
    }
  }
  const reportedCounties = [...countyKeys.values()].map(({ jurisdictionId, countyId }) => {
    const county = reportedCountyState(context, current.reducerState, jurisdictionId, countyId);
    return {
      jurisdictionId,
      countyId,
      candidateVotes: copyCandidateVotes(county.candidateVotes),
      totalReportedVotes: county.totalVotes,
      returnsPublished: county.returnsPublished,
    } satisfies SanitizedReportedCounty;
  });
  const publishedUnits = [...unitKeys.values()].map(({ jurisdictionId, unitId }) => {
    const unit = reportedUnitState(context, current.reducerState, jurisdictionId, unitId);
    return {
      jurisdictionId,
      unitId,
      countyId: unit.countyId,
      unitType: unit.unitType,
      geometryStatus: unit.geometryStatus,
      candidateVotes: copyCandidateVotes(unit.candidateVotes),
      totalReportedVotes: unit.totalVotes,
    } satisfies SanitizedPublishedUnit;
  });
  return { reportedCounties, publishedUnits };
}

export class ReplayWorkerRuntime {
  #context: ReplayReducerContext | null = null;
  #seekIndex: ReplaySeekIndex | null = null;
  #cursor: ReplayPlaybackCursor | null = null;
  #initializing = false;

  async handle(request: ReplayWorkerRequest): Promise<ReplayWorkerResponse> {
    try {
      if (
        request == null
        || typeof request !== "object"
        || request.protocolVersion !== REPLAY_WORKER_PROTOCOL_VERSION
        || !validRequestId(request.requestId)
      ) {
        throw new Error("Replay worker request envelope is invalid");
      }
      if (request.type === "INITIALIZE") return await this.#initialize(request);
      if (!this.#context || !this.#seekIndex || !this.#cursor || this.#initializing) {
        throw new Error("Replay worker has not initialized");
      }
      if (request.type === "RESYNCHRONIZE") {
        return {
          protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          type: "RESYNCHRONIZED",
          snapshot: createSanitizedPlaybackSnapshot(this.#context, this.#cursor),
          timelineProgressMillionths: timelineProgressMillionths(this.#cursor),
        };
      }
      if (request.type !== "COMMAND") {
        throw new Error("Replay worker request type is not authorized");
      }
      const previous = this.#cursor;
      const current = request.command.type === "SEEK_PROGRESS"
        ? this.#seekToProgress(previous, request.command.progressMillionths)
        : applyReplayPlaybackCommand(
          this.#context,
          this.#seekIndex,
          previous,
          request.command,
        );
      this.#cursor = current;
      const transition = createSanitizedPlaybackTransition(this.#context, previous, current);
      const local = localUpdates(this.#context, previous, current);
      return {
        protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "UPDATE",
        transition,
        current: createSanitizedPlaybackHeadline(this.#context, current),
        reportedCounties: local.reportedCounties,
        publishedUnits: local.publishedUnits,
        resynchronizationRecommended: transition.direction === "backward",
        timelineProgressMillionths: timelineProgressMillionths(current),
      };
    } catch (error: unknown) {
      return errorResponse(request?.requestId ?? 0, error);
    }
  }

  #seekToProgress(cursor: ReplayPlaybackCursor, progressMillionths: number) {
    if (!this.#context || !this.#seekIndex) {
      throw new Error("Replay worker has not initialized");
    }
    if (
      !Number.isSafeInteger(progressMillionths)
      || progressMillionths < 0
      || progressMillionths > REPLAY_WORKER_PROGRESS_MAX
    ) {
      throw new Error("Replay timeline progress is outside the authorized range");
    }
    const duration = cursor.endBoundaryAbsoluteTimeMs - cursor.startBoundaryAbsoluteTimeMs;
    const absoluteReplayTimeMs = progressMillionths === REPLAY_WORKER_PROGRESS_MAX
      ? cursor.endBoundaryAbsoluteTimeMs
      : cursor.startBoundaryAbsoluteTimeMs
        + Math.floor((duration * progressMillionths) / REPLAY_WORKER_PROGRESS_MAX);
    return seekReplayPlaybackCursorToAbsoluteTime(
      this.#context,
      this.#seekIndex,
      cursor,
      absoluteReplayTimeMs,
    );
  }

  async #initialize(
    request: Extract<ReplayWorkerRequest, { type: "INITIALIZE" }>,
  ): Promise<ReplayWorkerResponse> {
    if (this.#initializing || this.#context || this.#seekIndex || this.#cursor) {
      throw new Error("Replay worker can only initialize once");
    }
    this.#initializing = true;
    try {
      const replay = await compileNationalReplay(request.endpoint, request.definition);
      const context = await createReplayReducerContext(request.endpoint, replay);
      const cadence = request.checkpointCadenceEvents ?? DEFAULT_CHECKPOINT_CADENCE_EVENTS;
      const seekIndex = createReplaySeekIndex(context, cadence);
      const cursor = createReplayPlaybackCursor(context, seekIndex);
      this.#context = context;
      this.#seekIndex = seekIndex;
      this.#cursor = cursor;
      return {
        protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "READY",
        snapshot: createSanitizedPlaybackSnapshot(context, cursor),
        timelineProgressMillionths: timelineProgressMillionths(cursor),
      };
    } finally {
      this.#initializing = false;
    }
  }
}
