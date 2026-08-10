# 0006: Pennsylvania VTD geometry crosswalk

## Status

Accepted for the v0.3 Pennsylvania precinct pilot.

## Context

Pennsylvania's official 2024 presidential return file supplies county, precinct, MCD, FIPS, and VTD identifiers, but it does not include polygon geometry. The Census Bureau publishes 9,178 Pennsylvania voting-district polygons in its January 1, 2020 TIGER/Line redistricting vintage.

The election file contains 9,187 geographic reporting units. Reporting units and Census VTDs are not one-to-one because identifiers changed between vintages, some election units split a VTD, and some rows represent newer or otherwise unmatched geography.

## Decision

The build pipeline uses this ordered crosswalk:

1. Normalize state, county, and VTD codes and require an exact Census GEOID match.
2. If the identifier does not match, normalize only documented Pennsylvania abbreviations and numeric zero-padding. Accept the name only when it resolves to exactly one Census VTD in the same county.
3. Aggregate multiple official election units when they resolve to the same Census polygon.
4. Leave every unresolved unit in the audit artifact. Do not assign it by approximate string similarity, nearest polygon, or countywide vote allocation.

The renderer consumes one simplified TopoJSON shard per county. Geometry is projected with `geoAlbersUsa().scale(1300).translate([487.5, 305])` and its Y axis is inverted for the Atlas OrbitView coordinate system. County shards load only after a county is selected.

## Verified coverage

- 9,178 Census VTD polygons.
- 9,187 geographic election reporting units.
- 8,636 reporting units matched by exact VTD identifier.
- 451 reporting units matched by unique canonical name.
- 100 reporting units unresolved and retained explicitly.
- 6,933,560 of 7,031,737 precinct-file votes mapped, or 98.6038%.

The certified statewide residual and county reconciliation buckets remain non-geographic and are not included in this percentage.

## Consequences

- A county click can replace county terrain with real voting-district terrain.
- Every county discloses its own mapped-vote coverage and unmatched-unit count.
- Census polygons without a matched return remain neutral.
- Scenario changes propagate only through the mapped share represented by the visible polygons; the unmatched share remains implicit in the county aggregate.
- The geometry vintage is approximate for a 2024 election and must never be described as official 2024 precinct geometry.
