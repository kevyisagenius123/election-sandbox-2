# Detailed-state production admission checklist

No new detailed state may be registered until every required field below is reviewed and its evidence is committed. Research, source discovery, and isolated pipeline experiments do not constitute product admission.

## Results and reconciliation

- Official statewide presidential totals and all named candidate totals.
- Official county totals or an explicit statement that no authoritative county layer exists.
- Election-cycle reporting-unit results.
- Zero-change reconstruction of every candidate and total ballot count.
- Explicit non-geographic, central-count, correction, unmatched, and residual buckets.
- No fabricated county, precinct, or mode allocation.

## Geography and crosswalk

- Identified publisher, vintage, retrieval date, and checksum.
- Election-cycle geometry where available; otherwise a documented vintage mismatch.
- Deterministic identifiers and crosswalk rules.
- Matched and unmatched reporting units and polygons counted separately.
- Vote and feature coverage percentages.
- County shards with declared byte sizes.
- Visual checks for orientation, topology, boundary integrity, and county ownership.

## Behavioral denominator

- Identified denominator, source table, vintage, and limitations.
- Exact denominator reconciliation.
- Explicit unavailable units.
- Documented one-to-many or many-to-one allocation rules.
- Candidate preference must remain a user assumption, never inferred from demographics.

## Runtime and trust

- Compact versioned artifact with checksum and byte size.
- Fail-closed decoder and compatibility version.
- Typed detailed-state manifest and adapter.
- Worker calculation and stale-response protection.
- County and reporting-unit contribution reconciliation.
- Selected-geography inspector and URL replay.
- Route construction from Required through Modeled and Satisfied.
- Resource stress verification under the current runtime budgets.
- Redistribution inventory decision for every public and derived artifact.

## State exception record

Every state must complete this record in `STATE_EXCEPTIONS.md`:

```text
Reporting model:
Known unmatched result units:
Known unmatched geometry:
Non-geographic or central-count treatment:
Statistical corrections:
Geometry vintage:
Behavior denominator:
Crosswalk exceptions:
Electoral allocation:
Known limitations:
```

Admission is a release decision, not an adapter implementation detail.
