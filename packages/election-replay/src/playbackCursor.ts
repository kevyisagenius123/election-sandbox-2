import {
  eventCountAtOrBeforeAbsoluteTime,
  reduceReplayToEventCount,
  type ReplayReducerContext,
  type ReplayReducerState,
} from "./reducer.ts";
import {
  seekReplayIndexToAbsoluteTime,
  seekReplayIndexToEventCount,
  type ReplaySeekIndex,
} from "./replaySeekIndex.ts";

export const REPLAY_PLAYBACK_CURSOR_SCHEMA_VERSION = "rme-playback-cursor-v1" as const;
export const REPLAY_PLAYBACK_CONTROLLER_VERSION = "rme-headless-playback-controller-v1" as const;

export type ReplayPlaybackStatus = "paused" | "playing" | "complete";

export interface ReplayPlaybackCursor {
  schemaVersion: typeof REPLAY_PLAYBACK_CURSOR_SCHEMA_VERSION;
  controllerVersion: typeof REPLAY_PLAYBACK_CONTROLLER_VERSION;
  reducerVersion: ReplayReducerState["reducerVersion"];
  sourceStreamFingerprint: string;
  status: ReplayPlaybackStatus;
  startBoundaryAbsoluteTimeMs: number;
  endBoundaryAbsoluteTimeMs: number;
  playheadAbsoluteTimeMs: number;
  eventsApplied: number;
  reducerState: ReplayReducerState;
}

export type ReplayPlaybackCommand =
  | Readonly<{ type: "PLAY" }>
  | Readonly<{ type: "PAUSE" }>
  | Readonly<{ type: "RESET" }>
  | Readonly<{ type: "ADVANCE_LOGICAL_TIME"; deltaMs: number }>
  | Readonly<{ type: "SEEK_EVENT_COUNT"; eventCount: number }>
  | Readonly<{ type: "SEEK_ABSOLUTE_TIME"; absoluteReplayTimeMs: number }>
  | Readonly<{ type: "STEP_NEXT_EVENT_TIME" }>;

const constructedCursors = new WeakMap<object, string>();

function replayBounds(context: ReplayReducerContext) {
  const first = context.events[0];
  const last = context.events.at(-1);
  if (!first || !last) throw new Error("Playback requires a non-empty canonical replay stream");
  const startBoundaryAbsoluteTimeMs = first.absoluteReplayTimeMs - 1;
  if (!Number.isSafeInteger(startBoundaryAbsoluteTimeMs)) {
    throw new Error("Playback start boundary is outside safe integer time");
  }
  return {
    startBoundaryAbsoluteTimeMs,
    endBoundaryAbsoluteTimeMs: last.absoluteReplayTimeMs,
  };
}

function freezeCursor(
  context: ReplayReducerContext,
  fields: Omit<ReplayPlaybackCursor,
    "schemaVersion" | "controllerVersion" | "reducerVersion" | "sourceStreamFingerprint"
  >,
) {
  const cursor = Object.freeze({
    schemaVersion: REPLAY_PLAYBACK_CURSOR_SCHEMA_VERSION,
    controllerVersion: REPLAY_PLAYBACK_CONTROLLER_VERSION,
    reducerVersion: context.reducerVersion,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    ...fields,
  });
  constructedCursors.set(cursor, context.sourceStreamFingerprint);
  return cursor;
}

function assertCursor(context: ReplayReducerContext, cursor: ReplayPlaybackCursor) {
  const bounds = replayBounds(context);
  if (
    cursor.schemaVersion !== REPLAY_PLAYBACK_CURSOR_SCHEMA_VERSION
    || cursor.controllerVersion !== REPLAY_PLAYBACK_CONTROLLER_VERSION
    || cursor.reducerVersion !== context.reducerVersion
    || cursor.sourceStreamFingerprint !== context.sourceStreamFingerprint
    || cursor.reducerState.sourceStreamFingerprint !== context.sourceStreamFingerprint
    || cursor.startBoundaryAbsoluteTimeMs !== bounds.startBoundaryAbsoluteTimeMs
    || cursor.endBoundaryAbsoluteTimeMs !== bounds.endBoundaryAbsoluteTimeMs
  ) {
    throw new Error("Playback cursor is incompatible with this canonical stream");
  }
  if (constructedCursors.get(cursor) !== context.sourceStreamFingerprint) {
    throw new Error("Playback cursor is not a validated process-local controller state");
  }
  if (
    cursor.eventsApplied !== cursor.reducerState.observable.position.eventsApplied
    || !Number.isSafeInteger(cursor.playheadAbsoluteTimeMs)
    || cursor.playheadAbsoluteTimeMs < cursor.startBoundaryAbsoluteTimeMs
    || cursor.playheadAbsoluteTimeMs > cursor.endBoundaryAbsoluteTimeMs
  ) {
    throw new Error("Playback cursor position does not reconcile");
  }
  const expectedEventCount = eventCountAtOrBeforeAbsoluteTime(
    context,
    cursor.playheadAbsoluteTimeMs,
  );
  if (expectedEventCount !== cursor.eventsApplied) {
    throw new Error("Playback cursor exposes a partial or inconsistent timestamp group");
  }
  const isComplete = cursor.eventsApplied === context.events.length;
  if ((cursor.status === "complete") !== isComplete) {
    throw new Error("Playback cursor completion status does not reconcile");
  }
  return cursor;
}

export function validateReplayPlaybackCursor(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
) {
  return assertCursor(context, cursor);
}

function statusAtPosition(
  previousStatus: ReplayPlaybackStatus,
  eventCount: number,
  totalEventCount: number,
  preservePlaying: boolean,
): ReplayPlaybackStatus {
  if (eventCount === totalEventCount) return "complete";
  if (preservePlaying && previousStatus === "playing") return "playing";
  return "paused";
}

function timestampBoundaryAtOrAfterEventCount(
  context: ReplayReducerContext,
  requestedEventCount: number,
) {
  if (
    !Number.isSafeInteger(requestedEventCount)
    || requestedEventCount < 0
    || requestedEventCount > context.events.length
  ) {
    throw new Error("Playback event seek target is outside the canonical stream");
  }
  if (requestedEventCount === 0) return 0;
  let eventCount = requestedEventCount;
  const timestamp = context.events[eventCount - 1].absoluteReplayTimeMs;
  while (
    eventCount < context.events.length
    && context.events[eventCount].absoluteReplayTimeMs === timestamp
  ) {
    eventCount += 1;
  }
  return eventCount;
}

function cursorAt(
  context: ReplayReducerContext,
  previous: ReplayPlaybackCursor,
  playheadAbsoluteTimeMs: number,
  reducerState: ReplayReducerState,
  preservePlaying: boolean,
) {
  const eventsApplied = reducerState.observable.position.eventsApplied;
  return freezeCursor(context, {
    status: statusAtPosition(
      previous.status,
      eventsApplied,
      context.events.length,
      preservePlaying,
    ),
    startBoundaryAbsoluteTimeMs: previous.startBoundaryAbsoluteTimeMs,
    endBoundaryAbsoluteTimeMs: previous.endBoundaryAbsoluteTimeMs,
    playheadAbsoluteTimeMs,
    eventsApplied,
    reducerState,
  });
}

export function createReplayPlaybackCursor(
  context: ReplayReducerContext,
  seekIndex: ReplaySeekIndex,
) {
  const bounds = replayBounds(context);
  const reducerState = seekReplayIndexToEventCount(context, seekIndex, 0);
  return freezeCursor(context, {
    status: "paused",
    ...bounds,
    playheadAbsoluteTimeMs: bounds.startBoundaryAbsoluteTimeMs,
    eventsApplied: 0,
    reducerState,
  });
}

export function playReplayPlaybackCursor(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
) {
  assertCursor(context, cursor);
  if (cursor.status === "playing" || cursor.status === "complete") return cursor;
  return freezeCursor(context, { ...cursor, status: "playing" });
}

export function pauseReplayPlaybackCursor(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
) {
  assertCursor(context, cursor);
  if (cursor.status !== "playing") return cursor;
  return freezeCursor(context, { ...cursor, status: "paused" });
}

export function resetReplayPlaybackCursor(
  context: ReplayReducerContext,
  seekIndex: ReplaySeekIndex,
  cursor: ReplayPlaybackCursor,
) {
  assertCursor(context, cursor);
  return createReplayPlaybackCursor(context, seekIndex);
}

export function seekReplayPlaybackCursorToEventCount(
  context: ReplayReducerContext,
  seekIndex: ReplaySeekIndex,
  cursor: ReplayPlaybackCursor,
  requestedEventCount: number,
) {
  assertCursor(context, cursor);
  const eventCount = timestampBoundaryAtOrAfterEventCount(context, requestedEventCount);
  const reducerState = seekReplayIndexToEventCount(context, seekIndex, eventCount);
  const playheadAbsoluteTimeMs = eventCount === 0
    ? cursor.startBoundaryAbsoluteTimeMs
    : context.events[eventCount - 1].absoluteReplayTimeMs;
  return cursorAt(context, cursor, playheadAbsoluteTimeMs, reducerState, true);
}

export function seekReplayPlaybackCursorToAbsoluteTime(
  context: ReplayReducerContext,
  seekIndex: ReplaySeekIndex,
  cursor: ReplayPlaybackCursor,
  absoluteReplayTimeMs: number,
) {
  assertCursor(context, cursor);
  if (
    !Number.isSafeInteger(absoluteReplayTimeMs)
    || absoluteReplayTimeMs < cursor.startBoundaryAbsoluteTimeMs
    || absoluteReplayTimeMs > cursor.endBoundaryAbsoluteTimeMs
  ) {
    throw new Error("Playback time seek target is outside the canonical replay bounds");
  }
  const reducerState = seekReplayIndexToAbsoluteTime(
    context,
    seekIndex,
    absoluteReplayTimeMs,
  );
  return cursorAt(context, cursor, absoluteReplayTimeMs, reducerState, true);
}

export function advanceReplayPlaybackCursor(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
  deltaMs: number,
) {
  assertCursor(context, cursor);
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 0) {
    throw new Error("Playback logical-time delta must be a non-negative safe integer");
  }
  if (cursor.status !== "playing" || deltaMs === 0) return cursor;
  const remaining = cursor.endBoundaryAbsoluteTimeMs - cursor.playheadAbsoluteTimeMs;
  const playheadAbsoluteTimeMs = deltaMs >= remaining
    ? cursor.endBoundaryAbsoluteTimeMs
    : cursor.playheadAbsoluteTimeMs + deltaMs;
  const eventCount = eventCountAtOrBeforeAbsoluteTime(context, playheadAbsoluteTimeMs);
  const reducerState = reduceReplayToEventCount(context, eventCount, cursor.reducerState);
  return cursorAt(context, cursor, playheadAbsoluteTimeMs, reducerState, true);
}

export function stepReplayPlaybackCursorToNextEventTime(
  context: ReplayReducerContext,
  cursor: ReplayPlaybackCursor,
) {
  assertCursor(context, cursor);
  if (cursor.status === "complete") return cursor;
  const nextEvent = context.events[cursor.eventsApplied];
  if (!nextEvent) throw new Error("Playback cursor cannot locate its next canonical event");
  const playheadAbsoluteTimeMs = nextEvent.absoluteReplayTimeMs;
  const eventCount = eventCountAtOrBeforeAbsoluteTime(context, playheadAbsoluteTimeMs);
  const reducerState = reduceReplayToEventCount(context, eventCount, cursor.reducerState);
  return cursorAt(context, cursor, playheadAbsoluteTimeMs, reducerState, false);
}

export function applyReplayPlaybackCommand(
  context: ReplayReducerContext,
  seekIndex: ReplaySeekIndex,
  cursor: ReplayPlaybackCursor,
  command: ReplayPlaybackCommand,
) {
  if (command == null || typeof command !== "object") {
    throw new Error("Playback command must be an object");
  }
  switch (command.type) {
    case "PLAY":
      return playReplayPlaybackCursor(context, cursor);
    case "PAUSE":
      return pauseReplayPlaybackCursor(context, cursor);
    case "RESET":
      return resetReplayPlaybackCursor(context, seekIndex, cursor);
    case "ADVANCE_LOGICAL_TIME":
      return advanceReplayPlaybackCursor(context, cursor, command.deltaMs);
    case "SEEK_EVENT_COUNT":
      return seekReplayPlaybackCursorToEventCount(
        context,
        seekIndex,
        cursor,
        command.eventCount,
      );
    case "SEEK_ABSOLUTE_TIME":
      return seekReplayPlaybackCursorToAbsoluteTime(
        context,
        seekIndex,
        cursor,
        command.absoluteReplayTimeMs,
      );
    case "STEP_NEXT_EVENT_TIME":
      return stepReplayPlaybackCursorToNextEventTime(context, cursor);
    default:
      throw new Error("Playback command type is not authorized");
  }
}

export function replayPlaybackCursorMetadata(cursor: ReplayPlaybackCursor) {
  return Object.freeze({
    schemaVersion: cursor.schemaVersion,
    controllerVersion: cursor.controllerVersion,
    reducerVersion: cursor.reducerVersion,
    sourceStreamFingerprint: cursor.sourceStreamFingerprint,
    status: cursor.status,
    startBoundaryAbsoluteTimeMs: cursor.startBoundaryAbsoluteTimeMs,
    endBoundaryAbsoluteTimeMs: cursor.endBoundaryAbsoluteTimeMs,
    playheadAbsoluteTimeMs: cursor.playheadAbsoluteTimeMs,
    eventsApplied: cursor.eventsApplied,
  });
}
