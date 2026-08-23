import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYTIC_DEFINITIONS,
  buildBehaviorOperationAnalyticEnvelopes,
  buildContributionAnalyticEnvelope,
  buildElectoralConsequenceAnalyticEnvelope,
  buildEndpointAnalyticEnvelopes,
  buildProgressAnalyticEnvelopes,
  buildReportedAnalyticEnvelopes,
  createAnalyticCollection,
  createAnalyticEnvelope,
  createRatioAnalyticEnvelope,
  deserializeFingerprintedAnalyticCollection,
  fingerprintAnalyticCollection,
  serializeAnalyticCollection,
  serializeFingerprintedAnalyticCollection,
} from "../packages/election-analytics/src/index.ts";
import { deriveReportedVoteAnalytics } from "../packages/election-replay/src/reportedAnalytics.ts";

const sources = ["sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "source:certified"];

const endpoints = [
  { code: "PA", totalVotes: 100, harrisVotes: 48, trumpVotes: 49, otherVotes: 3, harrisElectoralVotes: 0, trumpElectoralVotes: 19 },
  { code: "MI", totalVotes: 200, harrisVotes: 99, trumpVotes: 96, otherVotes: 5, harrisElectoralVotes: 15, trumpElectoralVotes: 0 },
  { code: "WI", totalVotes: 150, harrisVotes: 72, trumpVotes: 75, otherVotes: 3, harrisElectoralVotes: 0, trumpElectoralVotes: 10 },
];

const prefix = deriveReportedVoteAnalytics({
  candidateVotes: [
    { candidateId: "harris", votes: 40 },
    { candidateId: "trump", votes: 35 },
    { candidateId: "stein", votes: 2 },
    { candidateId: "oliver", votes: 1 },
    { candidateId: "other-residual", votes: 2 },
  ],
  totalVotes: 80,
  returnsPublished: 3,
});

test("registry admits only explicit evidence-graded analytic definitions", () => {
  assert.equal(ANALYTIC_DEFINITIONS.length, 20);
  assert.equal(new Set(ANALYTIC_DEFINITIONS.map((definition) => definition.id)).size, 20);
  assert.equal(Object.isFrozen(ANALYTIC_DEFINITIONS), true);
  assert.deepEqual(
    [...new Set(ANALYTIC_DEFINITIONS.map((definition) => definition.semanticClass))].sort(),
    ["certified", "derived", "reported", "scenario"],
  );
  assert.equal(ANALYTIC_DEFINITIONS.some((definition) => /probability|confidence|call|bellwether/.test(definition.id)), false);
});

test("certified and scenario endpoints reconcile independently and across PA, MI, and WI", () => {
  for (const semanticClass of ["certified", "scenario"]) {
    const analytics = endpoints.flatMap((endpoint) => buildEndpointAnalyticEnvelopes(
      semanticClass,
      endpoint,
      { sourceIds: sources },
    ));
    const collection = createAnalyticCollection(analytics);
    assert.equal(collection.analytics.length, 15);
    for (const endpoint of endpoints) {
      const state = collection.analytics.filter((analytic) => analytic.geography.id === endpoint.code);
      const total = state.find((analytic) => analytic.definitionId === `${semanticClass}.total-ballots`);
      const candidateVotes = state
        .filter((analytic) => analytic.definitionId === `${semanticClass}.candidate-votes`)
        .reduce((sum, analytic) => sum + analytic.value, 0);
      assert.equal(total.value, endpoint.totalVotes);
      assert.equal(candidateVotes, endpoint.totalVotes);
    }
    assert.equal(
      collection.analytics
        .filter((analytic) => analytic.definitionId === `${semanticClass}.total-ballots`)
        .reduce((sum, analytic) => sum + analytic.value, 0),
      450,
    );
  }
});

test("operation envelopes preserve requested versus realized movement and signed direction", () => {
  const behavior = {
    units: [],
    totals: { harrisVotes: 0, trumpVotes: 0, steinVotes: 0, oliverVotes: 0, residualOtherVotes: 0, otherVotes: 0, totalVotes: 0 },
    turnout: { requestedVotes: 1200, addedVotes: 1050, harrisVotes: 630, trumpVotes: 420, denominator: 80000, capacity: 1050 },
    preference: { requestedTransfer: -400, realizedTransfer: -390 },
    thirdParty: {
      candidate: "stein",
      startingCandidateVotes: 800,
      exchangeCapacity: 500,
      ballotTotal: 100000,
      requestedCandidateDelta: -300,
      realizedCandidateDelta: -280,
      harrisVoteDelta: 168,
      trumpVoteDelta: 112,
    },
  };
  const analytics = buildBehaviorOperationAnalyticEnvelopes("PA", behavior, { sourceIds: sources });
  const values = Object.fromEntries(analytics.map((analytic) => [analytic.definitionId, analytic.value]));
  assert.equal(values["scenario.turnout-requested-ballots"], 1200);
  assert.equal(values["scenario.turnout-realized-ballots"], 1050);
  assert.equal(values["scenario.preference-requested-transfers"], -400);
  assert.equal(values["scenario.preference-realized-transfers"], -390);
  assert.equal(values["scenario.third-party-requested-exchanges"], -300);
  assert.equal(values["scenario.third-party-realized-exchanges"], -280);
  assert.deepEqual(
    analytics.find((analytic) => analytic.definitionId === "scenario.third-party-realized-exchanges").candidateScope,
    ["harris", "stein", "trump"],
  );
});

test("geographic contributions and Electoral College consequences retain sign and residual identity", () => {
  const mapped = buildContributionAnalyticEnvelope("PA", {
    id: "unit-1",
    countyFips: "42003",
    geometryId: "vtd-1",
    harrisDelta: 20,
    trumpDelta: -10,
    otherDelta: 0,
    ballotDelta: 10,
    marginDelta: 30,
  }, { sourceIds: sources });
  const residual = buildContributionAnalyticEnvelope("PA", {
    id: "residual-1",
    countyFips: null,
    geometryId: null,
    harrisDelta: -4,
    trumpDelta: 6,
    otherDelta: 0,
    ballotDelta: 2,
    marginDelta: -10,
  }, { sourceIds: sources });
  const electoral = buildElectoralConsequenceAnalyticEnvelope("harris", 19, { sourceIds: sources });
  assert.equal(mapped.value, 30);
  assert.equal(mapped.geography.level, "reporting-unit");
  assert.equal(residual.value, -10);
  assert.match(residual.geography.id, /residual/);
  assert.match(residual.caveat, /outside the mapped geography/);
  assert.equal(electoral.value, 19);
  assert.deepEqual(electoral.candidateScope, ["harris"]);
});

test("reported envelopes contain only current-prefix arithmetic", () => {
  const first = buildReportedAnalyticEnvelopes(prefix, { level: "state", id: "PA" }, { sourceIds: ["prefix:same"] });
  const second = buildReportedAnalyticEnvelopes(prefix, { level: "state", id: "PA" }, { sourceIds: ["prefix:same"] });
  assert.equal(serializeAnalyticCollection(createAnalyticCollection(first)), serializeAnalyticCollection(createAnalyticCollection(second)));
  assert.equal(first.find((analytic) => analytic.definitionId === "reported.total-ballots").value, 80);
  assert.equal(first.find((analytic) => analytic.definitionId === "reported.harris-trump-margin-votes").value, 5);
  const serialized = serializeAnalyticCollection(createAnalyticCollection(first));
  assert.equal(/winner|final|outstanding|probability|confidence/.test(serialized), false);
  assert.equal(serialized.includes("Current replay prefix only"), true);
});

test("zero progress remains available while a missing denominator remains unavailable", () => {
  const zeroPrefix = deriveReportedVoteAnalytics({
    candidateVotes: ["harris", "trump", "stein", "oliver", "other-residual"].map((candidateId) => ({ candidateId, votes: 0 })),
    totalVotes: 0,
    returnsPublished: 0,
  });
  const known = buildProgressAnalyticEnvelopes(
    zeroPrefix,
    { returns: 10, ballots: 1000 },
    { level: "state", id: "PA" },
    { sourceIds: ["progress:known"] },
  );
  assert.deepEqual(known.map((analytic) => [analytic.status, analytic.value]), [["available", 0], ["available", 0]]);

  const missing = buildProgressAnalyticEnvelopes(
    zeroPrefix,
    { returns: null, ballots: null },
    { level: "state", id: "PA" },
    { sourceIds: ["progress:missing"] },
  );
  assert.deepEqual(missing.map((analytic) => [analytic.status, analytic.value]), [["unavailable", null], ["unavailable", null]]);
});

test("progress ratios carry explicit denominators and reject impossible prefixes", () => {
  const progress = buildProgressAnalyticEnvelopes(
    prefix,
    { returns: 4, ballots: 100 },
    { level: "state", id: "PA" },
    { sourceIds: ["progress:test"] },
  );
  assert.equal(progress[0].value, 750000);
  assert.equal(progress[0].numerator.value, 3);
  assert.equal(progress[0].denominator.value, 4);
  assert.equal(progress[1].value, 800000);
  assert.throws(() => buildProgressAnalyticEnvelopes(
    prefix,
    { returns: 2, ballots: 79 },
    { level: "state", id: "PA" },
    { sourceIds: ["progress:invalid"] },
  ), /cannot exceed/);

  const maximumSafeRatio = createRatioAnalyticEnvelope({
    definitionId: "derived.return-progress-ppm",
    numerator: { label: "published", value: Number.MAX_SAFE_INTEGER, unit: "returns" },
    denominator: { label: "expected", value: Number.MAX_SAFE_INTEGER, unit: "returns" },
    geography: { level: "state", id: "PA" },
    candidateScope: ["all-candidates"],
    sourceIds: ["source:maximum-safe-ratio"],
    transformVersion: "test-v1",
  });
  assert.equal(maximumSafeRatio.value, 1_000_000);
});

test("collection serialization and fingerprints are input-order independent and tamper-evident", async () => {
  const analytics = buildEndpointAnalyticEnvelopes("certified", endpoints[0], { sourceIds: [...sources].reverse() });
  const forward = await fingerprintAnalyticCollection(analytics);
  const reverse = await fingerprintAnalyticCollection([...analytics].reverse());
  assert.equal(forward.fingerprint, reverse.fingerprint);
  assert.equal(serializeFingerprintedAnalyticCollection(forward), serializeFingerprintedAnalyticCollection(reverse));
  const restored = await deserializeFingerprintedAnalyticCollection(serializeFingerprintedAnalyticCollection(forward));
  assert.equal(restored.fingerprint, forward.fingerprint);

  const tampered = JSON.parse(serializeFingerprintedAnalyticCollection(forward));
  tampered.collection.analytics[0].value += 1;
  await assert.rejects(
    deserializeFingerprintedAnalyticCollection(JSON.stringify(tampered)),
    /fingerprint or content is invalid/,
  );
});

test("invalid values, candidate scopes, sources, ratios, and duplicate identities fail closed", () => {
  const base = {
    definitionId: "certified.total-ballots",
    value: 1,
    geography: { level: "state", id: "PA" },
    candidateScope: ["all-candidates"],
    sourceIds: ["source:one"],
    transformVersion: "test-v1",
  };
  assert.throws(() => createAnalyticEnvelope({ ...base, value: 1.5 }), /safe integer/);
  assert.throws(() => createAnalyticEnvelope({ ...base, candidateScope: ["harris"] }), /all-candidates/);
  assert.throws(() => createAnalyticEnvelope({ ...base, sourceIds: ["source:one", "source:one"] }), /duplicates/);
  assert.throws(() => createAnalyticEnvelope({ ...base, status: "invented" }), /availability is invalid/);
  assert.throws(() => createAnalyticEnvelope({ ...base, geography: { level: "planet", id: "PA" } }), /geography level is invalid/);
  assert.throws(() => createRatioAnalyticEnvelope({
    definitionId: "derived.return-progress-ppm",
    geography: { level: "state", id: "PA" },
    candidateScope: ["all-candidates"],
    sourceIds: ["source:one"],
    transformVersion: "test-v1",
    numerator: { label: "returns", value: 1, unit: "returns" },
    denominator: { label: "expected", value: 0, unit: "returns" },
  }), /positive/);
  assert.throws(() => createRatioAnalyticEnvelope({
    definitionId: "derived.return-progress-ppm",
    geography: { level: "state", id: "PA" },
    candidateScope: ["all-candidates"],
    sourceIds: ["source:one"],
    transformVersion: "test-v1",
    numerator: { label: "returns", value: 1, unit: "returns" },
    denominator: { label: "expected ballots", value: 2, unit: "ballots" },
  }), /must use returns/);
  const analytic = createAnalyticEnvelope(base);
  assert.throws(() => createAnalyticCollection([analytic, analytic]), /Duplicate analytic identity/);
  assert.throws(() => createAnalyticCollection([]), /must not be empty/);
});

test("the analytics package stays headless and deterministic", async () => {
  const files = ["registry.ts", "contracts.ts", "builders.ts", "index.ts"];
  const source = (await Promise.all(files.map((file) => readFile(
    new URL(`../packages/election-analytics/src/${file}`, import.meta.url),
    "utf8",
  )))).join("\n");
  assert.equal(/react|deck\.gl|babylon|echarts/i.test(source), false);
  assert.equal(source.includes("Math.random"), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("setTimeout"), false);
  assert.equal(source.includes("setInterval"), false);
});
