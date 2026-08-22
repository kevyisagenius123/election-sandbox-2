import { canonicalSerialize, type CanonicalValue } from "./canonical.ts";
import { sha256Fingerprint } from "./hash.ts";
import {
  createReplayZeroState,
  deserializeReplayReducerState,
  eventCountAtOrBeforeAbsoluteTime,
  reduceReplayToEventCount,
  replayReducerStateFingerprint,
  serializeReplayReducerState,
  REPLAY_REDUCER_SCHEMA_VERSION,
  REPLAY_REDUCER_VERSION,
  type ReplayReducerContext,
  type ReplayReducerState,
} from "./reducer.ts";

export const REPLAY_CHECKPOINT_SCHEMA_VERSION = "rme-reducer-checkpoint-v1" as const;

export interface ReplayCheckpoint {
  schemaVersion: typeof REPLAY_CHECKPOINT_SCHEMA_VERSION;
  reducerVersion: typeof REPLAY_REDUCER_VERSION;
  sourceStreamFingerprint: string;
  eventsApplied: number;
  lastAppliedSequence: number | null;
  state: ReplayReducerState;
  stateFingerprint: string;
  checkpointFingerprint: string;
}

const validatedCheckpointCache = new WeakMap<object, string>();

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function checkpointPreimage(checkpoint: Omit<ReplayCheckpoint, "checkpointFingerprint">) {
  return canonicalSerialize(checkpoint as unknown as CanonicalValue);
}

export function serializeReplayCheckpoint(checkpoint: ReplayCheckpoint) {
  return canonicalSerialize(checkpoint as unknown as CanonicalValue);
}

async function checkpointFromCanonicalState(
  context: ReplayReducerContext,
  state: ReplayReducerState,
): Promise<ReplayCheckpoint> {
  if (
    state.schemaVersion !== REPLAY_REDUCER_SCHEMA_VERSION
    || state.reducerVersion !== REPLAY_REDUCER_VERSION
    || state.sourceStreamFingerprint !== context.sourceStreamFingerprint
  ) {
    throw new Error("Cannot checkpoint an incompatible reducer state");
  }
  const stateFingerprint = await replayReducerStateFingerprint(state);
  const withoutFingerprint = {
    schemaVersion: REPLAY_CHECKPOINT_SCHEMA_VERSION,
    reducerVersion: REPLAY_REDUCER_VERSION,
    sourceStreamFingerprint: context.sourceStreamFingerprint,
    eventsApplied: state.observable.position.eventsApplied,
    lastAppliedSequence: state.observable.position.lastAppliedSequence,
    state,
    stateFingerprint,
  } as const;
  const checkpoint = Object.freeze({
    ...withoutFingerprint,
    checkpointFingerprint: await sha256Fingerprint(checkpointPreimage(withoutFingerprint)),
  });
  validatedCheckpointCache.set(checkpoint, context.sourceStreamFingerprint);
  return checkpoint;
}

export async function createReplayCheckpoint(
  context: ReplayReducerContext,
  state: ReplayReducerState,
): Promise<ReplayCheckpoint> {
  const expected = reduceReplayToEventCount(
    context,
    state.observable.position.eventsApplied,
  );
  if (serializeReplayReducerState(expected) !== serializeReplayReducerState(state)) {
    throw new Error("Cannot checkpoint state that does not equal its canonical event prefix");
  }
  return checkpointFromCanonicalState(context, state);
}

export async function validateReplayCheckpoint(
  context: ReplayReducerContext,
  checkpoint: ReplayCheckpoint,
) {
  if (
    checkpoint.schemaVersion !== REPLAY_CHECKPOINT_SCHEMA_VERSION
    || checkpoint.reducerVersion !== REPLAY_REDUCER_VERSION
    || checkpoint.sourceStreamFingerprint !== context.sourceStreamFingerprint
    || checkpoint.state.sourceStreamFingerprint !== context.sourceStreamFingerprint
  ) {
    throw new Error("Checkpoint belongs to a different replay stream or reducer version");
  }
  if (
    Object.isFrozen(checkpoint)
    && Object.isFrozen(checkpoint.state)
    && validatedCheckpointCache.get(checkpoint) === context.sourceStreamFingerprint
  ) {
    return checkpoint;
  }
  if (
    checkpoint.eventsApplied !== checkpoint.state.observable.position.eventsApplied
    || checkpoint.lastAppliedSequence !== checkpoint.state.observable.position.lastAppliedSequence
  ) {
    throw new Error("Checkpoint position metadata does not reconcile");
  }
  const stateFingerprint = await replayReducerStateFingerprint(checkpoint.state);
  if (stateFingerprint !== checkpoint.stateFingerprint) {
    throw new Error("Checkpoint reducer state fingerprint mismatch");
  }
  const { checkpointFingerprint, ...withoutFingerprint } = checkpoint;
  const expected = await sha256Fingerprint(checkpointPreimage(withoutFingerprint));
  if (checkpointFingerprint !== expected) {
    throw new Error("Checkpoint fingerprint mismatch");
  }
  deserializeReplayReducerState(context, serializeReplayReducerState(checkpoint.state));
  if (Object.isFrozen(checkpoint) && Object.isFrozen(checkpoint.state)) {
    validatedCheckpointCache.set(checkpoint, context.sourceStreamFingerprint);
  }
  return checkpoint;
}

export async function deserializeReplayCheckpoint(
  context: ReplayReducerContext,
  serialized: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Replay checkpoint is not valid JSON");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Replay checkpoint must contain an object");
  }
  const checkpoint = deepFreeze(parsed as ReplayCheckpoint);
  await validateReplayCheckpoint(context, checkpoint);
  return checkpoint;
}

export async function createReplayCheckpoints(
  context: ReplayReducerContext,
  cadence = 1_000,
) {
  if (!Number.isSafeInteger(cadence) || cadence <= 0) {
    throw new Error("Checkpoint cadence must be a positive safe integer");
  }
  const checkpoints: ReplayCheckpoint[] = [];
  let state = createReplayZeroState(context);
  checkpoints.push(await checkpointFromCanonicalState(context, state));
  while (state.observable.position.eventsApplied < context.events.length) {
    const next = Math.min(
      context.events.length,
      state.observable.position.eventsApplied + cadence,
    );
    state = reduceReplayToEventCount(context, next, state);
    checkpoints.push(await checkpointFromCanonicalState(context, state));
  }
  return Object.freeze(checkpoints);
}

export async function seekReplayToEventCount(
  context: ReplayReducerContext,
  eventCount: number,
  checkpoints: readonly ReplayCheckpoint[] = [],
) {
  if (!Number.isSafeInteger(eventCount) || eventCount < 0 || eventCount > context.events.length) {
    throw new Error("Replay seek target is outside the source stream");
  }
  const eligible = checkpoints
    .filter((checkpoint) => checkpoint.eventsApplied <= eventCount)
    .sort((left, right) => right.eventsApplied - left.eventsApplied);
  const checkpoint = eligible[0];
  const initial = checkpoint
    ? (await validateReplayCheckpoint(context, checkpoint)).state
    : createReplayZeroState(context);
  return reduceReplayToEventCount(context, eventCount, initial);
}

export async function seekReplayToAbsoluteTime(
  context: ReplayReducerContext,
  absoluteReplayTimeMs: number,
  checkpoints: readonly ReplayCheckpoint[] = [],
) {
  return seekReplayToEventCount(
    context,
    eventCountAtOrBeforeAbsoluteTime(context, absoluteReplayTimeMs),
    checkpoints,
  );
}
