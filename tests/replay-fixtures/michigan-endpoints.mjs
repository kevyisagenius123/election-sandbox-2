export const MICHIGAN_BASELINE_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "mi-certified-baseline-v1",
  createdAt: "2026-08-21T00:02:00.000Z",
  expectedContentFingerprint: "sha256:4a9bb791497c487eea16c7fcab13af628afff27c6bf1f9c9ba91f8c82b7612c1",
  expectedEventStreamFingerprint: "sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484",
  settings: Object.freeze({
    turnoutIncreasePoints: 0,
    addedVoterHarrisShare: 0.55,
    preferenceShiftPoints: 0,
    thirdPartyCandidate: "stein",
    thirdPartyShiftPoints: 0,
    thirdPartyHarrisExchangeShare: 0.5,
  }),
});

export const MICHIGAN_COMPLEX_REPLAY_FIXTURE = Object.freeze({
  scenarioId: "mi-complex-counterfactual-v1",
  createdAt: "2026-08-21T00:03:00.000Z",
  expectedContentFingerprint: "sha256:2a81ff04b0ad19c583ce805f0af09455d227ece17151ba196caa87307c2b5e24",
  expectedEventStreamFingerprint: "sha256:a5391fbda94477926d06f90885e22120d4e8801e8fdcd49e9063d55f1461dba6",
  settings: Object.freeze({
    turnoutIncreasePoints: 1,
    addedVoterHarrisShare: 0.61,
    preferenceShiftPoints: 2.1,
    thirdPartyCandidate: "oliver",
    thirdPartyShiftPoints: -0.7,
    thirdPartyHarrisExchangeShare: 0.65,
  }),
});

export const MICHIGAN_REPLAY_DEFINITION = Object.freeze({
  profileId: "mi-synthetic-uniform-wave-v1",
  rootSeed: "supervisor-mi-compiler-seed-v1",
});
