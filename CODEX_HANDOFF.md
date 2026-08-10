# Codex handoff: Sandbox 2.0

Last updated: 2026-08-09

## 1. Purpose of this handoff

This document is the working context for a new Codex session. It describes what Sandbox 2.0 is, how the repository is organized, what has been implemented, which data decisions are non-negotiable, what is currently unverified, and the exact next actions that were interrupted.

Do not assume this project is part of the older Sandbox or the Presidential Atlas. It is a separate product. It borrows proven renderer behavior from the Atlas, but it owns its code, data contracts, build, and future deployment.

## 2. Repository and runtime state

- Repository root: `C:\Users\kilom\OneDrive\Desktop\Sandbox\election-sandbox-2`
- Branch: `main`
- Latest commit: `99aea6d Initialize standalone Sandbox 2.0 foundation`
- Git remote: none configured
- Current package version: `0.3.0`
- Required Node version: 22.12 or newer
- Frontend: React 19, TypeScript, Vite
- Map renderer: deck.gl 9 with `OrbitView` and `GeoJsonLayer`
- Backend: none yet
- Persistence: none yet
- Current deployment: none
- Local development URL: `http://127.0.0.1:4173/`
- A development server from the previous session is still answering with HTTP 200 on port 4173 as PID 19724. It was started before the final Vite update and should be restarted before further browser testing.

The working tree is intentionally dirty. All work after the initial foundation commit is uncommitted. There are also many intentional deletions from the original Next/vinext/Cloudflare Sites scaffold. Do not restore those deleted files unless the user explicitly reverses the standalone Vite decision.

There is no `.openai/hosting.json`. This is not currently a ChatGPT Sites project.

## 3. Product definition

Sandbox 2.0 is a local-first historical election counterfactual laboratory. The central product promise is:

1. The unchanged scenario reproduces the official result exactly.
2. A user changes an explicit assumption.
3. The model shows where votes moved.
4. Counties, states, the popular vote, and the Electoral College update coherently.
5. Later phases can turn the counterfactual into a simulated election night.

The current pilot is the 2024 presidential election with detailed Pennsylvania data.

The current product is not:

- A forecast.
- A live election-night backend.
- A demographic model yet.
- A national precinct map yet.
- Connected to the existing Sandbox.
- Connected to the existing Presidential Atlas at runtime.

## 4. Current user experience

### National level

- Editorial Atlas-style workbench with a national 3D state map.
- Actual, Scenario, and Shift comparison modes.
- Certified 2024 Electoral College baseline: Harris 226, Trump 312.
- Certified national vote baseline: 155,238,302 votes.
- State color represents presidential winning margin.
- State height uses Electoral College weight.
- Clicking a state removes the national state layer and moves the camera into county terrain.
- Other states can be viewed geographically, but they remain neutral at county level until their county results are sourced and reconciled.

### Pennsylvania county level

- All 67 counties are colored from official Pennsylvania county results.
- County height represents a normalized ballot-volume scale.
- Ballots and Flat height modes are available.
- Hover shows county vote total, margin, and scenario transfer.
- Clicking a Pennsylvania county removes the county layer and lazy-loads the county's Census VTD terrain.

### Pennsylvania precinct/VTD level

- One simplified TopoJSON shard is loaded only for the selected county.
- VTD color represents presidential margin.
- VTD height represents a county-relative normalized ballot-volume scale.
- Census polygons with no matched 2024 return stay neutral.
- Hover and click-to-pin readouts show the reporting-unit name, named-candidate votes, margin, and match quality.
- The county card discloses mapped-vote coverage and the number of unmatched reporting units.
- Back navigation supports county to Pennsylvania to United States.
- Escape follows the same hierarchy.

### Scenario behavior

- The current assumption is a Pennsylvania two-party margin shift from 0.0 to +4.0 points toward Harris.
- The state transfer is deterministic.
- County allocations use largest remainder and preserve every county total.
- The visible mapped precinct share receives only its proportional share of the county transfer. Unmatched/non-geographic votes are not pushed into visible polygons.
- Zero change reproduces the official baseline.
- A successful Pennsylvania flip updates its 19 electoral votes.

## 5. Application architecture

```text
src/main.tsx
  -> src/App.tsx
       -> national/state/county scenario derivation
       -> editorial controls and readouts
       -> lazy src/map/AtlasMapScene.tsx
            -> us-atlas preprojected state/county geometry
            -> deck.gl OrbitView and GeoJsonLayer
            -> lazy Pennsylvania VTD loader

src/data/states.ts
  -> official 2024 state baselines and Electoral College allocation

src/data/pa-2024-counties.json
  -> generated official Pennsylvania county artifact
src/data/pennsylvania.ts
  -> typed county artifact exports

public/data/pa/2024/reporting-units.json
  -> generated 9,189-unit Pennsylvania result artifact
public/data/pa/2024/precinct-geometry-manifest.json
  -> county shard registry, coverage, bounds, checksums, source metadata
public/data/pa/2024/precincts/*.topo.json
  -> 67 lazy county VTD shards
src/data/paPrecincts.ts
  -> manifest fetch, shard fetch, TopoJSON conversion, successful-result cache

packages/data-contracts/src/index.ts
  -> canonical election/reporting-unit contracts
packages/election-model/src/invariants.ts
  -> reconciliation, probability, and largest-remainder invariants
packages/election-model/src/scenario.ts
  -> national aggregation and deterministic state/county/unit transfers

scripts/import-pennsylvania-2024.mjs
  -> official Pennsylvania result ingestion and reconciliation
scripts/build-pennsylvania-vtd-geometry.mjs
  -> Census shapefile ingestion, crosswalk, projection, simplification, sharding
```

Everything interactive is client-side today. The scripts are build-time data pipelines. A future election-night system or saved/shared scenario system will need a separate backend, but no backend has been introduced yet.

## 6. Renderer and camera decisions

The map uses an independently owned port of successful Atlas behavior. See `docs/decisions/0004-atlas-renderer-behavior.md`.

Important details:

- `OrbitView` uses `COORDINATE_SYSTEM.CARTESIAN`.
- `us-atlas` Albers geometry is projected for a 975 by 610 viewport.
- Screen Y is inverted for OrbitView in `src/map/atlasGeometry.ts`.
- The VTD build script uses the same projection and Y inversion.
- Camera transitions are cubic-eased and cancellable.
- View-state updates are throttled through `requestAnimationFrame`.
- Timers and animation frames are cleaned up on unmount.
- The transparent parent layer is removed after the child layer rises to avoid depth-buffer occlusion.
- The national camera now fits the actual map container and updates through `ResizeObserver`, fixing coast cropping on narrow screens.
- Precinct height is scaled from the selected county's horizontal span. This fixed the initial Philadelphia skyscraper bug.
- The precinct loader uses an `AbortController` and caches only successfully loaded counties.

## 7. Color and height semantics

- The diverging palette is in `src/map/atlasPalette.ts`.
- Blue means Democratic, orange/red means Republican, and a warm neutral is used near even or for missing results.
- Color uses margin magnitude, not raw vote total.
- State height uses electoral votes.
- County height uses `4 + 18 * sqrt(countyVotes / maxPennsylvaniaCountyVotes)`.
- Precinct height uses a county-relative unit derived from the selected county's horizontal span, then a square-root ballot scale.
- Ballots and Flat are explicit modes.
- Unmatched Census geometry is low and neutral, not colored with countywide results.

Do not assign height directly from raw vote totals without normalization. That previously made small urban precinct geography unreadable.

## 8. Pennsylvania result sources and reconciliation

### Official precinct return file

URL:

`https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt`

- Local temp copy used by the pipeline: `C:\Users\kilom\AppData\Local\Temp\pa-2024-general-precinct-returns.txt`
- Size: approximately 43 MB
- SHA-256: `34339122238fe82272c52717a4065dbd3949e00eeb98320332797853c96f3b6c`
- Source rows: 268,768
- Presidential rows: 36,748
- Geographic reporting-unit keys: 9,187

### Official county breakdown

URL:

`https://www.electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak?officeId=1&districtId=1&methodName=GetCountyBreak&electionid=105&electiontype=G&isactive=0`

- Local temp copy: `C:\Users\kilom\AppData\Local\Temp\pa-2024-county-break.json`
- SHA-256: `c73094edb1b46312f89facc68c561b26286caa158819fe775c00f3487942c7cc`
- Four named candidates are exposed: Harris, Trump, Oliver, and Stein.
- Election Day, mail, and provisional totals reconcile exactly for each published candidate.

### Certified statewide baseline

FEC URL:

`https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf`

Certified Pennsylvania totals:

| Candidate bucket | Votes |
|---|---:|
| Harris | 3,423,042 |
| Trump | 3,543,308 |
| Other | 92,382 |
| Total | 7,058,732 |

### Residual policy

See `docs/decisions/0005-pennsylvania-result-reconciliation.md`.

- Official county totals for the four named candidates sum to 7,034,206.
- The precinct extract is short of the county summaries by 2,469 named-candidate votes, all represented through an explicit Philadelphia county reconciliation bucket.
- The remaining 24,526 certified statewide votes are an explicit non-geographic statewide residual.
- The statewide residual is included in state and national totals.
- It is never fabricated across counties or precincts.
- Generated reporting units total 9,189: 9,187 source geographic units, one county residual, and one statewide residual.

The generated artifacts currently reconcile exactly to the FEC baseline.

## 9. Pennsylvania Census VTD geometry and crosswalk

See `docs/decisions/0006-pennsylvania-vtd-crosswalk.md`.

Official Census source:

`https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/42_PENNSYLVANIA/42/tl_2020_42_vtd20.zip`

Technical documentation:

`https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2020pl/TGRSHP2020PL_TechDoc.pdf`

Local temp files used during the build:

- Archive: `C:\Users\kilom\AppData\Local\Temp\tl_2020_42_vtd20.zip`
- Extracted directory: `C:\Users\kilom\AppData\Local\Temp\tl_2020_42_vtd20`

Checksums:

- Source archive SHA-256: `a2568ba2a1143341031d11482fd179be838f91dbdf0425ed024a378f8cc5ed79`
- Shapefile SHA-256: `10f113221cc93330d82d7c266b30b92a484340c5a1bec5eb831975cf5b386e44`
- DBF SHA-256: `fd6fd939558aa7d112e8513af31d58315e3e6b1e0d3c583a2434e6d3efc8d949`

### Match order

1. Normalize and exactly match state + county + VTD as a Census GEOID.
2. If the identifier changed, normalize only documented Pennsylvania abbreviations and numeric zero-padding.
3. Accept the normalized name only when it resolves to exactly one VTD in the same county.
4. Aggregate multiple official election reporting units when they resolve to one Census polygon.
5. Leave unresolved units unmatched.

No fuzzy edit-distance matching, nearest-polygon assignment, or countywide vote distribution is permitted.

### Verified coverage

| Measure | Count |
|---|---:|
| Census VTD polygons | 9,178 |
| Election geographic reporting units | 9,187 |
| Exact identifier matches | 8,636 |
| Unique canonical-name matches | 451 |
| Total matched reporting units | 9,087 |
| Unmatched reporting units | 100 |
| Matched Census polygons | 9,038 |
| Census polygons without a result | 140 |
| Polygons receiving multiple result units | 46 |

Mapped precinct-file votes:

- Matched: 6,933,560
- Precinct-file total: 7,031,737
- Coverage: 98.6038%

The 2020 Census VTD vintage is an approximation for a 2024 election. Never describe these polygons as official 2024 precinct geometry.

### Geometry output

- Projection: `geoAlbersUsa().scale(1300).translate([487.5, 305])`, then OrbitView Y inversion.
- Quantization: 50,000.
- Simplification quantile: 0.18. Note that `topojson-simplify` sorts weights descending, so lowering this value preserves fewer points.
- County shards: 67.
- Total shard size: 12,578,086 bytes.
- Average shard: approximately 187,733 bytes.
- Largest shard: 1,605,317 bytes, Allegheny County (`42003.topo.json`).

## 10. Data pipeline commands

Rebuild Pennsylvania results:

```powershell
node scripts\import-pennsylvania-2024.mjs `
  "C:\Users\kilom\AppData\Local\Temp\pa-2024-general-precinct-returns.txt" `
  "C:\Users\kilom\AppData\Local\Temp\pa-2024-county-break.json"
```

Rebuild Pennsylvania VTD geometry:

```powershell
node scripts\build-pennsylvania-vtd-geometry.mjs `
  "public\data\pa\2024\reporting-units.json" `
  "C:\Users\kilom\AppData\Local\Temp\tl_2020_42_vtd20\tl_2020_42_vtd20.shp" `
  "C:\Users\kilom\AppData\Local\Temp\tl_2020_42_vtd20\tl_2020_42_vtd20.dbf" `
  "C:\Users\kilom\AppData\Local\Temp\tl_2020_42_vtd20.zip"
```

The result importer checks both source hashes and every reconciliation invariant before replacing artifacts. The geometry builder writes the 67 public shards, the public manifest, and `data-sources/pennsylvania/2024-vtd-crosswalk.json`.

## 11. Important design decisions

These decisions should be treated as accepted constraints unless the user explicitly changes them:

- `docs/decisions/0001-independent-product.md`: Sandbox 2.0 is independent.
- `docs/decisions/0002-reporting-unit-model.md`: Reporting units include precinct and non-geographic buckets.
- `docs/decisions/0003-deterministic-scenarios.md`: Determinism is the default; uncertainty is an optional later layer.
- `docs/decisions/0004-atlas-renderer-behavior.md`: Own the Atlas-inspired renderer behavior locally.
- `docs/decisions/0005-pennsylvania-result-reconciliation.md`: Preserve residuals explicitly.
- `docs/decisions/0006-pennsylvania-vtd-crosswalk.md`: Exact ID, then unique canonical name, never fuzzy geography fabrication.

Additional product principles live in `PRODUCT_AND_ENGINEERING_PLAN.md`.

## 12. Key files changed or created

### App and UI

- `index.html`: Vite entry document.
- `src/main.tsx`: React mount.
- `src/App.tsx`: workbench, controls, scenario derivation, breadcrumb, selected readout.
- `src/styles.css`: complete editorial responsive design.
- `src/vite-env.d.ts`: Vite environment typing.

### Map

- `src/map/AtlasMapScene.tsx`: state, county, and VTD layers; camera; lazy loading; hover/pin; cleanup.
- `src/map/atlasGeometry.ts`: us-atlas conversion, FIPS registry, Albers Y correction, bounds.
- `src/map/atlasPalette.ts`: margin palette and deck color conversion.

### Data

- `src/data/states.ts`: national state baseline.
- `src/data/pennsylvania.ts`: typed Pennsylvania county exports.
- `src/data/pa-2024-counties.json`: generated county artifact.
- `src/data/paPrecincts.ts`: lazy manifest/shard loader and types.
- `public/data/pa/2024/reporting-units.json`: generated unit results.
- `public/data/pa/2024/precinct-geometry-manifest.json`: geometry registry and coverage.
- `public/data/pa/2024/precincts/*.topo.json`: 67 county shards.
- `data-sources/pennsylvania/2024-general-presidential.json`: source registry and reconciliation metadata.
- `data-sources/pennsylvania/2024-vtd-crosswalk.json`: full match audit and unresolved units.

### Model

- `packages/data-contracts/src/index.ts`: reporting-unit contracts.
- `packages/election-model/src/invariants.ts`: exact reconciliation helpers.
- `packages/election-model/src/scenario.ts`: national aggregation, state shift, county shift, generic unit transfer.

### Pipelines and verification

- `scripts/import-pennsylvania-2024.mjs`
- `scripts/build-pennsylvania-vtd-geometry.mjs`
- `tests/election-model.test.mjs`
- `README.md`
- `PRODUCT_AND_ENGINEERING_PLAN.md`
- `docs/decisions/0004-atlas-renderer-behavior.md`
- `docs/decisions/0005-pennsylvania-result-reconciliation.md`
- `docs/decisions/0006-pennsylvania-vtd-crosswalk.md`

### Build-system changes

- `package.json` and `package-lock.json`: converted from the original vinext/Cloudflare scaffold to React/Vite/deck.gl.
- `vite.config.ts`: simple standalone Vite server on 127.0.0.1:4173.
- `tsconfig.json`: strict browser TypeScript configuration.
- `eslint.config.mjs`: React, hooks, TypeScript, and accessibility linting.
- `.gitignore`: Vite output and local log ignores.

### Intentionally removed scaffold

The following categories are deleted in the working tree:

- `.openai/hosting.json`
- Next/vinext app files under `app/`
- Cloudflare worker and build plugin
- Drizzle database files
- Next configuration and generated types
- Old example D1 files
- Old Next/PostCSS assets and rendered-HTML test

These deletions are part of the standalone local product conversion.

## 13. Verification completed

The full command-line verification suite was rerun on 2026-08-09 after upgrading to Vite 8.2.1 and again after the final camera/keyboard fixes:

- `npm test`: 10 of 10 tests passed.
- `npm run lint`: passed with no warnings or errors.
- `npm run build`: passed on Vite 8.2.1.

The verified production build produced:

- Initial application JS: 225.21 kB, 70.62 kB gzip.
- Lazy Atlas/deck.gl chunk: 1,601.32 kB, 502.11 kB gzip.
- CSS: 18.47 kB, 4.83 kB gzip.

The deck.gl chunk still triggers Vite's greater-than-500-kB warning. It is lazy and does not block the build, but it is an optimization target.

Browser-tested behavior before the final dependency update:

- National desktop terrain renders.
- Pennsylvania state drilldown renders verified county colors and heights.
- Philadelphia and Bucks county clicks load VTD terrain.
- Philadelphia showed 99.6% mapped coverage with 6 unmatched units.
- Bucks showed 100.0% mapped coverage with 0 unmatched units.
- Initial precinct columns were too tall; county-relative elevation scaling fixed the issue.
- National fixed zoom cropped the coasts on mobile; container-fit camera logic fixed the issue.
- Mobile selected readout hid the national map; moving the undrilled card to the top of the stage fixed it.
- Mobile national terrain fits cleanly after waiting for the lazy deck.gl chunk.
- No browser console errors were present after these fixes in the pre-upgrade smoke test.

The browser smoke suite was repeated against a freshly started Vite 8.2.1 server on 2026-08-09. It verified:

- National desktop terrain fits the workbench.
- Pennsylvania opens to verified county terrain.
- Philadelphia opens to VTD terrain and reports 99.6% mapped coverage with 6 unmatched units.
- Ballots/Flat and Actual/Scenario/Shift controls change pressed state correctly.
- The Pennsylvania shift slider advances from 0.0 to 0.1 by keyboard, recalculates transferred votes, and updates the PA result.
- Philadelphia VTD terrain now refits after the lazy shard loads; it no longer remains a tiny sliver at the edge of the Pennsylvania county camera.
- At 390 by 844, `scrollWidth === clientWidth`, the selected readout remains above the map, and the national terrain fits without horizontal overflow.
- Browser console errors and warnings: none.

Two issues were found and fixed during this final browser pass:

1. `AtlasMapScene.tsx` now permits a tighter county zoom and refits the camera from the loaded shard's audited bounds.
2. `App.tsx` now explicitly supports ArrowLeft/ArrowRight/ArrowUp/ArrowDown plus Home/End on the controlled range input, while retaining pointer `onInput`/`onChange` handling.

## 14. Dependency security update

The dependency audit originally reported seven advisories, including five high-severity build-tool advisories.

Actions already completed:

1. `npm audit fix` updated 29 packages and removed all but the Vite advisory.
2. `npm install -D vite@8.2.1` updated Vite from 8.0.13 to the patched 8.2.1 line.
3. That install reported `found 0 vulnerabilities`.

The Vite install also emitted a cleanup warning because an old Rolldown native binding was locked by a running process. The install itself completed successfully. The likely lock holder is the still-running pre-update Vite development server.

The full test, lint, and production build suite passed after the Vite 8.2.1 update and after the final interaction fixes.

The final standalone `npm audit` was allowed to contact the registry and completed successfully with `found 0 vulnerabilities`.

## 15. Exact next steps

The interrupted verification checkpoint is complete. The next Codex session should do these steps in order.

### Step 1: inspect the complete working tree

- Review `git status` and `git diff` carefully.
- Preserve the intentional scaffold deletions.
- Do not discard or reset the dirty tree.
- Remember that many new product files are untracked, so `git diff` alone is not a complete review.

### Step 2: create the v0.3 commit only when the user asks

- A sensible commit boundary is the complete Pennsylvania precinct pilot.
- There is no remote, so pushing is not possible until the user chooses a repository and authorizes remote configuration.

### Step 3: begin the next product increment only after the repository boundary is accepted

The planned next increment is the Pennsylvania demographic model described in section 17.

## 16. Known limitations and unresolved work

### Data and geography

- Only Pennsylvania has verified county and VTD results.
- The remaining 49 states plus DC do not have detailed reconciled county result packages in this product.
- The 2020 Census VTD geometry is not official 2024 precinct geometry.
- 100 Pennsylvania election units remain unresolved.
- 140 Census VTD polygons have no matched 2024 return.
- The statewide 24,526-vote residual is intentionally non-geographic.
- Pennsylvania and Census redistribution/license language is still marked `review_required` in source metadata and should be reviewed before public deployment.

### Product and modeling

- Only one Pennsylvania two-party margin control exists.
- Turnout and preference are not yet separate controls.
- No demographic crosswalk, confidence score, ecological-inference model, or population editor exists.
- No county/precinct search exists.
- No saved/shareable scenario encoding exists.
- No Run My Election or election-night backend exists.
- No uncertainty layer exists.

### Frontend and deployment

- The lazy deck.gl bundle is about 502 kB gzip and triggers a chunk warning.
- The application imports Google Fonts at runtime.
- GitHub Pages/Vercel/Sites configuration is not present.
- Vite `base` is not configured for a repository subpath. Set it before a GitHub Pages deployment under `/repo-name/`.
- No remote is configured.
- The repository still needs a clean v0.3 commit after final verification.

### Interaction checks

- The final pass verified keyboard slider changes, desktop state/county/VTD drilldown, and the 390-by-844 national layout.
- A future polish pass should still exercise every mobile state/county/VTD breadcrumb and compact data-note combination, not only the national mobile view.
- Recheck blank-canvas click behavior when changing the hierarchy code. VTD blank clicks are intentionally inert; state-level blank clicks currently return to the national view.

## 17. Recommended next product increment after v0.3 is stabilized

Do not start this until the interrupted verification and commit are complete.

The next planned increment is the Pennsylvania demographic model:

1. Select authoritative Census demographic sources and vintages.
2. Build a versioned Census-block or block-group to VTD crosswalk.
3. Store coverage and confidence per reporting unit.
4. Separate turnout mutations from preference mutations.
5. Preserve the exact zero-change baseline.
6. Explain every changed vote through an assumption ledger.

After that, the product can add saved scenarios and eventually a separate election-night backend.

## 18. Guardrails for the next session

- Do not invent missing votes or geography.
- Do not convert the statewide residual into county or precinct votes.
- Do not describe Census 2020 VTDs as official 2024 precincts.
- Do not merge this product with the existing Sandbox.
- Do not reintroduce the removed Next/Cloudflare/Sites scaffold without explicit user direction.
- Do not reset or discard the current dirty worktree.
- Use `apply_patch` for source edits.
- Keep the Atlas editorial design and current interaction quality intact.
- Run reconciliation tests after every data or scenario-model change.
- Keep expensive geometry preprocessing out of the browser.
