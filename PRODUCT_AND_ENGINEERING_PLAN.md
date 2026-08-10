# Sandbox 2.0

## Product and Engineering Plan

**Status:** v0.10 replay and performance hardening

**Product type:** Standalone precinct-level counterfactual election simulator

**Initial election:** 2024 United States presidential election

**Primary principle:** An unchanged scenario must reproduce the certified baseline exactly

**Relationship to the existing Sandbox:** None. This is a separate product, repository, application, data model, deployment, and backend.

---

## 1. Executive summary

### Current implementation note

Version 0.10 turns the scenario-sharing audit into a checked-in browser contract and profiles the Pennsylvania runtime before multi-state expansion. Playwright now proves the canonical complex replay, official alphanumeric VTD restoration, and fail-closed future-version behavior through visible application outcomes. The deterministic engine caches immutable baseline validation and indexes, avoids unnecessary allocation objects, and keeps the same largest-remainder ordering and scenario results. On repeated runs on the current development machine, the complex Pennsylvania scenario median falls from about 100 ms to roughly 75 ms and contribution derivation from about 16 ms to under 2 ms. The remaining scenario cost makes a Web Worker boundary an entry condition for multiple detailed states.

Sandbox 2.0 lets a user change turnout, candidate preference, and eventually population composition, then see those assumptions propagate from reporting units to counties, states, the national popular vote, and the Electoral College.

The product answers one central question:

> What would the election look like if the electorate behaved differently, or if the electorate itself were different?

Its strongest complete experience is:

```text
USER CHANGES AN ASSUMPTION
        ↓
REPORTING-UNIT RESULTS CHANGE
        ↓
COUNTIES AND STATES CHANGE
        ↓
THE ELECTORAL COLLEGE CHANGES
        ↓
USER PRESSES RUN ELECTION
        ↓
THE COUNTERFACTUAL RESULT ARRIVES AS A NEW ELECTION NIGHT
```

The first release will not attempt the entire vision. It will establish a trustworthy 2024 baseline and a fast behavior-only simulator in a small set of production-ready states. Population editing, statistical demographic modeling, and Run My Election will follow only after the baseline and mutation engine pass strict validation.

---

## 2. Product boundaries

### 2.1 This product is

- A historical counterfactual simulator.
- A geographic explanation tool.
- A precinct or reporting-unit aggregation engine.
- A deterministic scenario system with an optional uncertainty layer.
- A way to understand how turnout and preference assumptions alter political outcomes.
- Eventually, an alternate election-night generator.

### 2.2 This product is not

- A forecast of a future election.
- A replacement for official election results.
- A voter targeting platform.
- A claim that precinct demographics reveal individual voter behavior.
- A national precinct map that invents missing geometry or vote allocations.
- A new route or mode inside the existing Sandbox.

### 2.3 Isolation requirements

Sandbox 2.0 must have:

- Its own repository and Git history.
- Its own frontend and backend deployments.
- Its own environment variables and secrets.
- Its own URL or subdomain.
- Its own data registry, object storage, and databases.
- Its own component library and map renderer.
- Its own API namespace and contracts.
- Its own test, release, and rollback process.

No existing Sandbox source files, routes, state stores, endpoints, build artifacts, or databases should be imported. Architectural lessons and broad visual ideas may inform the new product, but no runtime coupling is permitted.

---

## 3. Product promise

The product must make three things immediately understandable:

1. **What the user changed.**
2. **Where that change affected votes.**
3. **How those votes changed the final election.**

The map is not the product by itself. The product is the traceable causal chain from an assumption to an electoral consequence.

### Primary user jobs

- Test a political claim, such as “What if voters under 30 turned out six points more?”
- Apply a shift nationally or only within a state, county, or selected group of reporting units.
- Compare the actual election with a counterfactual result.
- Find the counties and reporting units responsible for a state flip.
- Understand the scenario’s tipping-point state and path to 270.
- Save and share an exact, reproducible scenario.
- Eventually watch the counterfactual result arrive as an election-night simulation.

### Intended audiences

- Election enthusiasts and map users.
- Political journalists and educators.
- Students and researchers exploring counterfactuals.
- Campaign and policy analysts using public aggregate data.

---

## 4. Product principles

### 4.1 Baseline fidelity

With no mutations, every published total must match the selected historical baseline exactly.

### 4.2 Incomplete truth over fabricated completeness

If reliable precinct geometry is unavailable, show a lower geographic level or a table. Do not invent polygons or assign countywide ballots to arbitrary precincts.

### 4.3 Reporting units are broader than precincts

Mail, early, provisional, central-count, and other ballots may exist in county-level or jurisdiction-level buckets. The model must represent them honestly.

### 4.4 Turnout and preference are different operations

Turnout changes who participates. Preference changes how participating voters divide among candidates. The interface and simulation engine must never merge these concepts.

### 4.5 Demographics are estimates, not identities

Precincts and Census geographies do not naturally align. Demographic values assigned to reporting units must be crosswalked, versioned, and given confidence levels.

### 4.6 Every result must be explainable

Every changed state, county, and reporting unit must be traceable to explicit scenario mutations and calculated contributions.

### 4.7 The interface must stay responsive

Geographic intersections are preprocessing work. Interactive scenario changes should use precomputed cells and fast local calculations.

### 4.8 Uncertainty must not be mistaken for randomness

The deterministic scenario is the expected result under the user’s assumptions. Optional uncertainty draws quantify model limitations. They do not replace a coherent model with arbitrary noise.

---

## 5. Geographic and electoral model

### 5.1 Geographic hierarchy

```text
United States
  State or federal district
    County or county equivalent
      Reporting unit
        Precinct
        Election Day precinct result
        Mail bucket
        Early-vote bucket
        Provisional bucket
        Central-count or other bucket
      Demographic cells derived through crosswalks
```

The interface must preserve a breadcrumb such as:

```text
USA > Pennsylvania > Erie County > Precinct 12-03
```

Selecting a higher breadcrumb level returns both the camera and the analytical context to that level.

### 5.2 Electoral College rules

The electoral model must support:

- Statewide winner-take-all allocation.
- District-level allocation in Maine and Nebraska.
- The District of Columbia.
- Election-year-specific electoral vote counts.
- Election-year-specific congressional district geometry where required.
- Candidate, party, and other-vote totals without assuming exactly two candidates.

The initial presidential simulator does not need to model faithless electors. It reports the allocation implied by the election rules and scenario vote totals.

### 5.3 Stable identifiers

FIPS codes alone are not sufficient for precincts. Every source record should receive a stable internal identifier derived from:

```text
election + state + county + source system + source reporting-unit key
```

Display names may change without changing internal identity. Geometry and result vintages must be stored independently.

---

## 6. Data strategy

### 6.1 Source hierarchy

| Tier | Description | Display treatment |
|---|---|---|
| A | Official state or local results and geometry | Official |
| B | Trusted normalized election datasets | Normalized, with source shown |
| C | Census VTD or another documented approximation | Approximate geography |
| D | Results without defensible geometry | Tabular only |

Source licensing and redistribution terms must be verified before any dataset is included in a public build.

### 6.2 Source registry

Every dataset must have a machine-readable registry entry containing:

- Source name and publisher.
- Source URL or archive location.
- Election and office.
- Retrieval date.
- License or use restrictions.
- File checksum.
- Geography vintage.
- Transformation pipeline version.
- Known limitations.
- Coverage and quality classification.

### 6.3 Canonical result contract

```ts
type ReportingUnitType =
  | "precinct"
  | "election_day_precinct"
  | "mail_bucket"
  | "early_vote_bucket"
  | "provisional_bucket"
  | "central_count_bucket"
  | "other_bucket";

interface ReportingUnit {
  id: string;
  electionId: string;
  stateFips: string;
  countyFips: string | null;
  name: string;
  type: ReportingUnitType;
  geometryId: string | null;
  geometryVintage: string | null;
  geometrySourceId: string | null;
  resultSourceId: string;
  geometryQuality: "official" | "normalized" | "approximate" | "none";
  resultQuality: "official" | "normalized" | "estimated";
}

interface CandidateVotes {
  candidateId: string;
  partyId: string | null;
  votes: number;
}

interface ReportingUnitResult {
  reportingUnitId: string;
  contestId: string;
  votes: CandidateVotes[];
  totalVotes: number;
  ballotMode: string | null;
}
```

### 6.4 Demographic source model

Demographics must not be stored as if they directly belong to precincts. The conceptual source chain is:

```text
Census blocks
  population, voting age, race and ethnicity

ACS block groups
  socioeconomic characteristics

CVAP products
  estimated citizen voting-age population

Election geometry
  reporting-unit boundaries

Offline crosswalk
  source geography to reporting-unit weights

Reporting-unit demographic cells
  documented estimates with confidence flags
```

Population-weighted allocation should be preferred over raw land-area weighting. Industrial land, water, parks, and other unpopulated areas must not receive population simply because they cover area.

### 6.5 Coverage dashboard

The internal dashboard must show, for every state:

- Result coverage.
- Geometry coverage.
- Official-geometry share.
- Crosswalk coverage.
- Demographic coverage.
- Reconciliation status.
- Known source limitations.
- Release classification: production ready, review, or incomplete.

No state is published as fully interactive until its required release checks pass.

---

## 7. Baseline reconstruction

The baseline is an engineering invariant, not a visual approximation.

```text
reporting units + non-geographic buckets = county
counties = state
states = national popular vote
state and district winners = Electoral College
```

### 7.1 Required baseline tests

- Candidate vote totals match the authoritative source at every supported level.
- Total votes equal the sum of candidate votes.
- County buckets are included once and only once.
- Geometry-free units still contribute to electoral totals.
- Maine and Nebraska district allocation is correct.
- DC and county equivalents are handled.
- No vote becomes negative.
- Integerization does not create or destroy votes.
- Zero mutations return a byte-stable scenario result for a fixed engine and data version.

### 7.2 Integer vote reconciliation

Interactive calculations may use fractional expected votes internally. Published reporting-unit results must be converted to integers using a deterministic reconciliation method such as largest remainder, while preserving each reporting unit’s required total.

### 7.3 Definition of a production-ready state

A state is production ready only when:

- Result reconciliation passes at reporting-unit, county, and state levels.
- Geometry coverage and exceptions are documented.
- Non-geographic reporting buckets are modeled.
- The data manifest is versioned.
- The no-mutation result exactly reproduces the baseline.
- Manual visual inspection finds no missing, duplicated, inverted, or misplaced geometry.

---

## 8. Scenario engine

### 8.1 Scenario structure

```ts
interface Scenario {
  id: string;
  electionId: string;
  engineVersion: string;
  dataVersion: string;
  mutations: ScenarioMutation[];
  uncertaintySeed?: string;
}

interface ScenarioMutation {
  id: string;
  order: number;
  enabled: boolean;
  editor: "behavior" | "population";
  operation: string;
  demographicSelector: DemographicSelector | null;
  geographySelector: GeographySelector;
  value: number;
  units: "points" | "percent" | "people" | "share";
  createdAt: string;
}
```

The ordered mutation ledger is part of the scenario definition. If operation order affects a result, reordering must visibly recompute it. Shared scenarios must preserve order.

### 8.2 Behavior operations

The first public editor supports:

- Turnout change by demographic selector.
- Candidate preference change by demographic selector.
- National, state, county, reporting-unit group, and custom-region scopes as coverage allows.
- Enable, disable, edit, reorder, remove, undo, and redo.

### 8.3 Overlapping groups

Independent demographic sliders can overlap. A person may be young, college educated, suburban, and part of a racial or ethnic group at the same time. The engine must therefore operate on joint or reconciled demographic cells, not independently add votes for each marginal group.

The model must define:

- How cells are constructed.
- How sparse cells are pooled or regularized.
- How several matching mutations combine.
- Whether mutation order matters.
- How totals are reconciled after a transform.

### 8.4 Turnout transformation

Turnout is modeled as:

```text
P(turnout | demographics, geography)
```

Constraints:

- Probability remains between 0 and 1.
- Resulting voters cannot exceed the selected eligible-electorate denominator.
- The denominator source and confidence level are visible.
- RECOMPOSE operations cannot create or destroy population.

### 8.5 Preference transformation

Candidate choice is modeled separately:

```text
P(candidate | turnout, demographics, geography)
```

Preference changes should use a probability-preserving transformation, such as a softmax or log-odds adjustment. Candidate probabilities must always sum to one, including third-party and other candidates.

### 8.6 Local residual preservation

The demographic model should not erase local political effects.

```text
actual reporting-unit result
  = modeled demographic component
  + calibrated local residual
```

When a user changes a modeled assumption, the relevant modeled component changes while the calibrated local residual remains unless the scenario explicitly chooses another residual treatment.

The exact statistical form, additive versus multiplicative, must be selected through model evaluation. It must preserve valid probabilities and reproduce the baseline after calibration.

### 8.7 Deterministic and uncertainty modes

**Deterministic mode** returns one exact expected scenario for exploration and sharing.

**Uncertainty mode** runs reproducible draws based on source, crosswalk, and behavior-model uncertainty. A saved seed and model version must reproduce the same interval results.

The UI must distinguish:

- Expected modeled result.
- Plausible model range.
- Historical actual result.
- Synthetic scenario assumption.

---

## 9. User experience

### 9.1 Core screen

The default national screen contains:

- Actual 2024 result.
- Current scenario result.
- Delta from actual.
- Electoral College and popular vote.
- National map.
- A compact assumptions ledger.
- A clear “Simulation, not a forecast” label.

### 9.2 Navigation

```text
National states
  click state
State counties
  click county
County reporting units
  click reporting unit
Reporting-unit inspector
```

The selected geography controls both the camera and the scope offered in the editor.

### 9.3 Editors

Controls are divided into three conceptual areas:

1. **Behavior:** change turnout and candidate preference.
2. **Population:** recompose, grow, or shrink the electorate in later releases.
3. **Geography:** select where a mutation applies.

Population controls remain disabled until the demographic foundation passes validation.

### 9.4 Comparison modes

- Actual.
- Scenario.
- Difference.
- Flips only.
- Side by side where screen size permits.

### 9.5 3D encodings

Three-dimensional height must always have a selected, labeled meaning:

- Ballots cast.
- Eligible population or CVAP.
- Turnout.
- Absolute scenario vote change.
- Selected demographic count or share.

A 2D map and text/table equivalent must remain available for accessibility and geographic recognition. Height is never left as unexplained decoration.

### 9.6 Explanation panels

Every changed unit supports:

```text
WHY DID THIS REPORTING UNIT MOVE?
WHY DID THIS COUNTY FLIP?
WHY DID THIS STATE FLIP?
```

The explanation is generated from simulation contributions, not free-form generated text. It should show:

- Actual and scenario result.
- Net vote shift.
- Contribution from each relevant mutation.
- Remaining residual contribution where applicable.
- Confidence or approximation warnings.

### 9.7 Path to 270

Path to 270 identifies:

- Tipping-point state.
- States closest to changing the Electoral College outcome.
- Counties most responsible for each relevant state margin.
- Reporting units most responsible for those county changes.

### 9.8 Scenario history and sharing

Users can:

- Undo and redo.
- Name snapshots.
- Enable or disable mutations.
- Compare snapshots.
- Copy a share URL.
- Export scenario JSON.
- Export simulated aggregate results as CSV.

A shared scenario includes only assumptions and immutable version references when the deterministic engine can rebuild the result.

---

## 10. Technical architecture

### 10.1 Repository layout

```text
election-sandbox-2/
  apps/
    web/
  services/
    scenario-api/
  packages/
    data-contracts/
    election-model/
    simulation-engine/
    map-renderer/
    ui/
  pipelines/
    ingest/
    normalize/
    geography/
    crosswalk/
    calibrate/
    publish/
  data-registry/
  tests/
    fixtures/
    invariants/
    integration/
    visual/
  docs/
    methodology/
    decisions/
    operations/
```

### 10.2 Proposed stack

This stack is a starting decision and should be captured in architecture decision records before scaffolding:

- **Frontend:** React, TypeScript, and Vite.
- **Map:** deck.gl with MapLibre, implemented independently for this product.
- **Interactive computation:** Web Worker using typed arrays; evaluate Rust/WASM only after profiling shows a need.
- **API:** FastAPI or another small typed service for scenario persistence, manifests, and heavy jobs.
- **Preprocessing:** Python, GeoPandas, DuckDB, and GDAL-compatible tooling.
- **Spatial registry:** PostgreSQL/PostGIS for pipeline metadata and validation.
- **Published data:** versioned compressed shards in object storage behind a CDN.
- **Testing:** unit and invariant tests, API integration tests, Playwright user flows, and visual geometry checks.

Technology reuse does not imply source-code reuse from the existing Sandbox.

### 10.3 Runtime division

#### Offline pipeline

- Download and archive source files.
- Normalize results.
- Normalize and repair geometry.
- Build crosswalks.
- Construct demographic cells.
- Fit and calibrate models.
- Run reconciliation and coverage checks.
- Publish versioned manifests and shards.

#### Browser

- Load the selected geographic level.
- Apply deterministic mutations in a worker.
- Aggregate results.
- Update map attributes and explanation panels.
- Manage local scenario history.

#### Backend

- Store and retrieve shared scenarios.
- Resolve immutable data and engine versions.
- Run heavier uncertainty jobs.
- Generate exports and preview cards.
- Later, prepare alternate election-night runs.

### 10.4 Lazy data loading

```text
App start       → national state geometry and totals
State selected  → county geometry, totals, and state model shard
County selected → reporting-unit geometry and result shard
Inspector open  → detailed demographic cells and provenance
```

The application must never load nationwide precinct geometry at startup.

### 10.5 Performance targets

Initial engineering targets:

- State-level mutation recompute: p95 under 150 ms on a mainstream laptop.
- National aggregate recompute from loaded model shards: p95 under 500 ms.
- Map interaction during steady-state navigation: target 60 frames per second.
- No main-thread GIS intersections.
- No leaked WebGL layers, workers, timers, listeners, or aborted fetches after navigation.
- Large geometry and model requests must be cancellable.

Targets may be revised after a measured Pennsylvania prototype.

### 10.6 API outline

The initial API surface should remain small:

```text
GET  /v1/elections
GET  /v1/elections/{electionId}/manifest
GET  /v1/geography/{geographyId}/manifest
POST /v1/scenarios
GET  /v1/scenarios/{scenarioId}
POST /v1/scenarios/{scenarioId}/exports
POST /v1/simulations/uncertainty
```

Versioned static result, geometry, and model shards should be served directly from object storage or a CDN rather than streamed through the application server.

---

## 11. Security, privacy, accessibility, and trust

### 11.1 Privacy

- Use public aggregate election and demographic data.
- Do not ingest individual voter files into the public product.
- Do not expose person-level predictions.
- Apply minimum-population and confidence rules to highly granular demographic displays.

### 11.2 Security

- Treat imported geography and tabular files as untrusted pipeline inputs.
- Validate scenario payload size and schema.
- Rate-limit share and heavy simulation endpoints.
- Keep storage credentials server-side.
- Sign or hash immutable data manifests.

### 11.3 Accessibility

- Provide a 2D alternative to every 3D view.
- Use color palettes distinguishable under common color-vision deficiencies.
- Do not encode a result using color alone.
- Support keyboard navigation and visible focus states.
- Provide table and text summaries for map selections.
- Respect reduced-motion preferences.

### 11.4 Trust language

The interface must use consistent labels:

- Actual result.
- User scenario.
- Modeled estimate.
- Approximate geography.
- Synthetic demographic scenario.
- Not a forecast.

---

## 12. Delivery plan

Work is gated by evidence. A later milestone does not begin merely because the interface for an earlier milestone looks complete.

### Milestone 0: Product and repository foundation

**Deliverables**

- Independent repository and deployment configuration.
- Architecture decision records.
- Data and scenario contracts.
- Source registry format.
- CI, formatting, testing, and release conventions.
- Static design prototype for national, state, and county views.

**Exit criteria**

- The new product can be built, tested, and deployed without the existing Sandbox.
- Contracts are reviewed against precincts, county buckets, DC, Maine, and Nebraska.

### Milestone 1: Pennsylvania pilot data foundation

Pennsylvania is the first end-to-end pilot. It provides competitive statewide politics, varied local geography, dense and rural reporting units, and meaningful county drilldown.

**Deliverables**

- Authoritative 2024 result sources.
- Reporting-unit registry.
- County and reporting-unit geometry.
- Geometry and result normalization.
- Versioned source manifest.
- Coverage dashboard.

**Exit criteria**

- Users can navigate USA > Pennsylvania > county > reporting unit.
- Every missing or approximate unit is documented.
- Manual geometry QA passes.

### Milestone 2: Exact baseline engine

**Deliverables**

- Candidate and contest model.
- Reporting-unit and bucket aggregation.
- County, state, popular-vote, and Electoral College aggregation.
- Deterministic integer reconciliation.
- Automated invariant suite.

**Exit criteria**

- Zero mutations reproduce every supported 2024 Pennsylvania total exactly.
- National state totals and Electoral College baseline reconcile for the states available at this stage.

### Milestone 3: Behavior sandbox MVP

**Deliverables**

- Simple turnout controls.
- Simple candidate-preference controls.
- National, state, and county scopes supported where model data exist.
- Worker-based scenario computation.
- Actual, scenario, difference, and flips-only views.
- Mutation ledger, undo, redo, and snapshots.

**Exit criteria**

- A user can create, inspect, reverse, and reproduce a meaningful behavior-only scenario.
- Every transformation respects turnout and probability constraints.
- Baseline remains exact after adding and removing mutations.

### Milestone 4: Multi-state private alpha

Add Arizona, Georgia, and Wisconsin after Pennsylvania. These states deliberately test countywide early or mail buckets, diverse reporting structures, and varied geography.

**Deliverables**

- Four production-ready states.
- State-specific ingestion adapters.
- Non-geographic reporting-bucket support.
- Cross-state scenario aggregation.
- Electoral College and Path to 270 interface.

**Exit criteria**

- Each state passes the same baseline and provenance gates.
- A national scenario can combine loaded state models without double counting.

### Milestone 5: Demographic foundation

**Deliverables**

- Census block ingestion.
- ACS and CVAP block-group ingestion.
- Population-weighted source-to-reporting-unit crosswalks.
- Initial joint demographic cells.
- Crosswalk confidence and coverage metrics.

**Exit criteria**

- Every production reporting unit has a documented estimated electorate composition or a clear unavailable status.
- Crosswalk weights reconcile to their source population within documented tolerance.

### Milestone 6: Calibrated behavior model

**Deliverables**

- Separate turnout and candidate-choice models.
- Survey ingestion and weighting.
- Sparse-cell strategy.
- Geographic effects.
- Local residual calibration.
- Model evaluation and robustness report.

**Exit criteria**

- Calibration returns exactly to actual reporting-unit totals.
- Out-of-sample and sensitivity tests are documented.
- Slider semantics can be explained in plain language.

### Milestone 7: Population editor

**Deliverables**

- RECOMPOSE mode.
- GROW and SHRINK mode.
- State, county, and selected-reporting-unit scopes.
- Demographic layers and paint/select tools.
- Permanent synthetic-scenario labeling.

**Exit criteria**

- RECOMPOSE preserves total eligible population.
- GROW and SHRINK show exactly where people are added or removed.
- Population changes propagate through turnout, candidate preference, votes, and the Electoral College.

### Milestone 8: Explainability and uncertainty

**Deliverables**

- Reporting-unit, county, and state contribution decomposition.
- Tipping-point geography.
- Path to 270.
- Deterministic versus uncertainty modes.
- Reproducible intervals and confidence display.

**Exit criteria**

- Every major flip has a numerical explanation.
- Interval results reproduce with the same data, engine version, scenario, and seed.

### Milestone 9: Run My Election

**Deliverables**

- Conversion from scenario endpoint to counterfactual reporting-unit totals.
- Historical or reconstructed reporting-event timing.
- County reporting-bucket events.
- Hidden-outcome mode.
- Projection model based on reported results, outstanding geography, and uncertainty.
- Exact replay-endpoint reconciliation.

**Exit criteria**

- The replay begins at zero and ends at the exact saved scenario result.
- Calls are not triggered by direct access to the final winner.
- The same run is reproducible from its scenario, engine, data, timing, and random-seed versions.

### Milestone 10: Public sharing and national expansion

**Deliverables**

- Stable scenario URLs.
- JSON and CSV export.
- Social preview cards.
- Public methodology and source pages.
- Progressive release of additional production-ready states.

**Exit criteria**

- Two users opening the same scenario receive identical deterministic results.
- Public states pass all data, model, performance, accessibility, and trust checks.

---

## 13. MVP definition

The MVP is complete when a user can:

1. Open an independent Sandbox 2.0 application.
2. See the exact 2024 baseline.
3. Enter Pennsylvania and inspect counties and reporting units.
4. Change a supported turnout or preference assumption.
5. Choose a national, state, or county scope supported by the available model.
6. Compare actual and scenario results.
7. See the county, state, popular-vote, and Electoral College effects.
8. Understand which assumption produced a selected change.
9. Undo the change and return exactly to baseline.
10. Save or serialize the scenario locally.

The MVP does **not** require:

- Fifty-state precinct geometry.
- Population editing.
- Demographic painting.
- Full statistical uncertainty.
- Alternate election-night replay.
- Future-election forecasting.

---

## 14. Initial implementation backlog

The first build sequence should be:

1. Create the independent repository and CI pipeline.
2. Record architecture decisions for IDs, result units, geometry, scenario ordering, and versioning.
3. Implement shared TypeScript data contracts.
4. Create the source-registry schema and validation command.
5. Acquire and archive the Pennsylvania pilot sources.
6. Normalize Pennsylvania counties and reporting units.
7. Implement reporting buckets and result reconciliation.
8. Publish the first versioned manifest and geography shards.
9. Build national, state, and county drilldown with an independent deck.gl renderer.
10. Implement the exact baseline aggregation engine.
11. Add invariant tests and golden fixtures.
12. Add a Web Worker simulation boundary.
13. Implement one turnout mutation and one preference mutation end to end.
14. Add actual, scenario, and difference rendering.
15. Add the mutation ledger, undo, redo, and reset to baseline.
16. Add the explanation inspector using computed contribution records.
17. Measure performance and memory behavior on representative devices.
18. Run accessibility and geometry QA.
19. Publish the internal Pennsylvania proof.
20. Review the model and data design before expanding to another state.

---

## 15. Testing strategy

### 15.1 Unit tests

- Probability transforms.
- Turnout caps.
- Candidate-share reconciliation.
- Mutation filtering and ordering.
- Integer vote allocation.
- Electoral vote rules.
- Contribution decomposition.

### 15.2 Data invariants

- Reporting units plus buckets equal county totals.
- Counties equal state totals.
- Candidate totals equal total votes.
- Crosswalk weights sum correctly.
- Population is conserved in RECOMPOSE mode.
- Published geometry identifiers resolve.

### 15.3 Golden scenarios

Maintain versioned fixtures for:

- Zero mutations.
- One turnout increase.
- One candidate-preference shift.
- Overlapping demographic mutations.
- A state flip.
- A third-party share change.
- A Maine or Nebraska district allocation change.

### 15.4 End-to-end tests

- Navigate from nation to reporting unit and back.
- Apply, edit, disable, reorder, and remove mutations.
- Reload and reproduce a shared scenario.
- Compare actual and scenario modes.
- Cancel data loads during rapid navigation.
- Use the core experience by keyboard.

### 15.5 Visual and memory tests

- Detect inverted or misplaced geometry.
- Compare known state and county silhouettes.
- Verify map colors against scenario totals.
- Verify every height mode has a visible legend.
- Repeatedly enter and leave geographic levels while monitoring layers, buffers, workers, listeners, and heap growth.

---

## 16. Release gates

A release candidate must pass five gates.

### Data gate

- Reconciled totals.
- Complete provenance.
- Verified licensing.
- Documented exceptions.

### Model gate

- Valid probabilities and turnout.
- Exact baseline calibration.
- Reproducible deterministic results.
- Reviewed slider semantics.

### Product gate

- The user can state what changed and why the result moved.
- Simulation and actual results cannot be confused.
- Unsupported geography is clearly labeled.

### Engineering gate

- Performance targets met or consciously revised.
- No material memory leak in navigation stress tests.
- APIs and stored scenarios are version compatible.
- Rollback path tested.

### Trust and accessibility gate

- Methodology and source pages published.
- Uncertainty and synthetic assumptions labeled.
- Keyboard, color, motion, and text-equivalent checks passed.

---

## 17. Key risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| Nationwide precinct fragmentation | Slow ingestion and inconsistent coverage | Start with production-ready states and publish a coverage dashboard |
| Misaligned election and Census geography | Misallocated population | Use block-informed, population-weighted crosswalks with confidence flags |
| Countywide ballot modes | False precinct precision | Preserve mail, early, provisional, and central-count reporting buckets |
| Overlapping demographic sliders | Double counting and impossible totals | Use joint or reconciled cells and probability-preserving transforms |
| Sparse survey cells | Unstable behavior estimates | Pool, regularize, validate, and expose uncertainty |
| Demographic model erases local politics | Unrealistic uniform results | Calibrate and preserve local residuals |
| Scenario order ambiguity | Non-reproducible results | Store mutation order and engine version explicitly |
| Large national geometry | Slow startup and excessive memory | Load by geographic level and cancel stale requests |
| False precision | Users overtrust derived values | Show confidence, ranges, and source quality |
| Licensing restrictions | Public deployment risk | Verify and record redistribution terms before publication |
| Feature breadth overwhelms the product | A polished interface without a reliable model | Gate each milestone and release behavior-only MVP first |

---

## 18. Success measures

### Trust and correctness

- 100 percent of published baseline reconciliation checks pass.
- 100 percent of displayed sources link to a versioned registry entry.
- Zero unlabeled approximate geometries.
- Zero known scenarios that violate probability, turnout, or conservation constraints.

### Product understanding

In usability testing, users should be able to answer:

- What assumption did I change?
- Where did it apply?
- Which places changed most?
- Why did the state or Electoral College outcome change?
- Is this an actual result, a modeled scenario, or a forecast?

### Performance

- Meet the measured recomputation and navigation targets.
- No sustained heap or GPU-resource growth across repeated drilldown sessions.
- No nationwide precinct payload on initial load.

### Engagement

- Scenario completion rate.
- Share or export rate.
- Percentage of users who inspect at least one explanation.
- Return rate for saved scenarios.
- Later, completion rate for Run My Election replays.

---

## 19. Decisions required before implementation

These decisions should become short architecture decision records:

1. Final public name and repository name.
2. Exact 2024 result authority and certification policy.
3. Candidate and third-party representation.
4. Reporting-unit identity and geometry versioning.
5. Pennsylvania source package and redistribution rights.
6. Deterministic integer reconciliation method.
7. Mutation combination and ordering semantics.
8. Initial turnout denominator hierarchy.
9. Initial demographic cell dimensions.
10. Local residual formulation.
11. Public data-shard format and compression.
12. Scenario URL, persistence, and compatibility policy.
13. Criteria for calling a state production ready.

None of these decisions requires coupling to the existing Sandbox.

---

## 20. Recommended first product increment

The first increment should prove one complete causal path:

```text
2024 Pennsylvania certified baseline
        ↓
one supported turnout or preference mutation
        ↓
reporting-unit vote changes
        ↓
county aggregation
        ↓
Pennsylvania result change
        ↓
Electoral College delta
        ↓
numeric explanation of the change
```

This increment is deliberately small. If it is exact, fast, and understandable, Sandbox 2.0 has a trustworthy foundation. Every later feature becomes an extension of the same model rather than a separate effect layered over a map.

---

## 21. Long-term product sequence

The recommended sequence is:

1. Precinct and reporting-unit foundation.
2. Exact 2024 baseline.
3. Behavior-only sandbox.
4. Actual, scenario, difference, and flips.
5. Electoral College and Path to 270.
6. Multi-state data expansion.
7. Census-to-reporting-unit demographic foundation.
8. Calibrated turnout and candidate-choice model.
9. Population editor.
10. Explainability and uncertainty.
11. Run My Election.
12. National expansion and sharing ecosystem.

The demographic editor should not ship until its controls have defensible statistical meaning. Run My Election should not ship until its replay can end at exactly the saved scenario endpoint without giving the projection model direct knowledge of the winner.

---

## 22. Final product statement

Sandbox 2.0 is a standalone laboratory for changing the American electorate and tracing the consequences.

It begins with an exact historical election. The user changes a documented assumption. The engine transforms eligible voters and candidate preferences within defensible geographic and statistical boundaries. Reporting-unit changes aggregate into counties, states, the popular vote, and the Electoral College. Every important movement remains numerically explainable.

Eventually, the user can lock that alternate America and watch its votes arrive through an independent election-night simulation.

That closed loop is the defining feature:

> Change the electorate, understand the result, then watch the alternate election happen.
