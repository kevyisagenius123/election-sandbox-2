# Run My Election

## Election-Night Engine, Replay Studio, and Production Architecture

**Status:** v0.23B integrated three-state Election Night refinement implemented and verified for review

**Target starting release:** v0.21

**Product:** Sandbox 2.0

**Current detailed-state foundation:** Pennsylvania, Michigan, and Wisconsin

**Primary guarantee:** Every replay starts from an immutable election endpoint, reports every ballot through an auditable event stream, and finishes at that exact endpoint.

**Public-release boundary:** This plan authorizes private engineering work. It does not clear unresolved PA/MI delivery rights, replace deferred human testing, or authorize public or paid detailed-state delivery.

---

## 1. Executive decision

Build the election-night engine now, before adding a large number of states, but build it as an independent subsystem rather than mixing time and randomness into the existing counterfactual model.

The existing model answers:

> What would the final election result be under these assumptions?

Run My Election answers:

> How could that exact result unfold as a realistic, inspectable election night?

The relationship is one-way:

```text
DETERMINISTIC SANDBOX RECIPE
        ↓
VERIFIED STATE SUMMARIES
        ↓
IMMUTABLE ELECTION ENDPOINT
        ↓
REPLAY COMPILER
        ↓
VERSIONED EVENT LOG
        ↓
INTERACTIVE REPLAY / LATER VIDEO
```

Reporting order, clock speed, calls, camera movement, and visual effects must never change the locked votes. The existing scenario engine remains deterministic and timeless. Election-night variability begins only after the endpoint has been validated and locked.

The first implementation is local-first and worker-driven. A backend is intentionally deferred until accounts, membership entitlements, cloud saves, shared live rooms, public publishing, or server-rendered video create a real server requirement.

---

## 2. Product identity

The product family has three distinct questions:

```text
ATLAS
What happened?

SANDBOX
What if the electorate behaved differently?

RUN MY ELECTION
How would that counterfactual unfold on election night?
```

Run My Election is not a decorative playback mode. Its killer feature is the connection between local reporting events and national consequence:

> A reporting-unit batch changes a county, which changes a state margin, which changes the outstanding-vote requirement, which may change a call, the Electoral College, and the path to 270.

The user should always be able to answer:

1. What just reported?
2. Why did the margin move?
3. What remains?
4. What does the trailing candidate need?
5. Why is the race called or still uncalled?
6. Did this event change the Electoral College?

---

## 3. Scope and non-scope

### 3.1 v0.21 scope

- Lock one or more existing deterministic state scenarios.
- Compile exact local candidate totals into a deterministic reporting event stream.
- Model irregular, state-specific, county-specific, and vote-mode-specific reporting.
- Aggregate events upward from legitimate reporting units to counties, states, the national popular vote, and the Electoral College.
- Show counted vote, modeled outstanding vote, lead changes, calls, and causal explanations.
- Support pause, seek, next return, next major event, and multiple playback speeds.
- Reproduce an identical run from explicit versions and a seed.
- Reuse the Atlas-quality 3D renderer behavior without coupling this product to the Atlas runtime.
- Prove the architecture across PA, MI, and WI, whose source contracts differ materially.

### 3.2 Deferred scope

- Manual direct editing of candidate totals.
- Arbitrary user-authored precinct geometry.
- Fifty-state local-detail replay.
- Real-time official election ingestion.
- Multiplayer rooms and presenter control.
- Public user uploads.
- Membership billing and entitlements.
- Server-side video rendering.
- Probabilistic election outcomes that change the locked endpoint.
- Automated historical claims for timestamps that are not documented.

### 3.3 Absolute exclusions

Run My Election must never:

- let reporting order alter final votes;
- let playback speed alter event order or totals;
- let the projection engine read future candidate totals or `finalWinner`;
- invent precinct polygons or attach residual ballots to arbitrary geography;
- describe synthetic or reconstructed return timing as documented history;
- silently convert county totals into fabricated precinct returns;
- lose, duplicate, or create ballots during batching;
- use decorative random noise with no geographic or administrative interpretation;
- publish PA/MI detailed artifacts while their delivery basis remains unresolved;
- treat AI review as completed human validation.

---

## 4. User modes

The architecture should support four modes, introduced progressively.

### 4.1 Scenario Night

The user builds a Sandbox scenario, locks it, and watches that counterfactual election report. This is the first production target.

### 4.2 Historical Replay

The endpoint is the certified result. Documented timestamps are used where available; reconstructed or modeled periods are labeled individually. A state may be admitted to Scenario Night without being admitted to a timestamped Historical Replay.

### 4.3 Hidden Outcome

The final state winners, national popular vote, and Electoral College result are hidden after lock. The user discovers their own scenario through the replay. The endpoint remains available to the compiler but not to the UI or projection model.

### 4.4 Director Mode

A later presentation workspace controls camera targets, event density, pauses, titles, aspect ratio, and export cues. Director choices operate on an existing event log and cannot mutate the election.

---

## 5. Four-editor model

The long-term studio is divided into four explicit editors.

| Editor | Question | Owns | Must not own |
|---|---|---|---|
| Electorate and Result | What votes exist? | Existing behavior recipes, later manual result construction | Timing, calls, camera |
| Reporting | How do votes arrive? | Poll closes, unit activation, batches, vote modes, cadence | Final totals, calls |
| Decision Desk | What can be inferred now? | Projection priors, thresholds, call state | Future actual returns, presentation |
| Presentation | How is the replay experienced? | Camera, density, clock display, layout, video cues | Votes, reporting order, projections |

These boundaries must exist in TypeScript contracts, worker messages, tests, and UI language, not only in documentation.

---

## 6. Epistemic-status system

Every event and supporting input receives one of the following statuses:

| Status | Meaning | Permitted wording |
|---|---|---|
| `documented` | Directly supported by an attributable timestamped source | “Reported at 10:31 PM” |
| `reconstructed` | Inferred from partial records using a documented method | “Reconstructed return sequence” |
| `modeled` | Generated from a calibrated administrative profile | “Modeled return” |
| `user_defined` | Explicitly scheduled by the user | “Custom reporting plan” |
| `synthetic` | Generated for an alternate election or experiment | “Synthetic scenario event” |
| `exact_endpoint` | Exact locked candidate totals at the replay terminus | “Exact scenario result” |

Rules:

1. Status travels with each event, not merely with the whole replay.
2. A documented poll close does not make later modeled batches documented.
3. Wisconsin ward totals remain LTSB population-disaggregated reconstructions. They must not be relabeled as raw ward returns or historical election-night batches.
4. Historical call events and model-generated calls are distinct event types and use distinct badges.
5. Mixed-evidence replays display a compact evidence summary and allow inspection of event provenance.
6. Video exports must include the same evidence labels as the interactive replay.

---

## 7. System architecture

### 7.1 Runtime layers

```text
EXISTING SCENARIO ENGINE
  Pure deterministic ballot transformations
        ↓
ENDPOINT LOCKER
  Validation, integer reconciliation, hashes, immutable manifest
        ↓
REPLAY COMPILER WORKER
  Unit profiles, batches, scheduling, stable event IDs
        ↓
EVENT LOG
  Append-only, versioned, deterministic
        ↓
REPLAY REDUCER
  Counted totals, outstanding estimates, geography aggregation
        ↓
DECISION DESK WORKER
  Receives only public-at-time-t information and approved priors
        ↓
PRESENTATION ADAPTERS
  3D map, desk, feed, clock, national consequence
```

### 7.2 Required modules

The implementation should create independent modules under a new `packages/election-replay` boundary or an equivalent package boundary:

- `endpoint`: validates and seals immutable election totals;
- `profile`: state, county, reporting-unit, and ballot-mode reporting behavior;
- `prng`: stable named random streams and seed derivation;
- `batching`: exact integer partitions of unit candidate totals;
- `scheduler`: poll close, activation, cadence, pauses, and stable ordering;
- `compiler`: produces the canonical event log;
- `reducer`: derives replay state from events;
- `outstanding`: estimates remaining ballots and candidate requirements;
- `projection`: makes calls without future-result access;
- `checkpoint`: supports seeking and recovery without replaying from zero;
- `provenance`: carries evidence and model versions;
- `invariants`: conservation, monotonicity, reconciliation, and blindness tests.

The React application consumes these modules through workers and selectors. It must not implement election arithmetic inside components.

### 7.3 Worker boundaries

At minimum:

1. **Scenario worker:** existing detailed-state scenario calculation.
2. **Replay compiler worker:** endpoint locking, event generation, checkpoints.
3. **Projection worker:** isolated decision-desk inputs and simulations.
4. **Optional render worker:** later off-main-thread preparation for video or dense event summaries.

The projection worker boundary is a trust mechanism. Its message contract must make it impossible to receive future candidate totals accidentally.

### 7.4 Proposed repository layout

```text
packages/
  election-replay/
    src/
      contracts.ts
      endpoint.ts
      fingerprints.ts
      prng.ts
      profiles.ts
      batching.ts
      scheduler.ts
      compiler.ts
      reducer.ts
      outstanding.ts
      projection.ts
      checkpoints.ts
      provenance.ts
      invariants.ts
      index.ts

src/
  replay/
    replayManifest.ts
    replaySelectors.ts
    replayNarrative.ts
    replayPresentation.ts
  runtime/
    replayCompiler.worker.ts
    replayCompilerProtocol.ts
    projection.worker.ts
    projectionWorkerProtocol.ts
    useElectionReplay.ts
  components/replay/
    ReplayWorkspace.tsx
    ReplayClock.tsx
    ReplayControls.tsx
    DecisionDesk.tsx
    OutstandingGeography.tsx
    ReplayEventFeed.tsx
    ReplayEvidence.tsx

data-sources/
  replay/
    pa/
    mi/
    wi/

public/data/replay/
  profiles/
  fixtures/

tests/
  election-replay.test.mjs
  replay-projection.test.mjs
  replay-fixtures/
  browser/election-night.spec.ts
```

The exact filenames may evolve, but dependency direction is fixed:

```text
data-contracts and election-model
        ↓
election-replay
        ↓
workers and application selectors
        ↓
React components and deck.gl presentation
```

The existing election model cannot import `election-replay`. The replay package cannot import React, deck.gl, browser globals, or application components. Projection contracts should live in the pure package, while the projection worker is only a transport and lifecycle owner.

---

## 8. Canonical data contracts

Names may change during implementation, but the responsibilities may not collapse.

### 8.1 Locked endpoint

```ts
interface LockedElectionEndpoint {
  schemaVersion: string;
  metadata: {
    scenarioId: string;
    scenarioFingerprint: string;
    createdAt: string;
  };
  content: {
    electionId: "us-president-2024";
    dataCompatibilityVersion: string;
    scenarioEngineVersion: string;
    candidates: CandidateDefinition[];
    evidence: EvidenceReference[];
    jurisdictions: LockedJurisdictionEndpoint[];
    nationalTotals: CandidateVoteVector;
    electoralAllocation: ElectoralAllocation;
    reconciliation: EndpointReconciliation;
  };
  contentFingerprint: string;
}
```

The endpoint contains exact final totals. It is available to the compiler but never passed wholesale to the Decision Desk.

The fingerprint is formally:

```text
contentFingerprint =
  SHA-256(UTF-8(canonicalSerialize({ schemaVersion, content })))
```

`createdAt`, `scenarioId`, `scenarioFingerprint`, and `contentFingerprint` are lock metadata and are excluded from the preimage. Locking identical election content twice therefore returns the same content fingerprint. Changing canonical evidence, a candidate vote, allocation, or a content version changes it.

### 8.2 Reporting unit endpoint

```ts
interface LockedReportingUnitEndpoint {
  unitId: string;
  parentCountyId?: string;
  jurisdictionId: string;
  unitType:
    | "precinct"
    | "vtd"
    | "ward"
    | "central-count"
    | "residual"
    | "jurisdiction-total";
  geometryStatus: "mapped" | "off-map" | "approximate" | "none";
  candidateVotes: CandidateVoteVector;
  ballotModeTotals?: Partial<Record<BallotMode, CandidateVoteVector>>;
  resultEvidence: EvidenceReference[];
}
```

If ballot-mode totals are unavailable, the compiler may use a modeled mode profile only when that fact is explicit. It may not present the modeled split as an official result.

### 8.3 Reporting profile

```ts
interface ReportingProfile {
  profileVersion: string;
  jurisdictionId: string;
  timezone: string;
  pollCloses: PollCloseRule[];
  releaseEmbargoes: ReleaseRule[];
  activationModel: ActivationModel;
  countyClasses: CountyReportingClass[];
  ballotModeModels: BallotModeModel[];
  cadenceModel: CadenceModel;
  correctionModel: CorrectionModel;
  expectedTurnoutPrior: ExpectedTurnoutPrior;
  evidence: EvidenceReference[];
  qualityTier: "documented" | "calibrated" | "provisional" | "synthetic-only";
}
```

### 8.4 Reporting event

```ts
interface ReplayEvent {
  eventId: string;
  sequence: number;
  replayTimeMs: number;
  type: ReplayEventType;
  jurisdictionId: string;
  countyId?: string;
  unitId?: string;
  ballotMode?: BallotMode;
  candidateDelta?: CandidateVoteVector;
  supersedesEventId?: string;
  evidenceStatus: EvidenceStatus;
  provenanceRef: string;
  narrativeImportance: number;
  checksum: string;
}
```

### 8.5 Replay manifest

```ts
interface ReplayManifest {
  replaySchemaVersion: string;
  replayId: string;
  endpointChecksum: string;
  reportingProfileVersions: Record<string, string>;
  batchingModelVersion: string;
  timingModelVersion: string;
  decisionDeskVersion: string;
  seed: string;
  eventLogChecksum: string;
  eventCount: number;
  durationMs: number;
  evidenceSummary: EvidenceSummary;
}
```

### 8.6 Projection snapshot

The Decision Desk may receive:

- counted candidate totals;
- public expected-vote estimates and uncertainty ranges;
- identities and nonpartisan descriptors of unreported geography;
- historical or modeled priors by geographic class and ballot mode;
- poll-close status;
- prior projection snapshots;
- known corrections already published.

It must not receive:

- future batch candidate vectors;
- locked final jurisdiction totals;
- final winner;
- future call chronology;
- a seed stream shared with the replay compiler;
- any field derived directly from the actual future vote shares.

### 8.7 Candidate completeness

The canonical endpoint and every return event carry a candidate vector, not only a two-party margin. Harris and Trump may remain the primary 2024 display pair, but the compiler must conserve every named candidate and explicit residual Other bucket.

The UI may collapse minor candidates into an expandable `Other` presentation row. That is a view transformation only. The event log, audit ledger, endpoint checksum, national popular vote, and terminal reconciliation retain the full candidate vector.

---

## 9. Endpoint lock and validation

`LOCK ELECTION` is a real validation transition, not a UI animation.

The locker must verify:

1. Every candidate total is a nonnegative integer.
2. Reporting units plus explicit residual buckets equal county totals where a complete county contract exists.
3. County totals plus explicit state residuals equal state totals.
4. State totals equal national totals.
5. Electoral allocation matches election-year rules and totals 538.
6. The state recipe fingerprint matches the verified scenario summary.
7. Every local total has one legitimate geographic or off-map owner.
8. Candidate vectors reconcile before and after serialization.
9. Data, engine, geography, and scenario versions are compatible.
10. The endpoint checksum reproduces after a save/load round trip.

Any failure aborts compilation. There is no best-effort replay of an internally contradictory election.

### 9.1 Canonical serialization

v0.21A defines one canonical JSON representation before hashing:

- candidate definitions and every candidate vector sort by candidate ID;
- jurisdictions sort by jurisdiction ID;
- counties sort by county ID;
- reporting units sort by unit ID;
- evidence records sort by evidence ID;
- electoral allocations sort by jurisdiction ID, candidate ID, then allocation district;
- evidence references sort by evidence ID;
- object keys are Unicode NFC-normalized and sorted by normalized UTF-16 code units;
- string values are Unicode NFC-normalized;
- only finite safe integers are allowed as endpoint numbers;
- negative zero serializes as zero;
- absent optional fields are omitted by the endpoint normalizer;
- explicit `null` remains distinct from absence;
- `undefined`, sparse arrays, non-plain objects, and duplicate normalized keys are rejected.

Array insertion order in an input cannot alter the canonical endpoint. Serialization must not coerce an integer vote into a floating value or silently omit an unknown candidate.

### 9.2 Versioned seed derivation

Canonical replay randomness uses `rme-prng-sha256-xoshiro128ss-v1`. The KDF input is the canonical tuple:

```text
[PRNG version, root seed, namespace, stream name]
```

SHA-256 produces the digest; its first 128 bits, decoded as four big-endian unsigned 32-bit words, seed xoshiro128**. An all-zero state is replaced by `[0x6d2b79f5, 0x1b56c4e9, 0x9e3779b9, 0x243f6a88]`. Golden test vectors make the result implementation-independent. Any algorithm change requires a new PRNG version. `Math.random()` is forbidden in canonical replay compilation.

### 9.3 Event identity and order

Canonical event identity derives from:

```text
replay schema version
+ jurisdiction ID
+ optional reporting-unit ID
+ event type
+ stable batch ordinal
```

`sequence` and `replayTimeMs` locate that identity within a particular compiled log but do not define it. Reindexing, checkpointing, slicing, or presentation grouping therefore cannot rename the underlying canonical event.

---

## 10. Realistic reporting model

### 10.1 Realism principle

Randomness is permitted only as reproducible variation around a defensible reporting process. The objective is not to make the line move constantly. The objective is to make movement emerge from which geography and ballot mode reports at a given time.

### 10.2 Named random streams

A root seed derives independent named streams:

```text
root seed
  ├─ activation/state/PA
  ├─ cadence/county/42003
  ├─ batch-size/unit/...
  ├─ composition/unit/.../mail
  └─ projection/simulation/PA
```

Adding a UI feature or compiling Michigan must not perturb Pennsylvania's already-defined event sequence. Stable stream naming prevents accidental cross-feature seed drift.

### 10.3 Unit activation

Units do not begin together. Activation is conditioned on:

- poll close and legal release rules;
- state and local reporting practice;
- county size and administrative class;
- urban, suburban, small-city, and rural classification;
- central-count versus precinct-count structure;
- ballot mode;
- timezone;
- modeled staffing and processing profile;
- documented exceptions.

Activation should occur in clusters and waves rather than evenly spaced independent draws.

### 10.4 Batch cadence

After activation, a unit may report atomically or through multiple batches. Modeled cadence should support:

- initial small test or precinct batches;
- irregular bursts;
- quiet intervals;
- correlated county updates;
- late large central-count releases;
- overnight pauses;
- provisional or cure-period tails;
- administrative corrections when explicitly enabled.

The default must not make every county rise at the same rate.

### 10.5 Exact batch partitioning

For each unit and ballot mode:

1. Choose a defensible number of batches from the reporting profile.
2. Draw positive batch weights from a seeded heavy-tailed distribution appropriate to the unit class.
3. Convert weights to integer ballot counts with a largest-remainder allocator.
4. Partition candidate totals through a conditioned multivariate bridge.
5. Assign the final remainder exactly, never through floating-point rounding.

The bridge is conditioned on the known unit endpoint. Early batches can deviate meaningfully from the final unit share because they represent heterogeneous precincts or processing cohorts, but the sequence converges and ends exactly. Volatility decreases as the unreported pool shrinks.

Where genuine sub-unit or ballot-mode totals exist, they replace the modeled bridge. Where only an atomic result is defensible, the unit reports once.

### 10.6 Geographic and historical lean

Historical lean is not applied as a second result model. The locked endpoint already determines how the unit voted. Lean metadata informs:

- plausible order of sub-cohort reporting;
- correlation among neighboring or administratively similar units;
- priors used by the Decision Desk;
- narrative importance;
- expected deviation early in the count.

It must never change the final candidate vector.

### 10.7 Early fluctuation and late convergence

The visible state margin should be capable of lead changes and sharp early movement without being arbitrary:

- early batches are smaller, compositionally heterogeneous, and less representative;
- county activation is clustered and uneven;
- vote modes can carry different endpoint-conditioned compositions;
- the sequence gradually samples more geography;
- large remaining pools place an uncertainty warning beside the current margin;
- late batches are increasingly constrained by the exact remaining candidate vectors.

The same seed produces the same fluctuations. A different seed changes the path, not the endpoint.

### 10.8 Corrections

The v0.21 default should prohibit synthetic corrections. The event schema may support a later `RETURN_REPLACED` event that supersedes an earlier published observation.

When enabled:

- corrections are explicit signed deltas;
- the reducer maintains both gross processed events and net counted totals;
- the superseded event remains in the audit log;
- negative net candidate totals are impossible;
- the final net result still equals the endpoint;
- the UI labels the correction instead of presenting it as a normal batch.

### 10.9 Terminal reconciliation

At replay completion:

- all scheduled units are terminal;
- all candidate remainders are zero;
- all county, state, and national totals match the endpoint;
- the electoral allocation matches the locked endpoint;
- all open calls are compatible with the final result;
- the event-log checksum and endpoint checksum are recorded.

The compiler must fail if a terminal reconciliation event would need to hide an earlier accounting error.

---

## 11. Poll closing and time model

The replay uses one monotonic internal clock plus jurisdiction-local display zones.

The time model must support:

- multiple poll closes within a state where legally relevant;
- no public returns before the applicable release rule;
- state-specific timezone labels;
- daylight-saving-safe timestamps;
- election date rollover after midnight;
- delayed central counting;
- overnight and next-day returns;
- cinematic compression of empty time without changing event order;
- seek by replay time or event sequence.

Every event stores replay-relative milliseconds. Wall-clock labels are derived from the replay start instant and an IANA timezone. Playback speed changes only how quickly replay time advances.

---

## 12. Outstanding-vote model

The replay reducer knows exact unreported ballots for internal rendering because it owns the compiled event log. The user-facing estimate and Decision Desk must behave differently.

Three values remain distinct:

1. **Exact internal remainder:** compiler-only accounting value.
2. **Estimated outstanding:** public model estimate with a range.
3. **Expected vote represented:** reported vote divided by the public turnout estimate, not by a hidden exact denominator.

The UI must never display an exact hidden remainder as if it were a realistic live estimate.

The public outstanding model should estimate:

- central estimate and interval;
- remaining geography;
- remaining ballot-mode composition;
- leading sources of uncertainty;
- candidate share needed across the estimated remainder;
- sensitivity if turnout finishes above or below expectation.

The estimate can revise upward or downward as new returns arrive. That revision is a feature of realism, not an accounting failure.

---

## 13. Decision Desk

### 13.1 Separation

The Decision Desk consumes a sanitized time-t snapshot and approved priors. It does not consume the compiler's future events.

### 13.2 Projection approach

The first defensible model should be a deterministic, seeded ensemble:

1. Estimate turnout remaining by unreported geographic and ballot-mode classes.
2. Update class-level vote-share priors with observed same-class returns.
3. Simulate remaining vote within explicit uncertainty bounds.
4. Apply state electoral rules to every draw.
5. Calculate winner probability, reversal risk, and sensitivity to turnout miss.
6. Require coverage, poll-close, data-quality, and anomaly gates before a call.

The seed for projection simulations is independent of the compiler seed.

### 13.3 Call states

```text
POLLING
TOO_EARLY
TOO_CLOSE
CALL_BLOCKED
PROJECTED_HARRIS
PROJECTED_TRUMP
RETRACTED
FINAL
```

`CALL_BLOCKED` should explain the reason, for example:

> 814,000 estimated votes remain in Democratic-leaning metropolitan and mail buckets. Trump leads by 132,400, but the remaining-vote interval still contains a Harris path.

### 13.4 Presets

- **Standard:** validated product default.
- **Conservative:** higher probability, geographic-coverage, and anomaly thresholds.
- **Aggressive:** lower but still disclosed thresholds.
- **Calls off:** reporting only.

Threshold numbers must be documented and tested before the preset names appear in production.

### 13.5 Call rules

- No call before the relevant poll close.
- Exact 270 and 269-269 retain their existing special national language.
- A candidate may be called while ballots remain only when the model establishes that remaining uncertainty is insufficient under the selected desk rules.
- The call card must show why the call is justified, not merely the winner.
- Documented historical calls remain separate from simulated calls.
- Retractions remain off until correction and anomaly models are validated.

### 13.6 Blindness test

The release suite must prove that two event logs with identical public snapshots through time `t`, but different future winners, produce identical Decision Desk output through time `t` when the same priors and projection seed are used.

This is the key anti-leak test.

---

## 14. Event-sourced replay state

The event log is the source of truth for the unfolding election. UI state is derived.

Core event types:

```text
REPLAY_STARTED
POLL_CLOSE
REPORTING_OPENED
RETURN_PUBLISHED
RETURN_REPLACED
COUNTY_STATUS_CHANGED
LEAD_CHANGED
OUTSTANDING_ESTIMATE_UPDATED
CALL_STATUS_CHANGED
ELECTORAL_SCORE_CHANGED
PATH_STATUS_CHANGED
REPLAY_COMPLETED
```

Derived events such as lead changes and electoral-score changes should be generated by a deterministic enrichment pass from canonical vote events. They must not duplicate candidate deltas.

Checkpoints are immutable reducer snapshots stored every fixed event count and at major events. Seeking loads the nearest checkpoint and replays the remaining short suffix. Checkpoints are caches and can always be regenerated from the manifest and event log.

---

## 15. State replay admission

Detailed-state admission and replay admission are separate gates. A state can support counterfactual modeling while lacking evidence for a historical-like reporting profile.

Every replay-ready state must document:

### Election administration

- poll-close rules and timezones;
- reporting release restrictions;
- reporting authority and result publication structure;
- precinct-count, county-count, and central-count behavior;
- mail, early, Election Day, provisional, and residual treatment;
- correction and canvass practices relevant to the replay window.

### Timing evidence

- whether timestamped returns exist;
- source and checksum for documented chronology;
- reconstruction method where chronology is partial;
- modeled timing calibration sources;
- quality tier and known blind spots.

### Local endpoint fitness

- whether local values are certified, normalized, or reconstructed;
- atomic versus defensible multi-batch units;
- off-map and non-geographic buckets;
- exact candidate and ballot reconciliation;
- local identifiers stable across timing and result sources.

### Projection priors

- expected turnout basis;
- geographic class definitions;
- vote-mode priors;
- uncertainty calibration basis;
- minimum coverage before projection;
- unsupported assumptions.

### Initial state posture

| State | Local endpoint | Initial replay posture |
|---|---|---|
| Pennsylvania | Detailed reporting units plus explicit residuals | First headless proof; timing may be modeled unless documented evidence is admitted |
| Michigan | Exact-cycle precinct and central-count exceptions | Multi-contract proof; preserve off-map and correction treatment |
| Wisconsin | LTSB reconstructed ward values | Synthetic Scenario Night only until chronology and raw local-return claims are independently supportable |

---

## 16. User experience

### 16.1 Entry

The primary flow is:

```text
BUILD SCENARIO
        ↓
REVIEW EXACT ENDPOINT
        ↓
LOCK ELECTION
        ↓
CHOOSE REPORTING PROFILE
        ↓
RUN ELECTION
```

Locking displays the scenario fingerprint, supported states, evidence mix, and any replay limitations.

### 16.2 Replay workspace

The workspace uses the Atlas editorial visual language while remaining clearly a Sandbox laboratory:

- national or state 3D map as the primary canvas;
- draggable, snap-point bottom Decision Desk;
- compact top-right score and call card;
- clear local time and replay status;
- high-contrast active event focus;
- explanatory hierarchy rather than duplicated panels.

### 16.3 3D terrain semantics

- Solid terrain represents counted ballots.
- Translucent continuation represents modeled outstanding ballots.
- Height can switch among counted ballots, estimated remaining, and flat mode.
- Color represents the currently counted candidate margin, not the final endpoint.
- Unreported geography is neutral and visibly uncertain, never secretly final-colored.
- Selecting a state removes its parent layer before clean county extrusion.
- Selecting a county replaces the county layer with legitimate reporting-unit geometry.
- Off-map buckets appear in the desk and ledger, not on invented polygons.

Height and color must always have visible legends. Reduced-motion mode removes animated extrusion and camera travel without removing information.

### 16.4 Playback controls

Required controls:

- Play / Pause
- Previous event
- Next return
- Next lead change
- Next call
- Reset
- Draggable timeline
- `0.1x`, `0.5x`, `1x`, `4x`, and `12x`
- full, condensed, highlights, and cinematic density

Speed changes must preserve all events. Density may group low-importance events visually but cannot omit them from accounting.

### 16.5 Analytical hierarchy

The bottom desk should prioritize:

1. Decision status and why.
2. Current counted margin with uncertainty prominence.
3. Expected vote represented and interval.
4. Where the race is: ranked outstanding counties or units.
5. Candidate share needed.
6. Latest consequential return.
7. Full audit feed on demand.

An early margin must never visually dominate its low coverage. At very low representation, the uncertainty treatment should be more prominent than the leader label.

### 16.6 Where the race is

For each consequential area, show:

```text
Milwaukee
249K estimated remaining
45.6% represented
Remaining vote currently modeled D 78-18
High uncertainty
```

Rows open the relevant county or reporting unit without stopping the clock unless the user has enabled pause-on-drilldown.

### 16.7 Event feed

Default prose is human-readable:

> Milwaukee added 22,481 votes and cut Trump's statewide lead by 14,106.

An expanded audit view provides candidate deltas, unit ID, evidence status, event checksum, and source/model reference.

### 16.8 Responsive and accessible behavior

- Desktop: full map plus bounded desk.
- Tablet: lower desk may expand over the map; core score remains visible.
- Mobile: map, race status, and one primary analytical card at a time.
- Keyboard access for timeline, speed, event navigation, drawer snap points, and map selections.
- Screen-reader announcements for calls, lead changes, and major returns.
- Non-color status symbols and text.
- Reduced motion and reduced transparency modes.
- No horizontal overflow at supported widths.

---

## 17. Presentation and later video

Interactive replay and exported video must consume the same event log. No separate video-only election simulation is permitted.

The presentation timeline may add:

- camera cues;
- title cards;
- explanatory annotations;
- event grouping;
- intentional pauses;
- music or narration references;
- aspect-ratio-specific layout cues.

It may not add, remove, reorder, or alter canonical election events.

Export reproducibility requires:

```text
endpoint checksum
+ replay manifest
+ event log checksum
+ presentation definition
+ renderer version
+ font and asset manifest
```

Renderer choice remains deferred until profiling. The architecture should support client capture for short clips and a later server render queue for reliable long-form exports.

---

## 18. Backend evolution

### Stage 0: local-first engine

- Static assets and versioned JSON.
- Web Workers compile and run replays.
- URLs or downloadable manifests reproduce runs.
- No account required.
- Appropriate for the private proof and deterministic testing.

### Stage 1: projects and memberships

- Authentication and verified accounts.
- Server-stored scenario and replay manifests.
- Membership plans and server-enforced entitlements.
- Private/public project visibility.
- Artifact delivery rules by dataset and user entitlement.
- Audit log for publishes and exports.

### Stage 2: live rooms

- Authoritative room clock.
- WebSocket or equivalent event distribution.
- Presenter, collaborator, and viewer roles.
- Reconnect from checkpoints.
- Deterministic room replay after completion.
- Rate limits and room capacity controls.

### Stage 3: render service

- Versioned render jobs.
- Isolated headless browser workers.
- Object storage for output and intermediate artifacts.
- Queue retries, idempotency keys, and cancellation.
- Entitlement-aware duration, resolution, watermark, and retention.

### Stage 4: public ecosystem

- Share pages and social cards.
- Public replay catalog with moderation.
- Embeds.
- Creator profiles.
- Published methodology and replay evidence manifests.

The browser remains capable of local deterministic runs even after a backend exists. The server stores, coordinates, secures, and renders; it does not become a competing election engine.

---

## 19. Versioning and reproducibility

A replay is reproducible only when these are explicit:

- endpoint schema version;
- scenario engine version;
- data compatibility version;
- reporting profile versions by state;
- batching model version;
- timing model version;
- outstanding model version;
- Decision Desk version and preset;
- replay schema version;
- root seed;
- presentation version where applicable.

Compatibility behavior is fail-closed:

- unknown major schema: reject;
- checksum mismatch: reject;
- missing state profile: exclude state or reject the requested scope explicitly;
- presentation incompatibility: replay election data with a compatibility notice only if canonical events remain valid;
- engine incompatibility: never partially restore.

Replay IDs should be content-derived references or server IDs resolving to immutable manifests. Human-readable titles are metadata, not identity.

---

## 20. Testing strategy

### 20.1 Model and invariant tests

- zero-change scenario locks to the certified baseline;
- endpoint serialization round-trips exactly;
- every candidate ballot is conserved;
- every event ID and ordering key is stable;
- every unit, county, state, and national sum reconciles;
- no event occurs before its release rule;
- identical versions and seed produce byte-identical canonical events;
- different seeds may change timing/composition but never endpoints;
- atomic units never receive fabricated intermediate percentages;
- off-map buckets never appear on map geometry;
- corrections, when enabled, preserve nonnegative net totals and terminal reconciliation;
- seek from any checkpoint matches sequential replay;
- full and condensed presentation states have identical counted totals at equal canonical sequence points.

### 20.2 Property and fuzz tests

Run hundreds or thousands of seeds against small and adversarial fixtures:

- tiny units with one ballot;
- candidates with zero votes;
- landslide and tie endpoints;
- one enormous central-count bucket;
- all units atomic;
- extreme overnight delay;
- multiple poll closes;
- incomplete geometry;
- residual statewide buckets;
- exact 270 and 269-269 national outcomes;
- maximum feasible third-party exchanges from the existing engine.

### 20.3 Projection tests

- blindness test against divergent future endpoints;
- no pre-poll-close calls;
- no call when reversal probability exceeds the preset threshold;
- correct handling of underestimated and overestimated turnout;
- safe-state call behavior under minimum coverage rules;
- no direct final-winner field in projection messages or bundles;
- documented and model calls never share a misleading label;
- fixed public snapshots and seed produce fixed projection output.

### 20.4 Golden replay fixtures

Keep small, reviewable event logs for:

- PA rural-first;
- PA metropolitan/mail-late;
- MI central-count-heavy;
- WI synthetic reconstructed-ward scenario;
- PA + MI + WI national portfolio;
- same endpoint with two reporting seeds;
- hidden-outcome run;
- one future correction/retraction fixture kept disabled until validated.

Golden fixtures assert checksums, milestones, final totals, and evidence labels without freezing incidental UI text.

### 20.5 Browser tests

- lock and launch from an existing scenario;
- play, pause, seek, reset, and speed changes;
- next return, next lead, and next call;
- state and county drilldown while the replay advances;
- drawer dragging and snap points;
- hidden outcome never leaks through labels, colors, URLs, accessibility text, or tooltips;
- reload from manifest reproduces the same event sequence;
- unsupported replay profile fails honestly;
- responsive layouts at existing canonical widths;
- keyboard and reduced-motion journeys;
- WebGL ownership remains singular across navigation.

### 20.6 Performance and lifecycle gates

Before v0.21E closes, establish measured budgets for:

- compile latency by event count;
- main-thread blocking during compile and playback;
- reducer step p95;
- seek latency from checkpoints;
- frames missed during extrusion and camera transitions;
- retained heap after repeated replay reset and state switching;
- worker, animation-frame, timer, and listener counts;
- geometry cache bounds;
- long replay memory growth;
- event-log serialization size.

The existing 35-cycle PA/MI/WI lifecycle profile becomes the baseline. Replay tests add repeated compile, start, seek, complete, reset, state-switch, and teardown cycles. Every worker, timer, animation frame, and deck.gl layer must have an explicit owner and cleanup path.

### 20.7 Human evaluation

The deferred end-to-end human study must eventually add tasks for:

- interpreting early margins under low reporting;
- distinguishing counted from estimated outstanding;
- explaining why a race remains uncalled;
- identifying documented versus modeled events;
- comparing two seeds with the same endpoint;
- finding the geography responsible for a lead change;
- recognizing that speed and presentation do not alter the election.

Run My Election cannot be considered public-production-ready from automated and AI evaluation alone.

---

## 21. Security, privacy, and abuse controls

Local manifests and future uploads are untrusted input.

Required controls:

- schema validation with strict numeric and collection limits;
- no executable scripts or arbitrary expressions in replay definitions;
- bounded event counts, durations, geography references, and title lengths;
- checksum verification for immutable artifacts;
- content-type and decompression limits;
- server-side entitlement checks for paid features;
- private-by-default projects for future accounts;
- explicit publish action;
- signed or server-verified public replay manifests;
- audit logs for exports and public releases;
- no personal voter records or individual-level targeting data;
- aggregate election data only.

Future live rooms require role checks, rate limits, reconnect tokens, and authoritative server clocks. Future render jobs require process isolation and cannot fetch arbitrary user URLs.

---

## 22. Delivery, licensing, and trust gate

Private engineering may use the current repository under the existing containment posture. Before public, participant, or paid detailed-state delivery:

1. Resolve the exact PA/MI artifact delivery basis or replace those artifacts with an approved architecture.
2. Re-run the public exposure inventory for replay artifacts, caches, event logs, videos, and source maps.
3. Verify that exported replays do not redistribute restricted local result derivatives unintentionally.
4. Complete end-to-end human testing.
5. Pass security, accessibility, performance, and privacy review.
6. Publish methodology for modeled timing, outstanding estimates, and projections.
7. Display source and evidence status in the product and exported media.

Membership does not solve data rights. Moving a file behind login or payment is still delivery and requires an explicit supported basis.

---

## 23. Release sequence

### v0.21A: Replay contracts and endpoint lock

**Goal:** Prove the architecture without building the polished election-night UI.

Deliverables:

- decision record accepting the subsystem boundary;
- `election-replay` package skeleton;
- endpoint, profile, event, manifest, snapshot, and provenance contracts;
- PA fixture endpoint produced from the existing deterministic scenario engine;
- exact lock validation and checksums;
- named PRNG streams;
- fail-closed version compatibility;
- initial invariant tests.

Exit criteria:

- zero-change and complex PA scenarios lock exactly;
- invalid reconciliation cannot compile;
- serialized endpoint reproduces its checksum;
- no React component is required to execute the proof.

### v0.21B: Headless Pennsylvania event compiler

**Goal:** Compile a locked Pennsylvania endpoint into deterministic atomic reporting events that start at zero and finish at the exact endpoint.

Deliverables:

- synthetic-only rural-first and metropolitan-late Pennsylvania profiles;
- explicit poll close and completion control events;
- candidate-blind unit activation and irregular cadence;
- one indivisible return per existing locked reporting unit;
- canonical event ordering and stream fingerprinting;
- headless unit, county, off-map, prefix, and statewide audit.

Exit criteria:

- both presets change schedules without changing event identity or votes;
- every event stream finishes at exact unit, county, candidate, off-map, and statewide totals;
- same content, configuration, and seed are byte-reproducible;
- changed lock metadata and shuffled input collections reproduce the same stream;
- no unsupported event is labeled documented and no fabricated batch precision exists.

### v0.21C: Multi-jurisdiction replay contracts

**Goal:** Define how independently valid jurisdiction streams can coexist without compiling another detailed state.

Deliverables:

- generic compiled-jurisdiction envelope and byte-identical Pennsylvania round-trip;
- explicit detailed, coarse, and future hybrid geography capability;
- source-unit, map-unit, and residual-treatment metadata;
- canonical absolute clock and timezone-safe ordering contract;
- endpoint, compiler, profile, definition, stream, and evidence trace;
- honest atomic coarse fixture and deterministic partial composition fixture.

Exit criteria:

- Pennsylvania golden stream fingerprints remain unchanged;
- detailed and coarse jurisdictions fail closed under incompatible capability claims;
- composition is independent of input, worker-completion, and filesystem order;
- accepted jurisdiction votes sum exactly and the locked election retains 538 EV;
- same local IDs and PRNG streams cannot collide across jurisdictions;
- no detailed Michigan compiler, national vote generator, reducer, or UI is introduced.

### v0.21D: Headless Michigan event compiler

**Goal:** Prove that the generic replay contract survives a second detailed jurisdiction with a materially different geography contract.

Deliverables:

- certified and complex Michigan endpoint goldens from the existing scenario engine;
- synthetic-only uniform-wave and metropolitan-late Michigan profiles;
- candidate-blind scheduling over workload, geography identity, and unit type;
- one indivisible return per 4,413 locked Michigan model units;
- explicit retention of central-count, unmatched, and statewide adjustment units;
- exact five-candidate unit, county, state, and prefix conservation;
- generic Michigan admission and a detailed PA+MI composition fixture.

Exit criteria:

- both Michigan goldens are byte-reproducible and frozen;
- Pennsylvania golden stream fingerprints remain unchanged;
- Michigan geography never claims Pennsylvania VTD semantics;
- event and PRNG identities remain isolated across states;
- composition remains input-order and worker-completion-order independent;
- the headless package remains React/deck.gl-free and contains no `Math.random()`.

### v0.21E: Headless national replay composition

**Goal:** Prove that all 51 locked jurisdictions can coexist on one deterministic zero-to-endpoint timeline while detailed jurisdictions remain detailed and unsupported jurisdictions remain honestly coarse.

Deliverables:

- one complete 51-jurisdiction locked endpoint and deterministic composition;
- Pennsylvania and Michigan retained as independently compiled detailed streams;
- 49 honest coarse streams with one exact statewide five-candidate return each;
- versioned poll-close and atomic-return eligibility rules;
- exact jurisdiction, national-prefix, candidate, and 538-EV reconciliation;
- frozen certified and complex national endpoint and stream fingerprints;
- generic audit, tamper rejection, deterministic serialization, and evidence lineage.

Exit criteria:

- exactly 51 jurisdictions are admitted once, with two detailed and 49 coarse capabilities;
- no coarse stream claims invented county, precinct, batch, percentage, or map geography;
- input order, completion order, lock metadata, and repeated runs cannot change output;
- permissible national seed changes affect coarse timing only;
- Pennsylvania and Michigan stream goldens remain unchanged;
- every jurisdiction reconciles independently and cross-state compensation fails closed;
- coarse multi-boundary returns cannot publish before their latest represented close;
- the package remains headless and the reducer remains absent.

### v0.22A: Headless replay reducer

**Goal:** Consume a verified national stream from zero reported votes to its exact endpoint through one deterministic, future-isolated state transition function.

Deliverables:

- canonical zero state and one-event transition law;
- sequential application, checkpoint restore, and arbitrary reseek equivalence;
- exact jurisdiction and national candidate totals at every prefix;
- deterministic completion at the locked endpoint;
- no access to unapplied future return vectors through reducer output;
- tampered, out-of-order, duplicated, or incompatible events fail closed;
- normalized jurisdiction, county, detailed-unit, mapped, and off-map reported state;
- versioned state and checkpoint fingerprints with certified and complex goldens;
- measured full-reduction, checkpoint-seek, and serialized-memory baseline;
- no calls, Decision Desk, UI, animation, or map integration.

Exit criteria:

- both accepted national streams reduce from zero to their exact endpoint;
- every prefix contains only applied votes and remains within its final stream vector;
- identical prefixes with different futures have byte-identical observable state;
- checkpoint and zero-state reconstruction agree at arbitrary positions;
- backward seek uses forward reconstruction and never inverse vote arithmetic;
- all 51 jurisdiction completions and the complete stream are required for national completion;
- performance and memory are measured without changing semantics;
- the package remains headless and future analytics remain absent.

### v0.22B: Derived reported-state analytics

**Goal:** Derive factual election-night summaries using only the applied observable reducer state.

Potential scope:

- reported-vote leader and exact reported margin;
- reported candidate shares computed only from reported votes;
- exact units and returns published;
- factual geographic progress without endpoint-based ballot percentages;
- deterministic analytics serialization and prefix-isolation tests.

Still excluded: remaining or expected vote, projections, calls, Decision Desk inference, UI, map animation, and backend work.

The analytics layer passed supervisor review. The interactive Election Night workspace remains a separately authorized milestone.

### v0.22C: Headless seek/checkpoint optimization

**Goal:** Reduce arbitrary reducer reconstruction cost without changing reducer or analytics meaning.

Deliverables:

- immutable process-local checkpoint index;
- deterministic configurable event cadence;
- arbitrary event-position and absolute-time seek;
- backward seek through checkpoint restore plus canonical forward reduction;
- certified and complex random-position equivalence torture tests;
- history-independent hostile backward/forward seek verification;
- preservation of all frozen v0.22A reducer and v0.22B analytics fingerprints;
- cold, early, midpoint, near-final, random, and repeated-seek benchmarks;
- construction, runtime-memory, and logical-storage evidence;
- no analytics cache, persistence format, alternate state authority, or UI dependency.

Exit criteria:

- full-prefix and indexed reconstruction serialize byte-identically at every tested position;
- derived analytics also serialize and fingerprint identically;
- foreign, untrusted, and invalid indexes fail closed;
- each indexed seek applies no more than the configured tail bound;
- realistic midpoint, late, and random workloads demonstrate measured improvement on both fixtures;
- checkpoints remain subordinate to the canonical reducer and process-local only.

### v0.22D: Headless deterministic playback cursor/controller

**Goal:** Express replay movement as pure logical commands without importing a wall clock or presentation runtime.

Deliverables:

- immutable paused, playing, and complete cursor states;
- explicit play, pause, reset, logical-time advance, event/time seek, and next-timestamp commands;
- safe-integer canonical time boundaries;
- partition-independent logical advancement;
- simultaneous-event atomicity across advancement, seek, and step;
- deterministic completion and reopening semantics;
- process-local cursor validation and hostile-command rejection;
- preservation of canonical reducer and analytics output;
- controller workload benchmarks on certified and complex fixtures;
- no timer, animation frame, UI, map, analytics cache, or Decision Desk dependency.

Exit criteria:

- identical total logical advancement produces identical state under arbitrary integer partitions;
- no cursor exposes a partial simultaneous timestamp group;
- forward, backward, reset, complete, and replay command sequences reproduce;
- malformed, untrusted, and cross-stream commands fail closed;
- all controller paths remain subordinate to the canonical reducer and seek index;
- performance is recorded without revisiting the accepted v0.22C cadence.

### v0.22E: Headless sanitized playback observation contract

**Goal:** Define exactly what future presentation may observe at the current canonical moment without exposing replay authority or future knowledge.

Deliverables:

- current-only immutable playback snapshot;
- applied-interval-only immutable playback transition;
- controller status, current logical time, and applied event count;
- accepted national and jurisdiction reported analytics;
- compact currently reported counties and published detailed units;
- newly observed timestamp groups and changed jurisdictions;
- canonical serialization, fingerprints, and fail-closed validation;
- identical-prefix and identical-transition divergent-future blindness tests;
- no stream identity, final boundary, next event, endpoint, remaining structure, transport, or presentation behavior.

Exit criteria:

- presentation cannot distinguish certified and complex streams before their observable prefixes diverge;
- transitions cannot reveal how the next timestamp or final election differs;
- play/pause affects controller metadata but not election knowledge;
- backward/reset movement exposes no newly observed group;
- accepted v0.22B analytics remain the only leader/margin/share implementation;
- serialized current-state growth and transition costs are measured honestly;
- the module defines what is observable, never how it is delivered.

### v0.21F: Interactive Election Night workspace

**Goal:** Turn the verified headless engine into the Atlas-quality experience.

Deliverables:

- Run Election entry after scenario lock;
- 3D counted/outstanding terrain modes;
- draggable Decision Desk;
- replay clock and timeline;
- required speeds and event jumps;
- state/county/reporting-unit drilldown;
- event feed and audit view;
- responsive, keyboard, reduced-motion, and non-color states;
- deterministic manifest restore.

Exit criteria:

- no design or functionality regression in the existing Sandbox laboratory;
- replay interaction never mutates the saved scenario recipe;
- hidden future results do not leak through any visible or accessibility surface;
- browser, visual, accessibility, lifecycle, lint, and build gates pass.

### v0.21G: Reporting Studio and hidden outcome

**Goal:** Let users control the night while preserving the election.

Deliverables:

- reporting presets;
- county and defensible unit ordering;
- timing adjustments with validation;
- seed control and reroll;
- hidden outcome mode;
- side-by-side same-endpoint comparison;
- downloadable replay manifest.

Exit criteria:

- editing order and timing cannot change endpoint checksums;
- two different configurations make meaningfully different nights;
- hidden outcome survives reload without leaks;
- custom schedules cannot violate poll-close and conservation rules unless explicitly in a separately labeled experimental mode.

### v0.22: Production service foundation

Begin only after the local engine proves useful.

Potential deliverables:

- accounts, projects, and server-side manifest storage;
- memberships and entitlements;
- private share links;
- publish audit and delivery-policy enforcement;
- job model for later exports;
- operational monitoring and backups.

### Later releases

- calibrated historical replay where evidence supports it;
- additional replay-ready states;
- live rooms and presenter mode;
- manual result construction with explicit geographic reconciliation;
- Director Mode;
- client and server video export;
- public replay ecosystem after all release gates.

---

## 24. Risk register

| Risk | Consequence | Mitigation |
|---|---|---|
| Randomness becomes decorative | Replay feels fake | Condition variation on geography, mode, administration, and exact endpoints |
| Projection leaks final result | Calls are fraudulent | Isolated sanitized worker contract and divergent-future tests |
| State profiles become generic | Every state feels identical | Separate replay admission and state-specific contracts |
| Exact internal remainder is shown as live knowledge | False realism | Separate internal accounting from public outstanding estimates |
| 3D height obscures geography | Visual novelty harms comprehension | Visible legend, flat mode, bounded camera, user testing |
| Early leader appears authoritative | Users misread low-coverage margins | Uncertainty hierarchy dominates at low representation |
| Event volume overwhelms browser | Jank and memory growth | Workers, chunking, checkpoints, density views, explicit budgets |
| Reconstructed data is mistaken for official | Trust failure | Event-level evidence status and export disclosures |
| Video renderer diverges from interactive replay | Two sources of truth | One canonical event log and versioned presentation layer |
| Backend arrives too early | Slower iteration and needless operations | Local-first v0.21; backend only for genuine server jobs |
| Membership is mistaken for rights clearance | Legal and trust exposure | Delivery gate applies regardless of authentication or payment |
| Human testing remains deferred indefinitely | Serious comprehension problems survive | Mandatory end-to-end human gate before public or paid release |

---

## 25. Definition of done

The election-night system is complete only when a user can:

1. Build a deterministic multi-state scenario.
2. Review and lock an exact endpoint.
3. Choose a defensible reporting profile.
4. Begin with zero reported votes.
5. Watch irregular local returns aggregate into counties, states, the national popular vote, and the Electoral College.
6. Understand counted vote, estimated outstanding vote, and uncertainty as separate concepts.
7. Receive calls made without future-result access.
8. Inspect why a state is called or blocked.
9. Navigate national, state, county, and legitimate reporting-unit geography while the clock runs.
10. Change seed, reporting order, timing, speed, density, and camera without changing the endpoint.
11. Hide the outcome without leaks.
12. Reproduce the run from its versions, endpoint checksum, configuration, and seed.
13. Finish at the exact locked candidate totals with a passing audit.
14. Export or render from the same canonical event log.
15. Pass deferred human testing and all delivery gates before public or paid use.

---

## 26. Exact next action

v0.21A through v0.22E have passed supervisor review. v0.22F established the worker boundary, v0.23A integrated the first visible three-state replay, and v0.23B added bounded active-session caching plus current-only local return explanations. The current evidence is recorded in `docs/review/v0.23b-election-night-refinement/VERIFICATION.md`.

The next action is supervisor review of that exact candidate, followed by a bounded v0.24 return to the Swingometer model roadmap. The demographic inputs and slider semantics should be audited before population editing, uncertainty, or further state expansion.

Decision Desk modeling, projections, calls, backend, memberships, live rooms, and video export remain out of scope until separately authorized.

The completed v0.22A proof is deliberately simple:

```text
IMMUTABLE NATIONAL EVENT STREAM
        ↓
CANONICAL ZERO STATE + STRICT PURE REDUCER
        ↓
APPLIED-FACT-ONLY OBSERVABLE STATE
        ↓
EXACT PREFIXES, SEEKS, AND FINAL ENDPOINT
```
