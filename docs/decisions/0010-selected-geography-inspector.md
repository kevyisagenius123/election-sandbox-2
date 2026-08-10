# Decision 0010: Selected-geography inspector

## Status

Accepted for Sandbox 2.0 v0.7.

## Decision

County and VTD selection is analytical state owned by the application. Map hover remains temporary renderer state. A pinned VTD therefore survives scenario changes, updates the breadcrumb and selected-result readout, and can also be opened from the contribution ranking.

The inspector presents four separate evidence layers:

1. certified candidate totals compared with the deterministic scenario;
2. the 2020 Census voting-age-population denominator and usable turnout capacity;
3. local effects from turnout, two-party preference, and named third-party exchange operations; and
4. election-result coverage and crosswalk quality.

The VTD demographic artifact stores the already-audited result match method and linked source-unit counts. Exact identifier, canonical-name, mixed, and unmatched cases remain distinct. The artifact schema and pipeline version advance because these fields are part of the runtime data contract.

County candidate totals remain authoritative. Mapped ballot coverage is a separate ratio and never replaces the official county result. County residual ballots remain explicit non-terrain units. A Census VTD without a matched 2024 return displays an unavailable result and receives neither synthetic baseline votes nor turnout capacity.

The inspector uses total population age 18 and over from 2020 P.L. 94-171. It must not label this denominator as citizen voting-age population, 2024 eligibility, or registered voters.

## Consequences

- Every selected production geography can explain its data foundation and scenario movement.
- Contribution clicks and map clicks now share one selection model.
- Unmatched geometry cannot appear result-ready merely because it has Census demographics.
- The sidebar becomes longer when a geography is selected; maintaining readable hierarchy is preferred over hiding audit information.
- The next release can encode the same selected geography and assumptions in a versioned scenario URL.
