# 0024: Alpha comprehension and trust corrections

Date: 2026-08-12

## Status

Accepted for v0.19.1 after the v0.19A synthetic private alpha.

## Decision

v0.19.1 corrects six repeated comprehension and trust failures without expanding the election model:

1. The collapsed drawer leads with geographic intent (`Change Pennsylvania`) and an explicit `Open controls` action. Snap names remain secondary drawer-position controls.
2. A canonical `buildStateFlipRequirement` derives the certified requirement, current modeled movement, and live remaining gap from the effective state result. State UI and Path to 270 consume the same arithmetic.
3. `Required`, `Modeled`, and `Satisfied` receive adjacent definitions. Mathematical-only routes explicitly disclaim local geographic support.
4. Direct two-party preference transfers explain at the values why one transferred ballot changes the Harris-minus-Trump margin by two votes. This explanation does not appear for turnout or third-party operations.
5. Data becomes an evidence ledger. Pennsylvania and Michigan expose publishers, artifacts, geographic contracts, mapped coverage, off-map treatment, denominator limitations, and methodology links. National Data exposes a coverage matrix and never implies detailed geography for unsupported states.
6. Pennsylvania uses `VTDs`; Michigan uses `2024 precinct reporting units`. Generic internal precinct naming remains an implementation detail only.

`Copy link` becomes `Copy scenario link`, and its confirmation states that the URL reconstructs the current assumptions.

## Deployment

The Pages workflow separates build and deploy jobs, configures Pages before the repository-base build, and runs a remote smoke journey against the deployed URL. The journey verifies Home, `/app/`, Pennsylvania mutation, scenario-link copy, remote reopen, and deterministic restoration.

## Frozen scope

No third detailed state, probability model, new mutation, accounts, guided tour, map redesign, or export system is part of this release.
