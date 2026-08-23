# v0.25A verification: Headless analytics contract

Date: 2026-08-23

## Verdict

**PASS for supervisor review.** Sandbox 2.0 now has one deterministic, evidence-graded contract for already-trusted analytics. The application interface and election arithmetic are unchanged.

## Accepted contract

- Twenty registered metric definitions cover certified endpoints, scenario endpoints and operations, geographic contribution, Electoral College consequence, current-prefix replay totals, and two explicit progress ratios.
- Each analytic carries a semantic class, integer unit, candidate scope, geography, time scope, availability, source identities, transform version, and caveat.
- Ratios retain their exact integer numerator and denominator.
- Missing is unavailable with a null value; observed zero remains available.
- Collections are canonical, input-order independent, deterministic, tamper-evident, and duplicate-free.
- Current-prefix metrics cannot contain a final outcome or hidden future return.
- Unsupported definitions and malformed envelopes fail closed.

## Frozen registry

```text
registry version: sandbox-analytic-registry-v1
definition count: 20
registry fingerprint:
sha256:df4bb84e37c2bc45ac2852fd6903c85be9d63f7bcd818c78ce159f3fff05092e
```

## Verification record

```text
dedicated analytics-contract tests      10 / 10 passed
aggregate model/replay/analytics tests 174 / 174 passed
TypeScript production build                    passed
ESLint                                          passed
git diff integrity                              passed
```

The existing deck.gl chunk-size warning remains a performance notice, not a build failure. v0.25A adds no application import of the headless package, so no visible browser journey changed and no new screenshot baseline was required.

## Non-scope

No chart, workspace, React integration, deck.gl integration, scenario arithmetic, replay schedule, URL contract, probability, projection, race call, demographic model, backend, membership, or public deployment changed.
