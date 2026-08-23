# v0.25B verification: Scenario delta ledger

Date: 2026-08-23

## Verdict

**PASS for supervisor review.** The accepted detailed-state scenario endpoint can now be explained exactly by operation, reporting unit, county, map coverage, residual geography, and Electoral College consequence.

## Frozen fixture

```text
schema: sandbox-scenario-delta-ledger-v1
transform: sandbox-scenario-delta-ledger-v1
fixture delta: Harris +8, Trump +3, Stein -1, ballots +10, margin +5
fingerprint:
sha256:62c4527528a1e42dc0de2c0a7ef3bd7fb47783cc7e5a66c8f11b4241dfa9a312
```

## Contract coverage

- Three operation vectors sum exactly to the endpoint delta.
- Every unit's operation vectors reconstruct its certified-to-scenario movement.
- Units sum to county and state totals.
- County rows preserve mapped, mixed, and off-map status.
- Statewide residual units remain separately disclosed.
- Mapped plus off-map movement equals the state delta.
- Requested and realized volumes retain clipping and direction semantics.
- Target-candidate EV movement reconciles to actual and scenario allocation.
- Rankings are deterministic across input ordering and operation filters.
- Internally invalid content fails validation even with a freshly recomputed hash.

## Verification record

```text
dedicated scenario-ledger tests           9 / 9 passed
aggregate model/replay/analytics tests 183 / 183 passed
TypeScript production build                    passed
ESLint                                          passed
git diff integrity                              passed
```

The dedicated state-foundation test builds complex ledgers for Pennsylvania, Michigan, and Wisconsin from their admitted runtime artifacts. The application does not yet import the ledger, so no visible browser journey or screenshot baseline changed.

The existing deck.gl chunk-size warning remains a performance notice, not a build failure.

## Non-scope

No chart, React integration, map integration, replay-window analytic, expected vote, probability, projection, race call, demographic model, backend, membership, or deployment changed.
