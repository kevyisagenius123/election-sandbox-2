import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  advanceReplayPlaybackCursor,
  applyReplayPlaybackCommand,
  canonicalSerialize,
  compileNationalReplay,
  createReplayPlaybackCursor,
  createReplayReducerContext,
  createReplaySeekIndex,
  deriveFullReportedAnalytics,
  lockElectionEndpoint,
  pauseReplayPlaybackCursor,
  playReplayPlaybackCursor,
  reduceReplayToEventCount,
  replayPlaybackCursorMetadata,
  resetReplayPlaybackCursor,
  seekReplayPlaybackCursorToAbsoluteTime,
  seekReplayPlaybackCursorToEventCount,
  serializeDerivedReportedAnalytics,
  serializeReplayReducerState,
  stepReplayPlaybackCursorToNextEventTime,
} from "../packages/election-replay/src/index.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "../src/data/miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import {
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
} from "./replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "./replay-fixtures/national-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
} from "./replay-fixtures/pennsylvania-endpoints.mjs";

const paFoundation = decodePennsylvaniaDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
)));
const miFoundation = decodeMichiganDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url),
  "utf8",
)));
const paUnits = toBehaviorModelUnits(paFoundation);
const miUnits = toMichiganBehaviorModelUnits(miFoundation);

async function fixture(national, pa, mi) {
  const endpoint = await lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: applyBehaviorScenario(paUnits, pa.settings),
    michiganFoundation: miFoundation,
    michiganScenario: applyBehaviorScenario(miUnits, mi.settings),
    scenarioId: national.scenarioId,
    scenarioFingerprint: national.scenarioFingerprint,
    createdAt: national.createdAt,
  }));
  const replay = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  const context = await createReplayReducerContext(endpoint, replay);
  const seekIndex = createReplaySeekIndex(context, 250);
  return { context, seekIndex };
}

const certifiedPromise = fixture(
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
);
const complexPromise = fixture(
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
);

function cursorSerialization(cursor) {
  return canonicalSerialize({
    metadata: replayPlaybackCursorMetadata(cursor),
    reducerState: cursor.reducerState,
  });
}

test("zero, play, pause, and paused advancement have explicit immutable semantics", async () => {
  const { context, seekIndex } = await certifiedPromise;
  const zero = createReplayPlaybackCursor(context, seekIndex);
  assert.equal(zero.status, "paused");
  assert.equal(zero.eventsApplied, 0);
  assert.equal(zero.playheadAbsoluteTimeMs, context.events[0].absoluteReplayTimeMs - 1);
  assert.equal(Object.isFrozen(zero), true);
  const playing = playReplayPlaybackCursor(context, zero);
  assert.equal(playing.status, "playing");
  assert.equal(cursorSerialization(zero), cursorSerialization(createReplayPlaybackCursor(context, seekIndex)));
  const paused = pauseReplayPlaybackCursor(context, playing);
  assert.equal(paused.status, "paused");
  assert.equal(advanceReplayPlaybackCursor(context, paused, 10_000), paused);
  assert.equal(pauseReplayPlaybackCursor(context, paused), paused);
});

test("logical-time advancement is partition-independent on certified and complex fixtures", async () => {
  for (const { context, seekIndex } of await Promise.all([certifiedPromise, complexPromise])) {
    const zero = createReplayPlaybackCursor(context, seekIndex);
    const totalDelta = Math.min(
      43_210_987,
      zero.endBoundaryAbsoluteTimeMs - zero.startBoundaryAbsoluteTimeMs - 1,
    );
    const whole = advanceReplayPlaybackCursor(
      context,
      playReplayPlaybackCursor(context, zero),
      totalDelta,
    );
    let partitioned = playReplayPlaybackCursor(context, zero);
    let remaining = totalDelta;
    const pieces = [1, 17, 997, 12_345, 1_000_003, 7_919_111];
    let pieceIndex = 0;
    while (remaining > 0) {
      const delta = Math.min(remaining, pieces[pieceIndex % pieces.length]);
      partitioned = advanceReplayPlaybackCursor(context, partitioned, delta);
      remaining -= delta;
      pieceIndex += 1;
    }
    assert.equal(cursorSerialization(partitioned), cursorSerialization(whole));
  }
});

test("simultaneous events are exposed atomically by time, event seek, and stepping", async () => {
  const { context, seekIndex } = await certifiedPromise;
  const groupStart = context.events.findIndex((event, index) => (
    index > 0 && event.absoluteReplayTimeMs === context.events[index + 1]?.absoluteReplayTimeMs
  ));
  assert.ok(groupStart > 0);
  const timestamp = context.events[groupStart].absoluteReplayTimeMs;
  let groupEnd = groupStart + 1;
  while (context.events[groupEnd]?.absoluteReplayTimeMs === timestamp) groupEnd += 1;
  const zero = createReplayPlaybackCursor(context, seekIndex);
  const byTime = seekReplayPlaybackCursorToAbsoluteTime(context, seekIndex, zero, timestamp);
  const byInsidePosition = seekReplayPlaybackCursorToEventCount(
    context,
    seekIndex,
    zero,
    groupStart + 1,
  );
  assert.equal(byTime.eventsApplied, groupEnd);
  assert.equal(byInsidePosition.eventsApplied, groupEnd);
  assert.equal(cursorSerialization(byInsidePosition), cursorSerialization(byTime));

  const before = seekReplayPlaybackCursorToEventCount(context, seekIndex, zero, groupStart);
  const stepped = stepReplayPlaybackCursorToNextEventTime(context, before);
  assert.equal(stepped.eventsApplied, groupEnd);
  assert.equal(stepped.status, "paused");
});

test("forward seek, backward seek, reset, and completion remain exact", async () => {
  const { context, seekIndex } = await certifiedPromise;
  const zero = createReplayPlaybackCursor(context, seekIndex);
  const forward = seekReplayPlaybackCursorToEventCount(context, seekIndex, zero, 10_000);
  const backward = seekReplayPlaybackCursorToEventCount(context, seekIndex, forward, 1_000);
  assert.equal(
    serializeReplayReducerState(backward.reducerState),
    serializeReplayReducerState(reduceReplayToEventCount(context, backward.eventsApplied)),
  );

  const playing = playReplayPlaybackCursor(context, forward);
  const complete = advanceReplayPlaybackCursor(context, playing, Number.MAX_SAFE_INTEGER);
  assert.equal(complete.status, "complete");
  assert.equal(complete.eventsApplied, context.events.length);
  assert.equal(complete.reducerState.observable.complete, true);
  assert.equal(playReplayPlaybackCursor(context, complete), complete);
  assert.equal(stepReplayPlaybackCursorToNextEventTime(context, complete), complete);

  const reopened = seekReplayPlaybackCursorToEventCount(context, seekIndex, complete, 100);
  assert.equal(reopened.status, "paused");
  assert.ok(reopened.eventsApplied >= 100);
  const reset = resetReplayPlaybackCursor(context, seekIndex, reopened);
  assert.equal(cursorSerialization(reset), cursorSerialization(zero));
});

test("command dispatch is deterministic and never mutates commands or prior cursors", async () => {
  const { context, seekIndex } = await certifiedPromise;
  const commands = [
    { type: "PLAY" },
    { type: "ADVANCE_LOGICAL_TIME", deltaMs: 10_000_000 },
    { type: "PAUSE" },
    { type: "SEEK_EVENT_COUNT", eventCount: 7_777 },
    { type: "STEP_NEXT_EVENT_TIME" },
    { type: "PLAY" },
    { type: "ADVANCE_LOGICAL_TIME", deltaMs: 9_876_543 },
    { type: "RESET" },
  ];
  const commandsBefore = canonicalSerialize(commands);
  const run = () => commands.reduce(
    (cursor, command) => applyReplayPlaybackCommand(context, seekIndex, cursor, command),
    createReplayPlaybackCursor(context, seekIndex),
  );
  const first = run();
  const second = run();
  assert.equal(cursorSerialization(first), cursorSerialization(second));
  assert.equal(canonicalSerialize(commands), commandsBefore);
});

test("controller positions preserve reducer and v0.22B analytics semantics", async () => {
  for (const { context, seekIndex } of await Promise.all([certifiedPromise, complexPromise])) {
    const zero = createReplayPlaybackCursor(context, seekIndex);
    for (const requested of [0, 1, 100, 1_000, 6_852, context.events.length]) {
      const cursor = seekReplayPlaybackCursorToEventCount(
        context,
        seekIndex,
        zero,
        requested,
      );
      const direct = reduceReplayToEventCount(context, cursor.eventsApplied);
      assert.equal(serializeReplayReducerState(cursor.reducerState), serializeReplayReducerState(direct));
      assert.equal(
        serializeDerivedReportedAnalytics(deriveFullReportedAnalytics(cursor.reducerState.observable)),
        serializeDerivedReportedAnalytics(deriveFullReportedAnalytics(direct.observable)),
      );
    }
  }
});

test("hostile commands, invalid time, untrusted cursors, and foreign indexes fail closed", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const zero = createReplayPlaybackCursor(certified.context, certified.seekIndex);
  for (const deltaMs of [-1, 0.5, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => advanceReplayPlaybackCursor(certified.context, zero, deltaMs),
      /non-negative safe integer/,
    );
  }
  assert.throws(
    () => seekReplayPlaybackCursorToAbsoluteTime(
      certified.context,
      certified.seekIndex,
      zero,
      zero.startBoundaryAbsoluteTimeMs - 1,
    ),
    /outside/,
  );
  assert.throws(
    () => seekReplayPlaybackCursorToEventCount(
      certified.context,
      certified.seekIndex,
      zero,
      certified.context.events.length + 1,
    ),
    /outside/,
  );
  assert.throws(
    () => playReplayPlaybackCursor(certified.context, structuredClone(zero)),
    /process-local/,
  );
  assert.throws(
    () => applyReplayPlaybackCommand(certified.context, certified.seekIndex, zero, { type: "CALL_STATE" }),
    /not authorized/,
  );
  assert.throws(
    () => seekReplayPlaybackCursorToEventCount(
      certified.context,
      complex.seekIndex,
      zero,
      100,
    ),
    /incompatible/,
  );
});

test("playback controller source remains headless, clockless, and inference-free", () => {
  const source = readFileSync(
    new URL("../packages/election-replay/src/playbackCursor.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /requestAnimationFrame|setTimeout|setInterval|Date\.now|performance\.now/);
  assert.doesNotMatch(source, /reportedAnalytics|deriveFullReportedAnalytics|DecisionDesk|STATE_CALL/);
  assert.doesNotMatch(source, /localStorage|indexedDB|WebSocket|from\s+["'](?:react|@deck\.gl)/);
  assert.doesNotMatch(source, /Math\.random\s*\(/);
});
