import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";

import { applyBehaviorScenario } from "../packages/election-model/src/scenario.ts";
import {
  compileNationalReplay,
  createReplayReducerContext,
  createReportedAnalyticsEnvelope,
  deriveCountyReportedAnalytics,
  deriveFullReportedAnalytics,
  deriveJurisdictionReportedAnalytics,
  deriveNationalReportedAnalytics,
  lockElectionEndpoint,
  reduceReplayToEventCount,
  replayReducerStateFingerprint,
  serializeDerivedReportedAnalytics,
} from "../packages/election-replay/src/index.ts";
import { decodeMichiganDemographicFoundation, toMichiganBehaviorModelUnits } from "../src/data/miDemographics.ts";
import { decodePennsylvaniaDemographicFoundation, toBehaviorModelUnits } from "../src/data/paDemographics.ts";
import { buildPennsylvaniaMichiganElectionEndpointInput } from "../src/replay/pennsylvaniaMichiganEndpoint.ts";
import { MICHIGAN_BASELINE_REPLAY_FIXTURE, MICHIGAN_COMPLEX_REPLAY_FIXTURE } from "../tests/replay-fixtures/michigan-endpoints.mjs";
import { NATIONAL_BASELINE_REPLAY_FIXTURE, NATIONAL_COMPLEX_REPLAY_FIXTURE, NATIONAL_REPLAY_DEFINITION } from "../tests/replay-fixtures/national-endpoints.mjs";
import { PENNSYLVANIA_BASELINE_REPLAY_FIXTURE, PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE } from "../tests/replay-fixtures/pennsylvania-endpoints.mjs";

const paFoundation = decodePennsylvaniaDemographicFoundation(JSON.parse(readFileSync(new URL("../public/data/pa/2020/vtd-demographics.json", import.meta.url), "utf8")));
const miFoundation = decodeMichiganDemographicFoundation(JSON.parse(readFileSync(new URL("../public/data/mi/2020/precinct-demographics.json", import.meta.url), "utf8")));
const paUnits = toBehaviorModelUnits(paFoundation);
const miUnits = toMichiganBehaviorModelUnits(miFoundation);

async function fixture(national, pa, mi) {
  const endpoint = await lockElectionEndpoint(buildPennsylvaniaMichiganElectionEndpointInput({
    pennsylvaniaFoundation: paFoundation,
    pennsylvaniaScenario: applyBehaviorScenario(paUnits, pa.settings),
    michiganFoundation: miFoundation,
    michiganScenario: applyBehaviorScenario(miUnits, mi.settings),
    scenarioId: national.scenarioId,
    scenarioFingerprint: national.scenarioFingerprint,
    createdAt: national.createdAt,
  }));
  const replay = await compileNationalReplay(endpoint, NATIONAL_REPLAY_DEFINITION);
  return createReplayReducerContext(endpoint, replay);
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  return { medianMs: +at(0.5).toFixed(3), p95Ms: +at(0.95).toFixed(3), worstMs: +sorted.at(-1).toFixed(3) };
}

function measure(runs, callback) {
  const values = [];
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    callback();
    values.push(performance.now() - started);
  }
  return stats(values);
}

const output = { goldens: {}, performance: {} };
for (const [label, national, pa, mi] of [
  ["certified", NATIONAL_BASELINE_REPLAY_FIXTURE, PENNSYLVANIA_BASELINE_REPLAY_FIXTURE, MICHIGAN_BASELINE_REPLAY_FIXTURE],
  ["complex", NATIONAL_COMPLEX_REPLAY_FIXTURE, PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE, MICHIGAN_COMPLEX_REPLAY_FIXTURE],
]) {
  const context = await fixture(national, pa, mi);
  const positions = { zero: 0, event1: 1, event100: 100, event1000: 1000, midpoint: Math.floor(context.events.length / 2), final: context.events.length };
  output.goldens[label] = {};
  for (const [position, eventCount] of Object.entries(positions)) {
    const state = reduceReplayToEventCount(context, eventCount);
    const envelope = await createReportedAnalyticsEnvelope(state.observable, await replayReducerStateFingerprint(state));
    output.goldens[label][position] = envelope.analyticsFingerprint;
  }
  if (label === "certified") {
    const state = reduceReplayToEventCount(context, context.events.length);
    const paCounty = Object.values(state.observable.reportedByCounty).find((county) => county.jurisdictionId === "PA");
    deriveFullReportedAnalytics(state.observable);
    output.performance = {
      national: measure(1000, () => deriveNationalReportedAnalytics(state.observable)),
      pennsylvania: measure(100, () => deriveJurisdictionReportedAnalytics(state.observable, "PA")),
      michigan: measure(100, () => deriveJurisdictionReportedAnalytics(state.observable, "MI")),
      county: measure(1000, () => deriveCountyReportedAnalytics(state.observable, "PA", paCounty.countyId)),
      fullSnapshot: measure(7, () => deriveFullReportedAnalytics(state.observable)),
      fullSnapshotBytes: Buffer.byteLength(serializeDerivedReportedAnalytics(deriveFullReportedAnalytics(state.observable))),
    };
  }
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
