# Decision 0012: Compact Pennsylvania demographic runtime

## Status

Accepted for Sandbox 2.0 v0.9.

## Decision

The Pennsylvania browser artifact uses storage schema `3` and encoding `vtd-row-v1`. The importer writes a self-describing `vtdFields` contract once and stores each of the 9,178 Census VTDs as a fixed-order row.

The compact row preserves the VTD GEOID, Census and display names, all six P.L. 94-171 voting-age-population cells, exact and canonical crosswalk counts, and Harris, Trump, Stein, Oliver, and residual Other votes. Redundant values are reconstructed by the runtime decoder:

- county FIPS and VTD code come from the official GEOID;
- an absent display-name override means the Census name is already the display name;
- source-unit count and match method come from exact and canonical link counts;
- Other and total ballots come from candidate totals; and
- result availability, denominator status, and turnout capacity come from source links, ballots, and VAP.

The decoder fails closed before enabling the behavior model. It validates the schema and encoding, exact field order, row length and types, Pennsylvania alphanumeric GEOIDs, demographic reconciliation, sorted unique identifiers, mapped/unavailable counts, mapped vote totals, and statewide turnout capacity.

The official importer still starts from the checksum-verified Census archive and fixed-width files. Its pipeline version advances to `pa-pl94-vtd-demographics-v3`; the source registry records storage schema, encoding, row count, byte size, and artifact SHA-256.

The deterministic scenario dataset version remains `us2024-pa-vtd2020-v2`. This release changes only lossless runtime representation and validation, not election inputs, demographic cells, crosswalk assignments, engine semantics, or scenario results. Existing compatible v0.8 links therefore remain valid.

## Consequences

- The public demographic artifact falls from 5,712,538 bytes to 874,568 bytes, an 84.7% raw reduction.
- A local gzip profile falls from 437,995 bytes to about 229,618 bytes.
- The decoded in-memory model retains the same ergonomic object contract used by the engine, inspector, and contribution panel.
- Storage schema and semantic scenario-data version are deliberately separate compatibility concepts.
- Any future field-order or derivation change requires a new storage schema and decoder path.
