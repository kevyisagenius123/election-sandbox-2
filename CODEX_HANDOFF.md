# Codex handoff: Sandbox 2.0

Last updated: 2026-08-10

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
- Release: `0.10.0`, replay and performance hardening
- Previous release commit: `f764815 Compact Pennsylvania demographic runtime`
- Remote: none configured
- Frontend: React 19, TypeScript, Vite 8
- Renderer: deck.gl 9 with `OrbitView` and `GeoJsonLayer`
- Backend: none
- Persistence: none
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
- Only Pennsylvania has verified county and VTD results. Other states stay neutral below the state layer.

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

## 8. Verification state

CLI verification for v0.10:

- `npm test`: 29 tests pass.
- `npm run test:browser`: 3 browser replays pass.
- `npm run profile:pa`: completes and validates profile invariants.
- `npm run lint`: passes.
- `npm run build`: passes.
- Vite emits the existing warning that the deck.gl Atlas chunk exceeds 500 kB after minification. This is a performance item, not a build failure.

Browser verification:

- v0.10 retains the v0.9 desktop and mobile layout behavior; the release contains no design changes beyond the visible version label.
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

1. **Only Pennsylvania is production-detailed.** Other states remain state-level only.
2. **The demographic artifact is 875 KB, but decoding and scenarios still run on the main thread.** Repeated local medians are about 25 to 45 ms for validated decode and roughly 75 ms for a complex 9,140-unit scenario. Add a Web Worker boundary before loading several detailed states at once.
3. **The deck.gl chunk is about 1.6 MB minified.** It is already lazy, but further code splitting or bundle review is warranted.
4. **No uncertainty model exists.** The deterministic result is intentional; do not add decorative random noise.
5. **No CVAP or 2024 eligibility estimate exists.** The UI correctly discloses the 2020 VAP limitation.
6. **No demographic preference model exists.** Candidate choice remains an explicit user input.
7. **Residual Other has no historical county geography.** Keep its certified baseline statewide-only; scenario additions may be geographically allocated only as explicitly counterfactual exchanges.
8. **A balanced third-party exchange can have zero `Harris - Trump` contribution.** This is correct even when exchanged ballot volume is large; the editor displays that volume separately.
9. **No backend-stored scenarios, authentication, or deployment exist.** Deterministic scenario URLs are client-side and require a compatible build.
10. **Source redistribution status still needs a formal public-release review.** Official provenance and checksums are present, but legal review is not encoded in code.

## 10. Exact next phase

Do not jump directly to a national demographic simulator. The next phase is the reusable multi-state platform:

1. Extract Pennsylvania-specific loading, geography, assumptions, and election rules behind a typed state manifest.
2. Move detailed-state decode/scenario work behind a Web Worker contract while retaining deterministic URL replay and stale-result cancellation.
3. Add one second production-detailed battleground using certified county and VTD/precinct data through that manifest.
4. Aggregate only loaded, version-compatible state scenarios nationally and expose the resulting path to 270.
5. Design uncertainty only after the multi-state deterministic contract is stable. It must be separately switchable, seeded, and calibrated; decorative random noise is prohibited.

The immediate next engineering task after v0.10 is items 1 and 2 together: define the state manifest and worker message contract before importing another state's data.

## 11. Commands

```bash
npm install
npm run test:browser:install
npm run dev
npm test
npm run test:browser
npm run profile:pa
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
