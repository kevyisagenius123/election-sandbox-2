import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createScenarioDeltaLedger,
  deserializeFingerprintedScenarioDeltaLedger,
  fingerprintScenarioDeltaLedger,
  rankScenarioDeltaRows,
  serializeFingerprintedScenarioDeltaLedger,
  serializeScenarioDeltaLedger,
  validateScenarioDeltaLedger,
} from "../packages/election-analytics/src/index.ts";
import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import { canonicalSerialize } from "../packages/election-replay/src/canonical.ts";
import { sha256Fingerprint } from "../packages/election-replay/src/hash.ts";
import { getDetailedStateManifest } from "../src/data/detailedStateManifest.ts";
import { getDetailedStateRuntimeAdapter } from "../src/data/detailedStateRuntimeLoaders.ts";
import { states2024 } from "../src/data/states.ts";

const sourceIds = ["source:scenario-recipe", "source:certified-foundation"];

const toyUnits = [
  {
    id: "A-1",
    countyFips: "00001",
    geometryId: "map-A-1",
    harrisVotes: 60,
    trumpVotes: 35,
    steinVotes: 3,
    oliverVotes: 1,
    residualOtherVotes: 1,
    otherVotes: 5,
    totalVotes: 100,
    turnoutDenominator: 130,
    turnoutCapacity: 30,
  },
  {
    id: "A-residual",
    countyFips: "00001",
    geometryId: null,
    harrisVotes: 15,
    trumpVotes: 30,
    steinVotes: 2,
    oliverVotes: 1,
    residualOtherVotes: 2,
    otherVotes: 5,
    totalVotes: 50,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  },
  {
    id: "B-1",
    countyFips: "00003",
    geometryId: "map-B-1",
    harrisVotes: 30,
    trumpVotes: 65,
    steinVotes: 2,
    oliverVotes: 2,
    residualOtherVotes: 1,
    otherVotes: 5,
    totalVotes: 100,
    turnoutDenominator: 145,
    turnoutCapacity: 45,
  },
  {
    id: "state-residual",
    countyFips: null,
    geometryId: null,
    harrisVotes: 4,
    trumpVotes: 5,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 1,
    otherVotes: 1,
    totalVotes: 10,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  },
];

function endpointFromUnits(code, units, electoralVotes = 10) {
  const totals = units.reduce((sum, unit) => {
    sum.harrisVotes += unit.harrisVotes;
    sum.trumpVotes += unit.trumpVotes;
    sum.otherVotes += unit.otherVotes;
    sum.totalVotes += unit.totalVotes;
    return sum;
  }, { harrisVotes: 0, trumpVotes: 0, otherVotes: 0, totalVotes: 0 });
  const harrisWins = totals.harrisVotes > totals.trumpVotes;
  return {
    code,
    ...totals,
    harrisElectoralVotes: harrisWins ? electoralVotes : 0,
    trumpElectoralVotes: harrisWins ? 0 : electoralVotes,
  };
}

function scenarioEndpoint(actual, scenario) {
  const harrisWins = scenario.totals.harrisVotes > scenario.totals.trumpVotes;
  const electoralVotes = actual.harrisElectoralVotes + actual.trumpElectoralVotes;
  return {
    ...actual,
    harrisVotes: scenario.totals.harrisVotes,
    trumpVotes: scenario.totals.trumpVotes,
    otherVotes: scenario.totals.otherVotes,
    totalVotes: scenario.totals.totalVotes,
    harrisElectoralVotes: harrisWins ? electoralVotes : 0,
    trumpElectoralVotes: harrisWins ? 0 : electoralVotes,
  };
}

function buildToyLedger(overrides = {}) {
  const scenario = applyBehaviorScenario(toyUnits, {
    turnoutIncreasePoints: 10,
    addedVoterHarrisShare: 0.7,
    preferenceShiftPoints: -4,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: -2,
    thirdPartyHarrisExchangeShare: 0.6,
  });
  const actualState = endpointFromUnits("TS", toyUnits);
  return createScenarioDeltaLedger({
    actualState,
    scenarioState: scenarioEndpoint(actualState, scenario),
    baselineUnits: toyUnits,
    scenario,
    targetCandidate: "harris",
    sourceIds,
    ...overrides,
  });
}

function sumDeltas(rows) {
  return rows.reduce((sum, row) => {
    for (const field of Object.keys(sum)) sum[field] += row.delta[field];
    return sum;
  }, {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
    harrisTrumpMarginVotes: 0,
  });
}

test("scenario delta ledger reconciles endpoint, operation, county, unit, and residual movement", () => {
  const ledger = buildToyLedger();
  assert.equal(ledger.units.length, 4);
  assert.equal(ledger.counties.length, 2);
  assert.equal(ledger.counties.find((county) => county.id === "00001").mapStatus, "mixed");
  assert.equal(ledger.statewideResidual.unitCount, 1);
  assert.deepEqual(sumDeltas(ledger.operations), ledger.delta);
  assert.deepEqual(sumDeltas(ledger.units), ledger.delta);
  assert.deepEqual(
    sumDeltas(ledger.counties.concat(ledger.statewideResidual)),
    ledger.delta,
  );
  assert.equal(
    ledger.partitions.find((partition) => partition.id === "mapped").delta.harrisTrumpMarginVotes
      + ledger.partitions.find((partition) => partition.id === "off-map").delta.harrisTrumpMarginVotes,
    ledger.delta.harrisTrumpMarginVotes,
  );
  assert.equal(ledger.analytics.analytics.length, 18);
});

test("operation attribution preserves exact model audit values", () => {
  const ledger = buildToyLedger();
  const turnout = ledger.operations.find((operation) => operation.operationId === "turnout");
  const preference = ledger.operations.find((operation) => operation.operationId === "preference");
  const thirdParty = ledger.operations.find((operation) => operation.operationId === "third-party");
  assert.equal(turnout.delta.totalVotes, turnout.realizedVolume);
  assert.equal(preference.delta.totalVotes, 0);
  assert.equal(preference.delta.harrisTrumpMarginVotes, preference.realizedVolume * 2);
  assert.equal(thirdParty.delta.steinVotes, thirdParty.realizedVolume);
  assert.equal(thirdParty.delta.totalVotes, 0);
  assert.equal(thirdParty.selectedCandidate, "stein");
});

test("county and reporting-unit rankings are deterministic and operation-filterable", () => {
  const ledger = buildToyLedger();
  const absolute = rankScenarioDeltaRows(ledger.units);
  const harris = rankScenarioDeltaRows(ledger.units, { direction: "harris" });
  const trumpPreference = rankScenarioDeltaRows(ledger.units, {
    operationId: "preference",
    direction: "trump",
  });
  assert.ok(Math.abs(absolute[0].delta.harrisTrumpMarginVotes)
    >= Math.abs(absolute.at(-1).delta.harrisTrumpMarginVotes));
  assert.ok(harris[0].delta.harrisTrumpMarginVotes >= harris.at(-1).delta.harrisTrumpMarginVotes);
  const preferenceMargin = (row) => row.operations
    .find((operation) => operation.operationId === "preference").delta.harrisTrumpMarginVotes;
  assert.ok(preferenceMargin(trumpPreference[0]) <= preferenceMargin(trumpPreference.at(-1)));
  assert.deepEqual(rankScenarioDeltaRows(ledger.counties).map((row) => row.id),
    rankScenarioDeltaRows([...ledger.counties].reverse()).map((row) => row.id));
});

test("ledger serialization and fingerprints ignore input ordering and reject tampering", async () => {
  const first = buildToyLedger();
  const scenario = applyBehaviorScenario(toyUnits, {
    turnoutIncreasePoints: 10,
    addedVoterHarrisShare: 0.7,
    preferenceShiftPoints: -4,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: -2,
    thirdPartyHarrisExchangeShare: 0.6,
  });
  const actualState = endpointFromUnits("TS", toyUnits);
  const second = createScenarioDeltaLedger({
    actualState,
    scenarioState: scenarioEndpoint(actualState, scenario),
    baselineUnits: [...toyUnits].reverse(),
    scenario: { ...scenario, units: [scenario.units[2], scenario.units[0], scenario.units[3], scenario.units[1]] },
    targetCandidate: "harris",
    sourceIds: [...sourceIds].reverse(),
  });
  assert.equal(serializeScenarioDeltaLedger(first), serializeScenarioDeltaLedger(second));
  const fingerprinted = await fingerprintScenarioDeltaLedger(first);
  const restored = await deserializeFingerprintedScenarioDeltaLedger(
    serializeFingerprintedScenarioDeltaLedger(fingerprinted),
  );
  assert.equal(restored.fingerprint, fingerprinted.fingerprint);

  const tampered = structuredClone(fingerprinted);
  tampered.ledger.counties[0].delta.harrisVotes += 1;
  tampered.fingerprint = await sha256Fingerprint(canonicalSerialize(tampered.ledger));
  await assert.rejects(
    deserializeFingerprintedScenarioDeltaLedger(JSON.stringify(tampered)),
    /noncanonical or inconsistent content/,
  );
});

test("canonical scenario delta fixture retains its frozen fingerprint", async () => {
  const units = [{
    id: "fixture",
    countyFips: "00001",
    geometryId: "fixture-map",
    harrisVotes: 48,
    trumpVotes: 45,
    steinVotes: 3,
    oliverVotes: 2,
    residualOtherVotes: 2,
    otherVotes: 7,
    totalVotes: 100,
    turnoutDenominator: 125,
    turnoutCapacity: 25,
  }];
  const scenario = applyBehaviorScenario(units, {
    turnoutIncreasePoints: 8,
    addedVoterHarrisShare: 0.6,
    preferenceShiftPoints: 2,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: -1,
    thirdPartyHarrisExchangeShare: 0.75,
  });
  const actualState = endpointFromUnits("FX", units, 3);
  const ledger = createScenarioDeltaLedger({
    actualState,
    scenarioState: scenarioEndpoint(actualState, scenario),
    baselineUnits: units,
    scenario,
    targetCandidate: "harris",
    sourceIds: ["fixture:certified", "fixture:scenario"],
  });
  assert.deepEqual(ledger.delta, {
    harrisVotes: 8,
    trumpVotes: 3,
    steinVotes: -1,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: -1,
    totalVotes: 10,
    harrisTrumpMarginVotes: 5,
  });
  assert.equal(
    (await fingerprintScenarioDeltaLedger(ledger)).fingerprint,
    "sha256:62c4527528a1e42dc0de2c0a7ef3bd7fb47783cc7e5a66c8f11b4241dfa9a312",
  );
});

test("zero-change ledgers preserve available zeros and zero Electoral College consequence", () => {
  const scenario = applyBehaviorScenario(toyUnits, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "oliver",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  });
  const actualState = endpointFromUnits("TS", toyUnits);
  const ledger = createScenarioDeltaLedger({
    actualState,
    scenarioState: scenarioEndpoint(actualState, scenario),
    baselineUnits: toyUnits,
    scenario,
    targetCandidate: "trump",
    sourceIds,
  });
  assert.deepEqual(ledger.delta, {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
    harrisTrumpMarginVotes: 0,
  });
  assert.equal(ledger.electoral.targetElectoralDelta, 0);
  assert.ok(ledger.analytics.analytics.every((analytic) => analytic.status === "available"));
});

const detailedSettings = {
  PA: { turnoutIncreasePoints: 0.4, addedVoterHarrisShare: 0.62, preferenceShiftPoints: 1.1, thirdPartyCandidate: "stein", thirdPartyShiftPoints: -0.15, thirdPartyHarrisExchangeShare: 0.55 },
  MI: { turnoutIncreasePoints: 0.3, addedVoterHarrisShare: 0.58, preferenceShiftPoints: -0.8, thirdPartyCandidate: "oliver", thirdPartyShiftPoints: -0.1, thirdPartyHarrisExchangeShare: 0.45 },
  WI: { turnoutIncreasePoints: 0.5, addedVoterHarrisShare: 0.6, preferenceShiftPoints: 0.9, thirdPartyCandidate: "residual_other", thirdPartyShiftPoints: -0.2, thirdPartyHarrisExchangeShare: 0.5 },
};

test("Pennsylvania, Michigan, and Wisconsin ledgers reconcile their admitted detailed foundations", () => {
  for (const stateCode of ["PA", "MI", "WI"]) {
    const manifest = getDetailedStateManifest(stateCode);
    const document = JSON.parse(readFileSync(
      new URL(`../public/${manifest.runtime.artifactPath}`, import.meta.url),
      "utf8",
    ));
    const adapter = getDetailedStateRuntimeAdapter(manifest.runtime.loader);
    const foundation = adapter.decode(document);
    const baselineUnits = adapter.toBehaviorModelUnits(foundation);
    const scenario = applyBehaviorScenario(baselineUnits, detailedSettings[stateCode]);
    const actualState = states2024.find((state) => state.code === stateCode);
    assert.ok(actualState);
    const ledger = createScenarioDeltaLedger({
      actualState,
      scenarioState: scenarioEndpoint(actualState, scenario),
      baselineUnits,
      scenario,
      targetCandidate: "harris",
      sourceIds: [`source:${stateCode}:certified`, `source:${stateCode}:scenario`],
    });
    assert.equal(ledger.units.length, baselineUnits.length);
    assert.deepEqual(sumDeltas(ledger.units), ledger.delta);
    assert.deepEqual(sumDeltas(ledger.operations), ledger.delta);
    assert.equal(ledger.counties.length, new Set(baselineUnits
      .map((unit) => unit.countyFips).filter(Boolean)).size);
    assert.equal(ledger.analytics.analytics.length, 18);
  }
});

test("mismatched endpoints, geography, identities, and electoral allocations fail closed", () => {
  const scenario = applyBehaviorScenario(toyUnits, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  });
  const actualState = endpointFromUnits("TS", toyUnits);
  const valid = {
    actualState,
    scenarioState: scenarioEndpoint(actualState, scenario),
    baselineUnits: toyUnits,
    scenario,
    targetCandidate: "harris",
    sourceIds,
  };
  assert.throws(() => createScenarioDeltaLedger({
    ...valid,
    actualState: { ...actualState, totalVotes: actualState.totalVotes + 1 },
  }), /endpoint does not reconcile/);
  assert.throws(() => createScenarioDeltaLedger({
    ...valid,
    baselineUnits: [...toyUnits, toyUnits[0]],
  }), /same baseline and scenario units|Duplicate baseline/);
  assert.throws(() => createScenarioDeltaLedger({
    ...valid,
    scenario: {
      ...scenario,
      units: scenario.units.map((unit, index) => index === 0
        ? { ...unit, geometryId: "changed" }
        : unit),
    },
  }), /changed its geography identity/);
  assert.throws(() => createScenarioDeltaLedger({
    ...valid,
    scenarioState: { ...valid.scenarioState, harrisElectoralVotes: 1 },
  }), /allocation does not reconcile/);

  const invalidOperation = structuredClone(buildToyLedger());
  invalidOperation.operations.find((operation) => operation.operationId === "preference").requestedVolume = 0;
  assert.throws(
    () => validateScenarioDeltaLedger(invalidOperation),
    /cannot exceed or reverse its request/,
  );
});

test("scenario delta ledger package remains headless and deterministic", () => {
  const source = readFileSync(
    new URL("../packages/election-analytics/src/scenarioDeltaLedger.ts", import.meta.url),
    "utf8",
  );
  assert.equal(/react|deck\.gl|mapbox|Math\.random|fetch\(|WebSocket/i.test(source), false);
});
