import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  admitCompiledJurisdictionReplay,
  auditCompiledJurisdictionReplay,
  compileAtomicCoarseJurisdictionFixture,
  compilePennsylvaniaEventStream,
  composeJurisdictionReplays,
  deriveNamedReplayStreamSeed,
  deriveReplayEventId,
  deserializeCompiledJurisdictionReplay,
  lockElectionEndpoint,
  REPLAY_SCHEMA_VERSION,
  serializeCompiledJurisdictionReplay,
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

const PA_CAPABILITY = Object.freeze({
  kind: "detailed",
  sourceUnitLabel: "2024 Pennsylvania election reporting unit",
  mapUnitLabel: "2020 Census VTD terrain",
  residualTreatment: "explicit-off-map",
  methodologyNote: "2024 reporting units are linked to 2020 Census VTD terrain; unmatched units remain explicit off-map returns.",
});
const COARSE_CAPABILITY = Object.freeze({
  kind: "coarse",
  sourceUnitLabel: null,
  mapUnitLabel: null,
  residualTreatment: "none",
  methodologyNote: "Contract fixture exposes one jurisdiction-total return and claims no local reporting geography.",
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

function endpointInput(fixture) {
  const scenario = applyBehaviorScenario(baselineUnits, fixture.settings);
  const recipe = createStateScenarioRecipe("PA", recipeSettings(fixture.settings));
  return buildPennsylvaniaElectionEndpointInput({
    foundation,
    scenario,
    scenarioId: fixture.scenarioId,
    scenarioFingerprint: stateScenarioRecipeFingerprint(recipe),
    createdAt: fixture.createdAt,
  });
}

function coarseDefinition(jurisdictionId, options = {}) {
  const isCentral = jurisdictionId === "WI";
  return {
    profileId: "coarse-synthetic-atomic-v1",
    rootSeed: options.rootSeed ?? "multi-jurisdiction-contract-seed-v1",
    timeZone: options.timeZone ?? (isCentral ? "America/Chicago" : "America/Detroit"),
    pollCloseInstant: options.pollCloseInstant
      ?? (isCentral ? "2024-11-06T02:00:00.000Z" : "2024-11-06T01:00:00.000Z"),
    minimumReturnDelayMs: options.minimumReturnDelayMs ?? 600_000,
    returnJitterMs: options.returnJitterMs ?? 0,
  };
}

function jurisdiction(endpoint, jurisdictionId) {
  return endpoint.content.jurisdictions.find(
    (candidate) => candidate.jurisdictionId === jurisdictionId,
  );
}

const baselineEndpointPromise = lockElectionEndpoint(
  endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE),
);
const complexEndpointPromise = lockElectionEndpoint(
  endpointInput(PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE),
);
const paBaselineStreamPromise = baselineEndpointPromise.then((endpoint) => (
  compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION)
));
const paComplexStreamPromise = complexEndpointPromise.then((endpoint) => (
  compilePennsylvaniaEventStream(endpoint, PENNSYLVANIA_REPLAY_DEFINITION)
));
const miStreamPromise = baselineEndpointPromise.then((endpoint) => (
  compileAtomicCoarseJurisdictionFixture(endpoint, "MI", coarseDefinition("MI"))
));
const wiStreamPromise = baselineEndpointPromise.then((endpoint) => (
  compileAtomicCoarseJurisdictionFixture(endpoint, "WI", coarseDefinition("WI"))
));
const miAdmissionPromise = Promise.all([baselineEndpointPromise, miStreamPromise]).then(
  ([endpoint, stream]) => admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId: "MI",
    capability: COARSE_CAPABILITY,
    timeZone: "America/Detroit",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
  }),
);
const wiAdmissionPromise = Promise.all([baselineEndpointPromise, wiStreamPromise]).then(
  ([endpoint, stream]) => admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId: "WI",
    capability: COARSE_CAPABILITY,
    timeZone: "America/Chicago",
    pollCloseInstant: "2024-11-06T02:00:00.000Z",
  }),
);

test("Pennsylvania golden streams remain unchanged behind the generic jurisdiction contract", async () => {
  const baseline = await paBaselineStreamPromise;
  const complex = await paComplexStreamPromise;
  assert.equal(
    baseline.eventStreamFingerprint,
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.expectedEventStreamFingerprint,
  );
  assert.equal(
    complex.eventStreamFingerprint,
    PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE.expectedEventStreamFingerprint,
  );
});

test("generic serialization round-trips Pennsylvania byte-identically", async () => {
  const stream = await paBaselineStreamPromise;
  const serialized = serializeCompiledJurisdictionReplay(stream);
  const restored = await deserializeCompiledJurisdictionReplay(serialized);
  assert.equal(serializeCompiledJurisdictionReplay(restored), serialized);
  assert.equal(restored.eventStreamFingerprint, stream.eventStreamFingerprint);
});

test("Pennsylvania is admitted as explicit detailed VTD-linked geography", async () => {
  const endpoint = await baselineEndpointPromise;
  const stream = await paBaselineStreamPromise;
  const admission = await admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId: "PA",
    capability: PA_CAPABILITY,
    timeZone: "America/New_York",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
  });
  assert.equal(admission.capability.kind, "detailed");
  assert.match(admission.capability.sourceUnitLabel, /reporting unit/);
  assert.match(admission.capability.mapUnitLabel, /Census VTD/);
  assert.equal(admission.audit.reportingUnitCount, 9140);
  assert.equal(admission.audit.countyCount, 67);
  assert.ok(admission.audit.offMapReturnCount > 0);
  assert.equal(admission.candidateVotes.length, 5);
  assert.deepEqual(admission.candidateVotes, jurisdiction(endpoint, "PA").candidateVotes);
});

test("coarse jurisdiction fixture remains one honest statewide atomic return", async () => {
  const endpoint = await baselineEndpointPromise;
  const stream = await miStreamPromise;
  const admission = await miAdmissionPromise;
  const returnEvents = stream.events.filter((event) => event.eventType === "RETURN_PUBLISHED");
  assert.equal(admission.capability.kind, "coarse");
  assert.equal(admission.audit.countyCount, 0);
  assert.equal(admission.audit.reportingUnitCount, 1);
  assert.equal(returnEvents.length, 1);
  assert.equal(returnEvents[0].unitType, "jurisdiction-total");
  assert.equal(returnEvents[0].countyId, null);
  assert.equal(returnEvents[0].geometryStatus, "none");
  assert.deepEqual(returnEvents[0].candidateDelta, jurisdiction(endpoint, "MI").candidateVotes);
  assert.equal(returnEvents[0].candidateDelta.length, 5);
});

test("capability is explicit and incompatible geography claims fail closed", async () => {
  const endpoint = await baselineEndpointPromise;
  await assert.rejects(admitCompiledJurisdictionReplay({
    endpoint,
    stream: await miStreamPromise,
    jurisdictionId: "MI",
    capability: PA_CAPABILITY,
    timeZone: "America/Detroit",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
  }), /lacks detailed replay geography/);
  await assert.rejects(admitCompiledJurisdictionReplay({
    endpoint,
    stream: await paBaselineStreamPromise,
    jurisdictionId: "PA",
    capability: COARSE_CAPABILITY,
    timeZone: "America/New_York",
    pollCloseInstant: "2024-11-06T01:00:00.000Z",
  }), /not compatible with coarse replay/);
});

test("same local unit identifier in two jurisdictions has distinct global identity", async () => {
  const input = endpointInput(PENNSYLVANIA_BASELINE_REPLAY_FIXTURE);
  for (const jurisdictionId of ["MI", "WI"]) {
    const target = input.content.jurisdictions.find(
      (candidate) => candidate.jurisdictionId === jurisdictionId,
    );
    target.reportingUnits[0].unitId = "shared-local-unit";
  }
  const endpoint = await lockElectionEndpoint(input);
  const miDefinition = coarseDefinition("MI", { pollCloseInstant: "2024-11-06T01:00:00.000Z" });
  const wiDefinition = coarseDefinition("WI", { pollCloseInstant: "2024-11-06T01:00:00.000Z" });
  const [miStream, wiStream] = await Promise.all([
    compileAtomicCoarseJurisdictionFixture(endpoint, "MI", miDefinition),
    compileAtomicCoarseJurisdictionFixture(endpoint, "WI", wiDefinition),
  ]);
  const [miAdmission, wiAdmission] = await Promise.all([
    admitCompiledJurisdictionReplay({
      endpoint,
      stream: miStream,
      jurisdictionId: "MI",
      capability: COARSE_CAPABILITY,
      timeZone: miDefinition.timeZone,
      pollCloseInstant: miDefinition.pollCloseInstant,
    }),
    admitCompiledJurisdictionReplay({
      endpoint,
      stream: wiStream,
      jurisdictionId: "WI",
      capability: COARSE_CAPABILITY,
      timeZone: wiDefinition.timeZone,
      pollCloseInstant: wiDefinition.pollCloseInstant,
    }),
  ]);
  const composition = await composeJurisdictionReplays(endpoint, [miAdmission, wiAdmission]);
  const returns = composition.events.filter((event) => event.eventType === "RETURN_PUBLISHED");
  assert.equal(returns[0].unitId, "shared-local-unit");
  assert.equal(returns[1].unitId, "shared-local-unit");
  assert.notEqual(returns[0].eventId, returns[1].eventId);
  assert.notEqual(
    await deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId: "MI",
      unitId: "shared-local-unit",
      eventType: "RETURN_PUBLISHED",
      batchOrdinal: 0,
    }),
    await deriveReplayEventId({
      replaySchemaVersion: REPLAY_SCHEMA_VERSION,
      jurisdictionId: "WI",
      unitId: "shared-local-unit",
      eventType: "RETURN_PUBLISHED",
      batchOrdinal: 0,
    }),
  );
});

test("composition is byte-identical across jurisdiction and worker completion order", async () => {
  const endpoint = await baselineEndpointPromise;
  const [mi, wi] = await Promise.all([miAdmissionPromise, wiAdmissionPromise]);
  const forward = await composeJurisdictionReplays(endpoint, [mi, wi]);
  const reverse = await composeJurisdictionReplays(endpoint, [wi, mi]);
  const completionOrder = [];
  await Promise.all([
    new Promise((resolve) => setTimeout(resolve, 5)).then(() => completionOrder.push(mi)),
    Promise.resolve().then(() => completionOrder.push(wi)),
  ]);
  const workerOrder = await composeJurisdictionReplays(endpoint, completionOrder);
  assert.equal(forward.compositionFingerprint, reverse.compositionFingerprint);
  assert.equal(forward.compositionFingerprint, workerOrder.compositionFingerprint);
  assert.equal(JSON.stringify(forward), JSON.stringify(reverse));
  assert.equal(JSON.stringify(forward), JSON.stringify(workerOrder));
});

test("absolute UTC ordering keeps Eastern and Central poll closes one hour apart", async () => {
  const endpoint = await baselineEndpointPromise;
  const composition = await composeJurisdictionReplays(
    endpoint,
    [await wiAdmissionPromise, await miAdmissionPromise],
  );
  const miComplete = composition.events.find(
    (event) => event.jurisdictionId === "MI" && event.eventType === "REPLAY_COMPLETED",
  );
  const wiPollClose = composition.events.find(
    (event) => event.jurisdictionId === "WI" && event.eventType === "POLL_CLOSE",
  );
  assert.equal(wiPollClose.absoluteReplayTimeMs - Date.parse("2024-11-06T01:00:00.000Z"), 3_600_000);
  assert.ok(miComplete.absoluteReplayTimeMs < wiPollClose.absoluteReplayTimeMs);
  assert.equal(composition.jurisdictions.find((entry) => entry.jurisdictionId === "MI").clock.timeZone, "America/Detroit");
  assert.equal(composition.jurisdictions.find((entry) => entry.jurisdictionId === "WI").clock.timeZone, "America/Chicago");
});

test("simultaneous jurisdiction controls use tie breaker then canonical event identity", async () => {
  const endpoint = await baselineEndpointPromise;
  const definition = coarseDefinition("WI", { pollCloseInstant: "2024-11-06T01:00:00.000Z" });
  const stream = await compileAtomicCoarseJurisdictionFixture(endpoint, "WI", definition);
  const wi = await admitCompiledJurisdictionReplay({
    endpoint,
    stream,
    jurisdictionId: "WI",
    capability: COARSE_CAPABILITY,
    timeZone: definition.timeZone,
    pollCloseInstant: definition.pollCloseInstant,
  });
  const composition = await composeJurisdictionReplays(endpoint, [await miAdmissionPromise, wi]);
  const simultaneous = composition.events.filter((event) => (
    event.eventType === "POLL_CLOSE"
    && event.absoluteReplayTimeMs === Date.parse("2024-11-06T01:00:00.000Z")
  ));
  assert.equal(simultaneous.length, 2);
  assert.equal(simultaneous[0].orderTieBreaker, simultaneous[1].orderTieBreaker);
  assert.ok(simultaneous[0].eventId < simultaneous[1].eventId);
  assert.deepEqual(simultaneous.map((event) => event.sequence), [0, 1]);
});

test("composition preserves jurisdiction totals, five candidates, evidence, and the 538-EV election", async () => {
  const endpoint = await baselineEndpointPromise;
  const admissions = [await miAdmissionPromise, await wiAdmissionPromise];
  const composition = await composeJurisdictionReplays(endpoint, admissions);
  const candidateIds = endpoint.content.candidates.map((candidate) => candidate.id);
  const expected = candidateIds.map((candidateId) => ({
    candidateId,
    votes: admissions.reduce((sum, admission) => (
      sum + admission.candidateVotes.find((candidate) => candidate.candidateId === candidateId).votes
    ), 0),
  }));
  assert.equal(composition.coverage, "partial");
  assert.deepEqual(composition.composedCandidateVotes, expected);
  assert.equal(composition.composedCandidateVotes.length, 5);
  assert.equal(
    composition.composedTotalVotes,
    admissions.reduce((sum, admission) => sum + admission.totalVotes, 0),
  );
  assert.equal(
    composition.acceptedElectoralVotes,
    admissions.reduce((sum, admission) => sum + admission.electoralVotes, 0),
  );
  assert.equal(composition.lockedElectionElectoralVotes, 538);
  for (const trace of composition.jurisdictions) {
    assert.equal(trace.evidence.endpointContentFingerprint, endpoint.contentFingerprint);
    assert.match(trace.evidence.replayDefinitionFingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.match(trace.evidence.eventStreamFingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.ok(trace.evidence.evidenceIds.length > 0);
  }
});

test("each jurisdiction fails independently before composition can repair it", async () => {
  const endpoint = await baselineEndpointPromise;
  const mi = await miAdmissionPromise;
  const tampered = structuredClone(mi);
  const returnEvent = tampered.stream.events.find((event) => event.eventType === "RETURN_PUBLISHED");
  returnEvent.candidateDelta[0].votes += 1;
  returnEvent.totalDelta += 1;
  await assert.rejects(
    composeJurisdictionReplays(endpoint, [tampered, await wiAdmissionPromise]),
    /fingerprint mismatch/,
  );
  const tamperedTrace = structuredClone(mi);
  tamperedTrace.evidence.profileId = "invented-profile";
  await assert.rejects(
    composeJurisdictionReplays(endpoint, [tamperedTrace, await wiAdmissionPromise]),
    /admission metadata was tampered/,
  );
  const validAudit = await auditCompiledJurisdictionReplay(
    endpoint,
    await wiStreamPromise,
    "WI",
    COARSE_CAPABILITY,
    "America/Chicago",
    "2024-11-06T02:00:00.000Z",
  );
  assert.deepEqual(validAudit.candidateVotes, jurisdiction(endpoint, "WI").candidateVotes);
});

test("jurisdiction-specific random namespaces cannot collide", async () => {
  const pa = await deriveNamedReplayStreamSeed(
    "multi-jurisdiction-contract-seed-v1",
    "activation/state/PA",
    "coarse-synthetic-atomic-v1",
  );
  const mi = await deriveNamedReplayStreamSeed(
    "multi-jurisdiction-contract-seed-v1",
    "activation/state/MI",
    "coarse-synthetic-atomic-v1",
  );
  const unitPa = await deriveNamedReplayStreamSeed(
    "multi-jurisdiction-contract-seed-v1",
    "timing/unit/PA/shared-local-unit",
    "coarse-synthetic-atomic-v1",
  );
  const unitMi = await deriveNamedReplayStreamSeed(
    "multi-jurisdiction-contract-seed-v1",
    "timing/unit/MI/shared-local-unit",
    "coarse-synthetic-atomic-v1",
  );
  assert.notEqual(pa.seedHex, mi.seedHex);
  assert.notEqual(unitPa.seedHex, unitMi.seedHex);
});

test("multi-jurisdiction replay contracts remain headless and deterministic", () => {
  const directory = new URL("../packages/election-replay/src/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(new URL(file, directory), "utf8");
    assert.doesNotMatch(source, /from ["']react|from ["']@deck\.gl|Math\.random\s*\(/);
  }
  const compositionSource = readFileSync(
    new URL("../packages/election-replay/src/jurisdictionComposition.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(compositionSource, /finalWinner|decision desk|called for/i);
});
