import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  auditPennsylvaniaEventStream,
  compilePennsylvaniaEventStream,
  lockElectionEndpoint,
  normalizeXoshiro128State,
  schedulePennsylvaniaReportingUnits,
  serializeCompiledPennsylvaniaReplay,
  serializeLockedElectionEndpoint,
  XOSHIRO128_ALL_ZERO_FALLBACK,
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
  PENNSYLVANIA_REPLAY_DEFINITION,
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
  return clone;
}

function pa(endpoint) {
  return endpoint.content.jurisdictions.find(
    (jurisdiction) => jurisdiction.jurisdictionId === "PA",
  );
}

function scheduleInputs(endpoint) {
  const jurisdiction = pa(endpoint);
  return {
    counties: jurisdiction.counties.map((county) => ({
      countyId: county.countyId,
      totalVotes: county.totalVotes,
      unitCount: jurisdiction.reportingUnits.filter(
        (unit) => unit.countyId === county.countyId,
      ).length,
    })),
    units: jurisdiction.reportingUnits.map((unit) => ({
      unitId: unit.unitId,
      countyId: unit.countyId,
      unitType: unit.unitType,
      totalVotes: unit.totalVotes,
    })),
  };
}

const baselineEndpointPromise = lockElectionEndpoint(
  endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE),
);
const complexEndpointPromise = lockElectionEndpoint(
  endpointInput(PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE),
);
const baselineStreamPromise = baselineEndpointPromise.then((endpoint) => (
  compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION)
));
const complexStreamPromise = complexEndpointPromise.then((endpoint) => (
  compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION)
));

test("the xoshiro128 all-zero state has an explicit fallback without changing nonzero states", () => {
  assert.deepEqual(normalizeXoshiro128State([0, 0, 0, 0]), XOSHIRO128_ALL_ZERO_FALLBACK);
  assert.deepEqual(normalizeXoshiro128State([1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.throws(() => normalizeXoshiro128State([0, 0, 0]), /four unsigned/);
});

test("same endpoint, definition, and seed compile byte-identically", async () => {
  const endpoint = await baselineEndpointPromise;
  const first = await baselineStreamPromise;
  const repeated = await compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION);
  assert.equal(serializeCompiledPennsylvaniaReplay(repeated), serializeCompiledPennsylvaniaReplay(first));
  assert.equal(first.eventStreamFingerprint, PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.expectedEventStreamFingerprint);
  assert.equal(first.events.length, pa(endpoint).reportingUnits.length + 2);
});

test("lock time, scenario metadata, and collection order do not perturb compilation", async () => {
  const changed = reverseEndpointArrays(endpointInput(
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
    "2026-08-21T12:34:56.000Z",
  ));
  changed.metadata.scenarioId = "metadata-must-not-drive-replay";
  changed.metadata.scenarioFingerprint = "metadata-must-not-drive-replay-either";
  const endpoint = await lockElectionEndpoint(changed);
  const stream = await compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION);
  assert.equal(endpoint.contentFingerprint, PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.expectedContentFingerprint);
  assert.equal(
    serializeCompiledPennsylvaniaReplay(stream),
    serializeCompiledPennsylvaniaReplay(await baselineStreamPromise),
  );
});

test("a different seed may reschedule returns but preserves identities and exact final votes", async () => {
  const endpoint = await baselineEndpointPromise;
  const first = await baselineStreamPromise;
  const rescheduled = await compilePennsylvaniaEventStream(endpoint, {
    ...PENNSYLVANIA_REPLAY_DEFINITION,
    rootSeed: "supervisor-pa-compiler-alternate-seed-v1",
  });
  const firstReturns = new Map(first.events.filter((event) => event.unitId).map((event) => [event.unitId, event]));
  const secondReturns = new Map(rescheduled.events.filter((event) => event.unitId).map((event) => [event.unitId, event]));
  assert.equal(secondReturns.size, firstReturns.size);
  assert.ok([...firstReturns].some(([unitId, event]) => (
    secondReturns.get(unitId).replayTimeMs !== event.replayTimeMs
  )));
  for (const [unitId, event] of firstReturns) {
    assert.equal(secondReturns.get(unitId).eventId, event.eventId);
    assert.deepEqual(secondReturns.get(unitId).candidateDelta, event.candidateDelta);
  }
  const audit = await auditPennsylvaniaEventStream(endpoint, rescheduled);
  assert.deepEqual(audit.finalCandidateTotals, pa(endpoint).candidateVotes);
  assert.equal(audit.finalTotalVotes, pa(endpoint).totalVotes);
});

test("the metropolitan-late profile changes only the schedule and still reaches the endpoint", async () => {
  const endpoint = await baselineEndpointPromise;
  const rural = await baselineStreamPromise;
  const metropolitan = await compilePennsylvaniaEventStream(endpoint, {
    ...PENNSYLVANIA_REPLAY_DEFINITION,
    profileId: "pa-synthetic-metropolitan-late-v1",
  });
  const ruralReturns = new Map(rural.events.filter((event) => event.unitId).map((event) => [event.unitId, event]));
  const metropolitanReturns = new Map(
    metropolitan.events.filter((event) => event.unitId).map((event) => [event.unitId, event]),
  );
  assert.ok([...ruralReturns].some(([unitId, event]) => (
    metropolitanReturns.get(unitId).replayTimeMs !== event.replayTimeMs
  )));
  for (const [unitId, event] of ruralReturns) {
    assert.equal(metropolitanReturns.get(unitId).eventId, event.eventId);
    assert.deepEqual(metropolitanReturns.get(unitId).candidateDelta, event.candidateDelta);
  }
  const audit = await auditPennsylvaniaEventStream(endpoint, metropolitan);
  assert.deepEqual(audit.finalCandidateTotals, pa(endpoint).candidateVotes);
});

test("scheduler is candidate-blind, input-order stable, and rejects malformed workloads", async () => {
  const endpoint = await baselineEndpointPromise;
  const input = scheduleInputs(endpoint);
  const harrisLabeled = input.units.map((unit) => ({
    ...unit,
    winner: "harris",
    candidateVotes: [{ candidateId: "harris", votes: unit.totalVotes }],
  }));
  const trumpLabeled = [...input.units].reverse().map((unit) => ({
    ...unit,
    winner: "trump",
    candidateVotes: [{ candidateId: "trump", votes: unit.totalVotes }],
  }));
  const first = await schedulePennsylvaniaReportingUnits(
    harrisLabeled,
    input.counties,
    PENNSYLVANIA_REPLAY_DEFINITION,
  );
  const second = await schedulePennsylvaniaReportingUnits(
    trumpLabeled,
    [...input.counties].reverse(),
    PENNSYLVANIA_REPLAY_DEFINITION,
  );
  assert.deepEqual(second, first);

  await assert.rejects(schedulePennsylvaniaReportingUnits(
    [{ ...input.units[0], unitType: "invented-subunit" }],
    [{ ...input.counties[0], unitCount: 1, totalVotes: input.units[0].totalVotes }],
    PENNSYLVANIA_REPLAY_DEFINITION,
  ), /unsupported type/);
  await assert.rejects(schedulePennsylvaniaReportingUnits(
    input.units.slice(0, 1),
    [{ ...input.counties[0], unitCount: 2 }],
    PENNSYLVANIA_REPLAY_DEFINITION,
  ), /unit count does not reconcile/);
});

test("both golden endpoint fixtures conserve every unit, county, candidate, and residual", async () => {
  for (const [fixture, endpoint, stream] of [
    [PENNSYLVANIA_BASELINE_REPLAY_FIXTURE, await baselineEndpointPromise, await baselineStreamPromise],
    [PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE, await complexEndpointPromise, await complexStreamPromise],
  ]) {
    assert.equal(stream.eventStreamFingerprint, fixture.expectedEventStreamFingerprint);
    const jurisdiction = pa(endpoint);
    const audit = await auditPennsylvaniaEventStream(endpoint, stream);
    assert.equal(audit.returnEventCount, jurisdiction.reportingUnits.length);
    assert.equal(audit.controlEventCount, 2);
    assert.equal(audit.countyCount, jurisdiction.counties.length);
    assert.equal(audit.reportingUnitCount, jurisdiction.reportingUnits.length);
    assert.equal(audit.finalCandidateTotals.length, 5);
    assert.deepEqual(audit.finalCandidateTotals, jurisdiction.candidateVotes);
    assert.equal(audit.finalTotalVotes, jurisdiction.totalVotes);

    const expectedOffMap = jurisdiction.reportingUnits.filter(
      (unit) => unit.geometryStatus === "off-map" || unit.geometryStatus === "none",
    );
    assert.ok(expectedOffMap.length > 0);
    assert.ok(expectedOffMap.some((unit) => unit.unitType === "residual"));
    assert.equal(audit.offMapReturnCount, expectedOffMap.length);
    assert.equal(audit.offMapVotes, expectedOffMap.reduce((sum, unit) => sum + unit.totalVotes, 0));
    assert.ok(stream.events.filter((event) => event.unitId).every((event) => event.batchOrdinal === 0));
  }
});

test("every prefix is nonnegative, integral, and bounded by the locked five-candidate endpoint", async () => {
  const endpoint = await complexEndpointPromise;
  const stream = await complexStreamPromise;
  const locked = new Map(pa(endpoint).candidateVotes.map((candidate) => [candidate.candidateId, candidate.votes]));
  const reported = new Map([...locked.keys()].map((candidateId) => [candidateId, 0]));
  const identities = new Set();
  for (const event of stream.events) {
    assert.equal(identities.has(event.eventId), false);
    identities.add(event.eventId);
    assert.ok(Number.isSafeInteger(event.totalDelta) && event.totalDelta >= 0);
    for (const candidate of event.candidateDelta ?? []) {
      assert.ok(Number.isSafeInteger(candidate.votes) && candidate.votes >= 0);
      const next = reported.get(candidate.candidateId) + candidate.votes;
      assert.ok(next <= locked.get(candidate.candidateId));
      reported.set(candidate.candidateId, next);
    }
  }
  assert.deepEqual(
    [...reported],
    pa(endpoint).candidateVotes.map((candidate) => [candidate.candidateId, candidate.votes]),
  );
});

test("compilation fails closed and never mutates a locked endpoint", async () => {
  const endpoint = await baselineEndpointPromise;
  const before = serializeLockedElectionEndpoint(endpoint);
  await compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION);
  assert.equal(serializeLockedElectionEndpoint(endpoint), before);

  const tampered = structuredClone(endpoint);
  tampered.contentFingerprint = `sha256:${"0".repeat(64)}`;
  await assert.rejects(
    compilePennsylvaniaEventStream(tampered, PENNSYLVANIA_REPLAY_DEFINITION),
    /fingerprint mismatch/,
  );
  await assert.rejects(
    compilePennsylvaniaEventStream({}, PENNSYLVANIA_REPLAY_DEFINITION),
  );
  await assert.rejects(
    compilePennsylvaniaEventStream(endpoint, { ...PENNSYLVANIA_REPLAY_DEFINITION, rootSeed: "" }),
    /root seed cannot be empty/i,
  );
});

test("compiled identity excludes replay time and sequence, and tampered streams fail audit", async () => {
  const endpoint = await baselineEndpointPromise;
  const stream = await baselineStreamPromise;
  const returnEvent = stream.events.find((event) => event.eventType === "RETURN_PUBLISHED");
  const tampered = structuredClone(stream);
  const target = tampered.events.find((event) => event.eventId === returnEvent.eventId);
  target.replayTimeMs += 1;
  target.sequence += 100;
  assert.equal(target.eventId, returnEvent.eventId);
  await assert.rejects(auditPennsylvaniaEventStream(endpoint, tampered), /fingerprint mismatch/);
});

test("the compiler package remains headless and contains no nondeterministic random call", () => {
  const packageDirectory = new URL("../packages/election-replay/src/", import.meta.url);
  for (const file of readdirSync(packageDirectory).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(new URL(file, packageDirectory), "utf8");
    assert.doesNotMatch(source, /from ["']react|from ["']@deck\.gl|Math\.random\s*\(/);
  }
  const compilerSource = readFileSync(
    new URL("../packages/election-replay/src/pennsylvaniaCompiler.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(compilerSource, /finalWinner|lead change|decision desk|called for/i);
  assert.match(compilerSource, /activation\/county\//);
  assert.match(compilerSource, /timing\/unit\//);
  assert.match(compilerSource, /timing\/statewide-residual\//);
});
