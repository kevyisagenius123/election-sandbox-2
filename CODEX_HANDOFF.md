# Codex handoff: Sandbox 2.0

Last updated: 2026-08-12

## 1. Product boundary

Sandbox 2.0 is a standalone historical election counterfactual laboratory. It is not a route, package, or backend inside the older Sandbox or the Presidential Atlas. The product borrows proven editorial and deck.gl interaction patterns, but this repository owns its application, data contracts, generated artifacts, tests, deployment, and future backend.

The product promise is a traceable chain:

```text
explicit assumption
  -> reporting-unit vote changes
  -> county and state totals
  -> national popular vote and Electoral College
```

The unchanged scenario must always reproduce the official baseline exactly.

## 2. Repository and runtime

- Root: `C:\Users\kilom\OneDrive\Desktop\Sandbox\election-sandbox-2`
- Branch: `main`
- Release: `0.18.2`, Editorial Home and United States Laboratory
- Previous release commit: `439db1c Add audited Michigan data foundation`
- Remote: `https://github.com/kevyisagenius123/election-sandbox-2.git`
- Frontend: React 19, TypeScript, Vite 8
- Renderer: deck.gl 9 with `OrbitView` and `GeoJsonLayer`
- Backend: none
- Persistence: URL-local versioned scenario recipes; no backend storage
- Local URL: `http://127.0.0.1:4173/`
- Required Node: 22.12 or newer
- Hosting metadata: none; there is no `.openai/hosting.json`

A local Vite server may still be running on port 4173; check rather than starting a duplicate.

## 3. What is implemented

### National workbench

- Official 2024 presidential state totals and election-specific Electoral College allocation.
- Exact actual baseline: Harris 226, Trump 312.
- Actual national vote: 155,238,302 ballots.
- Editorial three-column desktop layout and stacked mobile layout.
- National 3D state terrain with Actual, Scenario, and Shift modes.
- State click removes the national layer and transitions into state context.
- Pennsylvania and Michigan are production-detailed states. Selecting either state loads its official county result layer, deterministic worker foundation, contribution trace, inspector, and manifest-driven precinct geometry.

### Pennsylvania election foundation

- Official Department of State county totals for all 67 counties.
- 9,189 normalized result model units: 9,187 source geographic units, one Philadelphia reconciliation bucket, and one statewide residual bucket.
- Certified Pennsylvania baseline:

| Bucket | Votes |
|---|---:|
| Harris | 3,423,042 |
| Trump | 3,543,308 |
| Other | 92,382 |
| Total | 7,058,732 |

- 24,526 certified votes that cannot be placed by county remain in an explicit statewide residual.
- 2,469 named-candidate votes needed to reconcile Philadelphia remain in an explicit county residual.
- Residuals affect aggregate totals but are never painted onto arbitrary polygons.

### Pennsylvania geometry

- Official 2020 Census Pennsylvania VTD geometry.
- Exact identifier matching first, then unique canonical-name matching within a county.
- No fuzzy edit distance, proximity assignment, or countywide vote smearing.
- 9,038 of 9,178 VTD polygons are linked to mapped 2024 results.
- 6,933,560 votes, or 98.6038% of the source precinct-file vote, are linked to VTD terrain.
- One lazy TopoJSON shard per county.
- County drilldown removes the parent county layer and opens clean VTD terrain.
- Hover and pinned VTD readouts disclose match quality.

### v0.4 behavior foundation

- Official 2020 Census P.L. 94-171 Table P4 population age 18 and over by VTD.
- Exact state + county + VTD join to the existing 2020 geometry.
- Versioned source registry and reproducible importer with a required archive checksum.
- Separate ordered behavior operations:
  1. turnout addition;
  2. two-party preference transfer.
- Turnout adds integer ballots proportionally to available VTD denominators, capped by `2020 VAP - mapped 2024 ballots`.
- The user explicitly sets the Harris share of added ballots.
- Preference runs after turnout and transfers existing Harris/Trump ballots while preserving ballot totals.
- Exact VTD scenario values feed county colors, county totals, state totals, national popular vote, and Electoral College allocation.
- Exact scenario values also feed the VTD drilldown rather than approximating from a countywide shift.
- The assumption ledger explains operation order and whether each operation is active.
- Fail-closed loading: behavior controls stay disabled if the demographic artifact is unavailable.

### v0.5 bidirectional behavior and contribution tracing

- Preference now spans the complete feasible range in both directions instead of stopping at +4 Democratic points.
- The Republican endpoint transfers every available Harris ballot to Trump; the Democratic endpoint transfers every available Trump ballot to Harris.
- Bounds are recalculated after turnout, and the engine still clamps transfers to available ballots.
- Turnout composition spans 0 to 100 percent Harris, with the complementary Trump share shown explicitly.
- Exact contributions are derived for every model unit as the change in `Harris - Trump` margin.
- The contribution panel ranks the top five counties or mapped VTDs by absolute margin contribution.
- County rows reconcile to Pennsylvania and open that county's VTD terrain.
- VTD rows open their parent county, and the panel discloses the aggregate contribution remaining outside mapped terrain.
- Republican contributions use the Republican palette and direction labels; Democratic contributions use the Democratic palette.
- Third-party behavior is deliberately not included in the two-party slider.

### v0.6 named third-party exchange

- The result import retains exact Stein and Oliver votes at county and reporting-unit level.
- The certified residual Other/write-in total remains an explicit statewide-only bucket because the source package does not provide honest county geography for it.
- A separate third operation runs after turnout and two-party preference.
- The user selects Stein, Oliver, or residual Other/write-in and moves that bucket's share in either direction.
- A second control explicitly defines the Harris share of exchanged ballots; Trump supplies or receives the complement.
- Negative movement can reach exactly zero votes for the selected bucket.
- Positive movement reaches the exact integer ballot capacity implied by the selected Harris/Trump source mix. It has no arbitrary interface ceiling.
- Every reporting unit preserves its ballot total during the exchange, and every named third-party bucket reconciles to aggregate Other.
- Contribution tracing continues to measure `change in Harris - Trump`, while the third-party panel separately displays exchanged ballot volume.
- Increasing residual Other produces counterfactual geography where source major-party ballots were located. It does not fabricate a historical county allocation for the certified statewide residual.
- County contribution accounting separately discloses margin movement confined to the statewide-only residual instead of falsely assigning it to all 67 counties.

### v0.7 selected-geography inspector

- County and VTD selection is now shared application state instead of a renderer-only VTD pin.
- Contribution rows can open and pin the same VTD shown by the map and breadcrumb.
- The inspector compares certified and scenario totals for Harris, Trump, Stein, Oliver, and residual Other/write-in.
- It reports 2020 VAP, 2024 ballots divided by that denominator, usable turnout capacity, and denominator status.
- It audits local turnout additions, two-party transfer direction, third-party exchange, ballot change, and Harris-minus-Trump contribution.
- County coverage distinguishes official totals from mapped VTD ballots and explicit residual units.
- VTD coverage distinguishes exact-ID, canonical-name, mixed, and unmatched links.
- Unmatched VTDs display unavailable results and retain zero turnout capacity.
- The P.L. 94-171 runtime artifact advances to schema version 2 and pipeline version `pa-pl94-vtd-demographics-v2`.

### v0.8 versioned scenario URLs

- Every behavior control, active map mode, editor tab, contribution scope, and selected state, county, or VTD can be encoded in a readable URL.
- Compatibility is explicit: URL schema `1`, dataset `us2024-pa-vtd2020-v2`, and engine `pa-behavior-v1`.
- Compatible links rebuild the scenario locally through the deterministic engine; computed results are not serialized as a competing source of truth.
- Live changes use `history.replaceState`, so slider drags do not flood navigation history.
- Copy link always emits a complete versioned payload, including for the baseline; the ordinary untouched baseline URL stays clean.
- Duplicate fields, invalid ranges, malformed geography, missing metadata, and unknown future versions fail closed to the certified baseline with a visible explanation.
- Unrelated query parameters are retained and copied links omit page-section hashes.

### v0.9 compact demographic runtime

- The P.L. 94-171 browser artifact advances to storage schema `3` and encoding `vtd-row-v1`.
- A self-describing field list is stored once; all 9,178 VTDs use fixed-order compact rows.
- County FIPS, VTD code, display-name fallback, source count, match method, aggregate Other, total ballots, denominator status, and turnout capacity are losslessly derived by the loader.
- The loader validates field order, row types, official alphanumeric VTD GEOIDs, demographic sums, sorted uniqueness, mapped/unavailable coverage, mapped vote totals, and turnout capacity before enabling controls.
- The official checksum-verified importer emits the compact artifact directly through pipeline `pa-pl94-vtd-demographics-v3`.
- Raw browser payload falls from 5,712,538 bytes to 874,568 bytes, an 84.7 percent reduction. A local gzip profile falls from 437,995 to about 229,618 bytes.
- Artifact SHA-256 is `639341193ee9b44d25a1712d2e02979f54db41a312baa7df992db44df0e790f0`.
- Semantic scenario dataset `us2024-pa-vtd2020-v2` remains unchanged because decoded data and deterministic results are unchanged.

### v0.10 replay and performance hardening

- Playwright is a checked-in development dependency with three full browser replays in `tests/browser/scenario-replay.spec.ts`.
- The browser contract verifies the compact artifact response, canonical Pennsylvania R +5.8 result, ALEPPO VTD inspector, official alphanumeric VTD `4200300A000`, and visible certified-baseline fallback for future URL schema 99.
- `scripts/profile-pennsylvania-runtime.mjs` measures JSON parse, validated decode, model-unit conversion, full three-operation scenario calculation, contribution derivation, and retained heap.
- The engine caches validation and indexes by immutable baseline-array identity, uses numeric largest-remainder ranking, and removes per-unit accumulator object churn without changing allocation ordering or outputs.
- Repeated local profile medians: scenario calculation about 100 ms to roughly 75 ms; contribution audit about 16 ms to under 2 ms. Validated decode ranges around 25 to 45 ms and retained expanded runtime heap is about 13 MiB on this machine.
- URL schema, semantic dataset, and deterministic engine versions remain unchanged because results are unchanged.

### v0.11 multi-state runtime foundation

- `src/data/detailedStateManifest.ts` registers Pennsylvania through a typed schema covering election metadata, compatibility versions, runtime artifacts, geometry, and source registries.
- Scenario URL constants and precinct-geometry loading now consume the manifest instead of duplicating Pennsylvania runtime paths and versions.
- `src/runtime/detailedStateScenario.worker.ts` fetches, decodes, validates, converts, and calculates the detailed-state scenario outside the interface thread.
- `src/runtime/useDetailedStateScenario.ts` owns worker lifetime, monotonic request identifiers, pending/error state, and stale-response rejection.
- Queued worker calculations are coalesced to the newest waiting request. One already-running synchronous calculation may finish, but it can never replace a newer interface state.
- URL history replacement and Copy link wait until the worker has published the matching result.
- A fourth browser replay rapidly submits three conflicting preference settings and proves only the final D +4.5 Pennsylvania result and `preference=6.2` URL are published.
- `.github/workflows/verify.yml` runs model tests, lint, build, and Playwright browser replay for pushes to `main` and pull requests.
- URL schema `1`, dataset `us2024-pa-vtd2020-v2`, and engine `pa-behavior-v1` remain unchanged because deterministic results are unchanged.

### v0.12 Michigan audited data foundation

- Michigan is selected as the second production-detailed battleground after passing the official source and exact-cycle geometry audit.
- The checksum-verified `2024GEN.zip` importer reconciles 5,664,186 presidential votes, all 12 named candidates, all 83 counties, and 4,434 raw reporting-unit keys.
- Sixty-five AVCB or central-count units remain explicit non-geographic model units.
- Twenty-two raw statistical-adjustment units include negative candidate corrections. Their positive statewide net is retained as one explicit non-geographic normalized unit: Harris 95, Trump 290, Other 724, total 1,109.
- The official 2024 Michigan precinct layer contains 4,340 polygons. The deterministic crosswalk links 4,339 polygons and 4,339 of 4,347 geographic result units.
- Crosswalk coverage is 99.9979 percent of votes in geographic precinct units and 97.4829 percent of all statewide votes. Eight unmatched geographic units contain 114 votes.
- No central-count unit, statistical correction, or unmatched result is assigned to arbitrary terrain.
- The official Census `mi2020.pl.zip` archive is checksum verified and Table P4 is parsed for all 4,805 2020 VTDs.
- Michigan's official `VTDST` bridge maps 4,050 precinct polygons directly. Another 218 polygons share a 2020 VTD and receive deterministic integer P4 allocations weighted by official 2024 registered voters. Seventy-two polygons have no valid 2020 VTD bridge.
- The compact `mi-precinct-row-v1` artifact reconstructs the certified baseline from 4,340 geometry rows plus 74 residual units and exposes 2,058,704 ballots of fail-closed turnout capacity.
- This release adds data pipelines, generated artifacts, provenance registries, artifact tests, and decision 0015. It does not yet register Michigan in the worker or change the visible workbench.

### v0.13 Michigan runtime integration

- `mi-precinct-row-v1` now has a strict runtime decoder that validates schema, field order, identifiers, demographic sums, election-link counts, vote reconciliation, residual units, turnout capacity, and sorted unique geometry IDs.
- The worker protocol carries a discriminated Pennsylvania-or-Michigan foundation. Loader dispatch is keyed by manifest encoding; deterministic calculation contains no state-code branch.
- Michigan is registered with 15 electoral votes and the shared dataset version advances to `us2024-pa-vtd2020-mi-precinct2024-v1`. Engine semantics remain `pa-behavior-v1` for backward clarity, despite the historical name.
- `detailedStateData.ts`, `detailedStatePrecincts.ts`, and `detailedStateInspector.ts` normalize state differences at the application boundary.
- County scenarios are official county totals plus exact per-unit deltas. This prevents Michigan's central-count and statistical-adjustment geography from being fabricated while keeping the statewide scenario exact.
- Selecting Michigan replaces the national state layer with 83 official counties. Selecting a county removes the parent layer and opens its audited 2024 precinct shard.
- Michigan `PRECINCTID` selections round-trip through schema-1 URLs and are validated against their selected county. Pennsylvania alphanumeric Census VTD links remain valid.
- The inspector works for Michigan direct links, alternate official precinct-key links, weighted demographic splits, unavailable bridges, and explicit off-terrain residual coverage.
- A shared manifest fetch can no longer be poisoned by React Strict Mode cancellation; per-county geometry requests remain abortable.
- Unit/model verification now contains 35 tests. Playwright contains five real-browser replays, including three Michigan demographic bridge outcomes and stale worker rejection.

### v0.14 multi-state scenario portfolio

- `src/data/scenarioPortfolio.ts` defines authoritative per-state recipes, canonical fingerprints, worker-unit conversion, compact derived summaries, and summary-to-state aggregation.
- `src/runtime/scenarioPortfolio.worker.ts` validates and hydrates inactive recipes sequentially. It never returns or retains expanded foundations on the interface thread.
- `src/runtime/useScenarioPortfolio.ts` owns inactive-worker lifetime, publishes only the matching recipe signature, and fails closed on load or calculation errors.
- The active detailed worker still owns the one foundation needed for terrain, contribution analysis, and the selected-geography inspector.
- Pennsylvania and Michigan controls persist independently. Switching states snapshots the departing recipe, restores the arriving controls, and retains both exact results in the national aggregate.
- The scenario card includes a compact active-state strip with current margins and direct state-lab navigation.
- National aggregation replaces each certified state at most once. An inactive summary enters only when its fingerprint exactly matches the current recipe.
- URL schema 2 stores sorted multi-state recipes and the active detailed state. Schema 1 stays replayable and upgrades locally into a single-state recipe.
- Precinct geometry now uses a six-shard least-recently-used cache plus state-level release; workers, fetches, and Deck resources remain lifecycle-owned.
- The amended Path to 270 plan separates Actual, Modeled, and Required states, defines net margin votes, target and tie behavior, and splits delivery into v0.14 through v0.17.
- Decision 0017 records recipe authority, summary-cache semantics, memory lifecycle, aggregation safety, and replay compatibility.
- Verification now contains 37 model tests and six real-browser replays, including simultaneous PA and MI aggregation and state-switch restoration.

### v0.15 Electoral College consequence ledger

- `src/data/electoralConsequences.ts` derives the national score, majority threshold, target EV delta, active and consequential state rows, and deterministic causal language from certified and verified scenario states.
- The user explicitly selects Harris or Trump as the explanation target. Schema-2 URLs preserve that target; legacy schema-1 links retain their original Harris default.
- The scenario card now leads with threshold status and a changed-state ledger instead of a decorative active-state strip.
- Each Modeled row reports Actual winner and margin, Scenario winner and margin, and signed EV consequence from the target perspective.
- Active state recipes remain visible with `0 EV` if their margins change without changing the state's winner.
- Threshold states distinguish exactly 270, above-majority distance, below-majority distance, and a 269–269 Electoral College tie with no majority.
- Causal language reports exact target EV gained or lost and names only states whose allocations changed. It explicitly explains when active modeled changes produce no EV change.
- The consequence model fails if scenario EV allocation does not reconcile to the certified election-year total.
- Desktop and 390-pixel mobile visual QA show no horizontal overflow and preserve the Atlas editorial hierarchy.
- Decision 0018 records the target, threshold, signed-consequence, replay, and invariant contracts.
- Verification contains 42 model tests and seven browser replays.

### v0.16 deterministic Path to 270

- `src/data/pathTo270.ts` derives exact statewide target-margin requirements and bounded winning combinations from the current verified scenario states.
- Every route requirement preserves a current Actual or Modeled classification and a separate Required classification. Required never implies local geographic modeling.
- The smallest net margin-vote requirement is `opponent votes - target votes + 1`; the interface also reports its margin-point equivalent under the current state vote total.
- Routes rank deterministically by fewest states, aggregate margin movement, or aggregate net margin votes. Stable secondary comparisons prevent reload-dependent ordering.
- The bounded search caps excess EV states at the target need and retains a limited Pareto set instead of brute-forcing every national subset.
- The route panel reports current to projected EV, completeness, individual state requirements, and route totals.
- Supported Pennsylvania and Michigan rows open their detailed state labs. Unsupported Required states remain noninteractive and receive no county or precinct claims.
- Maine and Nebraska are excluded until district-level electoral allocation is modeled.
- Schema-2 URLs persist the selected route metric. Schema-1 URLs retain their prior defaults.
- A target already at or above the majority receives no Required route.
- Decision 0019 records arithmetic, classification, bounded-search, replay, and split-state contracts.
- Verification contains 46 model tests and seven browser replays.

### v0.17 geographic route construction

- `buildRouteConstructionPlan` preserves a selected state-code blueprint while deriving every status and number from certified and verified scenario states.
- Selected routes persist through schema-2 `plan` parameters. Computed margins, gaps, statuses, and EV totals are never serialized as authority.
- Route states transition strictly through Required, Modeled, and Satisfied. Modeled does not imply a flip; Satisfied requires the deterministic statewide allocation to change.
- The active PA or MI laboratory reports the certified net-margin requirement, signed modeled movement, exact remaining gap, progress, and verified EV contribution.
- Moving toward the target without flipping explains the remaining gap. Moving away from the target is described honestly and never shown as improvement.
- Reversing below the winner threshold immediately removes Satisfied status and the state's route EV contribution.
- The selected construction ledger survives national navigation and state switching while existing recipe and worker lifecycle rules remain authoritative.
- The national map adds numbered route markers, status-dependent outlines, and a check mark for satisfied states so status does not depend on color alone.
- Unsupported states remain mathematical and non-geographic. Invalid, duplicate, Maine, and Nebraska route plans fail closed.
- Changing the target candidate clears the selected route because its directional objective is no longer valid.
- Decision 0020 records route blueprint, status, replay, geographic honesty, and reversal contracts.
- Verification contains 47 model tests and eight browser replays.

## 4. Demographic source and limitations

Official archive:

`https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Pennsylvania/pa2020.pl.zip`

Archive SHA-256:

`2d33a7dab29c8dd5692bbde203d253e06eebbc44fcbaa96b1caa958d454026ae`

Table: P4, Hispanic or Latino and not Hispanic or Latino by race for the population 18 years and over.

State totals:

| Cell | Population |
|---|---:|
| Voting-age population | 10,353,548 |
| Hispanic, any race | 704,258 |
| Non-Hispanic White | 7,884,010 |
| Non-Hispanic Black | 1,039,831 |
| Non-Hispanic Asian | 398,348 |
| Non-Hispanic other or multiracial | 327,101 |

Behavior coverage:

- 9,038 result-linked VTDs.
- 8,880 turnout-ready VTDs.
- 158 result-linked VTDs excluded from turnout because mapped 2024 ballots exceed the older 2020 VAP denominator.
- 140 Census VTDs without a mapped 2024 result.
- Total modeled turnout capacity: 3,281,256 ballots.

Non-negotiable interpretation:

- This is 2020 VAP, not citizen VAP.
- It is not a 2024 eligible-voter estimate.
- It predates the 2024 election baseline by four years.
- Census demographic counts do not reveal candidate preference.
- The current Harris share and preference controls are explicit synthetic assumptions, not estimates or forecasts.
- Do not silently turn aggregate race or ethnicity counts into candidate support rates.

See `docs/decisions/0007-pennsylvania-demographic-denominator.md`.

## 5. Architecture

```text
src/main.tsx
  -> src/App.tsx
       -> load versioned PA demographic foundation
       -> apply ordered behavior scenario
       -> aggregate exact county/state/national consequences
       -> render editorial controls and audit disclosures
       -> lazy src/map/AtlasMapScene.tsx
            -> national us-atlas geometry
            -> verified Pennsylvania county terrain
            -> lazy county VTD shards
            -> exact scenario colors and heights

src/data/states.ts
  -> official 2024 state baselines and EV rules
src/data/pennsylvania.ts
  -> official county artifact exports
src/data/paPrecincts.ts
  -> lazy manifest and TopoJSON shard loader
src/data/paDemographics.ts
  -> compact P.L. 94-171 row decoder, validation, and model-unit conversion
src/data/scenarioUrl.ts
  -> versioned scenario codec, canonical URL builder, and compatibility validation

packages/data-contracts/src/index.ts
  -> result, demographic coverage, denominator, and quality contracts
packages/election-model/src/invariants.ts
  -> reconciliation and largest-remainder primitives
packages/election-model/src/scenario.ts
  -> national aggregation, capped allocation, turnout, preference, and third-party exchange

scripts/import-pennsylvania-2024.mjs
  -> election result ingestion
scripts/build-pennsylvania-vtd-geometry.mjs
  -> VTD projection, crosswalk, simplification, and sharding
scripts/import-pennsylvania-2020-pl94-demographics.mjs
  -> P.L. 94-171 fixed-width ingestion and exact VTD join
scripts/import-michigan-2024.mjs
  -> official tab-delimited results, central-count classification, and adjustment normalization
scripts/build-michigan-2024-precinct-geometry.mjs
  -> exact-cycle precinct crosswalk, projection, simplification, and county sharding
scripts/import-michigan-2020-pl94-demographics.mjs
  -> P.L. 94-171 VTD bridge and registered-voter-weighted split allocation
```

All interactive calculations are client-side. Large official source archives are build inputs, not runtime dependencies and not committed.

## 6. Renderer decisions

- `OrbitView` uses `COORDINATE_SYSTEM.CARTESIAN`.
- `us-atlas` Albers geometry is projected for a 975 by 610 viewport.
- Screen Y is inverted once for the OrbitView coordinate system.
- Pennsylvania VTD geometry is built in the same projection.
- Camera transitions are cubic-eased, cancellable, and clean up animation frames.
- View-state propagation is throttled through `requestAnimationFrame`.
- Parent layers disappear after the child layer rises to prevent depth-buffer occlusion.
- `ResizeObserver` keeps the map fit responsive.
- County and VTD heights use normalized square-root ballot scales.
- Unmatched geometry remains low and neutral.
- Precinct fetches use `AbortController`; only successful shard loads are cached.

Do not reintroduce raw-vote elevation or duplicate camera effects. Those caused unreadable urban towers, jerky transitions, and stale async work in earlier prototypes.

## 7. Important files changed

New:

- `scripts/import-pennsylvania-2020-pl94-demographics.mjs`
- `src/data/paDemographics.ts`
- `public/data/pa/2020/vtd-demographics.json`
- `data-sources/pennsylvania/2020-pl94-vtd-demographics.json`
- `docs/decisions/0007-pennsylvania-demographic-denominator.md`

Modified:

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/map/AtlasMapScene.tsx`
- `src/styles.css`
- `packages/data-contracts/src/index.ts`
- `packages/election-model/src/scenario.ts`
- `tests/election-model.test.mjs`
- `README.md`
- `PRODUCT_AND_ENGINEERING_PLAN.md`
- `CODEX_HANDOFF.md`

Generated artifacts are committed so the application works without a build-time Census download. The 55 MB raw Census archive is not committed.

v0.5 additionally changes:

- `packages/election-model/src/scenario.ts`
- `src/App.tsx`
- `src/styles.css`
- `tests/election-model.test.mjs`
- `docs/decisions/0008-bidirectional-preference-and-contributions.md`
- release documentation and package metadata

v0.6 additionally changes:

- `scripts/import-pennsylvania-2024.mjs`
- `scripts/import-pennsylvania-2020-pl94-demographics.mjs`
- regenerated Pennsylvania result and demographic artifacts
- `src/data/pennsylvania.ts`
- `src/data/paDemographics.ts`
- `packages/election-model/src/scenario.ts`
- `src/App.tsx`
- `src/styles.css`
- `tests/election-model.test.mjs`
- `docs/decisions/0009-named-third-party-exchange.md`
- release documentation and package metadata

v0.7 additionally changes:

- `src/components/GeographyInspector.tsx`
- `src/data/paInspector.ts`
- `src/App.tsx`
- `src/map/AtlasMapScene.tsx`
- `src/styles.css`
- `src/data/paDemographics.ts`
- `scripts/import-pennsylvania-2020-pl94-demographics.mjs`
- regenerated Pennsylvania demographic artifacts and registry hash
- `tests/election-model.test.mjs`
- `docs/decisions/0010-selected-geography-inspector.md`
- release documentation and package metadata

v0.8 additionally changes:

- `src/data/scenarioUrl.ts`
- `src/App.tsx`
- `src/styles.css`
- `tests/election-model.test.mjs`
- `docs/decisions/0011-versioned-scenario-urls.md`
- release documentation and package metadata

v0.9 additionally changes:

- `scripts/import-pennsylvania-2020-pl94-demographics.mjs`
- regenerated compact `public/data/pa/2020/vtd-demographics.json`
- regenerated `data-sources/pennsylvania/2020-pl94-vtd-demographics.json`
- `src/data/paDemographics.ts`
- `src/data/scenarioUrl.ts`
- `tests/election-model.test.mjs`
- `docs/decisions/0012-compact-demographic-runtime.md`
- release documentation and package metadata

v0.10 additionally changes:

- `package.json` and `package-lock.json`
- `packages/election-model/src/invariants.ts`
- `packages/election-model/src/scenario.ts`
- `src/App.tsx`
- `playwright.config.ts`
- `tests/browser/scenario-replay.spec.ts`
- `scripts/profile-pennsylvania-runtime.mjs`
- `docs/decisions/0013-browser-replay-and-runtime-profile.md`
- release documentation and package metadata

v0.11 additionally changes:

- `.github/workflows/verify.yml`
- `src/data/detailedStateManifest.ts`
- `src/data/paPrecincts.ts`
- `src/data/scenarioUrl.ts`
- `src/runtime/detailedStateWorkerProtocol.ts`
- `src/runtime/detailedStateScenario.worker.ts`
- `src/runtime/useDetailedStateScenario.ts`
- `src/App.tsx`
- `tests/election-model.test.mjs`
- `tests/browser/scenario-replay.spec.ts`
- `docs/decisions/0014-manifest-driven-worker-runtime.md`
- release documentation and package metadata

v0.12 additionally adds or changes:

- `scripts/import-michigan-2024.mjs`
- `scripts/build-michigan-2024-precinct-geometry.mjs`
- `scripts/import-michigan-2020-pl94-demographics.mjs`
- `src/data/mi-2024-counties.json`
- `public/data/mi/2024/reporting-units.json`
- `public/data/mi/2024/precinct-geometry-manifest.json`
- 83 files under `public/data/mi/2024/precincts/`
- `public/data/mi/2020/precinct-demographics.json`
- three registries/crosswalks under `data-sources/michigan/`
- `docs/decisions/0015-michigan-source-geometry-and-demographic-audit.md`
- artifact reconciliation coverage in `tests/election-model.test.mjs`
- `package.json`, `package-lock.json`, `README.md`, `PRODUCT_AND_ENGINEERING_PLAN.md`, and this handoff

v0.13 additionally adds or changes:

- `src/data/miDemographics.ts`
- `src/data/detailedStateData.ts`, `detailedStateInspector.ts`, `detailedStateRuntimeLoaders.ts`, and `detailedStatePrecincts.ts`
- `src/data/detailedStateManifest.ts` and shared worker protocol/runtime files
- `src/App.tsx`, `src/map/AtlasMapScene.tsx`, and `src/styles.css`
- Michigan runtime, inspector, URL, model, and browser coverage
- `docs/decisions/0016-michigan-runtime-integration.md`

v0.14 additionally adds or changes:

- `src/data/scenarioPortfolio.ts`
- `src/runtime/scenarioPortfolio.worker.ts`
- `src/runtime/useScenarioPortfolio.ts`
- `src/data/scenarioUrl.ts`
- `src/data/detailedStatePrecincts.ts`
- `src/App.tsx`, `src/map/AtlasMapScene.tsx`, and `src/styles.css`
- `tests/election-model.test.mjs` and `tests/browser/scenario-replay.spec.ts`
- `docs/decisions/0017-multi-state-scenario-portfolio.md`
- release documentation, product plan, and package metadata

v0.15 additionally adds or changes:

- `src/data/electoralConsequences.ts`
- `src/data/scenarioUrl.ts`
- `src/App.tsx` and `src/styles.css`
- `tests/election-model.test.mjs` and `tests/browser/scenario-replay.spec.ts`
- `docs/decisions/0018-electoral-consequence-ledger.md`
- release documentation and package metadata

v0.16 additionally adds or changes:

- `src/data/pathTo270.ts`
- `src/data/scenarioUrl.ts`
- `src/App.tsx` and `src/styles.css`
- `tests/election-model.test.mjs` and `tests/browser/scenario-replay.spec.ts`
- `docs/decisions/0019-deterministic-path-to-270.md`
- release documentation, product plan, and package metadata

v0.17 additionally adds or changes:

- `src/data/pathTo270.ts` route-construction contract
- `src/data/scenarioUrl.ts` selected-plan replay
- `src/App.tsx`, `src/map/AtlasMapScene.tsx`, and `src/styles.css`
- `tests/election-model.test.mjs` and `tests/browser/scenario-replay.spec.ts`
- `docs/decisions/0020-geographic-route-construction.md`
- release documentation, product plan, and package metadata

### v0.18.2 workspace architecture

- `/` is the editorial Home and `/app/` is the direct analytical entry.
- Home/Laboratory presentation is independent from national/state/county/reporting-unit geography.
- Home explains the product with the existing national map; every analytical geography uses the same fixed viewport Laboratory.
- Geographic navigation stays in the Laboratory. The product logo and explicit Home control return to Home.
- Root-level legacy scenario queries normalize to `/app/`; copied scenarios always target the Laboratory.
- Vite emits both `dist/index.html` and `dist/app/index.html` from one shared application bundle for static hosting.
- `.github/workflows/deploy-pages.yml` publishes the bundle with `/election-sandbox-2/` as its GitHub Pages base path.
- National Laboratory reuses the existing context rail, map, bounded consequence rail, three-state drawer, worker foundation, and renderer.
- National Behavior presents PA/MI entry actions only. It does not display a state editor or invent unsupported national operations.
- National Inspector and Contributors expose only certified national totals and verified detailed-state summaries.
- Eight canonical visual references replace the old v0.18.1 long-page and state-only reference set.
- Decision record: `docs/decisions/0023-editorial-home-and-united-states-laboratory.md`.

### v0.19A synthetic private alpha

- `SYNTHETIC_ALPHA_REPORT.md` contains eight structured, interface-bound cognitive walkthroughs.
- This is explicitly synthetic usability and comprehension evidence, not eight human users.
- No P0 model-integrity issue was identified.
- Repeated P1 findings: unavailable public Pages URL, unclear first entry into collapsed drawer controls, exact state gap gated by route selection, unearned Required/Modeled/Satisfied terminology, insufficient in-product provenance, and overly generic precinct vocabulary.
- The authorized correction scope does not include new states, model operations, uncertainty, backend work, or a redesign.
- Human v0.19B remains required after corrections.

## 8. Verification state

CLI verification for v0.18:

v0.18.2 verification completed on 2026-08-12:

- `npm test`: 47 deterministic model and URL-contract tests pass.
- Scenario replay plus Home/Laboratory navigation: 17 browser tests pass.
- Canonical visuals: 8 required references plus reduced-motion verification pass.
- Hostile delayed-geometry replacement passes with one runtime owner.
- Full 35-cycle PA/MI profile passes: 30 measured cycles after 5 warmups; heap growth 7,050,840 bytes / 17.76%, slope 57,758 bytes per cycle, cycle p95 8,813 ms. Accepted budgets remain 20 MiB, 20%, 524,288 bytes per cycle, and 15,000 ms respectively.
- Pennsylvania profile, lint, and the two-entry production build pass.

- `npm test`: 47 tests pass, including route construction transitions, exact gap arithmetic, replay, split-allocation rejection, and Electoral College invariants.
- `npm run test:browser`: 17 browser checks cover the original eight journeys, deterministic and hostile runtime ownership, six responsive baselines, and reduced motion.
- `npm run profile:runtime`: 35 cycles pass; measured median heap growth is 1,170,964 bytes / 2.61%, retained-heap slope is 75,047 bytes per cycle, and cycle-time p95 is 7,279 ms.
- `npm run profile:pa`: completes and validates profile invariants.
- `npm run lint`: passes.
- `npm run build`: passes.
- Vite emits the existing warning that the deck.gl Atlas chunk exceeds 500 kB after minification. This is a performance item, not a build failure.

Michigan pipeline verification:

- Result import: 12 candidates, 83 counties, 4,413 normalized model units, exact 5,664,186-vote baseline.
- Geometry build: 4,339 of 4,340 polygons and 4,339 of 4,347 geographic units linked; 114 geographic votes remain unpainted.
- Demographic build: 4,050 direct VTD bridges, 218 weighted-split polygons, 72 unavailable bridges, 74 residual model units, exact certified reconstruction.
- Compact Michigan runtime artifact: 628,735 bytes.

Browser verification:

- The two-state ledger attributes +34 Harris EV to Pennsylvania and Michigan; changing target reports −34 Trump EV without changing the underlying score.
- The target, score, state ledger, and recipes reproduce after reload from one schema-2 URL.
- A Pennsylvania scenario that changes its margin without flipping remains visible with 0 EV consequence and leaves the national 226–312 allocation unchanged.
- A schema-2 recipe portfolio flips Pennsylvania and Michigan simultaneously and produces Harris 260, Trump 278 from the certified 226 to 312 baseline.
- Pennsylvania and Michigan recipe controls restore exactly when their active-state chips are selected repeatedly.
- The inactive state is rehydrated into a compact fingerprinted summary before Copy link is enabled.
- Legacy schema-1 links remain replayable and are upgraded locally after deterministic calculation.

- v0.11 retains the v0.10 desktop and mobile design; pending calculations use the existing version-status line.
- The compact artifact loads successfully and enables behavior controls without changing the canonical complex scenario.
- That scenario still produces Pennsylvania R+5.8 and the same ALEPPO VTD candidate ledger and contribution audit.
- Official alphanumeric VTD `4200300A000` restores from a shared URL as Pittsburgh Ward 15 District 09 and opens the correct inspector.
- A URL carrying turnout, Republican preference movement, Oliver exchange, Shift view, VTD contribution scope, Allegheny County, and a pinned ALEPPO VTD restores every visible state exactly.
- Reloading that URL reproduces the same assumption ledger, R+5.8 Pennsylvania result, county terrain, VTD inspector, and local candidate ledger.
- The Copy link control confirms success and keeps the explicit schema, data, and engine versions.
- Changing turnout to +0.7 points immediately produces a canonical versioned URL through history replacement.
- URL schema version 99 is rejected, removed from the address bar, and replaced by the certified national baseline with a visible compatibility notice.
- Stein +1.5 points with a 65 percent Harris source exchanges 105.9K ballots and updates county contributions.
- Switching candidates resets movement to zero; the Oliver negative endpoint reaches exactly zero Oliver votes.
- Residual Other/write-in at its 100 percent Harris-source positive endpoint reaches the exact available capacity without negative votes.
- Contribution rows still open Pennsylvania county and VTD context correctly.
- Residual-only movement is labeled as having no honest county placement, including the balanced-exchange case where ballot changes net to no Harris-minus-Trump margin movement.
- Reset restores the exact baseline, and both irregularly bounded sliders now expose a genuine DOM value of zero.
- The browser console contains no application errors.
- County and VTD inspector cards update from live scenario controls and contribution-row selection.
- Returning from a pinned VTD to its county clears only the VTD selection and preserves county context.
- Desktop 1440 by 900: national and Pennsylvania layouts have no horizontal overflow.
- Full Republican preference endpoint: Harris reaches zero without negative votes; Pennsylvania displays R+98.7.
- Full Democratic preference endpoint: Trump reaches zero without negative votes; Pennsylvania displays D+98.7 and flips its 19 EV.
- Full turnout composition endpoints work at 0 and 100 percent Harris.
- County and VTD contribution rankings reconcile to the statewide margin movement and link into county drilldown.
- Pennsylvania county and VTD drilldown remains functional; exact scenario changes propagate while inside a county.
- Actual, Scenario, Shift, Ballots, and Flat controls respond.
- Mobile 390 by 844: no horizontal overflow; national map and behavior editor stack cleanly.
- Reset returns the certified Pennsylvania and national baselines.

Re-run the commands before publishing if any model, data, or renderer file changes.

## 9. Known issues and deliberate omissions

1. **Only one expanded detailed foundation is interactive at a time.** Recipes and verified summaries for Pennsylvania and Michigan persist, but returning to a state intentionally reloads its full foundation.
2. **The inactive portfolio hydrator reloads a foundation whenever that inactive recipe changes.** This is memory-safe and deterministic but not yet optimized with a bounded summary cache across revisits.
3. **The deck.gl chunk is about 1.6 MB minified.** It is already lazy, but further code splitting or bundle review is warranted.
4. **No uncertainty model exists.** The deterministic result is intentional; do not add decorative random noise.
5. **No CVAP or 2024 eligibility estimate exists.** The UI correctly discloses the 2020 VAP limitation.
6. **No demographic preference model exists.** Candidate choice remains an explicit user input.
7. **Residual Other has no historical county geography.** Keep its certified baseline statewide-only; scenario additions may be geographically allocated only as explicitly counterfactual exchanges.
8. **A balanced third-party exchange can have zero `Harris - Trump` contribution.** This is correct even when exchanged ballot volume is large; the editor displays that volume separately.
9. **No backend-stored scenarios, authentication, or deployment exist.** Deterministic scenario URLs are client-side and require a compatible build.
10. **Source redistribution status blocks an open public data release.** `docs/data/REDISTRIBUTION_INVENTORY.md` records the current review and approved delivery decisions; provenance alone is not treated as permission.

## 10. Exact next phase

v0.18 is the engineering gate for a small task-based private alpha. Do not rebuild Pennsylvania or Michigan artifacts unless an official source changes, and do not register State #3 yet.

1. Recruit five to ten mixed users: election specialists, technical users, a casual politics user, and a GIS or data reviewer where possible.
2. Give tasks instead of a feature tour: flip Pennsylvania, find the lowest-net-margin-vote route, stop a supported state short and explain its remaining gap, restore a shared URL, and identify the largest geographic contributions.
3. Observe completion, wrong mental models, terminology confusion, trust questions, and failures to find the next control.
4. Separate product-comprehension findings from defects and data questions; prioritize blockers before polish.
5. Clear the redistribution inventory for the actual alpha delivery model before sending builds or hosted data externally.
6. Re-run model, browser, visual, bundle, and controlled runtime gates after any alpha-driven changes.
7. Choose State #3 only after the alpha findings are triaged and that state's admission checklist and exception record pass.

Uncertainty remains deferred. It must be separately switchable, seeded, calibrated, and clearly distinguished from deterministic scenario construction; decorative random noise is prohibited.

## 11. Commands

```bash
npm install
npm run test:browser:install
npm run dev
npm test
npm run test:browser
npm run profile:pa
npm run profile:runtime
npm run lint
npm run build
```

Rebuild demographics from the official archive:

```bash
npm run data:pa:demographics -- \
  <path-to-pageo2020.pl> \
  <path-to-pa000022020.pl> \
  <path-to-pa2020.pl.zip>
```

The importer rejects any archive whose checksum does not match the documented source registry.

Rebuild Michigan from the audited official inputs:

```bash
npm run data:mi:results -- <2024GEN-directory> <2024GEN.zip>
npm run data:mi:geometry -- public/data/mi/2024/reporting-units.json <2024-precincts.geojson>
npm run data:mi:demographics -- \
  <migeo2020.pl> <mi000022020.pl> <mi2020.pl.zip> <2024-precincts.geojson>
```
