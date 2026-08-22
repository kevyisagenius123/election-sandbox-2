import type { BehaviorScenarioSettings } from "../../packages/election-model/src/scenario.ts";
import type { NationalReplayDefinition } from "../../packages/election-replay/src/index.ts";

export const CERTIFIED_REPLAY_SETTINGS: BehaviorScenarioSettings = Object.freeze({
  turnoutIncreasePoints: 0,
  addedVoterHarrisShare: 0.55,
  preferenceShiftPoints: 0,
  thirdPartyCandidate: "stein",
  thirdPartyShiftPoints: 0,
  thirdPartyHarrisExchangeShare: 0.5,
});

export const CERTIFIED_REPLAY_METADATA = Object.freeze({
  scenarioId: "us-certified-pa-mi-visible-slice-v1",
  scenarioFingerprint: "us-certified-pa-mi-visible-slice-v1",
  createdAt: "2026-08-22T00:00:00.000Z",
});

export const CERTIFIED_NATIONAL_REPLAY_DEFINITION: NationalReplayDefinition = Object.freeze({
  profileId: "us-synthetic-jurisdiction-wave-v1",
  rootSeed: "supervisor-national-composition-seed-v1",
  clockContractVersion: "us-2024-poll-close-eligibility-v1",
  pennsylvania: Object.freeze({
    profileId: "pa-synthetic-rural-first-v1",
    rootSeed: "supervisor-pa-compiler-seed-v1",
  }),
  michigan: Object.freeze({
    profileId: "mi-synthetic-uniform-wave-v1",
    rootSeed: "supervisor-mi-compiler-seed-v1",
  }),
  coarseMinimumReturnDelayMs: 12 * 60_000,
  coarseReturnJitterMs: 95 * 60_000,
});
