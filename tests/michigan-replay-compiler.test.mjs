import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  admitCompiledJurisdictionReplay,
  auditCompiledJurisdictionReplay,
  auditMichiganEventStream,
  compileMichiganEventStream,
  compilePennsylvaniaEventStream,
  composeJurisdictionReplays,
  deriveNamedReplayStreamSeed,
  deserializeCompiledJurisdictionReplay,
  lockElectionEndpoint,
  MICHIGAN_REPLAY_CAPABILITY,
  MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
  MICHIGAN_REPLAY_TIME_ZONE,
  scheduleMichiganReportingUnits,
  serializeCompiledJurisdictionReplay,
  serializeCompiledMichiganReplay,
} from "../packages/election-replay/src/index.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "../src/data/miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import {
  createStateScenarioRecipe,
  stateScenarioRecipeFingerprint,
} from "../src/data/scenarioPortfolio.ts";
import { buildMichiganElectionEndpointInput } from "../src/replay/michiganEndpoint.ts";
import { buildPennsylvaniaElectionEndpointInput } from "../src/replay/pennsylvaniaEndpoint.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import {
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_REPLAY_DEFINITION,
} from "./replay-fixtures/michigan-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_REPLAY_DEFINITION,
} from "./replay-fixtures/pennsylvania-endpoints.mjs";

const michiganDocument = JSON.parse(readFileSync(
  new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url),
  "utf8",
));
const pennsylvaniaDocument = JSON.parse(readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
  "utf8",
));
const michiganFoundation = decodeMichiganDemographicFoundation(michiganDocument);
const pennsylvaniaFoundation = decodePennsylvaniaDemographicFoundation(pennsylvaniaDocument);
const michiganBaselineUnits = toMichiganBehaviorModelUnits(michiganFoundation);
const pennsylvaniaBaselineUnits = toBehaviorModelUnits(pennsylvaniaFoundation);

const PA_CAPABILITY = Object.freeze({
  kind: "detailed",
  sourceUnitLabel: "2024 Pennsylvania election reporting unit",
  mapUnitLabel: "2020 Census VTD terrain",
  residualTreatment: "explicit-off-map",
  methodologyNote: "2024 reporting units are linked to 2020 Census VTD terrain; unmatched units remain explicit off-map returns.",
});

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

function scenario(units, settings) {
  return applyBehaviorScenario(units, settings);
}

function michiganEndpointInput(fixture, createdAt = fixture.createdAt) {
  const result = scenario(michiganBaselineUnits, fixture.settings);
  const recipe = createStateScenarioRecipe("MI", recipeSettings(fixture.settings));
  return buildMichiganElectionEndpointInput({
    foundation: michiganFoundation,
    scenario: result,
    scenarioId: fixture.scenarioId,
    scenarioFingerprint: stateScenarioRecipeFingerprint(recipe),
    createdAt,
  });
}

function pennsylvaniaEndpointInput(fixture) {
  const result = scenario(pennsylvaniaBaselineUnits, fixture.settings);
  const recipe = createStateScenarioRecipe("PA", recipeSettings(fixture.settings));
  return buildPennsylvaniaElectionEndpointInput({
    foundation: pennsylvaniaFoundation,
    scenario: result,
    scenarioId: fixture.scenarioId,
    scenarioFingerprint: stateScenarioRecipeFingerprint(recipe),
    createdAt: fixture.createdAt,
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

function jurisdiction(endpoint, id) {
  return endpoint.content.jurisdictions.find((candidate) => candidate.jurisdictionId === id);
}

function scheduleInputs(endpoint) {
  const michigan = jurisdiction(endpoint, "MI");
  return {
    counties: michigan.counties.map((county) => ({
      countyId: county.countyId,
      totalVotes: county.totalVotes,
      unitCount: michigan.reportingUnits.filter((unit) => unit.countyId === county.countyId).length,
    })),
    units: michigan.reportingUnits.map((unit) => ({
      unitId: unit.unitId,
      countyId: unit.countyId,
      unitType: unit.unitType,
      totalVotes: unit.totalVotes,
    })),
  };
}

function sumVectors(vectors, candidateIds) {
  const totals = new Map(candidateIds.map((id) => [id, 0]));
  for (const vector of vectors) {
    for (const candidate of vector) {
      totals.set(candidate.candidateId, totals.get(candidate.candidateId) + candidate.votes);
    }
  }
  return candidateIds.map((candidateId) => ({ candidateId, votes: totals.get(candidateId) }));
}

const baselineEndpointPromise = lockElectionEndpoint(
  michiganEndpointInput(MICHIGAN_BASELINE_REPLAY_FIXTURE),
);
const complexEndpointPromise = lockElectionEndpoint(
  michiganEndpointInput(MICHIGAN_COMPLEX_REPLAY_FIXTURE),
);
const baselineStreamPromise = baselineEndpointPromise.then((endpoint) => (
  compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION)
));
const complexStreamPromise = complexEndpointPromise.then((endpoint) => (
  compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION)
));

test("Michigan certified and complex endpoint goldens lock deterministically", async () => {
  const baseline = await baselineEndpointPromise;
  const complex = await complexEndpointPromise;
  assert.equal(baseline.contentFingerprint, MICHIGAN_BASELINE_REPLAY_FIXTURE.expectedContentFingerprint);
  assert.equal(complex.contentFingerprint, MICHIGAN_COMPLEX_REPLAY_FIXTURE.expectedContentFingerprint);
  assert.notEqual(baseline.contentFingerprint, complex.contentFingerprint);
  assert.equal(jurisdiction(baseline, "MI").reportingUnits.length, 4_413);
  assert.equal(jurisdiction(baseline, "MI").counties.length, 83);
});

test("Michigan golden streams are byte-identical and preserve Pennsylvania goldens", async () => {
  const endpoint = await baselineEndpointPromise;
  const first = await baselineStreamPromise;
  const repeated = await compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION);
  assert.equal(serializeCompiledMichiganReplay(repeated), serializeCompiledMichiganReplay(first));
  assert.equal(first.eventStreamFingerprint, MICHIGAN_BASELINE_REPLAY_FIXTURE.expectedEventStreamFingerprint);
  assert.equal(
    (await complexStreamPromise).eventStreamFingerprint,
    MICHIGAN_COMPLEX_REPLAY_FIXTURE.expectedEventStreamFingerprint,
  );
  const [paBaselineEndpoint, paComplexEndpoint] = await Promise.all([
    lockElectionEndpoint(pennsylvaniaEndpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE)),
    lockElectionEndpoint(pennsylvaniaEndpointInput(PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE)),
  ]);
  const [paBaseline, paComplex] = await Promise.all([
    compilePennsylvaniaEventStream(paBaselineEndpoint, PENNSYLVANIA_REPLAY_DEFINITION),
    compilePennsylvaniaEventStream(paComplexEndpoint, PENNSYLVANIA_REPLAY_DEFINITION),
  ]);
  assert.equal(paBaseline.eventStreamFingerprint, "sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c");
  assert.equal(paComplex.eventStreamFingerprint, "sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8");
});

test("lock metadata and input collection ordering do not change Michigan content or compilation", async () => {
  const input = reverseEndpointArrays(michiganEndpointInput(
    MICHIGAN_BASELINE_REPLAY_FIXTURE,
    "2026-08-21T19:45:00.000Z",
  ));
  input.metadata.scenarioId = "metadata-is-not-content";
  input.metadata.scenarioFingerprint = "metadata-is-not-scheduling-input";
  const endpoint = await lockElectionEndpoint(input);
  const stream = await compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION);
  assert.equal(endpoint.contentFingerprint, MICHIGAN_BASELINE_REPLAY_FIXTURE.expectedContentFingerprint);
  assert.equal(serializeCompiledMichiganReplay(stream), serializeCompiledMichiganReplay(await baselineStreamPromise));
});

test("seed and profile may alter only timing while event identities and votes stay fixed", async () => {
  const endpoint = await baselineEndpointPromise;
  const original = await baselineStreamPromise;
  const alternateSeed = await compileMichiganEventStream(endpoint, {
    ...MICHIGAN_REPLAY_DEFINITION,
    rootSeed: "supervisor-mi-compiler-alternate-seed-v1",
  });
  const alternateProfile = await compileMichiganEventStream(endpoint, {
    ...MICHIGAN_REPLAY_DEFINITION,
    profileId: "mi-synthetic-metropolitan-late-v1",
  });
  const originalReturns = new Map(original.events.filter((event) => event.unitId).map((event) => [event.unitId, event]));
  for (const candidateStream of [alternateSeed, alternateProfile]) {
    const returns = new Map(candidateStream.events.filter((event) => event.unitId).map((event) => [event.unitId, event]));
    assert.ok([...originalReturns].some(([unitId, event]) => returns.get(unitId).replayTimeMs !== event.replayTimeMs));
    for (const [unitId, event] of originalReturns) {
      assert.equal(returns.get(unitId).eventId, event.eventId);
      assert.deepEqual(returns.get(unitId).candidateDelta, event.candidateDelta);
    }
    assert.deepEqual((await auditMichiganEventStream(endpoint, candidateStream)).candidateVotes, jurisdiction(endpoint, "MI").candidateVotes);
  }
});

test("Michigan scheduling is candidate-blind, order-stable, and rejects malformed workloads", async () => {
  const endpoint = await baselineEndpointPromise;
  const input = scheduleInputs(endpoint);
  const harrisLabeled = input.units.map((unit) => ({
    ...unit,
    winner: "harris",
    candidateShares: { harris: 1, trump: 0 },
  }));
  const trumpLabeled = [...input.units].reverse().map((unit) => ({
    ...unit,
    winner: "trump",
    candidateShares: { harris: 0, trump: 1 },
  }));
  const first = await scheduleMichiganReportingUnits(harrisLabeled, input.counties, MICHIGAN_REPLAY_DEFINITION);
  const second = await scheduleMichiganReportingUnits(trumpLabeled, [...input.counties].reverse(), MICHIGAN_REPLAY_DEFINITION);
  assert.deepEqual(second, first);
  const scheduledById = new Map(first.map((unit) => [unit.unitId, unit]));
  const centralTimeCounties = new Set(["26043", "26053", "26071", "26109"]);
  assert.ok(input.units.filter((unit) => centralTimeCounties.has(unit.countyId)).every(
    (unit) => scheduledById.get(unit.unitId).replayTimeMs >= 72 * 60_000,
  ));
  await assert.rejects(scheduleMichiganReportingUnits(
    [{ ...input.units[0], unitType: "invented-batch" }],
    [{ ...input.counties[0], unitCount: 1, totalVotes: input.units[0].totalVotes }],
    MICHIGAN_REPLAY_DEFINITION,
  ), /unsupported type/);
  await assert.rejects(scheduleMichiganReportingUnits(
    input.units.slice(0, 1),
    [{ ...input.counties[0], unitCount: 2 }],
    MICHIGAN_REPLAY_DEFINITION,
  ), /unit count does not reconcile/);
});

test("every Michigan unit, county, off-map structure, prefix, and candidate reconciles", async () => {
  for (const [endpoint, stream] of [
    [await baselineEndpointPromise, await baselineStreamPromise],
    [await complexEndpointPromise, await complexStreamPromise],
  ]) {
    const michigan = jurisdiction(endpoint, "MI");
    const audit = await auditMichiganEventStream(endpoint, stream);
    assert.equal(audit.returnEventCount, michigan.reportingUnits.length);
    assert.equal(audit.controlEventCount, 2);
    assert.equal(audit.offMapReturnCount, 74);
    assert.deepEqual(audit.candidateVotes, michigan.candidateVotes);
    assert.equal(audit.totalVotes, michigan.totalVotes);
    const returnEvents = stream.events.filter((event) => event.eventType === "RETURN_PUBLISHED");
    assert.ok(returnEvents.every((event) => event.batchOrdinal === 0));
    assert.equal(new Set(returnEvents.map((event) => event.eventId)).size, returnEvents.length);
    const returned = new Map(michigan.candidateVotes.map((candidate) => [candidate.candidateId, 0]));
    for (const event of returnEvents) {
      for (const candidate of event.candidateDelta) {
        const next = returned.get(candidate.candidateId) + candidate.votes;
        assert.ok(next <= michigan.candidateVotes.find((item) => item.candidateId === candidate.candidateId).votes);
        returned.set(candidate.candidateId, next);
      }
    }
    for (const county of michigan.counties) {
      const units = michigan.reportingUnits.filter((unit) => unit.countyId === county.countyId);
      assert.deepEqual(
        sumVectors(units.map((unit) => unit.candidateVotes), michigan.candidateVotes.map((candidate) => candidate.candidateId)),
        county.candidateVotes,
      );
    }
    const offMap = michigan.reportingUnits.filter((unit) => unit.geometryStatus === "off-map");
    assert.equal(offMap.length, 74);
    assert.ok(offMap.some((unit) => unit.unitType === "central-count"));
    assert.ok(offMap.some((unit) => unit.unitType === "residual" && unit.countyId === null));
  }
});

test("generic serializer and admission accept Michigan byte-identically with honest geography", async () => {
  const endpoint = await baselineEndpointPromise;
  const stream = await baselineStreamPromise;
  const serialized = serializeCompiledJurisdictionReplay(stream);
  const restored = await deserializeCompiledJurisdictionReplay(serialized);
  assert.equal(serializeCompiledJurisdictionReplay(restored), serialized);
  const audit = await auditCompiledJurisdictionReplay(
    endpoint,
    restored,
    "MI",
    MICHIGAN_REPLAY_CAPABILITY,
    MICHIGAN_REPLAY_TIME_ZONE,
    MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
  );
  const admission = await admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId: "MI",
    capability: MICHIGAN_REPLAY_CAPABILITY,
    timeZone: MICHIGAN_REPLAY_TIME_ZONE,
    pollCloseInstant: MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
  });
  assert.equal(audit.reportingUnitCount, 4_413);
  assert.equal(admission.capability.kind, "detailed");
  assert.equal(admission.capability.residualTreatment, "explicit-off-map");
  assert.match(admission.capability.mapUnitLabel, /2024 Michigan precinct/);
  assert.doesNotMatch(admission.capability.mapUnitLabel, /Census|VTD/);
  assert.match(PA_CAPABILITY.mapUnitLabel, /2020 Census VTD/);
  assert.doesNotMatch(PA_CAPABILITY.mapUnitLabel, /Michigan/);
  assert.equal(admission.evidence.endpointContentFingerprint, endpoint.contentFingerprint);
  assert.equal(admission.evidence.eventStreamFingerprint, stream.eventStreamFingerprint);
  assert.ok(admission.evidence.evidenceIds.includes("mi-boe-2024-general-precinct-results"));
  assert.ok(admission.evidence.evidenceIds.includes("mi-gis-2024-voting-precincts"));
});

test("tampered streams and endpoints fail closed before admission or compilation", async () => {
  const endpoint = await baselineEndpointPromise;
  const stream = await baselineStreamPromise;
  const tamperedStream = structuredClone(stream);
  const returnEvent = tamperedStream.events.find((event) => event.eventType === "RETURN_PUBLISHED");
  returnEvent.candidateDelta[0].votes += 1;
  returnEvent.totalDelta += 1;
  await assert.rejects(auditMichiganEventStream(endpoint, tamperedStream), /fingerprint mismatch/);
  await assert.rejects(admitCompiledJurisdictionReplay({
    endpoint,
    stream: tamperedStream,
    jurisdictionId: "MI",
    capability: MICHIGAN_REPLAY_CAPABILITY,
    timeZone: MICHIGAN_REPLAY_TIME_ZONE,
    pollCloseInstant: MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
  }), /fingerprint mismatch/);

  const tamperedEndpoint = structuredClone(endpoint);
  jurisdiction(tamperedEndpoint, "MI").reportingUnits[0].candidateVotes[0].votes += 1;
  await assert.rejects(
    compileMichiganEventStream(tamperedEndpoint, MICHIGAN_REPLAY_DEFINITION),
    /fingerprint mismatch|reconcile|do not equal/,
  );
  const fractional = michiganEndpointInput(MICHIGAN_BASELINE_REPLAY_FIXTURE);
  fractional.content.jurisdictions.find((item) => item.jurisdictionId === "MI").reportingUnits[0].candidateVotes[0].votes = 0.5;
  await assert.rejects(lockElectionEndpoint(fractional), /non-negative safe integer/);
  const negative = michiganEndpointInput(MICHIGAN_BASELINE_REPLAY_FIXTURE);
  negative.content.jurisdictions.find((item) => item.jurisdictionId === "MI").reportingUnits[0].candidateVotes[0].votes = -1;
  await assert.rejects(lockElectionEndpoint(negative), /non-negative safe integer/);
});

test("Michigan and Pennsylvania identities and random streams are jurisdiction-isolated", async () => {
  const localId = "shared-local-unit-123";
  const [miSeed, paSeed] = await Promise.all([
    deriveNamedReplayStreamSeed("root", `timing/unit/MI/${localId}`, "shared-profile"),
    deriveNamedReplayStreamSeed("root", `timing/unit/PA/${localId}`, "shared-profile"),
  ]);
  assert.notEqual(miSeed.seedHex, paSeed.seedHex);

  const combinedInput = buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation,
    pennsylvaniaScenario: scenario(
      pennsylvaniaBaselineUnits,
      PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.settings,
    ),
    michiganFoundation,
    michiganScenario: scenario(michiganBaselineUnits, MICHIGAN_BASELINE_REPLAY_FIXTURE.settings),
    scenarioId: "pa-mi-equal-local-id-v1",
    scenarioFingerprint: "pa-mi-equal-local-id-fixture-v1",
    createdAt: "2026-08-21T00:03:30.000Z",
  });
  combinedInput.content.jurisdictions.find(
    (item) => item.jurisdictionId === "MI",
  ).reportingUnits[0].unitId = localId;
  combinedInput.content.jurisdictions.find(
    (item) => item.jurisdictionId === "PA",
  ).reportingUnits[0].unitId = localId;
  const endpoint = await lockElectionEndpoint(combinedInput);
  const [miStream, paStream] = await Promise.all([
    compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION),
    compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION),
  ]);
  const miEvent = miStream.events.find((event) => event.unitId === localId);
  const paEvent = paStream.events.find((event) => event.unitId === localId);
  assert.ok(miEvent);
  assert.ok(paEvent);
  assert.notEqual(miEvent.eventId, paEvent.eventId);
});

test("detailed Pennsylvania and Michigan compose deterministically without changing votes", async () => {
  const paScenario = scenario(pennsylvaniaBaselineUnits, PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.settings);
  const miScenario = scenario(michiganBaselineUnits, MICHIGAN_BASELINE_REPLAY_FIXTURE.settings);
  const endpoint = await lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation,
    pennsylvaniaScenario: paScenario,
    michiganFoundation,
    michiganScenario: miScenario,
    scenarioId: "pa-mi-detailed-composition-v1",
    scenarioFingerprint: "pa-mi-detailed-composition-fixture-v1",
    createdAt: "2026-08-21T00:04:00.000Z",
  }));
  const [paStream, miStream] = await Promise.all([
    compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION),
    compileMichiganEventStream(endpoint, MICHIGAN_REPLAY_DEFINITION),
  ]);
  const [paAdmission, miAdmission] = await Promise.all([
    admitCompiledJurisdictionReplay({
      endpoint,
      stream: paStream,
      jurisdictionId: "PA",
      capability: PA_CAPABILITY,
      timeZone: "America/New_York",
      pollCloseInstant: "2024-11-06T01:00:00.000Z",
    }),
    admitCompiledJurisdictionReplay({
      endpoint,
      stream: miStream,
      jurisdictionId: "MI",
      capability: MICHIGAN_REPLAY_CAPABILITY,
      timeZone: MICHIGAN_REPLAY_TIME_ZONE,
      pollCloseInstant: MICHIGAN_REPLAY_POLL_CLOSE_INSTANT,
    }),
  ]);
  const first = await composeJurisdictionReplays(endpoint, [paAdmission, miAdmission]);
  const reversed = await composeJurisdictionReplays(endpoint, [miAdmission, paAdmission]);
  const completionReversed = await Promise.all([
    Promise.resolve(miAdmission),
    new Promise((resolve) => setTimeout(() => resolve(paAdmission), 1)),
  ]).then((admissions) => composeJurisdictionReplays(endpoint, admissions));
  assert.equal(reversed.compositionFingerprint, first.compositionFingerprint);
  assert.equal(completionReversed.compositionFingerprint, first.compositionFingerprint);
  assert.deepEqual(reversed.events, first.events);
  assert.equal(first.coverage, "partial");
  assert.equal(first.acceptedElectoralVotes, 34);
  assert.equal(first.lockedElectionElectoralVotes, 538);
  assert.equal(new Set(first.events.map((event) => event.eventId)).size, first.events.length);
  const candidateIds = endpoint.content.candidates.map((candidate) => candidate.id);
  const expected = sumVectors([
    jurisdiction(endpoint, "PA").candidateVotes,
    jurisdiction(endpoint, "MI").candidateVotes,
  ], candidateIds);
  assert.deepEqual(first.composedCandidateVotes, expected);
  assert.equal(first.composedTotalVotes, jurisdiction(endpoint, "PA").totalVotes + jurisdiction(endpoint, "MI").totalVotes);

  const tampered = structuredClone(miAdmission);
  tampered.stream.events[1].totalDelta += 1;
  await assert.rejects(composeJurisdictionReplays(endpoint, [paAdmission, tampered]), /fingerprint mismatch/);
});

test("the headless replay package contains no browser framework imports or Math.random", () => {
  const root = new URL("../packages/election-replay/src/", import.meta.url);
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".ts")) continue;
    const source = readFileSync(new URL(name, root), "utf8");
    assert.doesNotMatch(source, /from\s+["'](?:react|@deck\.gl)/i, name);
    assert.doesNotMatch(source, /Math\.random\s*\(/, name);
  }
});
