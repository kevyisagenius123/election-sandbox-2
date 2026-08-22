import {
  createReplayZeroState,
  eventCountAtOrBeforeAbsoluteTime,
  reduceReplayToEventCount,
  type ReplayReducerContext,
  type ReplayReducerState,
} from "./reducer.ts";

export const REPLAY_SEEK_INDEX_SCHEMA_VERSION = "rme-replay-seek-index-v1" as const;
export const REPLAY_SEEK_INDEX_VERSION = "rme-headless-seek-optimization-v1" as const;

export interface ReplaySeekCheckpoint {
  eventsApplied: number;
  state: ReplayReducerState;
}

/**
 * A process-local reconstruction accelerator. It is deliberately not a
 * serialized artifact, persistence contract, alternate source of truth, or
 * analytics cache. Every stored state was produced by the canonical reducer.
 */
export interface ReplaySeekIndex {
  schemaVersion: typeof REPLAY_SEEK_INDEX_SCHEMA_VERSION;
  seekIndexVersion: typeof REPLAY_SEEK_INDEX_VERSION;
  reducerVersion: ReplayReducerState["reducerVersion"];
  sourceStreamFingerprint: string;
  eventCount: number;
  cadenceEvents: number;
  maxTailEvents: number;
  checkpoints: readonly ReplaySeekCheckpoint[];
}

const constructedIndexes = new WeakMap<object, string>();

function assertEventPosition(context: ReplayReducerContext, eventCount: number) {
  if (!Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > context.events.length) {
    throw new Error("Replay seek target is outside the canonical source stream");
  }
}

function assertUsableIndex(context: ReplayReducerContext, index: ReplaySeekIndex) {
  if (
    index.schemaVersion !== REPLAY_SEEK_INDEX_SCHEMA_VERSION
    || index.seekIndexVersion !== REPLAY_SEEK_INDEX_VERSION
    || index.reducerVersion !== context.reducerVersion
    || index.sourceStreamFingerprint !== context.sourceStreamFingerprint
    || index.eventCount !== context.events.length
  ) {
    throw new Error("Replay seek index is incompatible with this canonical stream");
  }
  if (constructedIndexes.get(index) !== context.sourceStreamFingerprint) {
    throw new Error("Replay seek index is not a validated process-local accelerator");
  }
  return index;
}

function checkpointAtOrBefore(
  checkpoints: readonly ReplaySeekCheckpoint[],
  eventCount: number,
) {
  let low = 0;
  let high = checkpoints.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (checkpoints[middle].eventsApplied <= eventCount) low = middle + 1;
    else high = middle;
  }
  const checkpoint = checkpoints[Math.max(0, low - 1)];
  if (!checkpoint || checkpoint.eventsApplied > eventCount) {
    throw new Error("Replay seek index has no checkpoint for the requested position");
  }
  return checkpoint;
}

export function createReplaySeekIndex(
  context: ReplayReducerContext,
  cadenceEvents = 250,
): ReplaySeekIndex {
  if (!Number.isSafeInteger(cadenceEvents) || cadenceEvents <= 0) {
    throw new Error("Replay seek cadence must be a positive safe integer");
  }
  const checkpoints: ReplaySeekCheckpoint[] = [];
  let state = createReplayZeroState(context);
  checkpoints.push(Object.freeze({ eventsApplied: 0, state }));
  while (state.observable.position.eventsApplied < context.events.length) {
    const next = Math.min(
      context.events.length,
      state.observable.position.eventsApplied + cadenceEvents,
    );
    state = reduceReplayToEventCount(context, next, state);
    checkpoints.push(Object.freeze({ eventsApplied: next, state }));
  }
  const index = Object.freeze({
    schemaVersion: REPLAY_SEEK_INDEX_SCHEMA_VERSION,
    seekIndexVersion: REPLAY_SEEK_INDEX_VERSION,
    reducerVersion: context.reducerVersion,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    eventCount: context.events.length,
    cadenceEvents,
    maxTailEvents: Math.max(0, cadenceEvents - 1),
    checkpoints: Object.freeze(checkpoints),
  });
  constructedIndexes.set(index, context.sourceStreamFingerprint);
  return index;
}

export function seekReplayIndexToEventCount(
  context: ReplayReducerContext,
  index: ReplaySeekIndex,
  eventCount: number,
) {
  assertEventPosition(context, eventCount);
  assertUsableIndex(context, index);
  const checkpoint = checkpointAtOrBefore(index.checkpoints, eventCount);
  return reduceReplayToEventCount(context, eventCount, checkpoint.state);
}

export function seekReplayIndexToAbsoluteTime(
  context: ReplayReducerContext,
  index: ReplaySeekIndex,
  absoluteReplayTimeMs: number,
) {
  return seekReplayIndexToEventCount(
    context,
    index,
    eventCountAtOrBeforeAbsoluteTime(context, absoluteReplayTimeMs),
  );
}

export function replaySeekIndexMetadata(index: ReplaySeekIndex) {
  return Object.freeze({
    schemaVersion: index.schemaVersion,
    seekIndexVersion: index.seekIndexVersion,
    reducerVersion: index.reducerVersion,
    sourceStreamFingerprint: index.sourceStreamFingerprint,
    eventCount: index.eventCount,
    cadenceEvents: index.cadenceEvents,
    maxTailEvents: index.maxTailEvents,
    checkpointCount: index.checkpoints.length,
  });
}
