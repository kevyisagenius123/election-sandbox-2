import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertProbabilityVector,
  assertResultReconciles,
  largestRemainder,
} from "../packages/election-model/src/invariants.ts";
import {
  aggregateNational,
  allocateCappedProportionally,
  applyBehaviorScenario,
  applyCountyTwoPartyMarginShift,
  applyTwoPartyMarginShift,
  applyTwoPartyVoteTransfer,
  deriveBehaviorContributions,
  preferenceShiftBounds,
  thirdPartyShiftBounds,
  toReportingUnitResult,
} from "../packages/election-model/src/scenario.ts";
import { states2024 } from "../src/data/states.ts";
import {
  getDetailedStateManifest,
  pennsylvaniaDetailedStateManifest,
  resolveDetailedStateArtifactUrl,
} from "../src/data/detailedStateManifest.ts";
import {
  buildCountyInspector,
  buildVtdInspector,
} from "../src/data/paInspector.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING,
  PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION,
  PENNSYLVANIA_VTD_ROW_FIELDS,
} from "../src/data/paDemographics.ts";
import {
  buildScenarioUrl,
  decodeScenarioSearch,
  DEFAULT_SCENARIO_URL_STATE,
  SCENARIO_DATA_VERSION,
  SCENARIO_ENGINE_VERSION,
} from "../src/data/scenarioUrl.ts";

const pennsylvaniaCountyDocument = JSON.parse(readFileSync(
  new URL("../src/data/pa-2024-counties.json", import.meta.url),
  "utf8",
));
const pennsylvaniaReportingUnitDocument = JSON.parse(readFileSync(
  new URL("../public/data/pa/2024/reporting-units.json", import.meta.url),
  "utf8",
));
const pennsylvaniaPrecinctGeometryManifest = JSON.parse(readFileSync(
  new URL("../public/data/pa/2024/precinct-geometry-manifest.json", import.meta.url),
  "utf8",
));
const pennsylvaniaVtdCrosswalk = JSON.parse(readFileSync(
  new URL("../data-sources/pennsylvania/2024-vtd-crosswalk.json", import.meta.url),
  "utf8",
));
const pennsylvaniaDemographicArtifactBytes = readFileSync(
  new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url),
);
const pennsylvaniaDemographicRuntimeDocument = JSON.parse(
  pennsylvaniaDemographicArtifactBytes.toString("utf8"),
);
const pennsylvaniaDemographicFoundation = decodePennsylvaniaDemographicFoundation(
  pennsylvaniaDemographicRuntimeDocument,
);
const pennsylvaniaDemographicRegistry = JSON.parse(readFileSync(
  new URL("../data-sources/pennsylvania/2020-pl94-vtd-demographics.json", import.meta.url),
  "utf8",
));

test("Pennsylvania is registered through a versioned detailed-state manifest", () => {
  const manifest = getDetailedStateManifest("PA");
  assert.equal(manifest, pennsylvaniaDetailedStateManifest);
  assert.equal(manifest.compatibility.dataVersion, SCENARIO_DATA_VERSION);
  assert.equal(manifest.compatibility.engineVersion, SCENARIO_ENGINE_VERSION);
  assert.equal(manifest.election.electoralVotes, 19);
  assert.equal(
    resolveDetailedStateArtifactUrl(manifest, "/sandbox/", "https://atlas.example"),
    "https://atlas.example/sandbox/data/pa/2020/vtd-demographics.json",
  );
  assert.doesNotThrow(() => readFileSync(
    new URL(`../public/${manifest.runtime.artifactPath}`, import.meta.url),
  ));
  assert.doesNotThrow(() => readFileSync(
    new URL(`../public/${manifest.geography.precinctGeometryManifestPath}`, import.meta.url),
  ));
  assert.doesNotThrow(() => readFileSync(
    new URL(`../${manifest.sources.electionRegistryPath}`, import.meta.url),
  ));
  assert.doesNotThrow(() => readFileSync(
    new URL(`../${manifest.sources.demographicRegistryPath}`, import.meta.url),
  ));
  assert.throws(() => getDetailedStateManifest("GA"), /not registered/);
});
const noThirdPartyChange = {
  thirdPartyCandidate: "stein",
  thirdPartyShiftPoints: 0,
  thirdPartyHarrisExchangeShare: 0.5,
};

test("largest remainder preserves the required integer total", () => {
  const allocated = largestRemainder([10.4, 5.4, 4.2], 20);
  assert.deepEqual(allocated, [11, 5, 4]);
  assert.equal(allocated.reduce((sum, value) => sum + value, 0), 20);
});

test("reporting-unit totals must reconcile", () => {
  assert.doesNotThrow(() => assertResultReconciles({
    reportingUnitId: "pa-erie-12-03",
    contestId: "2024-president",
    votes: [
      { candidateId: "harris", partyId: "democratic", votes: 530 },
      { candidateId: "trump", partyId: "republican", votes: 460 },
      { candidateId: "other", partyId: null, votes: 10 },
    ],
    totalVotes: 1000,
    ballotMode: null,
  }));

  assert.throws(() => assertResultReconciles({
    reportingUnitId: "broken-unit",
    contestId: "2024-president",
    votes: [{ candidateId: "harris", partyId: "democratic", votes: 9 }],
    totalVotes: 10,
    ballotMode: null,
  }), /candidates sum to 9/);
});

test("candidate probabilities must be a valid vector", () => {
  assert.doesNotThrow(() => assertProbabilityVector([0.49, 0.48, 0.03]));
  assert.throws(() => assertProbabilityVector([0.6, 0.5]), /sum to/);
  assert.throws(() => assertProbabilityVector([1.1, -0.1]), /between zero and one/);
});

test("official state baselines reconcile to the national FEC totals", () => {
  const national = aggregateNational(states2024);
  assert.deepEqual(national, {
    totalVotes: 155_238_302,
    harrisVotes: 75_017_613,
    trumpVotes: 77_302_580,
    otherVotes: 2_918_109,
    harrisElectoralVotes: 226,
    trumpElectoralVotes: 312,
  });
});

test("a two-party margin shift preserves total votes and other votes", () => {
  const pennsylvania = states2024.find((state) => state.code === "PA");
  assert.ok(pennsylvania);

  const unchanged = applyTwoPartyMarginShift(pennsylvania, 0);
  assert.deepEqual(unchanged, pennsylvania);

  const shifted = applyTwoPartyMarginShift(pennsylvania, 1.8);
  assert.equal(shifted.totalVotes, pennsylvania.totalVotes);
  assert.equal(shifted.otherVotes, pennsylvania.otherVotes);
  assert.equal(
    shifted.harrisVotes + shifted.trumpVotes,
    pennsylvania.harrisVotes + pennsylvania.trumpVotes,
  );
  assert.equal(shifted.harrisElectoralVotes, 19);
  assert.equal(shifted.trumpElectoralVotes, 0);
  assert.doesNotThrow(() => toReportingUnitResult(shifted));
});

test("two-party transfers distribute exactly without changing unit totals", () => {
  const actual = [
    { id: "a", harrisVotes: 60, trumpVotes: 40, otherVotes: 3, totalVotes: 103 },
    { id: "b", harrisVotes: 20, trumpVotes: 80, otherVotes: 2, totalVotes: 102 },
  ];
  const scenario = applyTwoPartyVoteTransfer(actual, 17);
  assert.equal(scenario.reduce((sum, unit) => sum + unit.netHarrisGain, 0), 17);
  scenario.forEach((unit, index) => {
    assert.equal(unit.harrisVotes + unit.trumpVotes, actual[index].harrisVotes + actual[index].trumpVotes);
    assert.equal(unit.totalVotes, actual[index].totalVotes);
    assert.equal(unit.otherVotes, actual[index].otherVotes);
  });
});

test("Pennsylvania official county results reconcile without fabricating the statewide residual", () => {
  assert.equal(pennsylvaniaCountyDocument.counties.length, 67);
  assert.deepEqual(pennsylvaniaCountyDocument.totals, {
    harrisVotes: 3_423_042,
    trumpVotes: 3_543_308,
    steinVotes: 34_538,
    oliverVotes: 33_318,
    residualOtherVotes: 24_526,
    otherVotes: 92_382,
    totalVotes: 7_058_732,
  });
  assert.deepEqual(pennsylvaniaCountyDocument.mappedCountyTotals, {
    harrisVotes: 3_423_042,
    trumpVotes: 3_543_308,
    steinVotes: 34_538,
    oliverVotes: 33_318,
    residualOtherVotes: 0,
    otherVotes: 67_856,
    totalVotes: 7_034_206,
  });
  assert.equal(pennsylvaniaCountyDocument.unassignedStatewideVotes, 24_526);

  for (const county of pennsylvaniaCountyDocument.counties) {
    assert.equal(county.harrisVotes + county.trumpVotes + county.otherVotes, county.totalVotes);
    assert.equal(county.steinVotes + county.oliverVotes + county.residualOtherVotes, county.otherVotes);
    assert.equal(county.electionDayVotes + county.mailVotes + county.provisionalVotes, county.totalVotes);
  }
});

test("Pennsylvania county shifts aggregate exactly to the statewide scenario", () => {
  const pennsylvania = states2024.find((state) => state.code === "PA");
  assert.ok(pennsylvania);
  const counties = pennsylvaniaCountyDocument.counties;
  const shiftedCounties = applyCountyTwoPartyMarginShift(counties, pennsylvania, 2.4);
  const shiftedState = applyTwoPartyMarginShift(pennsylvania, 2.4);
  const countyHarris = shiftedCounties.reduce((sum, county) => sum + county.harrisVotes, 0);
  const countyTrump = shiftedCounties.reduce((sum, county) => sum + county.trumpVotes, 0);

  assert.equal(countyHarris, shiftedState.harrisVotes);
  assert.equal(countyTrump, shiftedState.trumpVotes);
  shiftedCounties.forEach((county, index) => {
    assert.equal(county.totalVotes, counties[index].totalVotes);
    assert.equal(county.otherVotes, counties[index].otherVotes);
  });
});

test("Pennsylvania reporting units and explicit residual buckets reconcile to the state", () => {
  assert.equal(pennsylvaniaReportingUnitDocument.reportingUnits.length, 9_189);
  const totals = pennsylvaniaReportingUnitDocument.reportingUnits.reduce((sum, unit) => {
    assert.equal(unit.harrisVotes + unit.trumpVotes + unit.otherVotes, unit.totalVotes);
    assert.equal(unit.steinVotes + unit.oliverVotes + unit.residualOtherVotes, unit.otherVotes);
    sum.harrisVotes += unit.harrisVotes;
    sum.trumpVotes += unit.trumpVotes;
    sum.steinVotes += unit.steinVotes;
    sum.oliverVotes += unit.oliverVotes;
    sum.residualOtherVotes += unit.residualOtherVotes;
    sum.otherVotes += unit.otherVotes;
    sum.totalVotes += unit.totalVotes;
    return sum;
  }, {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
  });
  assert.deepEqual(totals, pennsylvaniaCountyDocument.totals);
  assert.equal(
    pennsylvaniaReportingUnitDocument.reportingUnits.filter((unit) => unit.type === "other_bucket").length,
    2,
  );
});

test("Pennsylvania VTD crosswalk preserves explicit matched and unmatched coverage", () => {
  const totals = pennsylvaniaPrecinctGeometryManifest.totals;
  assert.equal(pennsylvaniaPrecinctGeometryManifest.counties.length, 67);
  assert.equal(totals.geometryFeatureCount, 9_178);
  assert.equal(totals.resultReportingUnitCount, 9_187);
  assert.equal(totals.matchedReportingUnitCount, 9_087);
  assert.equal(totals.unmatchedReportingUnitCount, 100);
  assert.equal(totals.exactIdentifierMatchCount, 8_636);
  assert.equal(totals.canonicalNameMatchCount, 451);
  assert.equal(
    totals.matchedReportingUnitCount + totals.unmatchedReportingUnitCount,
    totals.resultReportingUnitCount,
  );
  assert.equal(
    totals.exactIdentifierMatchCount + totals.canonicalNameMatchCount,
    totals.matchedReportingUnitCount,
  );
  assert.equal(totals.matchedVotes.totalVotes, 6_933_560);
  assert.equal(totals.resultVotes.totalVotes, 7_031_737);
  assert.equal(totals.resultVoteCoveragePct, 98.6038);
  assert.equal(pennsylvaniaVtdCrosswalk.unmatchedReportingUnits.length, 100);
  assert.equal(
    pennsylvaniaVtdCrosswalk.matchedGeometry.reduce(
      (sum, geometry) => sum + geometry.reportingUnits.length,
      0,
    ),
    9_087,
  );
});

test("capped proportional allocation preserves totals and respects capacity", () => {
  const allocation = allocateCappedProportionally([1, 1], [1, 10], 5);
  assert.deepEqual(allocation, [1, 4]);
  assert.equal(allocation.reduce((sum, value) => sum + value, 0), 5);
  assert.throws(
    () => allocateCappedProportionally([1], [2], 3),
    /exceeds capacity/,
  );
});

test("turnout additions and preference transfers remain separate and exact", () => {
  const baseline = [
    {
      id: "a",
      countyFips: "42001",
      geometryId: "a",
      harrisVotes: 40,
      trumpVotes: 30,
      steinVotes: 0,
      oliverVotes: 0,
      residualOtherVotes: 0,
      otherVotes: 0,
      totalVotes: 70,
      turnoutDenominator: 100,
      turnoutCapacity: 30,
    },
    {
      id: "b",
      countyFips: "42003",
      geometryId: "b",
      harrisVotes: 20,
      trumpVotes: 30,
      steinVotes: 0,
      oliverVotes: 0,
      residualOtherVotes: 0,
      otherVotes: 0,
      totalVotes: 50,
      turnoutDenominator: 100,
      turnoutCapacity: 50,
    },
    {
      id: "residual",
      countyFips: null,
      geometryId: null,
      harrisVotes: 5,
      trumpVotes: 5,
      steinVotes: 0,
      oliverVotes: 0,
      residualOtherVotes: 2,
      otherVotes: 2,
      totalVotes: 12,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    },
  ];
  const scenario = applyBehaviorScenario(baseline, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 10,
    addedVoterHarrisShare: 0.6,
    preferenceShiftPoints: 2,
  });

  assert.deepEqual(scenario.turnout, {
    requestedVotes: 20,
    addedVotes: 20,
    harrisVotes: 12,
    trumpVotes: 8,
    denominator: 200,
    capacity: 80,
  });
  assert.equal(scenario.preference.requestedTransfer, 2);
  assert.equal(scenario.preference.realizedTransfer, 2);
  assert.deepEqual(scenario.totals, {
    harrisVotes: 79,
    trumpVotes: 71,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 2,
    otherVotes: 2,
    totalVotes: 152,
  });
  scenario.units.forEach((unit) => {
    assert.equal(unit.harrisVotes + unit.trumpVotes + unit.otherVotes, unit.totalVotes);
  });
});

test("preference bounds expose the full feasible range in both directions", () => {
  const baseline = [{
    id: "state",
    countyFips: "42001",
    geometryId: "unit",
    harrisVotes: 60,
    trumpVotes: 40,
    steinVotes: 4,
    oliverVotes: 3,
    residualOtherVotes: 3,
    otherVotes: 10,
    totalVotes: 110,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  }];
  const bounds = preferenceShiftBounds(baseline[0]);
  const towardHarris = applyBehaviorScenario(baseline, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: bounds.towardHarrisPoints,
  });
  const towardTrump = applyBehaviorScenario(baseline, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: bounds.towardTrumpPoints,
  });

  assert.equal(towardHarris.totals.trumpVotes, 0);
  assert.equal(towardHarris.totals.harrisVotes, 100);
  assert.equal(towardTrump.totals.harrisVotes, 0);
  assert.equal(towardTrump.totals.trumpVotes, 100);
  assert.equal(towardHarris.totals.totalVotes, 110);
  assert.equal(towardTrump.totals.totalVotes, 110);
});

test("third-party gains use the explicit major-party source mix and preserve every ballot", () => {
  const baseline = [
    {
      id: "urban",
      countyFips: "42101",
      geometryId: "urban",
      harrisVotes: 70,
      trumpVotes: 20,
      steinVotes: 6,
      oliverVotes: 2,
      residualOtherVotes: 2,
      otherVotes: 10,
      totalVotes: 100,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    },
    {
      id: "rural",
      countyFips: "42001",
      geometryId: "rural",
      harrisVotes: 30,
      trumpVotes: 60,
      steinVotes: 4,
      oliverVotes: 4,
      residualOtherVotes: 2,
      otherVotes: 10,
      totalVotes: 100,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    },
  ];
  const scenario = applyBehaviorScenario(baseline, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 10,
    thirdPartyHarrisExchangeShare: 0.25,
  });

  assert.deepEqual(scenario.thirdParty, {
    candidate: "stein",
    startingCandidateVotes: 10,
    exchangeCapacity: 107,
    ballotTotal: 200,
    requestedCandidateDelta: 20,
    realizedCandidateDelta: 20,
    harrisVoteDelta: -5,
    trumpVoteDelta: -15,
  });
  assert.deepEqual(scenario.totals, {
    harrisVotes: 95,
    trumpVotes: 65,
    steinVotes: 30,
    oliverVotes: 6,
    residualOtherVotes: 4,
    otherVotes: 40,
    totalVotes: 200,
  });
  scenario.units.forEach((unit, index) => {
    assert.equal(unit.totalVotes, baseline[index].totalVotes);
    assert.equal(unit.harrisVotes + unit.trumpVotes + unit.otherVotes, unit.totalVotes);
    assert.equal(unit.steinVotes + unit.oliverVotes + unit.residualOtherVotes, unit.otherVotes);
  });
  const contributions = deriveBehaviorContributions(baseline, scenario.units);
  assert.equal(contributions.reduce((sum, unit) => sum + unit.marginDelta, 0), 10);
  assert.equal(contributions.reduce((sum, unit) => sum + unit.otherDelta, 0), 20);
  assert.equal(contributions.reduce((sum, unit) => sum + unit.ballotDelta, 0), 0);
});

test("third-party removal can reach zero and returns ballots at the chosen source share", () => {
  const baseline = [{
    id: "state",
    countyFips: null,
    geometryId: null,
    harrisVotes: 40,
    trumpVotes: 40,
    steinVotes: 5,
    oliverVotes: 10,
    residualOtherVotes: 5,
    otherVotes: 20,
    totalVotes: 100,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  }];
  const bounds = thirdPartyShiftBounds(baseline[0], "oliver", 1);
  const scenario = applyBehaviorScenario(baseline, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "oliver",
    thirdPartyShiftPoints: bounds.towardZeroPoints,
    thirdPartyHarrisExchangeShare: 1,
  });

  assert.deepEqual(bounds, { towardZeroPoints: -10, towardMaximumPoints: 40 });
  assert.equal(scenario.totals.harrisVotes, 50);
  assert.equal(scenario.totals.trumpVotes, 40);
  assert.equal(scenario.totals.oliverVotes, 0);
  assert.equal(scenario.totals.otherVotes, 10);
  assert.equal(scenario.totals.totalVotes, 100);
  assert.equal(scenario.thirdParty.realizedCandidateDelta, -10);
  assert.equal(scenario.thirdParty.harrisVoteDelta, 10);
  assert.equal(scenario.thirdParty.trumpVoteDelta, 0);
});

test("third-party positive bounds reach the exact rounded source capacity", () => {
  const baseline = [{
    id: "state",
    countyFips: null,
    geometryId: null,
    harrisVotes: 1,
    trumpVotes: 9,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 10,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  }];
  const bounds = thirdPartyShiftBounds(baseline[0], "stein", 0.4);
  const scenario = applyBehaviorScenario(baseline, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: bounds.towardMaximumPoints,
    thirdPartyHarrisExchangeShare: 0.4,
  });

  assert.equal(bounds.towardMaximumPoints, 30);
  assert.equal(scenario.thirdParty.realizedCandidateDelta, 3);
  assert.equal(scenario.totals.harrisVotes, 0);
  assert.equal(scenario.totals.trumpVotes, 7);
  assert.equal(scenario.totals.steinVotes, 3);
  assert.equal(scenario.totals.totalVotes, 10);
  assert.ok(scenario.units.every((unit) => (
    unit.harrisVotes >= 0
    && unit.trumpVotes >= 0
    && unit.otherVotes >= 0
  )));
});

test("behavior contributions reconcile exactly and preserve Republican direction", () => {
  const baseline = [
    {
      id: "a",
      countyFips: "42001",
      geometryId: "a",
      harrisVotes: 60,
      trumpVotes: 40,
      steinVotes: 0,
      oliverVotes: 0,
      residualOtherVotes: 0,
      otherVotes: 0,
      totalVotes: 100,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    },
    {
      id: "b",
      countyFips: "42003",
      geometryId: "b",
      harrisVotes: 30,
      trumpVotes: 70,
      steinVotes: 0,
      oliverVotes: 0,
      residualOtherVotes: 0,
      otherVotes: 0,
      totalVotes: 100,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    },
  ];
  const scenario = applyBehaviorScenario(baseline, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: -10,
  });
  const contributions = deriveBehaviorContributions(baseline, scenario.units);
  const contributionMargin = contributions.reduce((sum, unit) => sum + unit.marginDelta, 0);
  const baselineMargin = baseline.reduce(
    (sum, unit) => sum + unit.harrisVotes - unit.trumpVotes,
    0,
  );
  const scenarioMargin = scenario.totals.harrisVotes - scenario.totals.trumpVotes;

  assert.equal(contributionMargin, scenarioMargin - baselineMargin);
  assert.equal(contributionMargin, -20);
  assert.ok(contributions.every((unit) => unit.marginDelta <= 0));
  assert.equal(contributions.reduce((sum, unit) => sum + unit.ballotDelta, 0), 0);
});

test("Pennsylvania Census VTD demographics reconcile and preserve unavailable coverage", () => {
  const foundation = pennsylvaniaDemographicFoundation;
  assert.equal(foundation.schemaVersion, PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION);
  assert.equal(foundation.encoding, PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING);
  assert.equal(foundation.source.pipelineVersion, "pa-pl94-vtd-demographics-v3");
  assert.equal(foundation.source.archiveSha256, "2d33a7dab29c8dd5692bbde203d253e06eebbc44fcbaa96b1caa958d454026ae");
  assert.equal(foundation.vtds.length, 9_178);
  assert.equal(foundation.join.mappedElectionGeometryCount, 9_038);
  assert.equal(foundation.join.unavailableElectionGeometryCount, 140);
  assert.equal(foundation.residualUnits.length, 102);
  assert.equal(foundation.totals.statewideDemographics.votingAgePopulation, 10_353_548);
  assert.equal(foundation.totals.turnoutCapacity, 3_281_256);
  assert.deepEqual(foundation.totals.certifiedVotes, pennsylvaniaCountyDocument.totals);
  assert.equal(
    foundation.vtds
      .reduce((sum, vtd) => sum + vtd.exactSourceUnitCount, 0),
    8_636,
  );
  assert.equal(
    foundation.vtds
      .reduce((sum, vtd) => sum + vtd.canonicalSourceUnitCount, 0),
    451,
  );
  assert.ok(foundation.vtds
    .filter((vtd) => !vtd.hasMappedResult)
    .every((vtd) => (
      vtd.resultMatchMethod === null
      && vtd.sourceUnitCount === 0
      && vtd.exactSourceUnitCount === 0
      && vtd.canonicalSourceUnitCount === 0
    )));

  for (const vtd of foundation.vtds) {
    assert.equal(
      vtd.hispanicAnyRace
        + vtd.nonHispanicWhite
        + vtd.nonHispanicBlack
        + vtd.nonHispanicAsian
        + vtd.nonHispanicOther,
      vtd.votingAgePopulation,
    );
  }
});

test("Pennsylvania demographic runtime artifact is compact, self-describing, and checksummed", () => {
  const runtime = pennsylvaniaDemographicRuntimeDocument;
  assert.equal(runtime.schemaVersion, PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION);
  assert.equal(runtime.encoding, PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING);
  assert.deepEqual(runtime.vtdFields, [...PENNSYLVANIA_VTD_ROW_FIELDS]);
  assert.equal(runtime.vtdRows.length, 9_178);
  assert.equal("vtds" in runtime, false);
  assert.ok(pennsylvaniaDemographicArtifactBytes.byteLength < 900_000);
  assert.equal(
    pennsylvaniaDemographicRegistry.artifact.byteSize,
    pennsylvaniaDemographicArtifactBytes.byteLength,
  );
  assert.equal(pennsylvaniaDemographicRegistry.artifact.schemaVersion, 3);
  assert.equal(pennsylvaniaDemographicRegistry.artifact.encoding, "vtd-row-v1");
  assert.equal(pennsylvaniaDemographicRegistry.artifact.rowCount, 9_178);
  assert.equal(
    pennsylvaniaDemographicRegistry.artifact.sha256,
    createHash("sha256").update(pennsylvaniaDemographicArtifactBytes).digest("hex"),
  );
});

test("Pennsylvania demographic decoder fails closed on incompatible or corrupted rows", () => {
  const futureSchema = {
    ...pennsylvaniaDemographicRuntimeDocument,
    schemaVersion: 99,
  };
  assert.throws(
    () => decodePennsylvaniaDemographicFoundation(futureSchema),
    /Unsupported Pennsylvania demographic schema 99/,
  );

  const incompatibleFields = structuredClone(pennsylvaniaDemographicRuntimeDocument);
  incompatibleFields.vtdFields[3] = "eligiblePopulation";
  assert.throws(
    () => decodePennsylvaniaDemographicFoundation(incompatibleFields),
    /field contract is incompatible/,
  );

  const brokenDemographics = structuredClone(pennsylvaniaDemographicRuntimeDocument);
  brokenDemographics.vtdRows[0][3] += 1;
  assert.throws(
    () => decodePennsylvaniaDemographicFoundation(brokenDemographics),
    /demographic cells do not reconcile to VAP/,
  );

  const duplicateGeoid = structuredClone(pennsylvaniaDemographicRuntimeDocument);
  duplicateGeoid.vtdRows[1][0] = duplicateGeoid.vtdRows[0][0];
  assert.throws(
    () => decodePennsylvaniaDemographicFoundation(duplicateGeoid),
    /unique sorted GEOIDs/,
  );
});

test("selected-geography inspectors preserve county, VTD, and unavailable distinctions", () => {
  const foundation = pennsylvaniaDemographicFoundation;
  const units = [
    ...foundation.vtds
      .filter((vtd) => vtd.hasMappedResult)
      .map((vtd) => ({
        id: `vtd-${vtd.geoid}`,
        countyFips: vtd.countyFips,
        geometryId: vtd.geoid,
        ...vtd.baselineVotes,
        turnoutDenominator: vtd.denominatorStatus === "available"
          ? vtd.votingAgePopulation
          : null,
        turnoutCapacity: vtd.denominatorStatus === "available"
          ? vtd.turnoutCapacity
          : 0,
      })),
    ...foundation.residualUnits.map((unit) => ({
      ...unit,
      geometryId: null,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    })),
  ];
  const scenario = applyBehaviorScenario(units, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
  });
  const adams = pennsylvaniaCountyDocument.counties.find((county) => county.fips === "42001");
  assert.ok(adams);
  const countyInspector = buildCountyInspector(
    adams,
    { ...adams, netHarrisGain: 0 },
    foundation,
    scenario.units,
    "stein",
  );
  const adamsSummary = foundation.counties.find((county) => county.countyFips === "42001");
  assert.ok(adamsSummary);
  assert.equal(countyInspector.kind, "county");
  assert.equal(countyInspector.votingAgePopulation, 83_005);
  assert.equal(countyInspector.coverage.mappedBallots, adamsSummary.mappedVotes.totalVotes);
  assert.equal(countyInspector.coverage.officialBallots, adams.totalVotes);
  assert.equal(countyInspector.operations.marginDelta, 0);

  const exactVtd = foundation.vtds.find(
    (vtd) => vtd.resultMatchMethod === "exact_vtd_identifier",
  );
  assert.ok(exactVtd);
  const exactInspector = buildVtdInspector(
    exactVtd,
    scenario.units.find((unit) => unit.geometryId === exactVtd.geoid),
    "Adams County",
    "stein",
  );
  assert.equal(exactInspector.coverage.resultMatchMethod, "exact_vtd_identifier");
  assert.ok(exactInspector.coverage.sourceUnitCount > 0);
  assert.equal(exactInspector.actualVotes.totalVotes, exactInspector.scenarioVotes.totalVotes);

  const unmatchedVtd = foundation.vtds.find((vtd) => !vtd.hasMappedResult);
  assert.ok(unmatchedVtd);
  const unavailableInspector = buildVtdInspector(
    unmatchedVtd,
    undefined,
    "Pennsylvania",
    "stein",
  );
  assert.equal(unavailableInspector.denominatorStatus, "no_mapped_2024_result");
  assert.equal(unavailableInspector.coverage.resultMatchMethod, null);
  assert.equal(unavailableInspector.turnoutRatePct, null);
  assert.equal(unavailableInspector.actualVotes.totalVotes, 0);
  assert.equal(unavailableInspector.scenarioVotes.totalVotes, 0);
});

test("zero-change Pennsylvania behavior model returns the certified baseline exactly", () => {
  const foundation = pennsylvaniaDemographicFoundation;
  const units = [
    ...foundation.vtds
      .filter((vtd) => vtd.hasMappedResult)
      .map((vtd) => ({
        id: `vtd-${vtd.geoid}`,
        countyFips: vtd.countyFips,
        geometryId: vtd.geoid,
        ...vtd.baselineVotes,
        turnoutDenominator: vtd.denominatorStatus === "available"
          ? vtd.votingAgePopulation
          : null,
        turnoutCapacity: vtd.denominatorStatus === "available"
          ? vtd.turnoutCapacity
          : 0,
      })),
    ...foundation.residualUnits.map((unit) => ({
      ...unit,
      geometryId: null,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    })),
  ];
  const scenario = applyBehaviorScenario(units, {
    ...noThirdPartyChange,
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.55,
    preferenceShiftPoints: 0,
  });
  assert.deepEqual(scenario.totals, pennsylvaniaCountyDocument.totals);
  assert.equal(scenario.turnout.addedVotes, 0);
  assert.equal(scenario.preference.realizedTransfer, 0);
  assert.equal(scenario.thirdParty.realizedCandidateDelta, 0);
});

test("Pennsylvania third-party scenarios retain exact named and statewide reconciliation", () => {
  const foundation = pennsylvaniaDemographicFoundation;
  const units = [
    ...foundation.vtds
      .filter((vtd) => vtd.hasMappedResult)
      .map((vtd) => ({
        id: `vtd-${vtd.geoid}`,
        countyFips: vtd.countyFips,
        geometryId: vtd.geoid,
        ...vtd.baselineVotes,
        turnoutDenominator: vtd.denominatorStatus === "available"
          ? vtd.votingAgePopulation
          : null,
        turnoutCapacity: vtd.denominatorStatus === "available"
          ? vtd.turnoutCapacity
          : 0,
      })),
    ...foundation.residualUnits.map((unit) => ({
      ...unit,
      geometryId: null,
      turnoutDenominator: null,
      turnoutCapacity: 0,
    })),
  ];
  const scenario = applyBehaviorScenario(units, {
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.5,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 1.5,
    thirdPartyHarrisExchangeShare: 0.65,
  });
  const expectedTransfer = Math.round(pennsylvaniaCountyDocument.totals.totalVotes * 0.015);

  assert.equal(scenario.thirdParty.realizedCandidateDelta, expectedTransfer);
  assert.equal(
    scenario.totals.steinVotes,
    pennsylvaniaCountyDocument.totals.steinVotes + expectedTransfer,
  );
  assert.equal(scenario.totals.oliverVotes, pennsylvaniaCountyDocument.totals.oliverVotes);
  assert.equal(
    scenario.totals.residualOtherVotes,
    pennsylvaniaCountyDocument.totals.residualOtherVotes,
  );
  assert.equal(scenario.totals.totalVotes, pennsylvaniaCountyDocument.totals.totalVotes);
  assert.equal(
    scenario.totals.harrisVotes + scenario.totals.trumpVotes,
    pennsylvaniaCountyDocument.totals.harrisVotes
      + pennsylvaniaCountyDocument.totals.trumpVotes
      - expectedTransfer,
  );
  assert.equal(
    scenario.units.reduce((sum, unit) => sum + unit.thirdPartyCandidateDelta, 0),
    expectedTransfer,
  );
});

test("versioned scenario URLs round-trip every assumption and selected geography", () => {
  const state = {
    turnoutIncreasePoints: 1.2,
    addedVoterHarrisShare: 63,
    preferenceShiftPoints: -4.7,
    thirdPartyCandidate: "oliver",
    thirdPartyShiftPoints: 0.8,
    thirdPartyHarrisExchangeShare: 41,
    viewMode: "difference",
    behaviorEditorMode: "third-party",
    contributionScope: "vtd",
    selectedStateCode: "PA",
    selectedCountyFips: "42003",
    selectedVtdGeoid: "42003000010",
  };
  const url = buildScenarioUrl(
    "https://atlas.example/lab/?utm_source=review#methodology",
    state,
    { force: true, clearHash: true },
  );
  const parsedUrl = new URL(url);
  const decoded = decodeScenarioSearch(parsedUrl.search);

  assert.equal(parsedUrl.searchParams.get("data"), SCENARIO_DATA_VERSION);
  assert.equal(parsedUrl.searchParams.get("engine"), SCENARIO_ENGINE_VERSION);
  assert.equal(parsedUrl.searchParams.get("utm_source"), "review");
  assert.equal(parsedUrl.hash, "");
  assert.equal(decoded.status, "valid");
  assert.deepEqual(decoded.state, state);
});

test("versioned scenario URLs preserve official alphanumeric VTD GEOIDs", () => {
  const state = {
    ...DEFAULT_SCENARIO_URL_STATE,
    selectedStateCode: "PA",
    selectedCountyFips: "42003",
    selectedVtdGeoid: "4200300A000",
  };
  const url = buildScenarioUrl("https://atlas.example/", state, { force: true });
  const decoded = decodeScenarioSearch(new URL(url).search);
  assert.equal(decoded.status, "valid");
  assert.deepEqual(decoded.state, state);
});

test("scenario URL replay produces the same deterministic result", () => {
  const baseline = [{
    id: "state",
    countyFips: "42003",
    geometryId: "42003000010",
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
  const state = {
    ...DEFAULT_SCENARIO_URL_STATE,
    turnoutIncreasePoints: 1.2,
    addedVoterHarrisShare: 60,
    preferenceShiftPoints: 2.4,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: -1,
    thirdPartyHarrisExchangeShare: 75,
  };
  const url = buildScenarioUrl("https://atlas.example/", state, { force: true });
  const decoded = decodeScenarioSearch(new URL(url).search);
  assert.equal(decoded.status, "valid");

  const scenarioSettings = (urlState) => ({
    turnoutIncreasePoints: urlState.turnoutIncreasePoints,
    addedVoterHarrisShare: urlState.addedVoterHarrisShare / 100,
    preferenceShiftPoints: urlState.preferenceShiftPoints,
    thirdPartyCandidate: urlState.thirdPartyCandidate,
    thirdPartyShiftPoints: urlState.thirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare: urlState.thirdPartyHarrisExchangeShare / 100,
  });
  assert.deepEqual(
    applyBehaviorScenario(baseline, scenarioSettings(decoded.state)),
    applyBehaviorScenario(baseline, scenarioSettings(state)),
  );
});

test("baseline URLs stay clean until an explicit share is requested", () => {
  const staleUrl = `https://atlas.example/lab/?utm_source=review&scenario=1&data=${SCENARIO_DATA_VERSION}&engine=${SCENARIO_ENGINE_VERSION}#top`;
  const passiveUrl = new URL(buildScenarioUrl(staleUrl, { ...DEFAULT_SCENARIO_URL_STATE }));
  const sharedUrl = new URL(buildScenarioUrl(
    staleUrl,
    { ...DEFAULT_SCENARIO_URL_STATE },
    { force: true, clearHash: true },
  ));

  assert.equal(passiveUrl.searchParams.get("scenario"), null);
  assert.equal(passiveUrl.searchParams.get("utm_source"), "review");
  assert.equal(passiveUrl.hash, "#top");
  assert.equal(sharedUrl.searchParams.get("scenario"), "1");
  assert.equal(sharedUrl.searchParams.get("data"), SCENARIO_DATA_VERSION);
  assert.equal(sharedUrl.searchParams.get("engine"), SCENARIO_ENGINE_VERSION);
  assert.equal(sharedUrl.hash, "");
});

test("unknown scenario, data, and engine versions fall back safely", () => {
  const futureSchema = decodeScenarioSearch(
    `?scenario=99&data=${SCENARIO_DATA_VERSION}&engine=${SCENARIO_ENGINE_VERSION}`,
  );
  const futureData = decodeScenarioSearch(
    `?scenario=1&data=future-data&engine=${SCENARIO_ENGINE_VERSION}`,
  );
  const futureEngine = decodeScenarioSearch(
    `?scenario=1&data=${SCENARIO_DATA_VERSION}&engine=future-engine`,
  );

  for (const result of [futureSchema, futureData, futureEngine]) {
    assert.equal(result.status, "unsupported");
    assert.deepEqual(result.state, DEFAULT_SCENARIO_URL_STATE);
  }
});

test("malformed scenario values and geography never apply partially", () => {
  const prefix = `?scenario=1&data=${SCENARIO_DATA_VERSION}&engine=${SCENARIO_ENGINE_VERSION}`;
  const malformedNumber = decodeScenarioSearch(`${prefix}&turnout=2`);
  const mismatchedVtd = decodeScenarioSearch(
    `${prefix}&state=PA&county=42003&vtd=42001000010`,
  );
  const duplicateControl = decodeScenarioSearch(`${prefix}&turnout=1&turnout=1.2`);

  for (const result of [malformedNumber, mismatchedVtd, duplicateControl]) {
    assert.equal(result.status, "invalid");
    assert.deepEqual(result.state, DEFAULT_SCENARIO_URL_STATE);
  }
});
