# Codex handoff: Sandbox 2.0

Last updated: 2026-08-23

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
- Release: `0.26.2`, v0.26C ECharts GL Research Gate candidate
- Frozen candidate: `v0.19.1-supervisor-review`
- Review entry: `SUPERVISOR_REVIEW.md`
- Remote: `https://github.com/kevyisagenius123/election-sandbox-2.git`
- Frontend: React 19, TypeScript, Vite 8
- Renderer: deck.gl 9 with `OrbitView` and `GeoJsonLayer`
- Backend: none
- Persistence: URL-local versioned scenario recipes; no backend storage
- Local URL: `http://127.0.0.1:4173/`
- Required Node: 22.12 or newer
- Hosting metadata: none; there is no `.openai/hosting.json`

The full repository is private and the former full-product Pages URL returns 404. The separate `election-sandbox-demo` repository is a national-only public preview with no detailed PA/MI artifacts. The 2026-08-20 supervisor candidate has a fresh green verification record and six release screenshots under `docs/review/v0.19.1-supervisor-review/`. Its same-eight regression pass is complete. Its fresh blind-agent pass is not complete: three isolated contexts failed before navigation because the installed evaluator-browser integration rejected its own trusted path. Do not classify that infrastructure failure as a Sandbox P0 or as completed cognitive evidence. The owner later designated Codex as AI supervisor; that technical exact-tag review completed all tasks, captured seven additional screenshots, and found no P0-P3 product issue. It is not human or genuinely unfamiliar evidence.

The supervisor's formal v0.19.1 verdict is **HOLD**, recorded in `docs/review/v0.19.1-supervisor-review/SUPERVISOR_VERDICT.md`. Gate B passed as an AI technical-supervisor walkthrough; Gate A remains unresolved for PA/MI participant delivery. The owner subsequently deferred human alpha and authorized private state expansion in decision 0027. Do not move the frozen tag or represent human validation as complete. Public or paid delivery of the detailed-state product remains blocked.

A local Vite server may still be running on port 4173; check rather than starting a duplicate.

## 3. What is implemented

### National workbench

- Official 2024 presidential state totals and election-specific Electoral College allocation.
- Exact actual baseline: Harris 226, Trump 312.
- Actual national vote: 155,238,302 ballots.
- Editorial three-column desktop layout and stacked mobile layout.
- National 3D state terrain with Actual, Scenario, and Shift modes.
- State click removes the national layer and transitions into state context.
- Pennsylvania, Michigan, and Wisconsin are production-detailed states. Selecting one loads its county result layer, deterministic worker foundation, contribution trace, inspector, and manifest-driven local geometry.

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
- Pennsylvania, Michigan, and Wisconsin controls persist independently. Switching states snapshots the departing recipe, restores the arriving controls, and retains every exact result in the national aggregate.
- The scenario card includes a compact active-state strip with current margins and direct state-lab navigation.
- National aggregation replaces each certified state at most once. An inactive summary enters only when its fingerprint exactly matches the current recipe.
- URL schema 2 stores sorted multi-state recipes and the active detailed state. Schema 1 stays replayable and upgrades locally into a single-state recipe.
- Local geometry uses a six-shard least-recently-used cache across state switches; workers, fetches, and Deck resources remain lifecycle-owned.
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
- Supported Pennsylvania, Michigan, and Wisconsin rows open their detailed state labs. Unsupported Required states remain noninteractive and receive no local-geography claims.
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
- National Behavior presents PA/MI/WI entry actions only. It does not display a state editor or invent unsupported national operations.
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

### v0.19.1 correction release

- `buildStateFlipRequirement` in `src/data/pathTo270.ts` is the canonical state-threshold calculation. Route construction reuses it.
- `src/data/provenance.ts` exposes the audited PA/MI evidence contracts. Preserve the PA VTD and MI exact-cycle precinct distinction.
- The collapsed drawer now leads with `Change {scope}` and `Open controls`; snap names remain secondary position controls.
- The two-vote margin explanation appears only for direct Harris/Trump preference transfer.
- `tests/browser/alpha-corrections.spec.ts` locks the bounded UX and trust corrections.
- `tests/browser/remote-smoke.spec.ts` runs against `PLAYWRIGHT_BASE_URL`; the Pages workflow supplies its deployed URL.
- `SYNTHETIC_ALPHA_RERUN_REPORT.md` repeats the same personas and tasks and records 8/8 comprehension across the five tracked concepts.
- v0.19B remains a human alpha. The synthetic comparison cannot replace it.

### v0.19B human-alpha readiness

- `docs/research/HUMAN_ALPHA_PROTOCOL.md` is the authoritative moderator protocol for the unchanged five tasks, comprehension prompts, help scale, success criteria, severity rules, and phase-closing gate.
- `docs/research/HUMAN_ALPHA_SESSION_TEMPLATE.md` is the per-participant evidence format. Keep participant names, contact details, recordings, and unredacted scenario URLs out of the repository.
- `HUMAN_ALPHA_READINESS.md` records what is ready and what remains. No human evidence exists yet; do not relabel synthetic or automated activity as v0.19B results.
- At least three genuinely new humans are required to close the phase; five to ten mixed users remains preferred.
- External participant recruitment remains blocked by the PA/MI result-artifact rows marked Review in `docs/data/REDISTRIBUTION_INVENTORY.md`, unless an approved delivery method replaces public redistribution.
- The deployed Home and `/app/` were reachable in the 2026-08-12 readiness audit, and `/app/` visibly exposed `Change United States` and `Open controls`.
- Readiness verification is green: 48 model tests, lint, production build, 33 local browser journeys, the deployed remote smoke, and the Pennsylvania runtime profile all pass. The local aggregate browser command exceeded its four-minute wrapper after 19 successful journeys, so the remaining responsive and visual group was rerun separately and all 18 passed; this was a wrapper timeout, not a test failure.
- State #3 and Run My Election remain outside this phase. After human findings are triaged and gates pass, State #3 admission is the next product phase; replay-readiness metadata may enter that admission contract without starting the replay engine.

### v0.19B authorization and research freeze

- Supervisor authorization allows human testing but does not mark v0.19B complete.
- Decision `docs/decisions/0025-human-alpha-research-freeze.md` freezes the v0.19.1 participant build through Session 1. Only delivery blockers, security issues, broken restoration, obvious P0 correctness defects, or minimum approved-delivery changes are permitted.
- The session template records 1–5 confidence before explanation after every task. High-confidence incorrect answers must be isolated as epistemic-status risks.
- `HUMAN_ALPHA_REPORT.md` is the required closing report and must recommend exactly one of Advance, Correct and retest, or Block.
- State #3 requires zero unresolved P0 and P1 findings, no repeated severe misunderstanding of epistemic status, functional and trusted deterministic restoration, discoverable evidence, resolved artifact delivery, and green correction gates.
- The artifact review did not clear the current result files: PA lacked an explicit grant for the specific pa.gov artifacts, and Michigan.gov terms restrict reuse absent permission or another basis. The result artifacts and dependent crosswalks are excluded from external alpha delivery until permission, an applicable documented legal basis, or an approved replacement is recorded.
- Do not invite participants to the currently reachable Pages deployment while the exclusion remains.
- `docs/operations/ALPHA_DATA_PERMISSION_REQUESTS.md` contains unsent, exact-scope drafts for `RA-Elections@pa.gov` and `ElectionData@Michigan.gov` with `Elections@Michigan.gov` copied. Bracketed owner identity fields must be completed before submission.
- `docs/operations/ALPHA_DELIVERY_DECISION_TRACKER.md` records the exact derivative checksums, response requirements, follow-up cadence, and fail-closed replacement choices. Silence and automated acknowledgments are not approval.
- Permission emails are postponed. Do not send the prepared drafts without a new explicit owner instruction.
- `docs/data/PUBLIC_EXPOSURE_INVENTORY.md` records 156 Pages-delivered PA/MI runtime files totaling 29,194,099 bytes, plus both county summaries bundled into application JavaScript and repository-only source-dependent registries. Candidate totals are embedded in every geometry shard and the compact demographic artifacts, so removing only `reporting-units.json` is insufficient.
- Containment completed on 2026-08-20: the full repository is private, its former Pages URL returns 404, the automatic Pages workflow was removed from the current branch, and anonymous access checks return 404 for both repository and Pages.
- A fresh-history public replacement is live at `https://kevyisagenius123.github.io/election-sandbox-demo/`. It contains only FEC statewide totals, national state geometry, and original public-demo code; it contains no PA/MI local-result derivatives.
- Do not delete research artifacts or rewrite history unless separately authorized after an evidence-backed purge decision.

### v0.20 Wisconsin detailed-state foundation

- Decision `docs/decisions/0027-deferred-human-validation.md` defers human alpha until end-to-end product testing and permits controlled private development. It does not count as a human pass.
- Decision `docs/decisions/0026-wisconsin-ltsb-admission.md` admits Wisconsin through the explicit open/public LTSB ArcGIS item.
- Wisconsin has 72 county summaries, 7,086 January 2025 ward polygons, 6,946 result-bearing reconstructed wards, and 140 geometry-only wards.
- The exact statewide baseline is Harris 1,668,229, Trump 1,697,626, Other 57,063, Total 3,422,918.
- LTSB population-disaggregated WEC reporting-unit results to blocks and reaggregated them to 2025 wards. Never call the ward values certified raw ward returns.
- `scripts/import-wisconsin-2024-ltsb.mjs` regenerates and validates the county, reporting-unit, geometry, denominator, and source-registry artifacts.
- `src/data/wiWards.ts` implements strict `wi-ward-row-v1` decoding and fail-closed reconciliation.
- Compatibility is now `us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1`.
- PA/MI delivery status is unchanged. Wisconsin's direct source is independently approved with attribution and reconstruction disclosure.

### v0.21A Run My Election endpoint law

- `RUN_MY_ELECTION_ENGINE_PLAN.md` is the authoritative 26-section implementation specification for the election-night engine, Replay Studio, later backend, and eventual video architecture.
- Decision `docs/decisions/0028-election-night-engine-boundary.md` authorizes the bounded replay core for private development and postpones Arizona/Georgia admission.
- `docs/data/DETAILED_STATE_ADMISSION.md` now has a separate replay-readiness supplement. Exact local results do not imply defensible historical chronology.
- The scenario engine remains deterministic and timeless. Replay variation begins only after an exact endpoint is locked.
- Event-level evidence status distinguishes documented, reconstructed, modeled, user-defined, synthetic, and exact-endpoint claims.
- The Decision Desk must run through a sanitized contract with no future candidate totals, future batches, or final winner.
- The first implementation is local-first and worker-driven. Backend, memberships, live rooms, and rendering services remain later stages.
- v0.21A is implemented as headless contracts, endpoint fixtures, checksums, deterministic named streams, and invariant tests only.
- `packages/election-replay/src/` owns canonical serialization, SHA-256 fingerprints, endpoint lock/restore, PRNG derivation, and event identity. It has no React or deck.gl dependency.
- `src/replay/pennsylvaniaEndpoint.ts` adapts the existing exact scenario into a 51-jurisdiction endpoint with 9,140 PA reporting units and honest jurisdiction-total units elsewhere.
- Baseline content fingerprint: `sha256:bbb5c3e94b2413829b7d9d8d243fcb9ed44e68ddfd4bde567cec1e91079b91c9`.
- Complex content fingerprint: `sha256:07de00195da9ab840f9b82947fa7b75c3e64400f086605926836d516e9c716d2`.
- `docs/review/v0.21a-replay-contracts/VERIFICATION.md` is the accepted endpoint-law package.

### v0.21B Pennsylvania compiler

- Decision `docs/decisions/0029-headless-pennsylvania-event-compiler.md` records the supervisor-authorized compiler boundary.
- `packages/election-replay/src/pennsylvaniaCompiler.ts` schedules and audits Pennsylvania atomic return events in the pure package.
- Scheduling consumes administrative identity and total-workload fields only. Candidate vectors are attached after scheduling and never influence timing.
- Every one of 9,140 locked Pennsylvania reporting units emits exactly one indivisible `RETURN_PUBLISHED` event. No invented reporting percentages or internal batches exist.
- The two profiles are `pa-synthetic-rural-first-v1` and `pa-synthetic-metropolitan-late-v1`. They are synthetic, not historical chronology.
- Canonical order is replay time, unsigned deterministic tie breaker, then event ID. Sequence and time do not participate in identity.
- Baseline stream fingerprint: `sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c`.
- Complex stream fingerprint: `sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8`.
- `docs/review/v0.21b-pa-event-compiler/VERIFICATION.md` is the accepted Pennsylvania compiler package.

### v0.21C multi-jurisdiction replay law

- Decision `docs/decisions/0030-multi-jurisdiction-replay-contracts.md` records the authorized contract-only boundary.
- `packages/election-replay/src/jurisdictionContracts.ts` owns generic serialization, validation, capability, clock, evidence, audit, and admission.
- `packages/election-replay/src/coarseFixtureCompiler.ts` exists only to prove an honest one-return jurisdiction-total contract for unsupported jurisdictions.
- `packages/election-replay/src/jurisdictionComposition.ts` revalidates independently admitted streams and merges them by absolute UTC milliseconds, unsigned tie breaker, and event identity.
- Pennsylvania remains `detailed`, with 2024 reporting units explicitly distinguished from 2020 Census VTD map terrain and unmatched units explicit off-map.
- Wisconsin remains a coarse contract fixture in replay. Michigan now has a separate detailed compiler under v0.21D.
- Composition reports `partial` or `complete` coverage, sums only accepted endpoints, and separately preserves the source election's exact 538 EV.
- Pennsylvania golden event-stream fingerprints remain unchanged.
- `docs/review/v0.21c-multi-jurisdiction-contracts/VERIFICATION.md` is the accepted generic-contract package.

### v0.21D Michigan compiler

- Decision `docs/decisions/0031-headless-michigan-event-compiler.md` records the bounded supervisor authorization.
- `src/replay/michiganEndpoint.ts` builds certified and complex locked Michigan endpoints through the existing scenario engine.
- `packages/election-replay/src/michiganCompiler.ts` produces one atomic event for each of 4,413 Michigan model units using two explicit synthetic profiles.
- 4,339 exact-cycle units remain mapped. Eight unmatched precincts, 65 central-count units, and one statewide adjustment remain explicit off-map returns.
- Scheduling is candidate-blind and uses Michigan-owned PRNG namespaces. Four Central Time counties receive a neutral one-hour local-close gate.
- Certified endpoint/stream fingerprints: `sha256:4a9bb791497c487eea16c7fcab13af628afff27c6bf1f9c9ba91f8c82b7612c1` / `sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484`.
- Complex endpoint/stream fingerprints: `sha256:2a81ff04b0ad19c583ce805f0af09455d227ece17151ba196caa87307c2b5e24` / `sha256:a5391fbda94477926d06f90885e22120d4e8801e8fdcd49e9063d55f1461dba6`.
- `src/replay/pennsylvaniaMichiganEndpoint.ts` exists only for the authorized shared-endpoint detailed PA+MI composition fixture.
- Generic admission and composition contain no Michigan branch. Pennsylvania compiled goldens remain unchanged.
- `docs/review/v0.21d-michigan-event-compiler/VERIFICATION.md` is the current supervisor-review package.

### v0.21E national composition

- Decision `docs/decisions/0032-headless-national-replay-composition.md` records the bounded supervisor authorization.
- `packages/election-replay/src/nationalClock.ts` owns the versioned 51-jurisdiction poll-close and coarse atomic-return eligibility table.
- `packages/election-replay/src/nationalComposition.ts` compiles, admits, composes, serializes, fingerprints, and audits the complete national stream.
- Pennsylvania and Michigan remain detailed and retain their accepted compiler-owned timing, evidence, geography, and stream fingerprints.
- The remaining 49 jurisdictions each emit one exact statewide five-candidate return with no invented local geography or intermediate batches.
- The complete stream has 13,704 events: 13,602 returns and 102 jurisdiction control events.
- Both national fixtures reconcile all five candidate buckets at every prefix and exactly 538 electoral votes at the locked endpoint.
- Certified endpoint/stream fingerprints: `sha256:ede060670bd8ece5d2933055c62a2053c3a87e4b2275546440993a5c10939aab` / `sha256:e3239ba2fcd783207709582f4b7a75498b364e717951a04285909c399e8d3696`.
- Complex endpoint/stream fingerprints: `sha256:05c391f4ecda01cfb831552f350793e9dcedfc303cf42441e80de29880212de1` / `sha256:eb90e5c85c43cdf41b2c7ac1e5d66933283dddb36fa09c89a73c9912e17a9089`.
- `tests/national-replay-composition.test.mjs` contains 11 grouped tests covering the supervisor's 40 release-blocking invariants.
- `docs/review/v0.21e-national-replay-composition/VERIFICATION.md` is the current supervisor-review package.

### v0.22A replay reducer

- Decision `docs/decisions/0033-headless-replay-reducer.md` records the supervisor-authorized future-isolation and reducer boundary.
- `packages/election-replay/src/reducer.ts` owns canonical zero state, strict pure event application, normalized reported hierarchy, state serialization, fingerprints, and time lookup.
- `packages/election-replay/src/reducerCheckpoint.ts` owns stream-bound checkpoints, validation, checkpoint generation, event-count seek, and absolute-time seek.
- Only `POLL_CLOSE`, `RETURN_PUBLISHED`, and `REPLAY_COMPLETED` are accepted.
- Observable state includes applied vote vectors, exact return counts, lifecycle facts, normalized detailed geography, and explicit mapped/off-map totals. It contains no endpoint, remaining-vote, percentage, leader, projection, or call data.
- Detailed unit state is a deterministic sparse 257-bucket structure. An unpublished known unit resolves to an exact five-candidate zero vector without cloning all 13,553 detailed units on every transition.
- Final certified and complex states reconcile 13,602 returns, 51 completed jurisdictions, every PA/MI unit and county, all five national candidate buckets, and the exact locked endpoint.
- Six certified and six complex reducer positions are frozen in `tests/replay-fixtures/reducer-goldens.mjs`.
- `tests/replay-reducer.test.mjs` contains 14 grouped tests covering the supervisor's 45 release-blocking checks.
- `scripts/benchmark-replay-reducer.mjs` measures seven complete reductions and 100 deterministic checkpoint seeks.
- Initial baseline: 6,129 ms median full reduction; 35 ms median checkpoint seek; 5,333,517-byte final serialized state; 80,206,132-byte 29-checkpoint set.
- `docs/review/v0.22a-replay-reducer/VERIFICATION.md` is the current supervisor-review package.

### v0.22B reported-state analytics

- `packages/election-replay/src/reportedAnalytics.ts` consumes only `ReplayObservableState` and derives reported-vote arithmetic without endpoint or future-event access.
- Overall leadership considers all five candidates; ties and zero are first-class, while Harris-Trump margin and shares remain separately named.
- Headline APIs cover national, jurisdiction, county, and unit facts; the full canonical snapshot supports audit and frozen fingerprints.
- `tests/reported-analytics.test.mjs` passes 8 of 8 grouped tests. Twelve certified/complex position fingerprints are frozen in `tests/replay-fixtures/reported-analytics-goldens.mjs`.
- Exact evidence is in `docs/review/v0.22b-reported-state-analytics/VERIFICATION.md` and `PERFORMANCE.md`.

### v0.22C seek/checkpoint optimization

- `packages/election-replay/src/replaySeekIndex.ts` creates an immutable process-local checkpoint index using structurally shared canonical reducer states.
- The accepted cadence is 250 events: 56 checkpoints over 13,704 events and at most 249 tail transitions per seek.
- Indexes have no serializer, cannot accept untrusted clones, cache no analytics, and never become an alternate state authority.
- `tests/replay-seek-index.test.mjs` passes 6 of 6 grouped tests, including 20 deterministic random positions per fixture and hostile backward/forward movement.
- `npm run benchmark:seek` records both fixtures. Random-seek median improves from 1,319.334 ms to 17.813 ms certified and from 1,259.712 ms to 20.385 ms complex.
- Measured index heap increase is 26.4 MB certified and 27.6 MB complex. Logical full-checkpoint serialization would exceed 152 MB, which is why no persistence format is authorized.
- Exact evidence is in `docs/review/v0.22c-seek-checkpoint-optimization/VERIFICATION.md` and `PERFORMANCE.md`; decision 0035 defines the authority boundary.

### v0.22D deterministic playback cursor

- `packages/election-replay/src/playbackCursor.ts` owns immutable paused, playing, and complete cursor state over the reducer and seek index.
- Commands are play, pause, reset, integer logical-time advance, event/time seek, and step to the next canonical timestamp.
- The zero boundary is one millisecond before the first event. Events sharing a timestamp are always applied as one atomic group; event-count seeks inside a group snap forward.
- The controller reads no wall clock and imports no timer, animation, UI, map, analytics, endpoint, or Decision Desk contract.
- `tests/playback-cursor.test.mjs` passes 8 of 8 grouped tests across certified and complex fixtures.
- `npm run benchmark:playback` records 100 random seeks, 1,000-partition full playback, and every canonical timestamp group. Random controller seek p50 is about 26 ms; forward advance p95 is about 10–11 ms.
- Exact evidence is in `docs/review/v0.22d-playback-cursor/VERIFICATION.md` and `PERFORMANCE.md`; decision 0036 defines controller time and atomicity law.

### v0.22E sanitized playback observation

- `packages/election-replay/src/playbackObservation.ts` is the current-knowledge firewall for future presentation code.
- Snapshots expose controller status/current time/applied count, accepted national and jurisdiction analytics, currently reporting counties, and published units.
- Transitions expose direction, previous/current sanitized controller positions, newly observed timestamp groups, and changed jurisdictions.
- No stream fingerprint, final time boundary, next event, endpoint total, remaining structure, inference, editorial message, map instruction, or transport object crosses the contract.
- Certified and complex streams serialize byte-identically at identical observed prefixes and transitions despite divergent futures.
- `tests/playback-observation.test.mjs` passes 8 of 8 grouped tests.
- `npm run benchmark:observation` shows one-group transitions at 526 bytes and 6–9 ms median. Final current-state snapshots are about 4.87 MB and 152–226 ms median, so this contract must not be treated as a per-frame feed.
- Exact evidence is in `docs/review/v0.22e-playback-observation/VERIFICATION.md` and `PERFORMANCE.md`; decision 0037 defines the blindness law.

### v0.22F replay worker/runtime bridge

- `src/runtime/replayWorkerProtocol.ts` defines only initialize, command, and resynchronize requests plus ready, update, resynchronized, and error responses.
- `src/runtime/replayWorkerRuntime.ts` exclusively owns national compilation, reducer context, the 250-event seek index, playback cursor, and sanitized observation derivation.
- `src/runtime/replayRuntime.worker.ts` serializes every request through one worker-owned promise queue; initialization is single-use.
- Ordinary updates send the accepted transition plus current national/state headline, not a full county/unit snapshot. Backward movement recommends an explicit resynchronization.
- Normalized integer progress enables a scrubber without exposing final boundary, remaining events, next-event time, endpoint totals, or stream fingerprints.
- `tests/replay-worker-runtime.test.mjs` passes 3 of 3 grouped gates. `npm run benchmark:worker` measures about 32.3 seconds initialization, 8.7 ms median step commands, 52–64 KB ordinary updates, and a 2.75 MB midpoint resynchronization.
- Exact evidence is in `docs/review/v0.22f-replay-worker-runtime/`; decision 0038 defines the transport boundary.

### v0.23A integrated three-state Election Night

- Election Night is a mode inside `/app/`; there is no `/replay/` entry or separate map.
- `src/runtime/threeStateNight.worker.ts` loads the PA, MI, and WI detailed foundations, applies their current Swingometer recipes, and schedules one return per VTD, precinct, or ward.
- `src/replay/threeStateElectionNight.ts` owns deterministic user-directed duration, geographic order, volatility, burst/stall, state-delay, and seed behavior.
- The other 48 jurisdictions never enter the visible count. The audited 51-jurisdiction kernel remains unchanged but is not used by this presentation.
- The existing AtlasMapScene stays mounted. Published local returns recolor and raise reporting units, counties, and states; the newest return receives a gold outline.
- Election Night restyles the existing Laboratory surface into the Atlas composition without changing routes or remounting the map: full-stage terrain, a large contextual headline at left, the read-only PA/MI/WI desk at upper right, and one shared resizable bottom command dock.
- The dock reuses the Laboratory's collapsed/working/expanded interaction. It owns playback, 0.1× through 12× speed, seeking, the full count-behavior editor, return inspection, methodology, and the handoff back to the Swingometer. There is no second floating behavior panel or playback console.
- Count direction now includes four deterministic built-in profiles, browser-local named custom profiles, a pre-apply PA/MI/WI chronology preview, and explicit county start/count-length overrides. County overrides are validated, candidate-blind, and affect timing only; atomic reporting-unit vote vectors remain unchanged.
- The editorial home now adapts the original Sandbox's map-led hero and staged product explanation to the warm Atlas system. It explains Model, Direct, and Understand; shows the four-step workflow; and discloses the distinct PA/MI/WI evidence contracts before entering the lab.
- `tests/three-state-election-night.test.mjs` proves jurisdiction scope, determinism, vote immutability, and rejection of missing or unsupported states.
- `tests/browser/replay-experience.spec.ts` proves same-canvas and same-route integration, three-state-only disclosure, real worker playback, behavior editing, and return to the Swingometer.
- Current evidence is in `docs/review/v0.23a-visible-replay/`; decision 0039 records the corrected product law.

### v0.23B Election Night refinement

- `src/runtime/useReplayExperience.ts` reuses the active Election Night worker for chronology restarts instead of destroying and rebuilding it.
- `src/runtime/threeStateNight.worker.ts` caches exactly three decoded detailed-state foundations and at most three scenario endpoint arrays for the active session. Default recipes use an exact zero-change projection; non-default recipes still use the accepted scenario engine.
- Leaving Election Night terminates the worker and releases the cache. No persistent or cross-product replay cache was added.
- Worker responses now include current-only local-return arithmetic: candidate votes, net two-party movement, and state/county margins immediately before and after the return.
- The bottom dock displays a twelve-entry local return tape, reporting-unit progress bars, and a restrained newest-state highlight.
- `tests/browser/replay-experience.spec.ts` verifies the return tape and a less-than-30-second active-session chronology restart.
- 161 model/replay tests, build, lint, and 2 focused browser journeys pass. Evidence and regenerated screenshots are in `docs/review/v0.23b-election-night-refinement/`; decision 0040 records the cache and observation boundary.

### v0.24 explicit Swingometer model semantics

- `src/data/modelSemantics.ts` centralizes state-specific population bases plus the changes, invariants, arithmetic, and feasible boundary of Turnout, Preference, and Third Party operations.
- The Behavior panel displays that contract before each slider and labels every operation as a scenario assumption rather than a forecast.
- Preference and third-party controls show exact calculated directional endpoints. Turnout, preference, and third-party explainers distinguish requested from realized ballot movement.
- Pennsylvania retains direct 2020 Census VAP language, Michigan discloses its 2020-to-2024 precinct bridge, and Wisconsin discloses the LTSB 2020 VAP estimate on 2025 ward terrain.
- The scenario engine, recipe schema, URLs, and election arithmetic are unchanged.
- Evidence is in `docs/review/v0.24-swingometer-semantics/`; decision 0041 and `docs/methodology/SWINGOMETER_MODEL_CONTRACT.md` define the product law.
- Verification passes 164 of 164 aggregate model/replay tests, 3 of 3 dedicated contract tests, 8 of 8 scenario-replay browser regressions, and 1 of 1 focused model-semantics browser journey. Production build and lint pass.

### Pre-v0.25 legacy analytics audit

- `docs/research/OLD_SANDBOX_ANALYTICS_AUDIT.md` traces the old Sandbox's results summaries, analytics workstation, Java services, and Python prediction modules.
- The audit retains exact descriptive arithmetic and the workstation concept, but identifies incompatible win-probability formulas, invented fallback trajectories, heuristic outstanding-vote uncertainty, unsupported race-call rules, and composite county-importance scores.
- `docs/methodology/ANALYTICS_CONSTITUTION.md` classifies every future analytic as certified, reported, scenario, derived, modeled, or decision and prohibits future leakage, silent denominators, and uncalibrated probability language.
- Decision 0042 makes the old analytics design input rather than code to port.
- `docs/plans/v0.25-analytics-foundation.md` defines four bounded slices.

### v0.25A headless analytics contract

- `packages/election-analytics/src/registry.ts` registers twenty explicit definitions spanning certified, scenario, derived, and reported values. Modeled and decision classes exist in the constitution but have no admitted metrics.
- `packages/election-analytics/src/contracts.ts` owns typed envelopes, availability, integer-only units, explicit ratio operands, canonical serialization, deterministic collection ordering, SHA-256 fingerprints, tamper detection, and fail-closed validation.
- `packages/election-analytics/src/builders.ts` adapts trusted state endpoints, behavior-operation audit values, signed local contributions, Electoral College consequences, current replay-prefix totals, and progress ratios.
- Missing values remain `unavailable` with null values; exact zero remains available. Residual contributions remain explicitly off-map.
- Current-prefix analytics carry no unreported candidate outcome, endpoint result, probability, or call.
- The package imports no React, deck.gl, map, backend, or random-number implementation.
- Decision 0043 defines the accepted contract. Release and verification records are in `docs/releases/v0.25a-headless-analytics-contract.md` and `docs/review/v0.25a-headless-analytics-contract/`.

### v0.25B scenario delta ledger

- `packages/election-analytics/src/scenarioDeltaLedger.ts` derives one exact certified-to-scenario ledger from the detailed baseline units and accepted behavior scenario.
- State operation rows preserve requested and realized turnout, preference, and third-party volumes plus exact candidate and Harris-minus-Trump margin deltas.
- Every reporting unit contains certified, scenario, total delta, and three operation vectors. Those units deterministically rebuild county rows, mapped/off-map partitions, and any statewide residual.
- County map status is explicit: mapped, mixed, or off-map. No residual is assigned to a polygon.
- Overall and operation-filtered rankings support absolute, Harris, and Trump direction without a composite importance score.
- The target candidate's EV consequence reconciles to the accepted actual and scenario allocations.
- The ledger embeds a compact v0.25A state analytic collection and references the registered contribution definition for its local rows instead of duplicating thousands of full envelopes. It rejects noncanonical internal arithmetic even when content is rehashed.
- Nine dedicated tests cover the frozen golden, tamper rejection, rankings, zero change, invalid inputs, and complex PA/MI/WI foundations. Decision 0044 and `docs/review/v0.25b-scenario-delta-ledger/` define the accepted evidence.

### v0.25C replay descriptive analytics

- `packages/election-analytics/src/replayDescriptiveContracts.ts` defines current-prefix windows, movement, progress, chronology, mathematical openness, local rankings, and fingerprinted output.
- `packages/election-analytics/src/replayDescriptiveAnalytics.ts` consumes only the observed canonical event prefix, matching reducer state, explicit logical time, explicit progress denominators, a user-selected stall threshold, and source identities. It cannot receive the complete replay stream or hidden endpoint candidate totals.
- Prefix validation reconciles national, jurisdiction, mapped, off-map, county, and reporting-unit state while enforcing canonical sequence, unique identities, timestamp bounds, and lifecycle order.
- Exact five-, fifteen-, and thirty-minute windows are start-exclusive and end-inclusive. Rates use deterministic integer milli-units rather than wall-clock sampling.
- Return-count and represented-ballot progress remain separate. Missing denominators remain unavailable.
- Mathematical openness reports whether the current margin can be overtaken by the explicitly modeled outstanding ballot count. It is not a probability, projection, or race call.
- Chronology status distinguishes not open, awaiting first return, counting, complete, and explicit threshold stalls.
- Ten dedicated tests freeze `sha256:5e4c698ded29820ec7fc971e4d1a5031881d610afdde55ea1317295bee7d0819` and cover future isolation, tampering, deterministic ordering, exact windows, zero-return behavior, and headless source boundaries.
- The complete aggregate passes 193 of 193 tests in 618.353 seconds. Lint and production build pass with only the existing deck.gl chunk-size warning.
- Decision 0045, `docs/releases/v0.25c-replay-descriptive-analytics.md`, and `docs/review/v0.25c-replay-descriptive-analytics/VERIFICATION.md` define the accepted evidence.

### v0.25D editorial analytics workspace

- `src/replay/visibleReplayAnalytics.ts` adapts the visible PA, MI, and WI event prefix into the accepted v0.25C diagnostic contract while preserving VTD, precinct, ward, mapped, and off-map semantics.
- The three-state Election Night worker owns the adapter and returns the descriptive analytics with each compact playback update. React does not derive those values.
- Swingometer now consumes the v0.25B scenario-delta ledger for its dominant summary, Actual/Scenario/Delta values, signed operation waterfall, county and reporting-unit rankings, residual geography, and operation filters.
- Election Night now presents exact five-, fifteen-, and thirty-minute windows, separate progress measures, mathematical openness, state stalls, recent movers, and exact return ledgers in the responsive bottom dock.
- Direct Count includes a user-selected stall-alert threshold. It changes analytics only and cannot change votes or scheduling.
- Desktop 1440 by 900 and mobile 390 by 844 inspections have no horizontal overflow. The focused integrated browser journey passes.
- Four visible-adapter tests prove poll-close/no-return behavior, exact geography reconciliation, exact completion without calls, and hidden-future isolation.
- The aggregate passes 197 of 197 tests in 586.307 seconds. Lint and production build pass with only the existing lazy deck.gl chunk warning.
- Decision 0046, `docs/releases/v0.25d-editorial-analytics-workspace.md`, and `docs/review/v0.25d-editorial-analytics-workspace/VERIFICATION.md` define the accepted evidence.

### v0.26A reported margin timeline

- Regular ECharts 6.1 was installed for v0.26A. v0.26C later added ECharts GL as a research-only development dependency; deck.gl remains the sole production geographic renderer. The production dependency audit reports zero vulnerabilities.
- `src/replay/visibleReplayTimeline.ts` builds an immutable cumulative margin index inside the replay worker and derives only the observed prefix for delivery.
- The visible timeline carries national, PA, MI, and WI reported margins, return identity, local geography, ballot volume, replay time, and progress. It contains no future event.
- Output is bounded to 320 deterministic display points and retains the latest return plus lead changes before neutral sampling.
- `SET_ANALYTICAL_LENS_VISIBILITY` subscribes the browser only while the Timeline tab is open. Hidden tabs receive null margin and pace payloads.
- `src/components/ElectionNightMarginTimeline.tsx` is dynamically imported, uses one regular ECharts canvas, coalesces updates through ECharts, observes its container, and disposes the observer and chart on unmount.
- Chart clicks seek the existing three-state worker and therefore update the same deck.gl map, state desk, returns, and descriptive analytics.
- Desktop and mobile timeline references are stored in `docs/review/v0.26a-election-night-analytical-lenses/screenshots/`.
- Four dedicated timeline tests cover empty-prefix honesty, exact reconstruction, deterministic bounds, and hidden-future isolation. The focused integrated browser journey covers seek, one-canvas disposal, remount, restart, and mobile layout.
- The aggregate passes 201 of 201 tests in 467.518 seconds. Lint, production build, and the zero-vulnerability production dependency audit pass. Regular ECharts is isolated in a 536.18 kB minified, 181.02 kB compressed lazy chunk.
- Decision 0047, `docs/plans/v0.26-analytical-lenses.md`, `docs/releases/v0.26a-reported-margin-timeline.md`, and the v0.26A verification record define the accepted boundary.

### v0.26B reporting velocity and state comparison

- The Timeline tab is now one analytical workspace with Margin, Velocity, and Compare states internal lenses.
- `src/replay/visibleReportingPace.ts` precomputes candidate-blind trailing 15-minute pace points in the worker and derives only the visible prefix.
- Velocity can display ballots or returns published per logical minute. It never combines them into an excitement or competitiveness score.
- State comparison preserves separate PA, MI, and WI activation, latest activity, stall status, ballot progress, reporting-unit progress, and current pace.
- Final scenario ballot and unit denominators are used transparently for progress. Unreported candidate shares do not enter the pace payload.
- Output is bounded to 320 deterministic points and retains current activity plus national and state ballot and return-rate peaks.
- `src/components/ElectionNightReportingVelocity.tsx` is dynamically imported. Margin and Velocity mount one regular ECharts canvas at a time; Compare states mounts none.
- Both charts seek the existing replay worker and persistent deck.gl map. State comparison cards select the existing map state.
- Five dedicated reporting-pace tests cover no-return honesty, visible-prefix reconciliation, timing-only seed changes, hidden-future candidate isolation, deterministic bounds, and completion.
- The focused integrated browser journey covers analytical lens switching, metric switching, chart seeking, canvas lifecycle, state comparison, and desktop/mobile layout.
- The aggregate passes 206 of 206 tests in 532.238 seconds. Lint, production build, and the focused browser journey pass. The accepted ECharts and deck.gl lazy chunk warning remains.
- Decision 0048, `docs/releases/v0.26b-reporting-velocity.md`, and `docs/review/v0.26b-reporting-velocity/VERIFICATION.md` define the release boundary.

### v0.26C ECharts GL research gate

- `src/replay/countLandscapeResearch.ts` bins any visible three-state return prefix into exact fixed-time PA, MI, and WI marks. Each point preserves ballots, returns, Harris, Trump, other, signed two-party movement, and the latest visible event identity.
- `scripts/build-v026c-count-landscape.mjs` compiles the admitted PA, MI, and WI detailed foundations with the accepted default chronology into a 48-bin, 144-mark research fixture.
- The fixture contains 20,499 returns and 16,145,836 ballots. Its fingerprint is `sha256:468ce7ca3cfb4bb3665b3c4cb5468ef9f7bc20223309ee0c3188dc3e9150b5a6`.
- `research/v0.26c/` is a standalone Vite harness comparing one regular-ECharts return pulse matrix with one ECharts GL count landscape. It is not a production Vite input and is not imported by `src/`.
- The 2D form uses time, state row, bubble area, and signed color. The GL form uses the same marks and substitutes height for bubble area, adding no new variable.
- One 2D chart owns one canvas. One GL chart owns two canvases. Ten repeated lifecycle cycles retained zero benchmark canvases, but a representative run averaged 43.8 ms for 2D versus 175.1 ms for GL.
- The isolated GL chunk is 603.46 kB minified and 166.47 kB compressed, in addition to ECharts support. The production build contains no GL chunk and retains the accepted renderer sizes.
- Desktop/mobile visual review found the 2D matrix immediately comparable without camera manipulation. GL perspective compressed state rows and occluded marks.
- ECharts GL is rejected for production. It remains a development-only research dependency; deck.gl remains the sole geographic and WebGL production renderer.
- Six dedicated headless tests and two isolated browser journeys cover exact prefix conservation, future isolation, dependency isolation, canvas ownership, repeated disposal, comparative lifecycle cost, and narrow-screen overflow.
- The full aggregate passes 212 of 212 tests in 857.679 seconds. The focused research suite, ESLint, isolated research build, and production TypeScript/Vite build pass. Only the accepted chunk-size warning remains.
- Decision 0049, `docs/releases/v0.26c-echarts-gl-research-gate.md`, and `docs/review/v0.26c-count-landscape/VERIFICATION.md` define the verdict.

## 8. Verification state

### v0.22A replay reducer

- `docs/review/v0.22a-replay-reducer/VERIFICATION.md` is the current supervisor-review record.
- The dedicated v0.22A test group passes 14 of 14 grouped reducer contract tests.
- `npm test` passes 122 of 122 tests. Lint, production build, benchmark, and `git diff --check` pass; the existing deck.gl chunk warning remains.
- The aggregate browser run passed 36 current journeys, skipped three deliberate review/environment tests, and timed out on two navigation-heavy journeys after abnormal suite delay. Both timed-out journeys passed immediately in isolation, giving a documented combined disposition of 38 of 38 current journeys passing.
- National, PA, MI, zero-state, checkpoint-position, midpoint, and final-state fingerprints are frozen.
- v0.22A through v0.22E passed supervisor review. v0.22F, v0.23A, and v0.23B are verified supervisor-review candidates.
- v0.23B refines only the local visible replay slice. No Decision Desk, projection, call, backend, membership, room, export, or video functionality was added.

### v0.20 Wisconsin admission

- `docs/review/v0.20-wisconsin/VERIFICATION.md` is the prior detailed-state release record.
- 52 model and data-contract tests pass.
- 38 current browser journeys pass; three environment or historical-capture tests are deliberately skipped.
- Lint and production build pass. The existing large deck.gl chunk warning remains.
- Three new visual references cover Wisconsin desktop state, desktop reconstructed ward, and 390px state layouts.
- The final 35-cycle PA/MI/WI profile passes: 972,572 bytes / 2.37% heap growth, 41,238 bytes per cycle slope, and 24,108 ms cycle p95.
- The county geometry LRU retains at most six recent shards across state switches. This removed repeated geometry decode churn without creating material retained-heap growth.
- The v0.20 verdict is PASS for private internal development. It is not a human-validation pass and does not clear PA/MI external delivery.

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

1. **Only one expanded detailed foundation is interactive at a time.** Recipes and verified summaries for Pennsylvania, Michigan, and Wisconsin persist, but returning to a state intentionally reloads its full foundation.
2. **The inactive portfolio hydrator reloads a foundation whenever that inactive recipe changes.** This is memory-safe and deterministic but not yet optimized with a bounded summary cache across revisits.
3. **The deck.gl chunk is about 1.6 MB minified.** It is already lazy, but further code splitting or bundle review is warranted.
4. **No uncertainty model exists.** The deterministic result is intentional; do not add decorative random noise.
5. **No CVAP or 2024 eligibility estimate exists.** The UI correctly discloses the 2020 VAP limitation.
6. **No demographic preference model exists.** Candidate choice remains an explicit user input.
7. **Residual Other has no historical county geography.** Keep its certified baseline statewide-only; scenario additions may be geographically allocated only as explicitly counterfactual exchanges.
8. **A balanced third-party exchange can have zero `Harris - Trump` contribution.** This is correct even when exchanged ballot volume is large; the editor displays that volume separately.
9. **No backend-stored scenarios, authentication, or deployment exist.** Deterministic scenario URLs are client-side and require a compatible build.
10. **Source redistribution status blocks an open public data release.** `docs/data/REDISTRIBUTION_INVENTORY.md` records the current review and approved delivery decisions; provenance alone is not treated as permission.
11. **The audited national replay kernel still has a heavy cold initialization.** Its certified compilation and checkpoint creation take about 32 seconds locally. The visible three-state Election Night now has a bounded active-session cache and an exact default-recipe shortcut, but no persistent or precompiled national replay artifact exists.
12. **Detailed county snapshots are intentionally periodic.** During active playback the national/state headline is current while the county list discloses that it refreshes on pause. Continuous multi-megabyte county snapshots are prohibited.

## 10. Exact next phase

v0.26 is complete and verified. The exact next work is a separately scoped v0.27 Swingometer analytical review, beginning with a written inventory and information hierarchy rather than another renderer. It should determine which accepted scenario, contribution, county/VTD, and Electoral College explanations deserve persistent space and which belong behind selection. Do not add a new chart merely because the old Sandbox had one.

ECharts GL is rejected for production. Do not let it become a second map engine. Do not add projections, calls, Decision Desk inference, demographic calibration, backend, memberships, rooms, public restricted-data delivery, or video without later authorization.

Uncertainty in the final election result remains deferred. Reporting variation is deterministic from explicit profiles and named seeds, must be evidence-labeled, and may never become decorative noise.

## 11. Commands

```bash
npm install
npm run test:browser:install
npm run dev
npm test
npm run test:browser
npm run research:v026c:fixture
npm run research:v026c:build
npm run research:v026c:test
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
