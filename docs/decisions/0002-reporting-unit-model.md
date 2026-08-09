# ADR 0002: Reporting unit is the atomic electoral abstraction

## Status

Accepted.

## Context

Not every ballot can be assigned honestly to a precinct polygon. Jurisdictions may report mail, early, provisional, or central-count ballots at county or other aggregate levels.

## Decision

The engine uses `ReportingUnit` as its atomic result abstraction. A precinct is one reporting-unit type. Geometry is optional. Countywide reporting buckets contribute to electoral totals without being assigned to a fabricated precinct.

## Consequences

- County reconciliation includes both geographic and non-geographic units.
- Map views can distinguish mapped votes from countywide buckets.
- Election-night events and final results share one coherent abstraction.
