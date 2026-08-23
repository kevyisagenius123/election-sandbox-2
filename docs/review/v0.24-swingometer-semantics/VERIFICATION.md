# v0.24 verification: Explicit Swingometer model semantics

Date: 2026-08-22

## Verdict

**PASS for supervisor review.** The Swingometer now communicates the exact meaning, arithmetic, invariants, and evidence boundary of each existing operation without changing the deterministic scenario engine.

## Contract coverage

- Turnout identifies the state-specific VAP basis, its +1.5-point product window, local capacity clipping, and Harris/Trump-only additions.
- Preference identifies counted ballots, direct two-party transfers, the two-vote margin effect, fixed ballot totals, and full calculated directional bounds.
- Third Party identifies the selected candidate bucket, source-share rule, fixed ballot total, zero-vote lower bound, and available-supply upper bound.
- Pennsylvania, Michigan, and Wisconsin retain distinct demographic and geography disclosures.

## Verification record

```text
model-semantics contract tests        3 / 3 passed
focused semantics browser journey    1 / 1 passed
focused browser duration                13.1 seconds
scenario replay browser regression   8 / 8 passed
aggregate model and replay tests    164 / 164 passed
production build                         passed
ESLint                                   passed
```

The existing deck.gl chunk-size warning remains a performance notice, not a build failure. No new warning or application error was introduced.

## Visual evidence

- [Pennsylvania turnout contract](screenshots/pennsylvania-turnout-contract.png)

## Non-scope

No election arithmetic, demographic preference calibration, survey model, CVAP estimate, population editor, uncertainty interval, replay behavior, backend, membership, export, or detailed-state admission changed.
