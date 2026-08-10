# ADR 0005: Preserve Pennsylvania result residuals as explicit buckets

## Status

Accepted on 2026-08-09.

## Context

Pennsylvania publishes two useful official result surfaces for the 2024 general election:

1. A 268,768-row precinct election-return extract.
2. The certified county breakdown used by the Commonwealth election-results website.

The precinct extract contains 36,748 presidential candidate rows and 9,187 geographic reporting-unit keys. It is short of the county summary by 2,469 named-candidate votes. The county summary reconciles Harris, Trump, Oliver, and Stein across all 67 counties, but it does not expose county-level write-ins. Consequently, the four named county candidates sum to 7,034,206 while the FEC certified statewide candidate total is 7,058,732.

## Decision

- County totals come from the official county breakdown.
- Precinct records come from the official bulk extract.
- A derived county reconciliation bucket is created wherever the precinct extract is short of its county summary.
- The remaining 24,526 certified statewide votes are stored in one non-geographic statewide residual bucket.
- The residual is included in statewide and national totals but never assigned to a county polygon.
- Scenario operations preserve the residual and every county total.

## Consequences

- Zero-change scenarios reproduce the FEC statewide result exactly.
- County colors and heights represent the four named candidates published by Pennsylvania's county endpoint.
- The interface can state precisely which votes are mapped and which are not.
- Later county-level write-in data may replace the statewide residual without changing the model contract.
