import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import {
  applyBehaviorScenario,
  deriveBehaviorContributions,
} from "../packages/election-model/src/scenario.ts";

const artifactUrl = new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url);
const artifactText = await readFile(fileURLToPath(artifactUrl), "utf8");
const profileIterations = 25;
const scenarioSettings = {
  turnoutIncreasePoints: 1.2,
  addedVoterHarrisShare: 0.63,
  preferenceShiftPoints: -4.7,
  thirdPartyCandidate: "oliver",
  thirdPartyShiftPoints: 0.8,
  thirdPartyHarrisExchangeShare: 0.41,
};

function measure(label, operation, iterations = profileIterations) {
  const samples = [];
  let result;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const startedAt = performance.now();
    result = operation();
    samples.push(performance.now() - startedAt);
  }
  samples.sort((left, right) => left - right);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
  return { label, median, p95, result };
}

global.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const parseProfile = measure("JSON parse", () => JSON.parse(artifactText), 10);
const decodedDocument = parseProfile.result;
const decodeProfile = measure(
  "Validated decode",
  () => decodePennsylvaniaDemographicFoundation(decodedDocument),
  10,
);
const foundation = decodeProfile.result;
const unitProfile = measure("Model-unit conversion", () => toBehaviorModelUnits(foundation));
const units = unitProfile.result;

applyBehaviorScenario(units, scenarioSettings);
const scenarioProfile = measure(
  "Scenario calculation",
  () => applyBehaviorScenario(units, scenarioSettings),
);
const scenario = scenarioProfile.result;
const contributionProfile = measure(
  "Contribution audit",
  () => deriveBehaviorContributions(units, scenario.units),
);

assert.equal(foundation.vtds.length, 9_178);
assert.equal(units.length, foundation.join.mappedElectionGeometryCount + foundation.residualUnits.length);
assert.equal(scenario.totals.totalVotes, foundation.totals.certifiedVotes.totalVotes + scenario.turnout.addedVotes);
assert.equal(contributionProfile.result.length, units.length);

global.gc?.();
const heapAfter = process.memoryUsage().heapUsed;
const profiles = [parseProfile, decodeProfile, unitProfile, scenarioProfile, contributionProfile];

console.log("Pennsylvania runtime profile");
console.log(`Artifact: ${(Buffer.byteLength(artifactText) / 1024).toFixed(1)} KiB`);
console.log(`VTDs: ${foundation.vtds.length.toLocaleString("en-US")} · model units: ${units.length.toLocaleString("en-US")}`);
for (const profile of profiles) {
  console.log(`${profile.label.padEnd(22)} median ${profile.median.toFixed(2).padStart(7)} ms · p95 ${profile.p95.toFixed(2).padStart(7)} ms`);
}
console.log(`Retained heap delta: ${((heapAfter - heapBefore) / 1024 / 1024).toFixed(2)} MiB`);
