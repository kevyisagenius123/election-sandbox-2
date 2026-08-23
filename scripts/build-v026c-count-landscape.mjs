import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getDetailedStateRuntimeAdapter } from "../src/data/detailedStateRuntimeLoaders.ts";
import { listDetailedStateManifests } from "../src/data/detailedStateManifest.ts";
import { buildCountLandscapeDataset } from "../src/replay/countLandscapeResearch.ts";
import {
  compileThreeStateElectionNight,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
} from "../src/replay/threeStateElectionNight.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "research/v0.26c/data/count-landscape.json");

function unchangedScenarioUnits(units) {
  return units.map((unit) => ({
    ...unit,
    turnoutAddedVotes: 0,
    turnoutHarrisVotes: 0,
    turnoutTrumpVotes: 0,
    preferenceNetHarrisGain: 0,
    thirdPartyCandidateDelta: 0,
    netHarrisGain: 0,
  }));
}

const states = [];
for (const manifest of listDetailedStateManifests()) {
  const artifactPath = resolve(projectRoot, "public", manifest.runtime.artifactPath);
  const serialized = JSON.parse(await readFile(artifactPath, "utf8"));
  const adapter = getDetailedStateRuntimeAdapter(manifest.runtime.loader);
  const foundation = adapter.decode(serialized);
  states.push({
    stateCode: manifest.code,
    units: unchangedScenarioUnits(adapter.toBehaviorModelUnits(foundation)),
  });
}

const replay = compileThreeStateElectionNight(states, DEFAULT_ELECTION_NIGHT_BEHAVIOR);
const dataset = buildCountLandscapeDataset(replay, replay.events.length, 48);
const source = {
  schemaVersion: 1,
  researchVersion: "v0.26c",
  status: "bounded research fixture, not a production replay artifact",
  replayVersion: replay.version,
  behavior: replay.behavior,
  foundationCompatibility: listDetailedStateManifests().map((manifest) => ({
    stateCode: manifest.code,
    dataVersion: manifest.compatibility.dataVersion,
    loader: manifest.runtime.loader,
    artifactPath: manifest.runtime.artifactPath,
  })),
  dataset,
};
const canonical = JSON.stringify(source);
const output = {
  ...source,
  fingerprint: `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Fingerprint ${output.fingerprint}`);
console.log(`${dataset.points.length} bounded points from ${dataset.observedReturnCount} detailed returns`);
