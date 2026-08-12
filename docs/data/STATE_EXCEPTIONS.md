# Detailed-state exception records

## Pennsylvania

- **Reporting model:** Department of State municipality and breakdown return units, aggregated into 9,189 normalized model units.
- **Known unmatched result units:** 100 reporting units are not linked to 2020 Census VTD terrain; one Philadelphia reconciliation bucket remains explicit.
- **Known unmatched geometry:** 140 of 9,178 Census VTD polygons have no mapped 2024 result.
- **Non-geographic or central-count treatment:** 24,526 certified residual Other/write-in votes remain in one statewide-only bucket because the official county source does not place them.
- **Statistical corrections:** No Michigan-style negative correction normalization. The explicit county and statewide residual buckets reconcile official totals.
- **Geometry vintage:** 2020 Census voting districts used with 2024 election returns.
- **Behavior denominator:** 2020 Census P.L. 94-171 Table P4 voting-age population, not CVAP or 2024 eligibility. Of 9,038 linked polygons, 8,880 are turnout-ready and 158 are capped because ballots exceed the older denominator.
- **Crosswalk exceptions:** Exact county-plus-VTD identifier first; unique normalized official name within county only when identifiers changed. No proximity or approximate-name assignment.
- **Electoral allocation:** 19 winner-take-all electoral votes in the current 2024 contract.
- **Known limitations:** Geometry predates the election by four years; residual write-ins have no honest county or VTD placement.

## Michigan

- **Reporting model:** 4,413 normalized 2024 model units from official precinct, absent-voter counting board, correction, and statewide adjustment records.
- **Known unmatched result units:** Eight geographic reporting units totaling 114 votes have no unique precinct polygon.
- **Known unmatched geometry:** One of 4,340 official 2024 precinct polygons has no matched return.
- **Non-geographic or central-count treatment:** 65 central-count units remain outside precinct terrain. They retain county and statewide totals without receiving a polygon.
- **Statistical corrections:** Twenty-two source locale-code 9999 rows include negative candidate corrections. They normalize into one explicit statewide non-negative adjustment bucket totaling 1,109 votes.
- **Geometry vintage:** Official State of Michigan 2024 voting precincts, dated election day.
- **Behavior denominator:** 2020 Census P.L. 94-171 Table P4 voting-age population. There are 4,050 direct VTD bridges, 218 registered-voter-weighted split polygons, and 72 unavailable demographic bridges.
- **Crosswalk exceptions:** Stable `PRECINCTID` resolves three reviewed jurisdiction-name defects. Shared 2020 VTD counts are split by official 2024 registered-voter weights.
- **Electoral allocation:** 15 winner-take-all electoral votes in the current 2024 contract.
- **Known limitations:** Central-count votes remain off terrain; the weighted demographic split is a documented modeling allocation rather than a Census precinct tabulation.
