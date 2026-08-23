# Decision 0044: Scenario delta ledger

Date: 2026-08-23

## Decision

Sandbox 2.0 will explain scenario movement through one headless, deterministic ledger derived from the certified detailed units and the accepted scenario endpoint.

The ledger attributes the exact candidate and Harris-minus-Trump vote delta to:

- turnout additions;
- two-party preference transfers;
- named third-party exchanges;
- every detailed reporting unit;
- every county;
- mapped and off-map partitions;
- the explicit statewide residual;
- the target candidate's Electoral College consequence.

## Contract law

- Operation rows must sum exactly to the scenario endpoint delta.
- Reporting-unit rows must sum exactly to state totals.
- County rows are derived from reporting units and may never replace or smear off-map units.
- Requested and realized operation volumes remain distinct.
- Every local operation attribution must reconstruct its unit's final candidate vector.
- Rankings are deterministic views of signed margin movement, not independent scores.
- Electoral College movement is derived from the accepted actual and scenario allocations.
- The embedded analytic collection must reproduce from the ledger through the v0.25A registry.
- Canonical validation is required even when a serialized ledger carries a matching hash.

## Consequences

- The existing contribution panel no longer needs to remain the long-term owner of aggregation logic.
- v0.25C may add current-prefix replay diagnostics without changing scenario attribution.
- The visible editorial analytics workspace remains deferred to v0.25D.
