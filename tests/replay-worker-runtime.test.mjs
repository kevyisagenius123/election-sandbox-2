import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  canonicalSerialize,
  lockElectionEndpoint,
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
  REPLAY_WORKER_PROTOCOL_VERSION,
} from "../src/runtime/replayWorkerProtocol.ts";
import { ReplayWorkerRuntime } from "../src/runtime/replayWorkerRuntime.ts";
import {
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
} from "./replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "./replay-fixtures/national-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
} from "./replay-fixtures/pennsylvania-endpoints.mjs";

const paFoundation = decodePennsylvaniaDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
)));
const miFoundation = decodeMichiganDemographicFoundation(JSON.parse(readFileSync(
  new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url),
  "utf8",
)));

function request(requestId, request) {
  return {
    protocolVersion: REPLAY_WORKER_PROTOCOL_VERSION,
    requestId,
    ...request,
  };
}

function withoutRequestId(response) {
  const stable = { ...response };
  delete stable.requestId;
  return stable;
}

function assertPresentationSafe(response) {
  const serialized = JSON.stringify(response);
  for (const prohibited of [
    "sourceStreamFingerprint",
    "endpointContentFingerprint",
    "nationalStreamFingerprint",
    "candidateDelta",
    "endBoundaryAbsoluteTimeMs",
    "nextEvent",
    "remainingVotes",
    "replay-definition",
  ]) {
    assert.equal(serialized.includes(prohibited), false, `response leaked ${prohibited}`);
  }
}

async function certifiedEndpoint() {
  const paScenario = applyBehaviorScenario(
    toBehaviorModelUnits(paFoundation),
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.settings,
  );
  const miScenario = applyBehaviorScenario(
    toMichiganBehaviorModelUnits(miFoundation),
    MICHIGAN_BASELINE_REPLAY_FIXTURE.settings,
  );
  return lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: paScenario,
    michiganFoundation: miFoundation,
    michiganScenario: miScenario,
    scenarioId: NATIONAL_BASELINE_REPLAY_FIXTURE.scenarioId,
    scenarioFingerprint: NATIONAL_BASELINE_REPLAY_FIXTURE.scenarioFingerprint,
    createdAt: NATIONAL_BASELINE_REPLAY_FIXTURE.createdAt,
  }));
}

test("worker runtime rejects playback commands before initialization", async () => {
  const runtime = new ReplayWorkerRuntime();
  const response = await runtime.handle(request(1, {
    type: "COMMAND",
    command: { type: "PLAY" },
  }));
  assert.equal(response.type, "ERROR");
  assert.match(response.message, /not initialized/);
  assertPresentationSafe(response);
});

test("worker runtime owns compilation, playback, compact updates, and resynchronization", async () => {
  const endpoint = await certifiedEndpoint();
  const runtime = new ReplayWorkerRuntime();
  const ready = await runtime.handle(request(10, {
    type: "INITIALIZE",
    endpoint,
    definition: NATIONAL_REPLAY_DEFINITION,
    checkpointCadenceEvents: 250,
  }));
  assert.equal(ready.type, "READY");
  assert.equal(ready.snapshot.controller.status, "paused");
  assert.equal(ready.snapshot.controller.appliedEventCount, 0);
  assert.equal(ready.snapshot.election.national.totalReportedVotes, 0);
  assert.equal(ready.timelineProgressMillionths, 0);
  assertPresentationSafe(ready);

  const duplicate = await runtime.handle(request(11, {
    type: "INITIALIZE",
    endpoint,
    definition: NATIONAL_REPLAY_DEFINITION,
  }));
  assert.equal(duplicate.type, "ERROR");
  assert.match(duplicate.message, /only initialize once/);

  const first = await runtime.handle(request(12, {
    type: "COMMAND",
    command: { type: "STEP_NEXT_EVENT_TIME" },
  }));
  assert.equal(first.type, "UPDATE");
  assert.equal(first.transition.direction, "forward");
  assert.equal(first.current.controller.appliedEventCount > 0, true);
  assert.equal("snapshot" in first, false);
  assert.equal(first.resynchronizationRecommended, false);
  assert.equal(JSON.stringify(first).length < 250_000, true);
  assertPresentationSafe(first);

  const play = await runtime.handle(request(13, {
    type: "COMMAND",
    command: { type: "PLAY" },
  }));
  assert.equal(play.type, "UPDATE");
  assert.equal(play.current.controller.status, "playing");

  const advance = await runtime.handle(request(14, {
    type: "COMMAND",
    command: { type: "ADVANCE_LOGICAL_TIME", deltaMs: 60_000 },
  }));
  assert.equal(advance.type, "UPDATE");
  assert.equal(advance.current.controller.logicalReplayTimeMs >= first.current.controller.logicalReplayTimeMs, true);

  const backward = await runtime.handle(request(15, {
    type: "COMMAND",
    command: { type: "SEEK_EVENT_COUNT", eventCount: 0 },
  }));
  assert.equal(backward.type, "UPDATE");
  assert.equal(backward.transition.direction, "backward");
  assert.equal(backward.resynchronizationRecommended, true);

  const synchronized = await runtime.handle(request(16, { type: "RESYNCHRONIZE" }));
  assert.equal(synchronized.type, "RESYNCHRONIZED");
  assert.deepEqual(synchronized.snapshot.controller, backward.current.controller);
  assertPresentationSafe(synchronized);

  const midpoint = await runtime.handle(request(161, {
    type: "COMMAND",
    command: { type: "SEEK_PROGRESS", progressMillionths: 500_000 },
  }));
  assert.equal(midpoint.type, "UPDATE", midpoint.type === "ERROR" ? midpoint.message : undefined);
  assert.equal(Math.abs(midpoint.timelineProgressMillionths - 500_000) <= 1, true);
  assert.equal(midpoint.publishedUnits.length > 0, true);
  assert.equal(midpoint.reportedCounties.length > 0, true);

  const invalidProgress = await runtime.handle(request(162, {
    type: "COMMAND",
    command: { type: "SEEK_PROGRESS", progressMillionths: 1_000_001 },
  }));
  assert.equal(invalidProgress.type, "ERROR");
  assert.match(invalidProgress.message, /outside the authorized range/);

  await runtime.handle(request(17, {
    type: "COMMAND",
    command: { type: "RESET" },
  }));
  const deterministicFirst = await runtime.handle(request(18, {
    type: "COMMAND",
    command: { type: "STEP_NEXT_EVENT_TIME" },
  }));
  await runtime.handle(request(19, {
    type: "COMMAND",
    command: { type: "RESET" },
  }));
  const deterministicSecond = await runtime.handle(request(20, {
    type: "COMMAND",
    command: { type: "STEP_NEXT_EVENT_TIME" },
  }));
  assert.equal(
    canonicalSerialize(withoutRequestId(deterministicFirst)),
    canonicalSerialize(withoutRequestId(deterministicSecond)),
  );
});

test("browser worker is a serialized, single-owner runtime and the client factory stays light", () => {
  const workerSource = readFileSync(
    new URL("../src/runtime/replayRuntime.worker.ts", import.meta.url),
    "utf8",
  );
  const factorySource = readFileSync(
    new URL("../src/runtime/createReplayWorker.ts", import.meta.url),
    "utf8",
  );
  assert.match(workerSource, /ReplayWorkerRuntime/);
  assert.match(workerSource, /queue = queue\.then/);
  assert.match(factorySource, /new Worker/);
  assert.doesNotMatch(factorySource, /compileNationalReplay|createReplaySeekIndex|createReplayReducerContext/);
  assert.doesNotMatch(`${workerSource}\n${factorySource}`, /Math\.random\(\)/);
});
