# Decision 0048: Reporting pace without a composite score

Date: 2026-08-23

## Decision

Election Night exposes reporting velocity as two separate observed measures:

```text
ballots published per logical minute
returns published per logical minute
```

Both use a trailing 15-minute logical-time window. State comparison keeps ballot progress, reporting-unit progress, activation, latest activity, pace, and stall status separate. It does not combine them into an excitement, competitiveness, or reporting score.

The replay worker precomputes immutable candidate-blind pace points, sends at most 320 display points from the visible return prefix, and sends no analytical payload while the Timeline workspace is closed. The final scenario ballot and unit denominators may be used for progress because they are already explicit Swingometer endpoints; unreported candidate shares may not enter the pace payload.

## Consequences

- A large precinct and a small precinct no longer appear equivalent merely because each counts as one return.
- Bursts and stalls are visible without implying forecast confidence.
- PA, MI, and WI remain comparable without erasing their different VTD, precinct, and ward contracts.
- Margin and velocity charts are mutually exclusive, lazy canvases. State comparison uses semantic HTML and mounts no chart.
- ECharts GL remains outside the application pending the v0.26C research gate.
