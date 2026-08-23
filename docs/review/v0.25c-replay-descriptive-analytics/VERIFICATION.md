# v0.25C verification: Replay descriptive analytics

Date: 2026-08-23

## Verdict

**PASS for supervisor review.** Sandbox 2.0 can now derive deterministic Election Night diagnostics from only the currently observed canonical replay prefix and explicit non-candidate denominators.

## Frozen fixture

```text
schema: sandbox-replay-descriptive-v1
transform: sandbox-replay-descriptive-v1
windows: 5, 15, 30 logical minutes
fingerprint:
sha256:5e4c698ded29820ec7fc971e4d1a5031881d610afdde55ea1317295bee7d0819
```

## Contract coverage

- Observed events reconcile exactly to reducer position and current national totals.
- Jurisdiction totals, mapped/off-map totals, counties, and atomic units reconcile exactly.
- Canonical event sequence, identities, timestamps, and lifecycle order fail closed on corruption.
- Five-, fifteen-, and thirty-minute windows use exact start-exclusive, end-inclusive boundaries.
- Publication rates use deterministic integer milli-units and explicit observed duration.
- Return progress and represented-ballot progress retain separate denominators.
- Missing denominators produce unavailable values instead of inferred values.
- Mathematical openness uses only current margin and the explicit modeled outstanding count.
- Chronology stalls use only logical replay time and the user-selected threshold.
- Current local margins and recent movers preserve state, county, and reporting-unit identity.
- Divergent unused futures cannot influence current-prefix output because future events are absent from the input.
- Canonical serialization and fingerprints are input-order independent and reject tampering.
- Source guards prohibit browser frameworks, mapping libraries, wall-clock fetches, random calls, probability, projection, and race-call fields.

## Verification record

```text
dedicated replay-descriptive tests        10 / 10 passed
aggregate model/replay/analytics tests 193 / 193 passed
aggregate duration                         618.353 s
TypeScript production build                    passed
ESLint                                          passed
git diff integrity                              passed
```

The production build retains the existing deck.gl chunk-size warning. v0.25C adds no application import and changes no visible browser journey, so no screenshot baseline changed.

## Non-scope

No editorial workspace, React integration, map integration, hidden endpoint inference, expected candidate share, probability, projection, race call, demographic model, backend, membership, or deployment changed.
