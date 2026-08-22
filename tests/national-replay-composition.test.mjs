import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  auditCompiledNationalReplay,
  compileMichiganEventStream,
  compileNationalReplay,
  compilePennsylvaniaEventStream,
  composeNationalReplay,
  deserializeCompiledNationalReplay,
  lockElectionEndpoint,
  NATIONAL_REPLAY_CLOCKS,
  serializeCompiledNationalReplay,
} from "../packages/election-replay/src/index.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "../src/data/miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits,
} from "../src/data/paDemographics.ts";
import { buildMichiganElectionEndpointInput } from "../src/replay/michiganEndpoint.ts";
import { buildPennsylvaniaElectionEndpointInput } from "../src/replay/pennsylvaniaEndpoint.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import {
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_REPLAY_DEFINITION,
} from "./replay-fixtures/michigan-endpoints.mjs";
import {
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  NATIONAL_REPLAY_DEFINITION,
} from "./replay-fixtures/national-endpoints.mjs";
import {
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_REPLAY_DEFINITION,
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

function endpointInput(nationalFixture, paFixture, miFixture) {
  return buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: applyBehaviorScenario(paUnits, paFixture.settings),
    michiganFoundation: miFoundation,
    michiganScenario: applyBehaviorScenario(miUnits, miFixture.settings),
    scenarioId: nationalFixture.scenarioId,
    scenarioFingerprint: nationalFixture.scenarioFingerprint,
    createdAt: nationalFixture.createdAt,
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
  return endpoint.content.jurisdictions.find((entry) => entry.jurisdictionId === id);
}

function returnEvents(replay, jurisdictionId) {
  return replay.composition.events.filter((event) => (
    event.jurisdictionId === jurisdictionId && event.eventType === "RETURN_PUBLISHED"
  ));
}

const baselineEndpointPromise = lockElectionEndpoint(endpointInput(
  NATIONAL_BASELINE_REPLAY_FIXTURE,
  PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
  MICHIGAN_BASELINE_REPLAY_FIXTURE,
));
const complexEndpointPromise = lockElectionEndpoint(endpointInput(
  NATIONAL_COMPLEX_REPLAY_FIXTURE,
  PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE,
  MICHIGAN_COMPLEX_REPLAY_FIXTURE,
));
const baselineReplayPromise = baselineEndpointPromise.then((endpoint) => (
  compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION)
));
const complexReplayPromise = complexEndpointPromise.then((endpoint) => (
  compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION)
));

test("certified and complex national endpoints and streams match their frozen goldens", async () => {
  const [baselineEndpoint, complexEndpoint, baselineReplay, complexReplay] = await Promise.all([
    baselineEndpointPromise,
    complexEndpointPromise,
    baselineReplayPromise,
    complexReplayPromise,
  ]);
  assert.equal(baselineEndpoint.contentFingerprint, NATIONAL_BASELINE_REPLAY_FIXTURE.expectedEndpointFingerprint);
  assert.equal(complexEndpoint.contentFingerprint, NATIONAL_COMPLEX_REPLAY_FIXTURE.expectedEndpointFingerprint);
  assert.equal(baselineReplay.nationalStreamFingerprint, NATIONAL_BASELINE_REPLAY_FIXTURE.expectedNationalStreamFingerprint);
  assert.equal(complexReplay.nationalStreamFingerprint, NATIONAL_COMPLEX_REPLAY_FIXTURE.expectedNationalStreamFingerprint);
  assert.equal(baselineReplay.composition.events.length, 13_704);
  assert.equal(complexReplay.composition.events.length, 13_704);
  assert.notEqual(baselineReplay.nationalStreamFingerprint, complexReplay.nationalStreamFingerprint);
});

test("accepted Pennsylvania and Michigan standalone golden streams remain unchanged", async () => {
  const paEndpoint = await lockElectionEndpoint(buildPennsylvaniaElectionEndpointInput({
    foundation: paFoundation,
    scenario: applyBehaviorScenario(paUnits, PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.settings),
    scenarioId: PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.scenarioId,
    scenarioFingerprint: "standalone-pa-regression",
    createdAt: PENNSYLVANIA_BASELINE_REPLAY_FIXTURE.createdAt,
  }));
  const miEndpoint = await lockElectionEndpoint(buildMichiganElectionEndpointInput({
    foundation: miFoundation,
    scenario: applyBehaviorScenario(miUnits, MICHIGAN_BASELINE_REPLAY_FIXTURE.settings),
    scenarioId: MICHIGAN_BASELINE_REPLAY_FIXTURE.scenarioId,
    scenarioFingerprint: "standalone-mi-regression",
    createdAt: MICHIGAN_BASELINE_REPLAY_FIXTURE.createdAt,
  }));
  const [pa, mi] = await Promise.all([
    compilePennsylvaniaEventStream(paEndpoint, PENNSYLVANIA_REPLAY_DEFINITION),
    compileMichiganEventStream(miEndpoint, MICHIGAN_REPLAY_DEFINITION),
  ]);
  assert.equal(pa.eventStreamFingerprint, "sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c");
  assert.equal(mi.eventStreamFingerprint, "sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484");
});

test("all 51 jurisdictions are exact, admitted, and capability-honest", async () => {
  const endpoint = await baselineEndpointPromise;
  const replay = await baselineReplayPromise;
  const audit = await auditCompiledNationalReplay(endpoint, replay);
  assert.equal(audit.jurisdictionCount, 51);
  assert.equal(audit.detailedJurisdictionCount, 2);
  assert.equal(audit.coarseJurisdictionCount, 49);
  assert.equal(audit.returnEventCount, 13_602);
  assert.equal(audit.controlEventCount, 102);
  assert.equal(audit.electoralVotes, 538);
  assert.deepEqual(audit.candidateVotes, endpoint.content.nationalTotals);
  assert.equal(audit.totalVotes, endpoint.content.reconciliation.nationalVotes);
  assert.equal(replay.composition.coverage, "complete");
  assert.equal(replay.composition.acceptedElectoralVotes, 538);
  const pa = replay.admissions.find((entry) => entry.jurisdictionId === "PA");
  const mi = replay.admissions.find((entry) => entry.jurisdictionId === "MI");
  assert.equal(pa.capability.kind, "detailed");
  assert.match(pa.capability.mapUnitLabel, /2020 Census VTD/);
  assert.equal(mi.capability.kind, "detailed");
  assert.match(mi.capability.mapUnitLabel, /2024 Michigan precinct/);
  for (const admission of replay.admissions.filter((entry) => !["PA", "MI"].includes(entry.jurisdictionId))) {
    assert.equal(admission.capability.kind, "coarse");
    assert.equal(admission.capability.sourceUnitLabel, null);
    assert.equal(admission.capability.mapUnitLabel, null);
    assert.equal(admission.audit.countyCount, 0);
    assert.equal(admission.audit.reportingUnitCount, 1);
    assert.equal(admission.audit.returnEventCount, 1);
    assert.deepEqual(returnEvents(replay, admission.jurisdictionId)[0].candidateDelta, jurisdiction(endpoint, admission.jurisdictionId).candidateVotes);
  }
});

test("national compilation is stable across endpoint order, metadata, admission order, and completion order", async () => {
  const reversedInput = reverseEndpointArrays(endpointInput(
    NATIONAL_BASELINE_REPLAY_FIXTURE,
    PENNSYLVANIA_BASELINE_REPLAY_FIXTURE,
    MICHIGAN_BASELINE_REPLAY_FIXTURE,
  ));
  reversedInput.metadata.scenarioId = "national-order-does-not-matter";
  reversedInput.metadata.scenarioFingerprint = "national-metadata-does-not-matter";
  reversedInput.metadata.createdAt = "2026-08-21T20:00:00.000Z";
  const endpoint = await lockElectionEndpoint(reversedInput);
  const compiled = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  const baseline = await baselineReplayPromise;
  assert.equal(endpoint.contentFingerprint, NATIONAL_BASELINE_REPLAY_FIXTURE.expectedEndpointFingerprint);
  assert.equal(serializeCompiledNationalReplay(compiled), serializeCompiledNationalReplay(baseline));

  const reverseAdmissions = await composeNationalReplay(
    endpoint,
    NATIONAL_REPLAY_DEFINITION,
    [...baseline.admissions].reverse(),
  );
  const completionOrder = await Promise.all([...baseline.admissions].reverse().map(
    (admission, index) => new Promise((resolve) => setTimeout(() => resolve(admission), index % 3)),
  ));
  const completionReplay = await composeNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION, completionOrder);
  assert.equal(reverseAdmissions.nationalStreamFingerprint, baseline.nationalStreamFingerprint);
  assert.equal(completionReplay.nationalStreamFingerprint, baseline.nationalStreamFingerprint);
});

test("a permissible national seed alters coarse timing but never votes or detailed-state ownership", async () => {
  const endpoint = await baselineEndpointPromise;
  const baseline = await baselineReplayPromise;
  const alternate = await compileNationalReplay(endpoint, {
    ...NATIONAL_REPLAY_DEFINITION,
    rootSeed: "supervisor-national-composition-alternate-seed-v1",
  });
  assert.notEqual(alternate.nationalStreamFingerprint, baseline.nationalStreamFingerprint);
  assert.deepEqual(alternate.composition.composedCandidateVotes, baseline.composition.composedCandidateVotes);
  for (const jurisdictionId of ["PA", "MI"]) {
    const original = baseline.admissions.find((entry) => entry.jurisdictionId === jurisdictionId);
    const changed = alternate.admissions.find((entry) => entry.jurisdictionId === jurisdictionId);
    assert.equal(changed.stream.eventStreamFingerprint, original.stream.eventStreamFingerprint);
  }
  assert.ok(baseline.admissions.filter((entry) => entry.capability.kind === "coarse").some((admission) => {
    const changed = alternate.admissions.find((entry) => entry.jurisdictionId === admission.jurisdictionId);
    return changed.stream.events[1].replayTimeMs !== admission.stream.events[1].replayTimeMs;
  }));
});

test("every national prefix and every authoritative jurisdiction hierarchy remains bounded and exact", async () => {
  const endpoint = await complexEndpointPromise;
  const replay = await complexReplayPromise;
  const prefix = new Map(endpoint.content.nationalTotals.map((candidate) => [candidate.candidateId, 0]));
  for (const event of replay.composition.events) {
    if (event.eventType !== "RETURN_PUBLISHED") continue;
    for (const candidate of event.candidateDelta) {
      const next = prefix.get(candidate.candidateId) + candidate.votes;
      assert.ok(next <= endpoint.content.nationalTotals.find((entry) => entry.candidateId === candidate.candidateId).votes);
      prefix.set(candidate.candidateId, next);
    }
  }
  assert.deepEqual(
    endpoint.content.nationalTotals,
    endpoint.content.nationalTotals.map((candidate) => ({ candidateId: candidate.candidateId, votes: prefix.get(candidate.candidateId) })),
  );
  const pa = replay.admissions.find((entry) => entry.jurisdictionId === "PA");
  const mi = replay.admissions.find((entry) => entry.jurisdictionId === "MI");
  assert.equal(pa.audit.reportingUnitCount, jurisdiction(endpoint, "PA").reportingUnits.length);
  assert.equal(pa.audit.countyCount, 67);
  assert.ok(pa.audit.offMapReturnCount > 0);
  assert.equal(mi.audit.reportingUnitCount, 4_413);
  assert.equal(mi.audit.countyCount, 83);
  assert.equal(mi.audit.offMapReturnCount, 74);
  for (const admission of replay.admissions) {
    assert.deepEqual(admission.candidateVotes, jurisdiction(endpoint, admission.jurisdictionId).candidateVotes);
  }
});

test("coarse multi-zone jurisdictions cannot publish before their latest represented close", async () => {
  const replay = await baselineReplayPromise;
  const extended = NATIONAL_REPLAY_CLOCKS.filter(
    (clock) => clock.pollCloseInstant !== clock.returnEligibilityInstant,
  );
  assert.ok(extended.length >= 10);
  for (const clock of extended) {
    const admission = replay.admissions.find((entry) => entry.jurisdictionId === clock.jurisdictionId);
    assert.equal(admission.clock.returnEligibilityInstant, clock.returnEligibilityInstant);
    if (["PA", "MI"].includes(clock.jurisdictionId)) continue;
    const event = returnEvents(replay, clock.jurisdictionId)[0];
    assert.ok(event.absoluteReplayTimeMs >= new Date(clock.returnEligibilityInstant).getTime());
  }
  const florida = replay.admissions.find((entry) => entry.jurisdictionId === "FL");
  assert.ok(florida.clock.returnEligibilityEpochMs > florida.clock.pollCloseEpochMs);
  assert.ok(returnEvents(replay, "FL")[0].absoluteReplayTimeMs >= florida.clock.returnEligibilityEpochMs);
});

test("national order is canonical and identities remain globally unique", async () => {
  const replay = await baselineReplayPromise;
  const events = replay.composition.events;
  assert.equal(new Set(events.map((event) => event.eventId)).size, events.length);
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    assert.ok(
      previous.absoluteReplayTimeMs < current.absoluteReplayTimeMs
      || (
        previous.absoluteReplayTimeMs === current.absoluteReplayTimeMs
        && (
          previous.orderTieBreaker < current.orderTieBreaker
          || (
            previous.orderTieBreaker === current.orderTieBreaker
            && previous.eventId.localeCompare(current.eventId) < 0
          )
        )
      ),
    );
  }
  assert.ok(events.some((event, index) => index > 0 && (
    event.absoluteReplayTimeMs === events[index - 1].absoluteReplayTimeMs
  )));
});

test("partial, tampered, and cross-jurisdiction-compensating inputs fail closed", async () => {
  const endpoint = await baselineEndpointPromise;
  const replay = await baselineReplayPromise;
  await assert.rejects(composeNationalReplay(
    endpoint,
    NATIONAL_REPLAY_DEFINITION,
    replay.admissions.slice(0, 50),
  ), /requires 51/);

  const tamperedAdmission = structuredClone(replay.admissions[0]);
  const localReturn = tamperedAdmission.stream.events.find((event) => event.eventType === "RETURN_PUBLISHED");
  localReturn.candidateDelta[0].votes -= 1;
  localReturn.totalDelta -= 1;
  const compensatingAdmission = structuredClone(replay.admissions[1]);
  const compensatingReturn = compensatingAdmission.stream.events.find((event) => event.eventType === "RETURN_PUBLISHED");
  compensatingReturn.candidateDelta[0].votes += 1;
  compensatingReturn.totalDelta += 1;
  const admissions = [...replay.admissions];
  admissions[0] = tamperedAdmission;
  admissions[1] = compensatingAdmission;
  await assert.rejects(composeNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION, admissions), /fingerprint mismatch|reconcile/);

  const tamperedNational = structuredClone(replay);
  tamperedNational.composition.events.find((event) => event.eventType === "RETURN_PUBLISHED").totalDelta += 1;
  await assert.rejects(auditCompiledNationalReplay(endpoint, tamperedNational), /fingerprint mismatch/);

  const tamperedEndpoint = structuredClone(endpoint);
  jurisdiction(tamperedEndpoint, "AL").reportingUnits[0].candidateVotes[0].votes += 1;
  await assert.rejects(compileNationalReplay(tamperedEndpoint, NATIONAL_REPLAY_DEFINITION), /do not equal|fingerprint mismatch|reconcile/);
});

test("national serialization and evidence lineage round-trip without flattening capability", async () => {
  const endpoint = await baselineEndpointPromise;
  const replay = await baselineReplayPromise;
  const serialized = serializeCompiledNationalReplay(replay);
  const restored = await deserializeCompiledNationalReplay(endpoint, serialized);
  assert.equal(serializeCompiledNationalReplay(restored), serialized);
  assert.equal(restored.nationalStreamFingerprint, replay.nationalStreamFingerprint);
  for (const admission of restored.admissions) {
    assert.equal(admission.evidence.endpointContentFingerprint, endpoint.contentFingerprint);
    assert.equal(admission.evidence.eventStreamFingerprint, admission.stream.eventStreamFingerprint);
    assert.ok(admission.evidence.evidenceIds.length > 0);
    assert.equal(admission.capability.kind, admission.jurisdictionId === "PA" || admission.jurisdictionId === "MI" ? "detailed" : "coarse");
  }
});

test("national compilation mutates no endpoint and the replay package stays headless and deterministic", async () => {
  const endpoint = await baselineEndpointPromise;
  const before = JSON.stringify(endpoint);
  await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  assert.equal(JSON.stringify(endpoint), before);
  const root = new URL("../packages/election-replay/src/", import.meta.url);
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".ts")) continue;
    const source = readFileSync(new URL(name, root), "utf8");
    assert.doesNotMatch(source, /from\s+["'](?:react|@deck\.gl)/i, name);
    assert.doesNotMatch(source, /Math\.random\s*\(/, name);
  }
});
