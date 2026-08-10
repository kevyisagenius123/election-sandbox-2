# Sandbox 2.0

Sandbox 2.0 is an independent, local-first laboratory for historical United States election counterfactuals. It is not connected to the existing Sandbox or Presidential Atlas at runtime. The application owns its code, data contracts, renderer, tests, and future deployment path.

## Current release: v0.5 bidirectional behavior and contribution tracing

The current build provides:

- The official 2024 presidential baseline, including a reconciled 312 to 226 Electoral College result.
- An editorial React and deck.gl workbench with national, Pennsylvania county, and Pennsylvania Census voting-district terrain.
- Official Pennsylvania county summaries and 9,189 normalized election reporting units.
- A versioned crosswalk connecting 9,038 of 9,178 Census VTD polygons to mapped 2024 results.
- A Census P.L. 94-171 Table P4 voting-age-population denominator for every 2020 Pennsylvania VTD.
- Separate, ordered turnout and preference operations.
- Full feasible Republican-to-Democratic preference movement with no arbitrary point ceiling.
- Turnout composition from 100% Trump through 100% Harris.
- Exact county and mapped-VTD contribution rankings using the change in the Harris minus Trump vote margin.
- Exact scenario aggregation from VTD or residual model units to counties, Pennsylvania, the national popular vote, and the Electoral College.
- Actual, scenario, and shift comparison modes, plus ballot and flat terrain modes.
- Lazy county geometry shards and deterministic, cancellable camera transitions.
- Reconciliation, allocation, and zero-change tests.

The Pennsylvania county endpoint exposes four named candidates but not county-level write-ins. The model therefore preserves 24,526 certified votes in an explicit statewide residual bucket instead of inventing a county or precinct location. One Philadelphia reconciliation bucket and every unmatched reporting unit also remain explicit.

## Behavior model

Turnout and preference are deliberately different operations:

1. **Turnout** adds ballots in proportion to each usable VTD's 2020 population age 18 and over. Added ballots cannot exceed the VTD's remaining denominator capacity. The user explicitly sets the Harris and Trump division from either full endpoint.
2. **Preference** transfers already-counted Harris and Trump ballots after turnout. It preserves the number of ballots and can run to the full mathematically feasible endpoint in either direction. The engine caps at the available candidate ballots, never at an arbitrary interface margin.

The contribution panel ranks the counties or mapped VTDs that most changed the state result. Contribution is defined as the scenario change in `Harris votes - Trump votes`. That definition lets turnout and preference reconcile in the same unit while retaining their separate operations.

The model is deterministic and integer-reconciled. With both operations set to zero, it reproduces Pennsylvania's certified result exactly.

The turnout denominator is not citizen voting-age population and is not a 2024 eligible-voter estimate. Census data do not reveal candidate preference. These controls are transparent counterfactual assumptions, not a forecast or a claim about individual voters.

Coverage is explicit:

- 9,178 Census VTD polygons.
- 9,038 polygons linked to mapped 2024 election results.
- 8,880 VTDs available for the turnout operation.
- 158 linked VTDs excluded from turnout because mapped 2024 ballots exceed the older 2020 VAP denominator.
- 140 Census VTDs with no mapped 2024 result.

## Run locally

Requirements: Node.js 22.12 or newer.

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

## Repository map

```text
src/App.tsx                         Editorial workbench and scenario state
src/map/AtlasMapScene.tsx           deck.gl national, county, and VTD renderer
src/data/paDemographics.ts          Versioned demographic artifact loader
packages/data-contracts/            Canonical election and demographic contracts
packages/election-model/            Deterministic allocation and scenario engine
public/data/pa/2024/                Runtime Pennsylvania result and geometry artifacts
public/data/pa/2020/                Runtime P.L. 94-171 VTD demographic artifact
data-sources/pennsylvania/           Small auditable source registries and crosswalks
scripts/                             Reproducible import and geometry pipelines
tests/                               Reconciliation and model invariants
docs/decisions/                      Architecture and data decisions
```

## Rebuild Pennsylvania data

The repository does not vendor the large source archives. The importers verify source checksums before replacing generated artifacts.

Results:

```bash
node scripts/import-pennsylvania-2024.mjs <precinct-return-file> <county-summary-file>
```

VTD geometry:

```bash
node scripts/build-pennsylvania-vtd-geometry.mjs \
  public/data/pa/2024/reporting-units.json \
  <path-to-vtd.shp> \
  <path-to-vtd.dbf> \
  <path-to-source.zip>
```

Demographic denominator:

```bash
npm run data:pa:demographics -- \
  <path-to-pageo2020.pl> \
  <path-to-pa000022020.pl> \
  <path-to-pa2020.pl.zip>
```

## Important documents

- `PRODUCT_AND_ENGINEERING_PLAN.md`
- `CODEX_HANDOFF.md`
- `docs/decisions/0001-independent-product.md`
- `docs/decisions/0002-reporting-unit-model.md`
- `docs/decisions/0003-deterministic-scenarios.md`
- `docs/decisions/0004-atlas-renderer-behavior.md`
- `docs/decisions/0005-pennsylvania-result-reconciliation.md`
- `docs/decisions/0006-pennsylvania-vtd-crosswalk.md`
- `docs/decisions/0007-pennsylvania-demographic-denominator.md`
- `docs/decisions/0008-bidirectional-preference-and-contributions.md`

## Next increment

Add third-party candidate controls as a separate multi-candidate operation. They must preserve total ballots, retain named candidates and the residual Other bucket, and remain distinct from the two-party transfer. After that, add selected-geography denominator inspection and shareable versioned scenario URLs.

## Primary sources

- [Federal Election Commission, official 2024 presidential results](https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf)
- [Pennsylvania Department of State, election data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)
- [U.S. Census Bureau, 2020 Pennsylvania VTD TIGER/Line archive](https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/42_PENNSYLVANIA/42/tl_2020_42_vtd20.zip)
- [U.S. Census Bureau, 2020 Redistricting Data summary files](https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html)
- [U.S. Census Bureau, Table P4 variables](https://api.census.gov/data/2020/dec/pl/groups/P4.html)
