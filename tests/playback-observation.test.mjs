import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  canonicalSerialize,
  compileNationalReplay,
  createReplayPlaybackCursor,
  createReplayReducerContext,
  createReplaySeekIndex,
  createSanitizedPlaybackHeadline,
  createSanitizedPlaybackSnapshot,
  createSanitizedPlaybackTransition,
  deserializeSanitizedPlaybackSnapshot,
  deserializeSanitizedPlaybackTransition,
  lockElectionEndpoint,
  pauseReplayPlaybackCursor,
  playReplayPlaybackCursor,
  resetReplayPlaybackCursor,
  sanitizedPlaybackSnapshotFingerprint,
  sanitizedPlaybackTransitionFingerprint,
  seekReplayPlaybackCursorToEventCount,
  serializeSanitizedPlaybackSnapshot,
  serializeSanitizedPlaybackTransition,
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
  return { context, seekIndex, zero: createReplayPlaybackCursor(context, seekIndex) };
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

test("zero snapshot is current-only, deterministic, and contains accepted reported analytics", async () => {
  for (const { context, zero } of await Promise.all([certifiedPromise, complexPromise])) {
    const first = createSanitizedPlaybackSnapshot(context, zero);
    const second = createSanitizedPlaybackSnapshot(context, zero);
    assert.equal(serializeSanitizedPlaybackSnapshot(first), serializeSanitizedPlaybackSnapshot(second));
    assert.equal(first.controller.status, "paused");
    assert.equal(first.controller.appliedEventCount, 0);
    assert.equal(first.election.national.totalReportedVotes, 0);
    assert.equal(first.election.national.reportedVoteLeader.type, "none");
    assert.equal(first.election.reportedCounties.length, 0);
    assert.equal(first.election.publishedUnits.length, 0);
    assert.equal(first.election.jurisdictions.every((jurisdiction) => !jurisdiction.pollClosed), true);
  }
});

test("play and pause alter controller state but not election knowledge", async () => {
  const { context, zero } = await certifiedPromise;
  const playing = playReplayPlaybackCursor(context, zero);
  const paused = pauseReplayPlaybackCursor(context, playing);
  const zeroObservation = createSanitizedPlaybackSnapshot(context, zero);
  const playingObservation = createSanitizedPlaybackSnapshot(context, playing);
  const pausedObservation = createSanitizedPlaybackSnapshot(context, paused);
  assert.equal(canonicalSerialize(zeroObservation.election), canonicalSerialize(playingObservation.election));
  assert.equal(canonicalSerialize(zeroObservation.election), canonicalSerialize(pausedObservation.election));
  assert.equal(playingObservation.controller.status, "playing");
  assert.equal(pausedObservation.controller.status, "paused");
});

test("one and simultaneous timestamp groups expose only newly observable group facts", async () => {
  const { context, seekIndex, zero } = await certifiedPromise;
  const oneGroup = stepReplayPlaybackCursorToNextEventTime(context, zero);
  const firstTransition = createSanitizedPlaybackTransition(context, zero, oneGroup);
  assert.equal(firstTransition.direction, "forward");
  assert.equal(firstTransition.newlyObservedTimestampGroups.length, 1);
  assert.equal(
    firstTransition.newlyObservedTimestampGroups[0].lastAppliedEventCount,
    oneGroup.eventsApplied,
  );

  const simultaneousIndex = context.events.findIndex((event, index) => (
    index > 0 && event.absoluteReplayTimeMs === context.events[index + 1]?.absoluteReplayTimeMs
  ));
  assert.ok(simultaneousIndex > 0);
  const before = seekReplayPlaybackCursorToEventCount(
    context,
    seekIndex,
    zero,
    simultaneousIndex,
  );
  const current = stepReplayPlaybackCursorToNextEventTime(context, before);
  const transition = createSanitizedPlaybackTransition(context, before, current);
  assert.equal(transition.newlyObservedTimestampGroups.length, 1);
  const group = transition.newlyObservedTimestampGroups[0];
  assert.ok(group.lastAppliedEventCount - group.firstAppliedEventCount >= 1);
  assert.deepEqual([...group.changedJurisdictionIds].sort(), group.changedJurisdictionIds);
});

test("forward, backward, reset, stationary, and completion transitions are explicit", async () => {
  const { context, seekIndex, zero } = await certifiedPromise;
  const forward = seekReplayPlaybackCursorToEventCount(context, seekIndex, zero, 8_000);
  const forwardTransition = createSanitizedPlaybackTransition(context, zero, forward);
  assert.equal(forwardTransition.direction, "forward");
  assert.ok(forwardTransition.newlyObservedTimestampGroups.length > 0);
  assert.ok(forwardTransition.changedJurisdictionIds.length > 0);

  const backward = seekReplayPlaybackCursorToEventCount(context, seekIndex, forward, 1_000);
  const backwardTransition = createSanitizedPlaybackTransition(context, forward, backward);
  assert.equal(backwardTransition.direction, "backward");
  assert.equal(backwardTransition.newlyObservedTimestampGroups.length, 0);

  const reset = resetReplayPlaybackCursor(context, seekIndex, backward);
  const resetTransition = createSanitizedPlaybackTransition(context, backward, reset);
  assert.equal(resetTransition.direction, "backward");
  assert.equal(resetTransition.currentController.appliedEventCount, 0);

  const playing = playReplayPlaybackCursor(context, zero);
  const stationary = createSanitizedPlaybackTransition(context, zero, playing);
  assert.equal(stationary.direction, "stationary");
  assert.deepEqual(stationary.changedJurisdictionIds, []);
  assert.deepEqual(stationary.newlyObservedTimestampGroups, []);

  const complete = seekReplayPlaybackCursorToEventCount(
    context,
    seekIndex,
    zero,
    context.events.length,
  );
  const completeObservation = createSanitizedPlaybackSnapshot(context, complete);
  assert.equal(completeObservation.controller.status, "complete");
  assert.equal(completeObservation.election.complete, true);
  assert.equal(completeObservation.election.national.totalReportedVotes, 155_238_302);
});

test("identical observable prefixes with divergent futures have byte-identical snapshots", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const firstReturn = certified.context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  assert.ok(firstReturn > 0);
  assert.equal(
    canonicalSerialize(certified.context.events.slice(0, firstReturn)),
    canonicalSerialize(complex.context.events.slice(0, firstReturn)),
  );
  const certifiedCursor = seekReplayPlaybackCursorToEventCount(
    certified.context,
    certified.seekIndex,
    certified.zero,
    firstReturn,
  );
  const complexCursor = seekReplayPlaybackCursorToEventCount(
    complex.context,
    complex.seekIndex,
    complex.zero,
    firstReturn,
  );
  assert.equal(certifiedCursor.eventsApplied, complexCursor.eventsApplied);
  const certifiedSerialized = serializeSanitizedPlaybackSnapshot(
    createSanitizedPlaybackSnapshot(certified.context, certifiedCursor),
  );
  const complexSerialized = serializeSanitizedPlaybackSnapshot(
    createSanitizedPlaybackSnapshot(complex.context, complexCursor),
  );
  assert.equal(certifiedSerialized, complexSerialized);
  assert.equal(
    canonicalSerialize(createSanitizedPlaybackHeadline(certified.context, certifiedCursor)),
    canonicalSerialize(createSanitizedPlaybackHeadline(complex.context, complexCursor)),
  );
  assert.doesNotMatch(certifiedSerialized, /sourceStreamFingerprint|endBoundary|nextEvent/);
});

test("identical observable transitions with divergent futures are byte-identical", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  const firstReturn = certified.context.events.findIndex((event) => event.eventType === "RETURN_PUBLISHED");
  const certifiedCurrent = seekReplayPlaybackCursorToEventCount(
    certified.context,
    certified.seekIndex,
    certified.zero,
    firstReturn,
  );
  const complexCurrent = seekReplayPlaybackCursorToEventCount(
    complex.context,
    complex.seekIndex,
    complex.zero,
    firstReturn,
  );
  const certifiedTransition = createSanitizedPlaybackTransition(
    certified.context,
    certified.zero,
    certifiedCurrent,
  );
  const complexTransition = createSanitizedPlaybackTransition(
    complex.context,
    complex.zero,
    complexCurrent,
  );
  assert.equal(
    serializeSanitizedPlaybackTransition(certifiedTransition),
    serializeSanitizedPlaybackTransition(complexTransition),
  );
});

test("snapshot and transition serialization, fingerprints, and validation fail closed", async () => {
  const { context, seekIndex, zero } = await certifiedPromise;
  const current = seekReplayPlaybackCursorToEventCount(context, seekIndex, zero, 1_000);
  const snapshot = createSanitizedPlaybackSnapshot(context, current);
  const transition = createSanitizedPlaybackTransition(context, zero, current);
  const snapshotSerialized = serializeSanitizedPlaybackSnapshot(snapshot);
  const transitionSerialized = serializeSanitizedPlaybackTransition(transition);
  assert.equal(
    serializeSanitizedPlaybackSnapshot(deserializeSanitizedPlaybackSnapshot(
      snapshotSerialized,
      context,
      current,
    )),
    snapshotSerialized,
  );
  assert.equal(
    serializeSanitizedPlaybackTransition(deserializeSanitizedPlaybackTransition(
      transitionSerialized,
      context,
      zero,
      current,
    )),
    transitionSerialized,
  );
  assert.equal(
    await sanitizedPlaybackSnapshotFingerprint(snapshot),
    await sanitizedPlaybackSnapshotFingerprint(createSanitizedPlaybackSnapshot(context, current)),
  );
  assert.equal(
    await sanitizedPlaybackTransitionFingerprint(transition),
    await sanitizedPlaybackTransitionFingerprint(
      createSanitizedPlaybackTransition(context, zero, current),
    ),
  );
  const tampered = structuredClone(snapshot);
  tampered.election.national.candidateVotes[0].votes += 1;
  assert.throws(
    () => deserializeSanitizedPlaybackSnapshot(canonicalSerialize(tampered), context, current),
    /does not match/,
  );
});

test("foreign cursors and prohibited presentation or future fields never cross the contract", async () => {
  const [certified, complex] = await Promise.all([certifiedPromise, complexPromise]);
  assert.throws(
    () => createSanitizedPlaybackSnapshot(certified.context, complex.zero),
    /incompatible/,
  );
  const complete = seekReplayPlaybackCursorToEventCount(
    certified.context,
    certified.seekIndex,
    certified.zero,
    certified.context.events.length,
  );
  const serialized = serializeSanitizedPlaybackSnapshot(
    createSanitizedPlaybackSnapshot(certified.context, complete),
  );
  for (const prohibited of [
    "sourceStreamFingerprint", "endBoundaryAbsoluteTimeMs", "nextEventTime",
    "remainingEventCount", "remainingVotes", "finalWinner", "electoralVotes",
    "projection", "callStatus", "presentationString", "mapStyle", "cameraState",
  ]) {
    assert.equal(serialized.includes(`"${prohibited}"`), false, prohibited);
  }

  const source = readFileSync(
    new URL("../packages/election-replay/src/playbackObservation.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /deriveNationalReportedAnalytics/);
  assert.match(source, /deriveJurisdictionReportedAnalytics/);
  assert.doesNotMatch(source, /LockedElectionEndpoint|CompiledNationalReplay|DecisionDesk|STATE_CALL/);
  assert.doesNotMatch(source, /EventEmitter|WebSocket|localStorage|indexedDB|from\s+["']rxjs/);
  assert.doesNotMatch(source, /requestAnimationFrame|setTimeout|setInterval|Date\.now/);
  assert.doesNotMatch(source, /from\s+["'](?:react|@deck\.gl)/);
});
