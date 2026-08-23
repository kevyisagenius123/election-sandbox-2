import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScenarioExplanation,
  createScenarioDeltaLedger,
} from "../packages/election-analytics/src/index.ts";
import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";

const units = [
  {
    id: "A-1",
    countyFips: "00001",
    geometryId: "map-A-1",
    harrisVotes: 60,
    trumpVotes: 40,
    steinVotes: 5,
    oliverVotes: 2,
    residualOtherVotes: 3,
    otherVotes: 10,
    totalVotes: 110,
    turnoutDenominator: 150,
    turnoutCapacity: 40,
  },
  {
    id: "B-1",
    countyFips: "00003",
    geometryId: "map-B-1",
    harrisVotes: 10,
    trumpVotes: 90,
    steinVotes: 5,
    oliverVotes: 2,
    residualOtherVotes: 3,
    otherVotes: 10,
    totalVotes: 110,
    turnoutDenominator: 150,
    turnoutCapacity: 40,
  },
];

function endpointFromUnits(sourceUnits, electoralVotes = 10) {
  const totals = sourceUnits.reduce((sum, unit) => ({
    harrisVotes: sum.harrisVotes + unit.harrisVotes,
    trumpVotes: sum.trumpVotes + unit.trumpVotes,
    otherVotes: sum.otherVotes + unit.otherVotes,
    totalVotes: sum.totalVotes + unit.totalVotes,
  }), { harrisVotes: 0, trumpVotes: 0, otherVotes: 0, totalVotes: 0 });
  const harrisWins = totals.harrisVotes > totals.trumpVotes;
  return {
    code: "TS",
    ...totals,
    harrisElectoralVotes: harrisWins ? electoralVotes : 0,
    trumpElectoralVotes: harrisWins ? 0 : electoralVotes,
  };
}

function buildLedger(settings) {
  const scenario = applyBehaviorScenario(units, settings);
  const actualState = endpointFromUnits(units);
  const scenarioState = endpointFromUnits(scenario.units);
  return createScenarioDeltaLedger({
    actualState,
    scenarioState,
    baselineUnits: units,
    scenario,
    targetCandidate: "harris",
    sourceIds: ["source:test-foundation", "source:test-recipe"],
  });
}

test("scenario explanation connects the dominant operation, geography, and electoral consequence", () => {
  const ledger = buildLedger({
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 40,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  });
  const explanation = buildScenarioExplanation({
    ledger,
    countyNames: { "00001": "Alpha County", "00003": "Beta County" },
    unitNames: { "map-A-1": "Alpha Ward", "map-B-1": "Beta Ward" },
  });

  assert.equal(explanation.direction, "harris");
  assert.equal(explanation.marginVotes, ledger.delta.harrisTrumpMarginVotes);
  assert.deepEqual(explanation.dominantOperation, {
    operationId: "preference",
    marginVotes: ledger.operations[1].delta.harrisTrumpMarginVotes,
    grossShareMillionths: 1_000_000,
  });
  assert.equal(explanation.largestSupportingCounty.name, "Beta County");
  assert.equal(explanation.largestSupportingUnit.name, "Beta Ward");
  assert.equal(explanation.electoral.actualWinner, "trump");
  assert.equal(explanation.electoral.scenarioWinner, "harris");
  assert.equal(explanation.electoral.winnerChanged, true);
  assert.equal(explanation.electoral.targetElectoralDelta, 10);
});

test("scenario explanation identifies local offsets without changing the statewide direction", () => {
  const ledger = buildLedger({
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 8,
    thirdPartyHarrisExchangeShare: 0.8,
  });
  const explanation = buildScenarioExplanation({
    ledger,
    countyNames: { "00001": "Alpha County", "00003": "Beta County" },
  });

  assert.equal(explanation.direction, "trump");
  assert.equal(explanation.dominantOperation.operationId, "third-party");
  assert.equal(explanation.largestSupportingCounty.name, "Alpha County");
  assert.equal(explanation.largestOpposingCounty?.name, "Beta County");
  assert.ok(explanation.largestSupportingCounty.marginVotes < 0);
  assert.ok(explanation.largestOpposingCounty.marginVotes > 0);
});

test("zero movement produces an explicit baseline explanation without invented geography", () => {
  const ledger = buildLedger({
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  });
  const first = buildScenarioExplanation({ ledger });
  const second = buildScenarioExplanation({ ledger: {
    ...ledger,
    counties: [...ledger.counties].reverse(),
    units: [...ledger.units].reverse(),
  } });

  assert.equal(first.direction, "none");
  assert.equal(first.dominantOperation, null);
  assert.equal(first.largestSupportingCounty, null);
  assert.equal(first.largestOpposingCounty, null);
  assert.equal(first.largestSupportingUnit, null);
  assert.equal(first.electoral.winnerChanged, false);
  assert.deepEqual(first, second);
});
