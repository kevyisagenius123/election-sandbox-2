import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  canonicalSerialize,
  canonicalSerializeEndpointContent,
  createNamedReplayRandomStream,
  deriveNamedReplayStreamSeed,
  deriveReplayEventId,
  deserializeLockedElectionEndpoint,
  lockElectionEndpoint,
  REPLAY_PRNG_VERSION,
  REPLAY_SCHEMA_VERSION,
  serializeLockedElectionEndpoint,
  sha256Fingerprint,
} from "../packages/election-replay/src/index.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import {
  createStateScenarioRecipe,
  stateScenarioRecipeFingerprint,
} from "../src/data/scenarioPortfolio.ts";
import { buildPennsylvaniaElectionEndpointInput } from "../src/replay/pennsylvaniaEndpoint.ts";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
} from "./replay-fixtures/pennsylvania-endpoints.mjs";

const demographicDocument = JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
));
const foundation = decodePennsylvaniaDemographicFoundation(demographicDocument);
const baselineUnits = toBehaviorModelUnits(foundation);

function recipeSettings(settings) {
  return {
    turnoutIncreasePoints: settings.turnoutIncreasePoints,
    addedVoterHarrisShare: settings.addedVoterHarrisShare * 100,
    preferenceShiftPoints: settings.preferenceShiftPoints,
    thirdPartyCandidate: settings.thirdPartyCandidate,
    thirdPartyShiftPoints: settings.thirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare: settings.thirdPartyHarrisExchangeShare * 100,
  };
}

function endpointInput(fixture, createdAt = fixture.createdAt) {
  const scenario = applyBehaviorScenario(baselineUnits, fixture.settings);
  const recipe = createStateScenarioRecipe("PA", recipeSettings(fixture.settings));
  return buildPennsylvaniaElectionEndpointInput({
    foundation,
    scenario,
    scenarioId: fixture.scenarioId,
    scenarioFingerprint: stateScenarioRecipeFingerprint(recipe),
    createdAt,
  });
}

function reverseEndpointArrays(input) {
  const clone = structuredClone(input);
  clone.content.candidates.reverse();
  clone.content.evidence.reverse();
  clone.content.jurisdictions.reverse();
  clone.content.nationalTotals.reverse();
  clone.content.electoralAllocation.reverse();
  for (const jurisdiction of clone.content.jurisdictions) {
    jurisdiction.candidateVotes.reverse();
    jurisdiction.counties.reverse();
    jurisdiction.reportingUnits.reverse();
    jurisdiction.evidenceIds.reverse();
    for (const county of jurisdiction.counties) {
      county.candidateVotes.reverse();
      county.evidenceIds.reverse();
    }
    for (const unit of jurisdiction.reportingUnits) {
      unit.candidateVotes.reverse();
      unit.evidenceIds.reverse();
    }
  }
  for (const evidence of clone.content.evidence) evidence.limitations.reverse();
  return clone;
}

function addOneHarrisVoteEverywhere(input) {
  const clone = structuredClone(input);
  const pa = clone.content.jurisdictions.find((jurisdiction) => jurisdiction.jurisdictionId === "PA");
  const unit = pa.reportingUnits.find((candidate) => candidate.countyId != null);
  const county = pa.counties.find((candidate) => candidate.countyId === unit.countyId);
  unit.candidateVotes.find((candidate) => candidate.candidateId === "harris").votes += 1;
  unit.totalVotes += 1;
  county.candidateVotes.find((candidate) => candidate.candidateId === "harris").votes += 1;
  county.totalVotes += 1;
  pa.candidateVotes.find((candidate) => candidate.candidateId === "harris").votes += 1;
  pa.totalVotes += 1;
  clone.content.nationalTotals.find((candidate) => candidate.candidateId === "harris").votes += 1;
  return clone;
}

test("canonical serialization is order-stable, NFC-normalized, and integer-only", () => {
  assert.equal(
    canonicalSerialize({ beta: 2, alpha: "e\u0301" }),
    canonicalSerialize({ alpha: "é", beta: 2 }),
  );
  assert.equal(canonicalSerialize({ negativeZero: -0 }), '{"negativeZero":0}');
  assert.throws(() => canonicalSerialize({ value: 1.5 }), /safe integer/);
  assert.throws(() => canonicalSerialize({ value: undefined }), /unsupported canonical value/);
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => canonicalSerialize(sparse), /sparse array/);
});

test("Pennsylvania certified and complex scenarios lock as exact immutable national endpoints", async () => {
  const baseline = await lockElectionEndpoint(endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE));
  const complex = await lockElectionEndpoint(endpointInput(PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE));
  assert.equal(baseline.content.reconciliation.electoralVotes, 538);
  assert.equal(
    baseline.contentFingerprint,
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.expectedContentFingerprint,
  );
  assert.equal(
    complex.contentFingerprint,
    PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE.expectedContentFingerprint,
  );
  assert.equal(baseline.content.reconciliation.reportingUnitVotes, baseline.content.reconciliation.nationalVotes);
  assert.equal(baseline.content.reconciliation.jurisdictionVotes, baseline.content.reconciliation.nationalVotes);
  assert.equal(baseline.content.jurisdictions.length, 51);
  assert.equal(baseline.content.jurisdictions.find((state) => state.jurisdictionId === "PA").reportingUnits.length, 9140);
  assert.notEqual(complex.contentFingerprint, baseline.contentFingerprint);
  assert.ok(complex.content.nationalTotals.reduce((sum, candidate) => sum + candidate.votes, 0)
    > baseline.content.nationalTotals.reduce((sum, candidate) => sum + candidate.votes, 0));
  assert.equal(Object.isFrozen(baseline), true);
  assert.equal(Object.isFrozen(baseline.content.jurisdictions), true);
});

test("content fingerprints ignore lock time and insertion order but bind election evidence", async () => {
  const firstInput = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  const secondInput = endpointInput(
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
    "2026-08-21T04:30:00.000Z",
  );
  secondInput.metadata.scenarioId = "same-content-second-lock";
  secondInput.metadata.scenarioFingerprint = "different-recipe-same-election-content";
  const first = await lockElectionEndpoint(firstInput);
  const second = await lockElectionEndpoint(secondInput);
  const reordered = await lockElectionEndpoint(reverseEndpointArrays(firstInput));
  assert.equal(first.contentFingerprint, second.contentFingerprint);
  assert.equal(first.contentFingerprint, reordered.contentFingerprint);
  assert.notEqual(first.metadata.createdAt, second.metadata.createdAt);
  assert.notEqual(serializeLockedElectionEndpoint(first), serializeLockedElectionEndpoint(second));

  const changedEvidence = structuredClone(firstInput);
  changedEvidence.content.evidence[0].title += " corrected";
  const evidenceLock = await lockElectionEndpoint(changedEvidence);
  assert.notEqual(evidenceLock.contentFingerprint, first.contentFingerprint);
});

test("changing one fully reconciled candidate vote changes the content fingerprint", async () => {
  const input = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  const baseline = await lockElectionEndpoint(input);
  const changed = await lockElectionEndpoint(addOneHarrisVoteEverywhere(input));
  assert.notEqual(changed.contentFingerprint, baseline.contentFingerprint);
});

test("the locker rejects county corruption, floats, missing candidates, and non-538 allocations", async () => {
  const countyCorruption = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  const pa = countyCorruption.content.jurisdictions.find((state) => state.jurisdictionId === "PA");
  pa.counties[0].candidateVotes[0].votes += 1;
  pa.counties[0].totalVotes += 1;
  await assert.rejects(lockElectionEndpoint(countyCorruption), /county .* does not reconcile/);

  const floatingVote = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  floatingVote.content.jurisdictions[0].reportingUnits[0].candidateVotes[0].votes = 1.5;
  await assert.rejects(lockElectionEndpoint(floatingVote), /safe integer/);

  const missingCandidate = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  missingCandidate.content.jurisdictions[0].reportingUnits[0].candidateVotes.pop();
  await assert.rejects(lockElectionEndpoint(missingCandidate), /every endpoint candidate exactly once/);

  const invalidElectoralCollege = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  const allocation = invalidElectoralCollege.content.electoralAllocation[0];
  const jurisdiction = invalidElectoralCollege.content.jurisdictions.find(
    (state) => state.jurisdictionId === allocation.jurisdictionId,
  );
  allocation.electoralVotes -= 1;
  jurisdiction.electoralVotes -= 1;
  await assert.rejects(lockElectionEndpoint(invalidElectoralCollege), /must total 538/);
});

test("locked endpoint serialization round-trips and the fingerprint excludes itself", async () => {
  const endpoint = await lockElectionEndpoint(endpointInput(PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE));
  const serialized = serializeLockedElectionEndpoint(endpoint);
  const restored = await deserializeLockedElectionEndpoint(serialized);
  assert.equal(serializeLockedElectionEndpoint(restored), serialized);
  const expectedFingerprint = await sha256Fingerprint(
    canonicalSerializeEndpointContent(endpoint.content),
  );
  assert.equal(endpoint.contentFingerprint, expectedFingerprint);

  const tampered = JSON.parse(serialized);
  tampered.contentFingerprint = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    deserializeLockedElectionEndpoint(JSON.stringify(tampered)),
    /fingerprint mismatch/,
  );

  const tamperedReconciliation = JSON.parse(serialized);
  tamperedReconciliation.content.reconciliation.nationalVotes += 1;
  await assert.rejects(
    deserializeLockedElectionEndpoint(JSON.stringify(tamperedReconciliation)),
    /reconciliation nationalVotes mismatch/,
  );
});

test("candidate vectors retain deterministic complete ordering after round-trip", async () => {
  const endpoint = await lockElectionEndpoint(
    reverseEndpointArrays(endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE)),
  );
  const expected = ["harris", "oliver", "other-residual", "stein", "trump"];
  assert.deepEqual(endpoint.content.candidates.map((candidate) => candidate.id), expected);
  assert.deepEqual(endpoint.content.nationalTotals.map((candidate) => candidate.candidateId), expected);
  for (const jurisdiction of endpoint.content.jurisdictions) {
    assert.deepEqual(jurisdiction.candidateVotes.map((candidate) => candidate.candidateId), expected);
  }
});

test("named replay streams have versioned stable seeds and independent namespaces", async () => {
  assert.equal(REPLAY_PRNG_VERSION, "rme-prng-sha256-xoshiro128ss-v1");
  const paSeed = await deriveNamedReplayStreamSeed(
    "supervisor-fixture-seed",
    "activation/state/PA",
    "state-wave",
  );
  const repeated = await deriveNamedReplayStreamSeed(
    "supervisor-fixture-seed",
    "activation/state/PA",
    "state-wave",
  );
  const miSeed = await deriveNamedReplayStreamSeed(
    "supervisor-fixture-seed",
    "activation/state/MI",
    "state-wave",
  );
  assert.equal(paSeed.seedHex, repeated.seedHex);
  assert.equal(paSeed.seedHex, "7c535ba97c57290caf4308faca279826");
  assert.notEqual(paSeed.seedHex, miSeed.seedHex);
  const stream = await createNamedReplayRandomStream(
    "supervisor-fixture-seed",
    "activation/state/PA",
    "state-wave",
  );
  const values = [stream.nextUint32(), stream.nextUint32(), stream.nextUint32()];
  assert.deepEqual(values, [2837155814, 3359726438, 1783370652]);
});

test("canonical event identity is independent of sequence and replay time", async () => {
  const identity = {
    replaySchemaVersion: REPLAY_SCHEMA_VERSION,
    jurisdictionId: "PA",
    unitId: "vtd-42001000100",
    eventType: "RETURN_PUBLISHED",
    batchOrdinal: 2,
  };
  const first = await deriveReplayEventId(identity);
  const sameIdentityAtAnotherPosition = await deriveReplayEventId({ ...identity });
  const nextBatch = await deriveReplayEventId({ ...identity, batchOrdinal: 3 });
  assert.equal(first, sameIdentityAtAnotherPosition);
  assert.equal(first, "event:de849938994aa9a085c03f83eb282fdd13559a883576f25d3c0a15d4d94d772a");
  assert.notEqual(first, nextBatch);
});

test("the pure replay package contains no UI dependency or canonical Math.random use", () => {
  const packageDirectory = new URL("../packages/election-replay/src/", import.meta.url);
  for (const file of readdirSync(packageDirectory).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(new URL(file, packageDirectory), "utf8");
    assert.doesNotMatch(source, /from ["']react|from ["']@deck\.gl|Math\.random\s*\(/);
  }
});
