# v0.22A verification: Headless replay reducer

Date: 2026-08-21

## Candidate verdict

**PASS for supervisor review.** This is a bounded headless reducer proof. It does not authorize reported-state analytics, Decision Desk inference, replay UI, public delivery, or State #3 detailed admission.

## Implemented contract

- One pure reducer consumes only the accepted `POLL_CLOSE`, `RETURN_PUBLISHED`, and `REPLAY_COMPLETED` events.
- Canonical zero state contains zero votes, zero returns, no closed polls, no completions, and no applied event.
- Strict global sequence and byte-exact canonical-event matching reject gaps, duplication, reordering, and tampering.
- Five-candidate returns accumulate through only their authorized unit, county, jurisdiction, and national levels.
- Coarse jurisdictions never acquire invented local state.
- Michigan and Pennsylvania off-map units remain explicit off-map reported state.
- Jurisdiction completion asserts exact admitted totals; national completion requires all 51 jurisdictions and the complete exact stream.
- Observable state contains applied facts only and excludes endpoint totals, remaining vote, percentages, leaders, projections, and calls.
- Checkpoints are stream-bound, fingerprinted, validated against canonical reconstruction, and semantically cadence-independent.
- Forward, backward, sequence, and absolute-time seeks reconstruct deterministically without inverse vote arithmetic.

## Frozen state fingerprints

| Position | Certified | Complex PA/MI counterfactual |
|---|---|---|
| Zero | `sha256:f6f157be24e06d76b34c64c82068b98f1deb96cb809890d524846a46c86bbc23` | `sha256:8f33b3a70c3adc52e7d598a0cc08dacd645a0ecdc531a568b7c2187a991dfc0d` |
| Event 1 | `sha256:e1cdf4d89b54e803c484b88e04382db85bb74e247d9a685ed5dcbe73e314c715` | `sha256:0a07cdecb6ccb34f935109e1e402cee407d000546ad0a58d631f88d396f0ae33` |
| Event 100 | `sha256:3da0e2691c4bd9555a93700d94f4cbc6dae9352607926021da82d22748c4c29f` | `sha256:27bd02f2675efa99d377d13489c84014559ca7d93b54f511b53ea396d85b7e27` |
| Event 1,000 | `sha256:8710a472ba7a31bf812e87801ef4379e54c50423c0628cbd3af7cc7e1d799d4b` | `sha256:9f418d16590abff0d78e7556af536760c8fa574f5fe80a6570342a20404dea7b` |
| Midpoint | `sha256:38894724fcef35bba29ed9e7e55be7102e686a1d4fb63287503a101f48027884` | `sha256:b00ddb51aeb22252158a44385058dfd4080bc91fb50596efeefe9eb8ac0a1a18` |
| Final | `sha256:7efb78c7df20d6ea4f54c27116d954a72086c5b263c77db689b4e15911124213` | `sha256:982b58b4860d4fcf2007ffcc61bb6a53bc4d989716cad86e4f43b6cc3be88e03` |

The accepted national source-stream fingerprints remain:

```text
Certified  sha256:e3239ba2fcd783207709582f4b7a75498b364e717951a04285909c399e8d3696
Complex    sha256:eb90e5c85c43cdf41b2c7ac1e5d66933283dddb36fa09c89a73c9912e17a9089
```

## Release-blocking evidence

The 14 grouped v0.22A tests cover the supervisor's 45 required checks:

1. Zero state, serialization, and fingerprints are deterministic and exactly zero at every level.
2. Same state plus same event is byte-identical and mutates neither input.
3. Missing, duplicated, reordered, unknown, or lifecycle-invalid events fail closed.
4. Every return increments exactly its five-candidate vector and total.
5. Coarse, Pennsylvania, Michigan, county, unit, mapped, and off-map hierarchy boundaries are enforced.
6. One jurisdiction cannot alter another jurisdiction's state.
7. Every national prefix contains only applied votes and remains within its accepted endpoint.
8. Identical prefixes with different valid futures produce byte-identical observable state.
9. No endpoint, remaining-vote, percentage, leader, projection, or call field enters observable state.
10. Premature jurisdiction completion fails; final certified and complex states reconcile every hierarchy and all 51 completions.
11. State and checkpoint serialization round-trip byte-identically with deterministic hashes.
12. Tampered and cross-stream checkpoints fail validation.
13. Direct reduction, checkpoint resume, backward reconstruction, repeated seeks, and shuffled canonical reconstruction agree byte-for-byte.
14. Time lookup includes the final canonical simultaneous event at the selected instant.
15. Safe-integer overflow and fractional accumulated state fail closed.
16. The package remains React/deck.gl-free, contains no `Math.random()`, and imports no Decision Desk or projection layer.
17. Existing PA, MI, and national endpoint and stream goldens remain regression-locked by the full suite.

## Performance

The required baseline is recorded in [PERFORMANCE.md](PERFORMANCE.md). Initial measurements:

```text
Full reduction median / p95 / worst   6,129 / 6,412 / 6,412 ms
Checkpoint seek median / p95 / worst     35 /   101 /   165 ms
Final serialized state                5,333,517 bytes
29 serialized checkpoints            80,206,132 bytes
```

These are observations, not release limits. Compact checkpoint storage is a documented pre-UI optimization opportunity.

## Commands

```bash
node --experimental-strip-types --test tests/replay-reducer.test.mjs
npm run benchmark:reducer
npm test
npm run lint
npm run build
git diff --check
```

Current gate result:

```text
Dedicated v0.22A suite  14 / 14 passed
npm test                122 / 122 passed
npm run lint            passed
npm run build           passed
git diff --check        passed
```

The production build retains the existing approximately 1.6 MB minified deck.gl chunk warning. The application does not import the reducer, so v0.22A adds no replay interface code or application-bundle regression.

The standing browser disposition remains unchanged because application code still does not import the replay package:

```text
Aggregate invocation: 36 / 38 current journeys passed
2 timed out at suite level
Isolation reruns: 2 / 2 passed
Combined current-journey disposition: 38 / 38
```

## Explicit omissions

No leader, margin, share, reporting percentage, remaining vote, expected vote, call, projection, Electoral College call allocation, election winner, React component, map replay, playback loop, timeline, camera, reporting editor, Studio, video, backend, account, membership, or deployment change is included.

## Proposed next decision

If the supervisor accepts this proof, the proposed v0.22B is a bounded headless derived reported-state analytics layer. It may calculate only facts available from the applied observable reducer state and must remain isolated from endpoint totals and future events.
