import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildCountLandscapeDataset } from "../src/replay/countLandscapeResearch.ts";
import {
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
} from "../src/replay/threeStateElectionNight.ts";

function unit(id, countyFips, harrisVotes, trumpVotes, otherVotes = 6) {
  return {
    id,
    countyFips,
    geometryId: id,
    harrisVotes,
    trumpVotes,
    steinVotes: 2,
    oliverVotes: 1,
    residualOtherVotes: otherVotes - 3,
    otherVotes,
    totalVotes: harrisVotes + trumpVotes + otherVotes,
    turnoutDenominator: 1_000,
    turnoutCapacity: 100,
    turnoutAddedVotes: 0,
    turnoutHarrisVotes: 0,
    turnoutTrumpVotes: 0,
    preferenceNetHarrisGain: 0,
    thirdPartyCandidateDelta: 0,
    netHarrisGain: 0,
  };
}

const states = [
  { stateCode: "PA", units: [unit("shared", "42001", 80, 40), unit("pa-2", "42003", 25, 70)] },
  { stateCode: "MI", units: [unit("shared", "26001", 60, 45), unit("mi-2", "26163", 90, 35)] },
  { stateCode: "WI", units: [unit("shared", "55001", 30, 55), unit("wi-2", "55079", 100, 45)] },
];

const replay = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);

test("count landscape is deterministic, bounded, and empty before the first return", () => {
  const first = buildCountLandscapeDataset(replay, replay.events.length, 24);
  const second = buildCountLandscapeDataset(replay, replay.events.length, 24);
  assert.deepEqual(first, second);
  assert.ok(first.points.length <= 24 * 3);
  assert.deepEqual(first.stateCodes, ["PA", "MI", "WI"]);

  const empty = buildCountLandscapeDataset(replay, 0, 24);
  assert.equal(empty.points.length, 0);
  assert.equal(empty.national.ballotsPublished, 0);
  assert.equal(empty.national.returnsPublished, 0);
});

test("count landscape conserves every visible-prefix ballot and candidate vector", () => {
  for (let observed = 1; observed <= replay.events.length; observed += 1) {
    const dataset = buildCountLandscapeDataset(replay, observed, 24);
    const visible = replay.events.slice(0, observed);
    assert.equal(dataset.national.ballotsPublished, visible.reduce((sum, event) => sum + event.totalVotes, 0));
    assert.equal(dataset.national.returnsPublished, observed);
    assert.equal(dataset.national.harrisVotes, visible.reduce((sum, event) => sum + event.harrisVotes, 0));
    assert.equal(dataset.national.trumpVotes, visible.reduce((sum, event) => sum + event.trumpVotes, 0));
    assert.equal(
      dataset.national.otherVotes,
      visible.reduce((sum, event) => (
        sum + event.steinVotes + event.oliverVotes + event.residualOtherVotes
      ), 0),
    );
    assert.equal(
      dataset.national.twoPartyMovementVotes,
      dataset.national.harrisVotes - dataset.national.trumpVotes,
    );
  }
});

test("count landscape never exposes a future event identity", () => {
  const observed = Math.floor(replay.events.length / 2);
  const visibleIds = new Set(replay.events.slice(0, observed).map((event) => event.eventId));
  const futureIds = new Set(replay.events.slice(observed).map((event) => event.eventId));
  const dataset = buildCountLandscapeDataset(replay, observed, 24);
  for (const point of dataset.points) {
    if (point.latestEventId === null) continue;
    assert.ok(visibleIds.has(point.latestEventId));
    assert.ok(!futureIds.has(point.latestEventId));
  }
});

test("hidden future candidate changes cannot alter the visible landscape", () => {
  const observed = 3;
  const changedReplay = {
    ...replay,
    events: replay.events.map((event, index) => index < observed ? event : {
      ...event,
      harrisVotes: event.trumpVotes,
      trumpVotes: event.harrisVotes,
    }),
  };
  assert.deepEqual(
    buildCountLandscapeDataset(replay, observed, 24),
    buildCountLandscapeDataset(changedReplay, observed, 24),
  );
});

test("full landscape jurisdiction totals reconcile to the replay endpoint", () => {
  const dataset = buildCountLandscapeDataset(replay, replay.events.length, 24);
  for (const stateCode of dataset.stateCodes) {
    const events = replay.events.filter((event) => event.stateCode === stateCode);
    assert.equal(dataset.jurisdictions[stateCode].returnsPublished, events.length);
    assert.equal(
      dataset.jurisdictions[stateCode].ballotsPublished,
      events.reduce((sum, event) => sum + event.totalVotes, 0),
    );
  }
  assert.throws(() => buildCountLandscapeDataset(replay, -1), /outside/);
  assert.throws(() => buildCountLandscapeDataset(replay, replay.events.length + 1), /outside/);
  assert.throws(() => buildCountLandscapeDataset(replay, replay.events.length, 7), /between 8 and 120/);
});

test("ECharts GL remains a research-only development dependency", async () => {
  const projectRoot = resolve(import.meta.dirname, "..");
  const packageDocument = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
  assert.equal(packageDocument.dependencies["echarts-gl"], undefined);
  assert.equal(packageDocument.devDependencies["echarts-gl"], "^2.1.0");

  async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }));
    return nested.flat();
  }
  const applicationSource = await Promise.all(
    (await sourceFiles(resolve(projectRoot, "src")))
      .filter((path) => /\.(?:ts|tsx)$/.test(path))
      .map((path) => readFile(path, "utf8")),
  );
  assert.equal(applicationSource.some((source) => source.includes("echarts-gl")), false);
});
