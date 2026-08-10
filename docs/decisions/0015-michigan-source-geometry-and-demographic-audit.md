# 0015: Michigan source, geometry, and demographic audit

Date: 2026-08-10

## Status

Accepted for the second production-detailed state. Runtime and interface integration remain a separate implementation step.

## Decision

Michigan will use the Bureau of Elections' official 2024 precinct result package, the state's exact 2024 voting-precinct geometry, and 2020 Census P.L. 94-171 Table P4. The election baseline and map crosswalk are production-quality. The demographic bridge is usable only with explicit vintage and allocation disclosures.

## Certified election baseline

The official result archive is `2024GEN.zip`, SHA-256 `64f9285bbe94565ff8685d90fccb283a72f04f849bc3b16873af26e9ae34294a`.

| Bucket | Votes |
|---|---:|
| Harris | 2,736,533 |
| Trump | 2,816,636 |
| Stein | 44,607 |
| Oliver | 22,440 |
| Other named and write-in candidates | 43,970 |
| Total | 5,664,186 |

All 12 named candidate totals reconcile exactly to the official statewide total. All 83 counties are present.

The raw package contains 4,434 presidential reporting-unit keys. Of these, 4,347 are ordinary geographic precinct units, 65 are AVCB or other central-count units, and 22 are statistical-adjustment units.

Some candidate values inside the 22 statistical-adjustment units are negative corrections. The scenario engine cannot represent a reporting unit with negative candidate ballots. The importer therefore preserves their certified statewide net as one explicit non-geographic normalization bucket: Harris 95, Trump 290, Other 724, total 1,109. County result summaries continue to retain the source adjustments. The normalization bucket is not painted onto a precinct or silently distributed across counties.

## Exact-cycle geometry

The geometry is the State of Michigan Bureau of Elections `2024 Voting Precincts` layer, SHA-256 `bbc331967ac5e2e1293e581bcdd9c0fa7c5c556faa1b6caaa5d984720be90c4b`.

The source metadata identifies 4,340 official 2024 precinct polygons and permits use, reproduction, and distribution without restriction. The layer includes stable `PRECINCTID`, county FIPS, ward, precinct, 2020 VTD approximation, and registered-voter fields.

The deterministic crosswalk uses:

1. normalized county, jurisdiction, ward, and precinct;
2. a unique county, jurisdiction, and precinct key when the source ward attribute is internally inconsistent;
3. three reviewed `PRECINCTID` corrections for demonstrable jurisdiction-name defects.

No edit-distance matching, proximity matching, or countywide vote smearing is allowed.

| Measure | Result |
|---|---:|
| Geometry polygons | 4,340 |
| Matched polygons | 4,339 |
| Geographic result units | 4,347 |
| Matched result units | 4,339 |
| Exact ward-key matches | 3,822 |
| Unique precinct-key matches | 517 |
| Geographic-unit vote coverage | 99.9979% |
| Statewide vote painted on precinct terrain | 97.4829% |
| Unmatched geographic votes | 114 |

The difference between geographic and statewide coverage is intentional. Central-count votes, the statewide statistical adjustment, and the eight unmatched source units remain visible in aggregate totals but absent from precinct terrain.

## Demographic denominator

The Census archive is `mi2020.pl.zip`, SHA-256 `971bd53abeb1d905bb9b09bfe4dc1afe8514a916f24d285b289e0f66ec5cfb62`. Table P4 supplies population age 18 and over by Hispanic origin and race for 4,805 2020 Census VTD records.

Michigan's official 2024 geometry describes `VTDST` as an approximation to 2020 Census VTD geography. It yields:

| Bridge outcome | Precinct polygons |
|---|---:|
| Direct one-polygon VTD bridge | 4,050 |
| Registered-voter-weighted split | 218 |
| No 2020 VTD record | 72 |

There are 108 Census VTD keys shared by two or three 2024 precinct polygons. For those cases, the importer allocates each integer P4 category by the state's official 2024 registered-voter counts using deterministic largest remainder. This preserves the Census VTD totals exactly. It is a documented modeling allocation, not an official 2024 precinct demographic tabulation.

The resulting behavior denominator has 3,426 available precincts, 841 precincts excluded because mapped 2024 ballots exceed allocated 2020 VAP, 72 precincts without a demographic bridge, and one polygon without a mapped result. Total usable turnout capacity is 2,058,704 ballots.

The interface must say that this is 2020 VAP, not citizen VAP, a 2024 eligible-voter estimate, or observed candidate preference. The 841 over-capacity precincts must remain excluded rather than forcing an implausible denominator.

## Redistribution and provenance

- The official geometry metadata states that there are no access constraints and no restrictions on use, reproduction, or distribution.
- Census data are public federal statistical products; the source archive, checksum, table, and vintage remain in the registry.
- The Michigan result package is publicly downloadable from the state results application, but its release terms are not encoded in the package. Its registry status remains `review_required` pending formal public-release review.

## Consequences

- Michigan passes the election and exact-cycle geometry standard and is selected as the second detailed state.
- Central-count and correction records remain first-class non-geographic model units.
- The Michigan runtime needs a loader for `mi-precinct-row-v1`; the worker must dispatch by manifest loader rather than state-specific branching.
- Inspector language must distinguish direct VTD bridges, weighted splits, unavailable denominators, and off-map votes.
- The URL data version must advance before Pennsylvania and Michigan scenarios can coexist in one shareable scenario.

## Reproduction

```bash
node scripts/import-michigan-2024.mjs <2024GEN-directory> <2024GEN.zip>
node scripts/build-michigan-2024-precinct-geometry.mjs \
  public/data/mi/2024/reporting-units.json <2024-precincts.geojson>
node scripts/import-michigan-2020-pl94-demographics.mjs \
  <migeo2020.pl> <mi000022020.pl> <mi2020.pl.zip> <2024-precincts.geojson>
```
