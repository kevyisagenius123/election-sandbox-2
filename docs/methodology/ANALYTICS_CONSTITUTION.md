# Sandbox 2.0 Analytics Constitution

Date adopted: 2026-08-23

## Purpose

Sandbox analytics must help a user understand what changed, where it changed, and which explicit assumption produced the change. Visual sophistication may never upgrade an estimate into a fact or a mathematical possibility into a prediction.

This constitution governs the Swingometer, Election Night, contribution analysis, Electoral College analysis, future demographic models, and any later Decision Desk.

## The six semantic classes

Every analytic belongs to exactly one class. The class is part of the data contract, not merely interface copy.

| Class | Meaning | Permitted examples |
| --- | --- | --- |
| `certified` | Published endpoint evidence | Certified candidate totals, final county totals, electoral votes |
| `reported` | Information observable at the current replay prefix | Counted ballots, current leader, published returns, current reported margin |
| `scenario` | Exact arithmetic caused by user instructions | Added turnout ballots, transferred two-party ballots, scenario endpoint margin |
| `derived` | Deterministic arithmetic using only identified inputs | Contribution ranking, outstanding-to-margin ratio, route to 270 |
| `modeled` | An estimate requiring assumptions beyond direct arithmetic | Expected vote, demographic response estimate, uncertainty interval |
| `decision` | A consequential judgment made under an approved decision policy | Call, hold, retract, projected winner |

An analytic cannot move to a stronger class because its presentation looks authoritative. A modeled value remains modeled even when deterministic for a given seed.

## Required analytic envelope

Every reusable analytic must expose or inherit the following contract:

```ts
type AnalyticEnvelope = {
  id: string
  semanticClass: "certified" | "reported" | "scenario" | "derived" | "modeled" | "decision"
  status: "available" | "partial" | "unavailable"
  value: number | string | null
  unit: "votes" | "ballots" | "percentage-points" | "share" | "returns" | "electoral-votes" | "duration"
  geography: string
  timeScope: "endpoint" | "current-prefix" | "selected-window"
  candidateScope: readonly string[]
  numerator?: string
  denominator?: string
  sourceIds: readonly string[]
  transformVersion: string
  uncertainty?: {
    method: string
    interval?: readonly [number, number]
    calibrationEvidence: readonly string[]
  }
  caveat?: string
}
```

The product may use a compact serialized representation, but these meanings must survive serialization and display.

## Constitutional rules

### 1. One authority per value

The same named metric cannot have separate frontend, backend, and service formulas. Computation belongs in a headless deterministic module. Interfaces render its output.

### 2. No future leakage

Election Night analytics may consume only the replay prefix currently observable to the user. Final endpoints may be used for explicit model bookkeeping such as a known synthetic expected-vote denominator, but never to infer a hidden winner, future return, or unreported candidate share.

### 3. Endpoint and current state are different objects

`Scenario endpoint margin` and `current reported margin` must never share an unlabeled field. The certified baseline, scenario endpoint, and replay prefix must remain separately identifiable.

### 4. Every percentage names its denominator

At minimum, distinguish:

- reporting units published;
- modeled ballots represented;
- candidate share of all counted ballots;
- two-party candidate share;
- turnout as ballots divided by the disclosed population basis.

The interface must not use the generic label `percent reporting` when more than one denominator exists.

### 5. Conservation precedes interpretation

Vote totals must remain nonnegative integers and reconcile from reporting unit to county, state, and national scope. Candidate-complete arithmetic precedes two-party summaries.

### 6. Zero is not missing

Unavailable evidence renders as unavailable. It never silently becomes zero, 50 percent, an even race, or a neutral forecast.

### 7. Mathematical openness is not flip risk

If outstanding ballots exceed a current margin, the trailing candidate has a mathematical path. That does not quantify the likelihood of a flip. The accepted label is `mathematically open` unless a calibrated probabilistic model exists.

### 8. Contribution is signed and causal wording is bounded

A contribution ledger may say that a modeled operation produced a margin change in a geography. It may not claim that a demographic group caused an observed election outcome. Rankings must retain sign, operation identity, geography coverage, and off-map residuals.

### 9. Time analytics use canonical events

Return pace, latest movement, and stalls must be derived from canonical replay events and logical time windows. They may not depend on React render cadence, request polling frequency, playback speed, or wall-clock scheduling.

### 10. Probability requires calibration

No value may be called probability, confidence, risk, or uncertainty unless:

1. the stochastic quantity is defined;
2. the assumptions and training or prior data are identified;
3. out-of-sample calibration has been measured;
4. the interval or probability reproduces from a versioned artifact;
5. known failure modes are disclosed.

A hand-tuned score is a score, not a probability. A deterministic heuristic is not an ML ensemble.

### 11. Decision outputs are a separate product layer

A future Decision Desk may consume reported and modeled analytics, but a call is not an ordinary chart annotation. Call policy, evidence thresholds, chronology, overrides, and retractions require their own contract and verification.

### 12. Presentation cannot outrun evidence

Three-dimensional displays are permitted only when height, color, and selection each encode a defined analytic. Decorative analytical terrain, invented uncertainty volumes, and unlabeled composite scores are prohibited.

## Context rules

### Swingometer

The primary comparison is:

```text
certified baseline
→ explicit user operation
→ exact scenario endpoint
→ signed geographic contribution
→ Electoral College consequence
```

The Swingometer may calculate requirements and counterfactual consequences. It does not predict voter behavior unless a separately approved modeled layer is active.

### Election Night

The primary comparison is:

```text
zero reported
→ current observable replay prefix
→ newest atomic return
→ current geographic and statewide arithmetic
```

Election Night may display current leaders, counted ballots, return progress, return pace, and exact local movement. It must not expose the hidden scenario endpoint through analytics.

### Demographics

Population evidence, allocation coverage, and scenario response are separate concepts. `Data coverage`, `model fit`, and `electoral uncertainty` may never be collapsed into one confidence score.

## Release gates for a new analytic

Before display, every new metric must prove:

1. a named semantic class;
2. an explicit numerator, denominator, unit, geography, and time scope;
3. one authoritative implementation;
4. deterministic serialization where applicable;
5. endpoint or prefix conservation;
6. missing-data behavior;
7. adversarial tests against future leakage and source drift;
8. truthful interface copy at desktop and mobile sizes;
9. no implication of probability or causality beyond its evidence;
10. a documented removal or degradation state when prerequisites are absent.

## Standing prohibition

Until a later calibrated-model review explicitly authorizes them, Sandbox 2.0 will not display win probabilities, automated race calls, bellwether accuracy, county predictive importance, projected completion times, or partisan estimates of unreported votes.
