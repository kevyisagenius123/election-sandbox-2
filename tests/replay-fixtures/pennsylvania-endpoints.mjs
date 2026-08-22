export const PENNSYLVANIA_BASELINE_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "pa-certified-baseline-v1",
  createdAt: "2026-08-21T00:00:00.000Z",
  expectedContentFingerprint: "sha256:bbb5c3e94b2413829b7d9d8d243fcb9ed44e68ddfd4bde567cec1e91079b91c9",
  expectedEventStreamFingerprint: "sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c",
  settings: Object.freeze({
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.55,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  }),
});

export const PENNSYLVANIA_COMPLEX_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "pa-complex-counterfactual-v1",
  createdAt: "2026-08-21T00:01:00.000Z",
  expectedContentFingerprint: "sha256:07de00195da9ab840f9b82947fa7b75c3e64400f086605926836d516e9c716d2",
  expectedEventStreamFingerprint: "sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8",
  settings: Object.freeze({
    turnoutIncreasePoints: 1.2,
    addedVoterHarrisShare: 0.62,
    preferenceShiftPoints: 2.4,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: -1,
    thirdPartyHarrisExchangeShare: 0.7,
  }),
});

export const PENNSYLVANIA_REPLAY_DEFINITION = Object.freeze({
  profileId: "pa-synthetic-rural-first-v1",
  rootSeed: "supervisor-pa-compiler-seed-v1",
});
