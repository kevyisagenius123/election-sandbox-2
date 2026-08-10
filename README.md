# Sandbox 2.0

Sandbox 2.0 is an independent, local-first laboratory for historical United States election counterfactuals.

It is not connected to the existing Sandbox. It has its own application code, data contracts, model primitives, tests, and deployment path.

## Current foundation

The first local build includes:

- Official 2024 statewide presidential totals compiled by the Federal Election Commission.
- Certified 312 to 226 Electoral College baseline, including the Maine and Nebraska splits.
- A responsive editorial workbench.
- A port of the Atlas deck.gl 3D renderer behavior with independent ownership.
- Smooth state drilldown into verified Pennsylvania county terrain; other states remain neutral until their sources reconcile.
- Actual, scenario, and shift comparison modes.
- Official Pennsylvania Department of State county summaries, ballot-mode totals, and 9,189 normalized reporting units.
- County-to-precinct drilldown using official 2020 Census Pennsylvania voting-district geometry.
- A versioned crosswalk that matches 8,636 reporting units by VTD identifier and 451 by a unique canonical name in the same county.
- Lazy county geometry shards, so the national application does not load statewide precinct geometry at startup.
- A deterministic Pennsylvania two-party margin operation that preserves every county total and aggregates exactly to the state.
- Reporting-unit contracts that support precincts and non-geographic ballot buckets.
- Baseline reconciliation and probability invariants.
- Architecture decisions and a source-registry schema.

The Pennsylvania slice is county-complete and precinct-geometry enabled. The official county endpoint exposes four named candidates but not county-level write-ins, so 24,526 certified votes remain in an explicit statewide residual bucket instead of being fabricated across counties.

The precinct crosswalk links 6,933,560 votes, or 98.6038% of the precinct-file vote, to Census VTD polygons. The remaining 100 reporting units stay explicit in the audit artifact and are not assigned by fuzzy text or proximity. Demographic controls remain locked until a separate Census crosswalk is validated.

## Run locally

Requirements:

- Node.js 22.12 or newer

```bash
npm install
npm run dev
```

The local application runs at `http://127.0.0.1:4173`.

## Verify

```bash
npm test
npm run lint
npm run build
```

## Important documents

- `PRODUCT_AND_ENGINEERING_PLAN.md`
- `docs/decisions/0001-independent-product.md`
- `docs/decisions/0002-reporting-unit-model.md`
- `docs/decisions/0003-deterministic-scenarios.md`
- `docs/decisions/0004-atlas-renderer-behavior.md`
- `docs/decisions/0005-pennsylvania-result-reconciliation.md`
- `docs/decisions/0006-pennsylvania-vtd-crosswalk.md`

## Rebuild the Pennsylvania data package

The repository does not vendor the 43 MB Department of State source extract. Download the official precinct return file and county breakdown, then run:

```bash
node scripts/import-pennsylvania-2024.mjs <precinct-return-file> <county-summary-file>
```

The importer verifies both SHA-256 checksums, county ballot-mode totals, reporting-unit reconciliation, the 67-county registry, and the certified statewide result before replacing generated artifacts.

To rebuild the precinct geometry package, download and extract the official Census Pennsylvania VTD archive, then run:

```bash
node scripts/build-pennsylvania-vtd-geometry.mjs \
  public/data/pa/2024/reporting-units.json \
  <path-to-vtd.shp> \
  <path-to-vtd.dbf> \
  <path-to-source.zip>
```

The geometry builder projects to the same Albers coordinate system as the Atlas renderer, simplifies shared boundaries, writes one lazy TopoJSON shard per county, and regenerates the public manifest plus the full audit crosswalk.

## Next increment

Build the Pennsylvania demographic crosswalk and confidence model, then replace the single statewide swing control with separate turnout and preference operations.

## Baseline source

[Federal Election Commission, Official 2024 Presidential General Election Results](https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf)

[Pennsylvania Department of State, Historical Elections Data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)

[United States Census Bureau, 2020 Pennsylvania Voting District TIGER/Line archive](https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/42_PENNSYLVANIA/42/tl_2020_42_vtd20.zip)
