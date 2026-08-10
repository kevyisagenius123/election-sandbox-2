# Decision 0009: Named third-party exchange

## Status

Accepted for Sandbox 2.0 v0.6.

## Decision

Third-party behavior is a distinct third operation. It runs after turnout additions and the two-party Harris/Trump preference transfer.

The user selects one certified vote bucket:

- Jill Stein;
- Chase Oliver; or
- residual Other/write-in.

The movement control changes that bucket's statewide share of all scenario ballots. Negative movement releases votes from the selected bucket. Positive movement transfers existing Harris and Trump ballots into it. A second control explicitly sets the Harris share of exchanged major-party ballots; Trump supplies or receives the complement.

The operation preserves the total ballot count in every model unit. Integer allocations use the existing deterministic largest-remainder and capped proportional methods. The negative endpoint is exactly zero selected-candidate votes. The positive endpoint is the greatest integer exchange permitted by the chosen source mix and available Harris and Trump ballots. There is no arbitrary political-plausibility ceiling.

Official Pennsylvania reporting units retain exact Stein and Oliver votes. The certified residual Other/write-in total of 24,526 has no official county geography in the source package, so its historical baseline remains in a statewide residual unit. If a user increases that bucket, the newly exchanged counterfactual ballots can appear in mapped units where their source major-party ballots were located. That geography describes the user's scenario, not an invented historical allocation.

Contribution remains defined as the change in `Harris - Trump`. A balanced 50/50 third-party exchange can therefore move many ballots while producing little or no major-party margin contribution. The third-party editor separately displays exchanged ballot volume.

## Consequences

- The two-party preference slider keeps a precise, independent meaning.
- Named candidate and aggregate Other totals reconcile at every unit and statewide.
- Users can state exactly where third-party ballots came from or went.
- Extreme endpoints remain mathematically valid but are not presented as forecasts.
- Residual historical geography remains honest and visibly limited by the source data.
