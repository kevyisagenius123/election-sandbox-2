# Sandbox 2.0

## Product and Engineering Plan

**Status:** v0.23B Election Night Refinement implemented and verified for supervisor review

**Product type:** Standalone precinct-level counterfactual election simulator

**Initial election:** 2024 United States presidential election

**Primary principle:** An unchanged scenario must reproduce the certified baseline exactly

**Relationship to the existing Sandbox:** None. This is a separate product, repository, application, data model, deployment, and backend.

---

## 1. Executive summary

### Current implementation note

Version 0.17 completes the first geographic Path to 270 workflow. A selected route persists as state codes while all progress is reconstructed from certified results and verified recipes. Supported Pennsylvania and Michigan requirements open their existing laboratories, report exact modeled movement and remaining gap, and become Satisfied only after a deterministic winner change. National route markers expose status without relying on color alone. Unsupported states remain mathematical and non-geographic.

Version 0.18 hardens that two-state portfolio for a small external alpha. A deterministic 35-cycle browser profile now enforces worker, WebGL, cache, request, animation, heap-growth, and latency budgets. Hostile state replacement proves delayed geometry cannot reclaim ownership. Detailed-state admission, state exceptions, and redistribution review are explicit product gates. No third detailed state was added.

Version 0.18.1 replaces the detailed-state long page with a fixed viewport Laboratory, bounded national-consequence rail, and collapsed, working, or expanded bottom drawer. Version 0.18.2 then separates the editorial Home from analytical geography. `/` introduces Sandbox; `/app/` is the direct United States Laboratory and shared-scenario entry. National, state, county, and reporting-unit geographies now use the same analytical shell without remounting the renderer or model foundations. Home/Laboratory presentation remains workspace state and is never serialized into an election recipe.

Version 0.19A is a synthetic usability and comprehension evaluation, not a substitute for human testing. Eight interface-bound personas completed the same five tasks against v0.18.2. The report identifies no P0 model-integrity defect and recommends a bounded correction scope: public deployment, clearer entry into model controls, an always-available exact state threshold, just-in-time model terminology, registry-backed provenance, and state-specific geography labels. See `SYNTHETIC_ALPHA_REPORT.md`. No model or data expansion is authorized by the evaluation itself.

Version 0.19.1 implements that correction scope without adding model features. The drawer leads with geographic intent, the live state-flip requirement is a shared state fact consumed by Path to 270, terminology is defined beside its consequence, preference-transfer arithmetic is explained at the values, Data is a provenance ledger, and PA VTD / MI precinct contracts remain distinct. Scenario sharing now explains that the deterministic URL is the saved object. The Pages workflow includes a post-deployment remote smoke journey.

The unchanged eight-persona synthetic rerun is recorded in `SYNTHETIC_ALPHA_RERUN_REPORT.md`. All five target concepts moved from 6–7 of 8 correct interpretations to 8 of 8 in the walkthrough. This is predicted-failure verification, not statistical human evidence; v0.19B remains required.

Version 0.23B is the current implementation. Election Night is integrated into the Swingometer on the same mounted 3D map and publishes only detailed PA, MI, and WI local returns. Its active worker now reuses bounded decoded foundations and scenario endpoints for chronology restarts, while the bottom dock explains the exact current-only margin movement of each recent reporting-unit return. Decision Desk inference, projections, calls, backend services, and additional states remain deferred.

The product is now frozen as `v0.19.1-supervisor-review`. `SUPERVISOR_REVIEW.md` defines the exact review tasks, evidence, limitations, redistribution hold, and three permitted verdicts. A fresh-context blind pass was attempted on 2026-08-20, but three isolated contexts failed at the evaluator browser boundary before navigation. The owner then designated Codex as AI supervisor. The exact-tag technical walkthrough completed all seven tasks and three adversarial questions with no P0-P3 product finding. It is AI evidence, not human or genuinely unfamiliar evidence. The candidate's own 48 model checks, 34 bounded browser checks, lint, build, screenshots, and PA profile remain green.

The supervisor issued **HOLD** without ordering a product correction. Gate B subsequently passed through the owner-authorized AI technical-supervisor review. Gate A still requires a supported participant-delivery disposition for both PA and MI and blocks external participant, public full-product, and paid delivery. `docs/review/v0.19.1-supervisor-review/SUPERVISOR_VERDICT.md` remains authoritative for that frozen candidate.

Version 0.19B remains operationally specified in `docs/research/HUMAN_ALPHA_PROTOCOL.md`, but the owner has deferred it until the assembled product can receive end-to-end human testing. Decision 0027 permits private internal development in small state batches without treating human validation as passed. PA/MI delivery remains blocked, and public or paid detailed-state release remains prohibited.

Version 0.20 admits Wisconsin as the third detailed state. The official LTSB layer supplies 72 county totals, 7,086 January 2025 ward polygons, a 2020 Census-derived `PERSONS18` denominator, and 6,946 result-bearing local rows. All 3,422,918 statewide ballots reconcile. The ward values are explicitly disclosed as LTSB population-disaggregated reconstructions, not raw certified ward returns. Wisconsin reuses the manifest-driven worker, 3D drilldown, contribution, inspector, portfolio, route, and deterministic URL architecture.

The v0.20 release gate passes 52 model checks, 38 current browser journeys, three Wisconsin visual references, lint, build, and a 35-cycle PA/MI/WI controlled profile. The final profile measured 2.37% retained-heap growth, a 41,238-byte per-cycle slope, and 24.11-second whole-cycle p95.

Decision 0028 authorizes v0.21 Run My Election as the next private engineering phase and postpones the Arizona/Georgia admission batch. The current implementation target is the headless replay boundary: an immutable exact endpoint, state-specific evidence-labeled reporting profiles, a deterministic event compiler, and a Decision Desk isolated from future results. `RUN_MY_ELECTION_ENGINE_PLAN.md` is the authoritative implementation specification. No public or paid release is authorized by this sequencing decision.

Version 0.21A implements only the constitutional endpoint boundary: pure contracts, canonical serialization, exact national and local reconciliation, content fingerprints, a versioned deterministic seed namespace, stable event identity, Pennsylvania fixtures, and adversarial tests. Its exact verification is recorded in `docs/review/v0.21a-replay-contracts/VERIFICATION.md`. That endpoint law passed supervisor review before v0.21B began.

Version 0.21B implements the separately authorized private Pennsylvania compiler. Each locked reporting unit becomes one atomic return, scheduled without candidate shares or winner knowledge and then populated with its exact five-candidate endpoint vector. Canonical event ordering, named timing streams, prefix conservation, geographic reconciliation, explicit off-map treatment, endpoint immutability, and two frozen compiled-stream fingerprints are enforced by the headless audit. No reducer, Decision Desk, UI, other-state compiler, or backend was added. Its evidence is recorded in `docs/review/v0.21b-pa-event-compiler/VERIFICATION.md`; the Pennsylvania compiler passed supervisor review before v0.21C began.

Version 0.21C introduced jurisdiction-independent stream admission and composition law while preserving Pennsylvania byte-for-byte. Version 0.21D proved that law with Michigan as a second detailed state. Version 0.21E now admits all 50 states and District of Columbia on one deterministic zero-to-endpoint timeline: Pennsylvania and Michigan remain detailed, the other 49 jurisdictions remain exact statewide atomic returns, and complete composition conserves the five candidate buckets and 538 electoral votes. A versioned return-eligibility clock prevents coarse multi-boundary jurisdictions from publishing before all territory represented by their indivisible return has closed. Evidence is recorded in `docs/review/v0.21e-national-replay-composition/VERIFICATION.md`. A headless replay reducer remains separately review-gated.

Version 0.22A consumes that immutable timeline through a strict pure reducer. Canonical zero state, exact hierarchy accumulation, lifecycle assertions, future-data isolation, versioned state fingerprints, validated checkpoints, and deterministic sequence/time reseeking are implemented for both accepted national fixtures. Observable state exposes only applied facts and no endpoint totals, remaining-vote arithmetic, percentages, leaders, projections, or calls. The first measured baseline records full-reduction, seek, and serialized-memory costs without imposing an unreviewed performance limit. Evidence is recorded in `docs/review/v0.22a-replay-reducer/VERIFICATION.md`. Derived reported-state analytics remain separately review-gated.

Version 0.22B derives only arithmetic facts from already-applied observable reducer state: five-candidate reported leaders and rankings, exact margins, explicit-denominator shares, return counts, and honest available geography summaries. Version 0.22C adds a process-local immutable seek index that reconstructs from the nearest canonical checkpoint without creating persistence or caching analytics. Certified and complex random-seek torture tests remain byte-identical to full-prefix reducer and analytics output. The v0.22C performance record shows roughly 62x to 74x random-seek median improvement at a 250-event cadence. Replay UI remains separately review-gated.

Version 0.22D builds a pure logical playback controller over that accepted infrastructure. Explicit play, pause, reset, logical-time advance, event/time seek, completion, and next-timestamp commands remain immutable and process-local. Logical-time partitioning cannot change state, simultaneous events are exposed atomically, and no wall clock, timer, presentation behavior, analytics cache, or Decision Desk inference enters the controller. Evidence is recorded in `docs/review/v0.22d-playback-cursor/VERIFICATION.md`.

Version 0.22E gives future presentation a structural current-knowledge boundary rather than access to kernel objects. Sanitized snapshots contain current controller position, accepted reported analytics, and compact already-published geography. Sanitized transitions contain only applied timestamp groups and changed jurisdictions. Critical certified/complex tests prove that identical observed prefixes and transitions serialize byte-identically despite divergent futures. No transport, subscription, worker, UI, narrative, or inference behavior was added.

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

### 9.7 Path to 270 and national scenario portfolio

Path to 270 turns the state laboratory into a national electoral strategy tool. It answers:

> What combination of state-level changes gets a target candidate to 270 electoral votes, and where did those electoral votes come from?

The national interface preserves a compact recipe for every state with active assumptions. A state does not need to remain fully loaded for its scenario to remain active.

#### Scenario classification

Every state in a route has one permanent, visible classification:

1. **Actual**: the certified historical result.
2. **Modeled**: a detailed scenario the user constructed with a supported state model.
3. **Required**: a mathematical movement needed to reach the target, without county or reporting-unit allocation.

A Required state must never be presented as geographically modeled. The system may state that Wisconsin requires approximately 29,400 additional net Democratic margin votes to flip, but it must not claim which Wisconsin counties supply them until Wisconsin has a production-ready foundation.

#### National scenario portfolio

Recipes are authoritative. Derived state summaries are disposable caches and must be regenerated whenever their recipe fingerprint, data version, or engine version changes. The portfolio stores only compact inactive-state recipes and verified summaries:

```text
Pennsylvania: turnout +0.4; added-voter share 58% Harris; preference +1.2 D
Michigan: turnout +0.2; preference +0.9 D
```

Heavy county, reporting-unit, demographic, worker, and geometry resources may be released when a user leaves a state. Reopening the state reloads its foundation and deterministically reconstructs the same totals.

#### Electoral consequence panel

Path to 270 provides four views:

- **Score**: candidate EV totals, change from baseline, and EV still needed.
- **Changed states**: actual margin, scenario margin, winner change, and EV consequence for each active recipe.
- **Closest paths**: combinations capable of reaching 270, the additional movement required, ranking metric, and Modelled or Required status.
- **Scenario audit**: every contributing assumption, data and engine version, state vote contribution, and EV consequence.

The panel explains causality. For example: Harris reaches 270 after Pennsylvania and Michigan flip; the two states contribute 34 electoral votes relative to the certified baseline.

#### Route calculation

The route engine uses an explicit target candidate and election-year EV allocation. It computes certified and scenario winners and margins, EV, flip status, additional margin movement required, approximate net margin votes where defensible, model availability, and classification.

`Net margin votes required` means the smallest integer increase in `target candidate votes - opponent votes` needed to move past a tie under the current state total. It is not a claim about turnout, persuasion, counties, or reporting units. A 269-269 result is reported as no Electoral College majority and is never treated as reaching the target.

Routes may be ranked by fewest states, smallest aggregate margin-point movement, smallest aggregate net margin-vote requirement, or user-selected states only. The chosen metric must remain visible. The engine should retain a bounded Pareto frontier and prune dominated partial routes rather than brute-force every national subset.

#### Route completeness

- **Mathematical path**: composed primarily of Required movements.
- **Partially modeled path**: at least one route state is Modeled and at least one remains Required.
- **Fully modeled path**: every state responsible for reaching 270 has a detailed scenario.

#### Geographic drilldown

Selecting a route state enters its detailed state laboratory. Returning to the national map preserves every other state recipe. The long-term workflow is:

```text
Path to 270 -> Required state -> State lab -> Counties -> Reporting units
            -> user constructs change -> Modeled state -> EV consequence
```

#### Visual treatment

The national Atlas retains its restrained editorial language: a gold outline for active Modeled states, numbered route markers, a muted dashed treatment for Required states, partisan fill for the current result, and a concise `270 reached` lockup. Required and Modeled states must never rely on color alone, and no celebratory or casino-like animation is used.

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

### 10.4.1 Multi-state scenario persistence

Detailed-state resources and national scenario state are separate. The browser maintains lightweight authoritative recipes:

```ts
interface StateScenarioRecipe {
  stateCode: string;
  electionId: string;
  engineVersion: string;
  dataVersion: string;
  settings: StateBehaviorRecipeSettings;
}
```

Verified calculations produce disposable summaries:

```ts
interface StateScenarioSummary {
  stateCode: string;
  recipeFingerprint: string;
  actualMargin: number;
  scenarioMargin: number;
  actualWinner: string;
  scenarioWinner: string;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  totalVotes: number;
  electoralVotes: number;
  flipped: boolean;
}
```

A summary may be aggregated only when its fingerprint matches the current recipe. National aggregation otherwise uses the certified baseline for that state and reports the recipe as pending or unavailable.

Runtime lifecycle is explicit: `unloaded -> loading -> ready -> releasing -> unloaded`, with a separate fail-closed `error` state. Only one detailed foundation is interactive at a time. Inactive recipes are hydrated sequentially in a worker to compact summaries; heavy foundations are not returned to or retained by the main interface. County geometry uses bounded least-recently-used caching and state-level purge on release.

Scenario URL schema 2 serializes the complete recipe portfolio, active detailed state, interface modes, and selected geography. Schema 1 remains replayable for backward compatibility and is upgraded locally after a successful deterministic calculation.

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

### Milestone 4: Multi-state scenario portfolio and Path to 270 private alpha

Pennsylvania and Michigan established the first persistent multi-state scenario. Wisconsin is the first controlled expansion through the proven architecture. Arizona, Georgia, and later states follow only in small audited batches.

**Implementation status:** v0.14 Portfolio foundation, v0.15 Consequence ledger, v0.16 Route engine, v0.17 Geographic route construction, v0.18 Private-alpha hardening, v0.19.1 comprehension corrections, and the v0.20 Wisconsin admission are complete or in final verification.

The milestone is released in four bounded increments:

- **v0.14 Portfolio foundation**: versioned recipes, sequential inactive-state hydration, persistent PA and MI controls, aggregation, changed-state strip, schema-2 replay, and resource release.
- **v0.15 Consequence ledger**: baseline delta, changed-state causal ledger, EV needed, exact-threshold and 269-269 handling.
- **v0.16 Route engine**: Actual, Modeled, and Required classifications; bounded deterministic route enumeration; selectable ranking metrics. Complete.
- **v0.17 Geographic route construction**: selected routes persist, supported rows open detailed state labs, live gaps remain explicit, and only verified winner changes satisfy route contributions. Complete.
- **v0.18 Private-alpha hardening**: deterministic lifecycle stress and hostile navigation, written resource and performance budgets, responsive and reduced-motion visual gates, state-admission exceptions, and redistribution inventory. Complete.
- **v0.20 Wisconsin foundation**: open LTSB source admission, exact county and statewide reconciliation, reconstructed-ward disclosure, shared runtime integration, and three-state portfolio support.

**Deliverables**

- Pennsylvania, Michigan, and Wisconsin production-ready runtime integration.
- Compact authoritative per-state recipe portfolio and derived summary cache.
- Persistent assumptions while switching states.
- Lazy unloading and deterministic state rehydration.
- Cross-state scenario aggregation with no double counting.
- National changed-state ledger and Electoral College consequence panel.
- Explicit target candidate, 270 threshold, and 269-269 logic.
- Deterministic closest-path enumeration using bounded dominance pruning.
- Ranking by fewest states, margin-point movement, or net margin-vote requirement.
- Actual, Modeled, and Required state classifications.
- Route rows linked to detailed state drilldown.
- Scenario URL capable of reproducing the same multi-state result.

**Exit criteria**

- Pennsylvania, Michigan, and Wisconsin scenarios coexist without retaining multiple full foundations on the main thread.
- Leaving and reopening either state reproduces identical deterministic totals.
- National popular-vote and EV totals contain no double counting and always equal the election-year allocation.
- Every changed EV is attributable to a state recipe.
- Required states never acquire modeled geography or model-derived precision.
- Route enumeration and ordering are deterministic for a fixed scenario, target, data version, and engine version.
- A shared multi-state scenario reproduces identical state and national totals after reload.
- Repeated state switching shows no material heap, worker, or WebGL-resource growth.

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

The detailed architecture, release sequence, evidence taxonomy, realism model, backend staging, and verification gates are defined in `RUN_MY_ELECTION_ENGINE_PLAN.md`. Decision 0028 moves the bounded replay core ahead of further state expansion so the existing PA/MI/WI contracts can test the architecture before national scale.

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

### 15.6 Multi-state and Path to 270 tests

Maintain golden scenarios for Pennsylvania only, Michigan only, both states simultaneously, one Modeled plus one Required state, exactly 270, below 270, multiple valid routes, and Maine or Nebraska district consequences when supported.

End-to-end tests verify that state assumptions survive navigation, rehydration is identical, aggregation is unchanged after unloading, schema-2 links reproduce every recipe and EV total, route ranking is deterministic, Required geography remains unavailable, removing a pivotal state drops the candidate below 270, 269-269 is not a win, and total allocated EV equals the election-year allocation.

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
| Multi-state foundations retained simultaneously | Excessive browser memory | Persist compact recipes and summaries; sequentially hydrate inactive states and release heavy resources |
| Required path confused with Modeled result | False geographic precision | Permanent Actual, Modeled, and Required labels in data and interface contracts |
| Route ranking implies one definition of easiest | Misleading strategy claims | Show the ranking metric and expose several defensible criteria |
| State model versions drift | Shared scenarios change over time | Version every recipe and reject incompatible replay rather than silently recalculating |
| Stale summary enters national aggregation | Incorrect national result | Require an exact recipe-fingerprint match before a derived summary is accepted |
| Cross-state aggregation double counts | Incorrect popular-vote or EV total | Replace each canonical state exactly once and assert national invariants |

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
- Which states did I actually model?
- Which states are only mathematical requirements?
- How did my changed states alter the Electoral College?
- What remaining combinations can reach the target?
- Can I trace a flipped state to the counties and reporting units responsible?

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
5. Multi-state scenario portfolio.
6. Path to 270 and route enumeration.
7. Geographic drilldown from national route to state, county, and reporting unit.
8. Run My Election replay contracts, event compiler, Decision Desk, and interactive proof across existing detailed states.
9. Additional production-ready and replay-ready state expansion.
10. Extended Census-to-reporting-unit demographic foundation.
11. Calibrated turnout and candidate-choice model.
12. Population editor.
13. Explainability and uncertainty.
14. Run My Election production services, Director Mode, and export.
15. National expansion and sharing ecosystem.

The demographic editor should not ship until its controls have defensible statistical meaning. Run My Election should not ship until its replay can end at exactly the saved scenario endpoint without giving the projection model direct knowledge of the winner.

---

## 22. Final product statement

Sandbox 2.0 is a standalone laboratory for changing the American electorate and tracing the consequences.

It begins with an exact historical election. The user changes a documented assumption. The engine transforms eligible voters and candidate preferences within defensible geographic and statistical boundaries. Reporting-unit changes aggregate into counties, states, the popular vote, and the Electoral College. Every important movement remains numerically explainable.

Eventually, the user can lock that alternate America and watch its votes arrive through an independent election-night simulation.

That closed loop is the defining feature:

> Change the electorate, understand the result, then watch the alternate election happen.
