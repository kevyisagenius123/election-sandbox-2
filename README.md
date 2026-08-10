# Sandbox 2.0

Sandbox 2.0 is an independent, local-first laboratory for historical United States election counterfactuals. It is not connected to the existing Sandbox or Presidential Atlas at runtime. The application owns its code, data contracts, renderer, tests, and future deployment path.

## Current release: v0.11 multi-state runtime foundation

The current build provides:

- The official 2024 presidential baseline, including a reconciled 312 to 226 Electoral College result.
- An editorial React and deck.gl workbench with national, Pennsylvania county, and Pennsylvania Census voting-district terrain.
- Official Pennsylvania county summaries and 9,189 normalized election reporting units.
- A versioned crosswalk connecting 9,038 of 9,178 Census VTD polygons to mapped 2024 results.
- A Census P.L. 94-171 Table P4 voting-age-population denominator for every 2020 Pennsylvania VTD.
- Separate, ordered turnout, preference, and third-party operations.
- Full feasible Republican-to-Democratic preference movement with no arbitrary point ceiling.
- Turnout composition from 100% Trump through 100% Harris.
- Named Stein and Oliver controls plus an explicit residual Other/write-in control.
- A user-defined Harris/Trump source split for every third-party ballot exchange.
- Candidate-share bounds derived only from available ballots, with no arbitrary interface ceiling.
- Exact county and mapped-VTD contribution rankings using the change in the Harris minus Trump vote margin.
- A selected county and VTD inspector with certified-to-scenario candidate ledgers, VAP, turnout capacity, operation contributions, result coverage, and crosswalk quality.
- Versioned, shareable scenario URLs that preserve every behavior assumption, interface mode, ranking scope, and selected state, county, or VTD.
- Explicit data and engine compatibility checks with certified-baseline fallback for malformed or unsupported links.
- A self-describing Pennsylvania VTD row format that reduces the demographic browser artifact from 5.71 MB to 875 KB without removing modeled or audited fields.
- Fail-closed runtime decoding that verifies field order, GEOIDs, demographic cells, mapped votes, coverage counts, and turnout capacity before enabling controls.
- Checked-in Playwright replays for the canonical complex scenario, an official alphanumeric VTD, and unsupported-future-version fallback.
- A reproducible Pennsylvania runtime profiler plus allocation hot-path improvements that preserve the engine's exact integer results.
- A typed detailed-state manifest that owns Pennsylvania's election, compatibility, runtime-artifact, geography, and source contracts.
- Dedicated Web Worker decoding and scenario calculation with queued-change coalescing and stale-response rejection.
- GitHub Actions release gates for model tests, lint, production build, and full browser replay.
- Exact scenario aggregation from VTD or residual model units to counties, Pennsylvania, the national popular vote, and the Electoral College.
- Actual, scenario, and shift comparison modes, plus ballot and flat terrain modes.
- Lazy county geometry shards and deterministic, cancellable camera transitions.
- Reconciliation, allocation, and zero-change tests.

The Pennsylvania source exposes exact Harris, Trump, Stein, and Oliver results by reporting unit, but does not place every write-in or residual vote by county. The model therefore preserves 24,526 certified residual votes in an explicit statewide bucket instead of inventing a county or precinct location. One Philadelphia reconciliation bucket and every unmatched reporting unit also remain explicit.

## Behavior model

The model runs three deliberately separate operations:

1. **Turnout** adds ballots in proportion to each usable VTD's 2020 population age 18 and over. Added ballots cannot exceed the VTD's remaining denominator capacity. The user explicitly sets the Harris and Trump division from either full endpoint.
2. **Preference** transfers already-counted Harris and Trump ballots after turnout. It preserves the number of ballots and can run to the full mathematically feasible endpoint in either direction. The engine caps at the available candidate ballots, never at an arbitrary interface margin.
3. **Third party** moves ballots between one selected bucket and the two major candidates after preference. The user selects Stein, Oliver, or residual Other/write-in and explicitly sets the Harris share of the exchanged major-party ballots. Negative movement can reduce the selected bucket to zero. Positive movement is limited only by the chosen Harris/Trump source mix and the ballots those candidates actually have.

The contribution panel ranks the counties or mapped VTDs that most changed the state result. Contribution is defined as the scenario change in `Harris votes - Trump votes`. That definition lets all three operations reconcile in the same unit while retaining their separate meanings.

The model is deterministic and integer-reconciled. With all three operations set to zero, it reproduces Pennsylvania's certified result exactly. Third-party exchanges are counterfactual ballot transfers, not an estimate of which candidate those voters historically preferred.

## Selected-geography inspector

Selecting a Pennsylvania county or pinning a mapped VTD opens an audit panel. It separates certified candidate totals from the scenario, reports the 2020 Census VAP denominator and usable turnout capacity, and attributes the local change to turnout, two-party transfer, and third-party exchange operations.

County coverage compares VTD-linked ballots with the official county total. VTD match quality distinguishes exact Census identifiers, unique canonical-name links, mixed links, and polygons with no matched return. Unmatched polygons show an explicit unavailable state. The inspector never assigns non-terrain residual ballots to a polygon.

The turnout denominator is not citizen voting-age population and is not a 2024 eligible-voter estimate. Census data do not reveal candidate preference. These controls are transparent counterfactual assumptions, not a forecast or a claim about individual voters.

## Scenario sharing

Every non-baseline change is written into a readable query string with URL schema, dataset, and deterministic engine versions. The payload includes all three behavior operations, the active editor and map modes, contribution scope, and selected state, county, or VTD. A copied baseline link is also explicit and versioned even though the ordinary baseline page keeps a clean URL.

Compatible links restore locally without a backend. Slider changes replace the current browser-history entry instead of creating hundreds of entries during a drag. Unknown future schema, data, or engine versions and malformed payloads never apply partially: the application restores the certified baseline and displays the reason.

Current compatibility contract:

- URL schema: `1`
- Dataset: `us2024-pa-vtd2020-v2`
- Engine: `pa-behavior-v1`

## Compact demographic runtime

The official P.L. 94-171 importer now writes storage schema `3` with encoding `vtd-row-v1`. Repeated object keys and derivable values no longer travel once per VTD. The loader reconstructs the same expanded objects used by the model and inspector, then reconciles the decoded rows against statewide coverage, mapped vote totals, and turnout capacity before returning them.

The committed artifact is 874,568 bytes instead of 5,712,538 bytes, an 84.7% raw reduction. All 9,178 VTDs, six VAP cells, candidate totals, and exact/canonical crosswalk counts remain present. The importer pipeline is `pa-pl94-vtd-demographics-v3`; its checksum and byte size are recorded in the Pennsylvania source registry.

Coverage is explicit:

- 9,178 Census VTD polygons.
- 9,038 polygons linked to mapped 2024 election results.
- 8,880 VTDs available for the turnout operation.
- 158 linked VTDs excluded from turnout because mapped 2024 ballots exceed the older 2020 VAP denominator.
- 140 Census VTDs with no mapped 2024 result.

## Reliability and runtime profile

The browser suite opens the real application, waits for the compact demographic artifact, and verifies visible scenario outcomes rather than private component state. It locks the canonical replay to Pennsylvania R +5.8 and the ALEPPO VTD inspector, verifies `4200300A000`, and proves that a future URL schema fails closed to the certified baseline.

The local profiler covers JSON parsing, fail-closed decoding, model-unit conversion, a complex three-operation scenario, and its contribution audit. On repeated runs on the current Windows development machine, the scenario median fell from about 100 ms to roughly 75 ms and the contribution audit from about 16 ms to under 2 ms. These measurements are diagnostic, not cross-device performance guarantees.

## Multi-state runtime foundation

Pennsylvania is now registered through a typed state manifest instead of scattered runtime constants. URL compatibility versions, the demographic artifact, precinct geometry manifest, election metadata, and source registries resolve through that contract.

The demographic artifact is fetched, decoded, validated, and converted to model units inside a dedicated worker. Scenario requests carry monotonically increasing identifiers. Queued slider changes are coalesced, and the interface accepts only the response matching the newest settings. Share links remain disabled while a result is pending, so a copied URL and the displayed result cannot disagree.

## Run locally

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm run test:browser:install
npm run dev
```

The local application runs at `http://127.0.0.1:4173`.

## Verify

```bash
npm test
npm run test:browser
npm run profile:pa
npm run lint
npm run build
```

## Repository map

```text
src/App.tsx                         Editorial workbench and scenario state
src/map/AtlasMapScene.tsx           deck.gl national, county, and VTD renderer
src/data/paDemographics.ts          Versioned demographic artifact loader
src/data/detailedStateManifest.ts   Typed state registration and asset contracts
src/data/scenarioUrl.ts             Versioned scenario URL codec and compatibility policy
src/runtime/                         Worker protocol, scenario runtime, and React bridge
packages/data-contracts/            Canonical election and demographic contracts
packages/election-model/            Deterministic allocation and scenario engine
public/data/pa/2024/                Runtime Pennsylvania result and geometry artifacts
public/data/pa/2020/                Runtime P.L. 94-171 VTD demographic artifact
data-sources/pennsylvania/           Small auditable source registries and crosswalks
scripts/                             Reproducible import and geometry pipelines
tests/                               Model invariants and browser scenario replays
playwright.config.ts                 Browser-test server and Chromium configuration
.github/workflows/verify.yml         Hosted model, build, and browser release gates
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
- `docs/decisions/0009-named-third-party-exchange.md`
- `docs/decisions/0010-selected-geography-inspector.md`
- `docs/decisions/0011-versioned-scenario-urls.md`
- `docs/decisions/0012-compact-demographic-runtime.md`
- `docs/decisions/0013-browser-replay-and-runtime-profile.md`
- `docs/decisions/0014-manifest-driven-worker-runtime.md`

## Next increment

Select and import the second production-detailed battleground through the manifest contract, then replace Pennsylvania-only aggregation with version-compatible multi-state aggregation and a path-to-270 view.

## Primary sources

- [Federal Election Commission, official 2024 presidential results](https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf)
- [Pennsylvania Department of State, election data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)
- [U.S. Census Bureau, 2020 Pennsylvania VTD TIGER/Line archive](https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/42_PENNSYLVANIA/42/tl_2020_42_vtd20.zip)
- [U.S. Census Bureau, 2020 Redistricting Data summary files](https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html)
- [U.S. Census Bureau, Table P4 variables](https://api.census.gov/data/2020/dec/pl/groups/P4.html)
