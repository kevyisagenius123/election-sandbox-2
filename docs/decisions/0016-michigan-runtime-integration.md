# 0016: Michigan runtime integration through detailed-state adapters

Status: Accepted for v0.13.

## Context

Michigan's audited election, exact-cycle precinct geometry, demographic bridge, and residual model units passed the v0.12 data gate. The visible application and worker still assumed Pennsylvania VTDs in several places. Adding state-code branches to each layer would make reconciliation, cancellation, URL validation, and future state additions difficult to audit.

## Decision

- Register Pennsylvania and Michigan through the same detailed-state manifest contract.
- Dispatch artifact decoding and behavior-unit conversion through a loader registry keyed by the manifest encoding, never through calculation branches keyed to state code.
- Keep one active detailed foundation in the worker and replace it when the selected detailed state changes.
- Normalize county results and mapped geography records at the application boundary.
- Calculate scenario county totals as deltas from official county totals. This preserves Michigan's official county baseline while central-count, statistical-adjustment, and unmatched units remain explicit and off terrain.
- Load county geometry through the active manifest. The shared manifest request is not tied to a component abort signal; individual county-shard requests remain cancellable.
- Preserve the URL schema and deterministic engine version while advancing the data version to `us2024-pa-vtd2020-mi-precinct2024-v1`.
- Validate Pennsylvania Census VTD GEOIDs and Michigan `PRECINCTID` hierarchies against the selected state and county.

## Consequences

- Selecting Michigan now recomputes its state result, national popular vote, and 15 electoral votes through the same deterministic engine used for Pennsylvania.
- Michigan counties open exact-cycle precinct terrain and the parent county layer disappears cleanly.
- The inspector discloses direct or alternate election links and unavailable demographic bridges. Non-geographic ballots remain outside terrain.
- Pennsylvania behavior and browser replay remain unchanged except for generic precinct language and the advanced data version.
- A state-specific decoder can remain strict without leaking its row contract into the renderer or React state.
- Browser replays cover Michigan direct bridge, registered-voter-weighted split, unavailable denominator, Pennsylvania alphanumeric VTDs, future-version fallback, and stale-worker rejection.
