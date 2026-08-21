# 0026: Admit Wisconsin through the LTSB reconstructed-ward foundation

Date: 2026-08-20

## Status

Accepted for v0.20 as the third production-detailed state.

## Decision

Wisconsin enters the detailed-state runtime through the Wisconsin Legislative Technology Services Bureau's public `2024 Election Data with 2025 Wards` layer. The source item explicitly describes the data as open and publicly available and is owned by `WI_Legislature`.

The layer is not represented as raw certified ward returns. LTSB collected Wisconsin Elections Commission returns, disaggregated reporting-unit results to Census blocks by population, and reaggregated those estimates to January 2025 ward boundaries. Sandbox therefore labels the local layer `LTSB reconstructed wards`. County and statewide totals remain exact; ward values are an official spatial reconstruction.

## Admission evidence

| Measure | Accepted value |
| --- | ---: |
| Harris | 1,668,229 |
| Trump | 1,697,626 |
| Stein | 12,275 |
| Oliver | 10,511 |
| Residual other | 34,277 |
| Total | 3,422,918 |
| Counties | 72 |
| Ward polygons | 7,086 |
| Result-bearing ward rows | 6,946 |
| Geometry-only wards | 140 |
| Result ballots mapped | 100% |
| 2020 voting-age population estimate | 4,612,300 |
| Turnout capacity | 1,198,983 |
| Denominator available | 6,785 wards |
| Ballots exceed 2020 VAP | 161 wards |
| No mapped result | 140 wards |

All result-bearing ward rows have a unique 14-character LTSB GEOID, and all statewide ballots reconcile to the county and state baselines. The 140 geometry-only wards carry no invented votes or capacity.

## Provenance and reproducibility

- ArcGIS item ID: `878d8826218f42509e07437a82ef6b6e`
- Item owner: `WI_Legislature`
- Source snapshot SHA-256: `02e19c18503b928b1f53826b6224475a6391bbfb8e53afad9fbf4abb143734fd`
- Runtime encoding: `wi-ward-row-v1`
- Data compatibility version: `us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1`

Rebuild and validate the checked-in artifacts with:

```bash
npm run data:wi
```

The importer fails closed if the item identity, ownership, access, license status, feature count, county count, identifiers, vote totals, or denominator reconciliation changes.

## Consequences

- Wisconsin participates in the same deterministic worker, contribution, inspector, portfolio, Electoral College, Path to 270, and URL contracts as Pennsylvania and Michigan.
- Only one expanded detailed-state foundation remains resident at a time.
- Wisconsin may be included in the private research repository because the direct LTSB source carries an explicit open/public statement.
- Any interface or documentation that calls the local values certified raw ward returns is a correctness defect.

## Sources

- [LTSB ArcGIS item](https://www.arcgis.com/home/item.html?id=878d8826218f42509e07437a82ef6b6e)
- [LTSB feature service](https://services1.arcgis.com/FDsAtKBk8Hy4cAH0/ArcGIS/rest/services/2024_Election_Data_with_2025_Wards/FeatureServer/0)
- [Wisconsin Elections Commission 2024 general-election results](https://elections.wi.gov/election-result/2024-general-election-results)

