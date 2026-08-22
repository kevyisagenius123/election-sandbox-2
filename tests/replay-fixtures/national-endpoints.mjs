import { MICHIGAN_REPLAY_DEFINITION } from "./michigan-endpoints.mjs";
import { PENNSYLVANIA_REPLAY_DEFINITION } from "./pennsylvania-endpoints.mjs";

export const NATIONAL_REPLAY_DEFINITION = Object.freeze({
  profileId: "us-synthetic-jurisdiction-wave-v1",
  rootSeed: "supervisor-national-composition-seed-v1",
  clockContractVersion: "us-2024-poll-close-eligibility-v1",
  pennsylvania: PENNSYLVANIA_REPLAY_DEFINITION,
  michigan: MICHIGAN_REPLAY_DEFINITION,
  coarseMinimumReturnDelayMs: 12 * 60_000,
  coarseReturnJitterMs: 95 * 60_000,
});

export const NATIONAL_BASELINE_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "us-certified-pa-mi-detailed-v1",
  scenarioFingerprint: "us-certified-pa-mi-detailed-fixture-v1",
  createdAt: "2026-08-21T00:05:00.000Z",
  expectedEndpointFingerprint: "sha256:ede060670bd8ece5d2933055c62a2053c3a87e4b2275546440993a5c10939aab",
  expectedNationalStreamFingerprint: "sha256:e3239ba2fcd783207709582f4b7a75498b364e717951a04285909c399e8d3696",
});

export const NATIONAL_COMPLEX_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "us-complex-pa-mi-detailed-v1",
  scenarioFingerprint: "us-complex-pa-mi-detailed-fixture-v1",
  createdAt: "2026-08-21T00:06:00.000Z",
  expectedEndpointFingerprint: "sha256:05c391f4ecda01cfb831552f350793e9dcedfc303cf42441e80de29880212de1",
  expectedNationalStreamFingerprint: "sha256:eb90e5c85c43cdf41b2c7ac1e5d66933283dddb36fa09c89a73c9912e17a9089",
});
