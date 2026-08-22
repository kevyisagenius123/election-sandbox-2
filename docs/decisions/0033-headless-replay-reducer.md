# 0033: Reduce the immutable national stream without exposing its future

Date: 2026-08-21

## Status

Accepted by the product owner after the supervisor passed v0.21E and authorized bounded v0.22A.

## Decision

The pure replay package may introduce current election-night state through one strict transition:

```text
validation context + previous state + next canonical event
                        ↓
                  next reducer state
```

The reducer understands only `POLL_CLOSE`, `RETURN_PUBLISHED`, and `REPLAY_COMPLETED`. It accumulates reported facts. It does not derive leaders, margins, percentages, remaining vote, expected vote, calls, projections, or Electoral College consequences.

## Context and observable-state boundary

Immutable reducer context may hold the admitted stream, endpoint identity, canonical candidate order, hierarchy contracts, and final totals required to reject invalid events and premature completion. Those validation facts are never copied wholesale into observable state.

Observable state contains only:

- canonical replay position;
- reported five-candidate vote vectors and exact return counts;
- poll-close and completion lifecycle facts that have occurred;
- normalized jurisdiction and county aggregates;
- sparse detailed-unit aggregates for published returns;
- mapped and explicit off-map reported totals;
- factual national completion after all requirements are met.

It contains no endpoint object, final totals, remaining-vote subtraction, reported percentage, leader, winner, projection, or call.

Two streams with the same applied prefix must therefore produce byte-identical observable state even when their valid suffixes and source-stream identities differ.

## Zero and hierarchy law

The canonical zero state has zero reported votes and returns, no closed polls, no completed jurisdiction, no last event, and zero events applied. All 51 jurisdictions and all 150 detailed counties are explicit zero aggregates. Detailed units use a normalized sparse store: absence means the known unit's canonical five-candidate zero state until its atomic return publishes.

A valid detailed return affects its unit, applicable county, jurisdiction, and national aggregate. A coarse return affects only its jurisdiction and national aggregate. Michigan and Pennsylvania off-map units retain their locked off-map identity and are never assigned invented terrain.

## Lifecycle and arithmetic law

Normal application requires the exact next global sequence and byte-exact admitted event. Missing, reordered, duplicated, modified, unknown, or post-completion events fail closed.

`POLL_CLOSE` changes no votes and may occur once per jurisdiction. `RETURN_PUBLISHED` requires the jurisdiction's poll-close fact and adds exactly its five-candidate vector. `REPLAY_COMPLETED` is an assertion: the jurisdiction's applied returns must already equal its admitted endpoint vector, total, and return count.

National completion requires all 51 jurisdictions, the complete canonical event stream, and exact national five-candidate and total-vote reconciliation. Every arithmetic operation remains a non-negative safe integer.

## State identity and checkpoints

Reducer schema and implementation versions are:

```text
rme-reducer-state-v1
rme-headless-reducer-v1
```

Canonical state fingerprints bind the reducer version, source national-stream fingerprint, replay position, and observable state.

Checkpoints bind:

- checkpoint and reducer versions;
- source-stream fingerprint;
- events applied and last sequence;
- complete reducer state;
- state fingerprint;
- checkpoint fingerprint.

Checkpoint cadence is a performance choice and cannot change results. A checkpoint is accepted only if it belongs to the same stream and equals canonical zero-to-prefix reconstruction. Backward seeking reconstructs forward from the nearest checkpoint; no inverse vote mutation exists.

## Frozen reducer states

The certified and complex fixtures freeze state fingerprints at zero, event 1, event 100, event 1,000, midpoint, and final completion. The exact values are recorded in `tests/replay-fixtures/reducer-goldens.mjs` and the v0.22A verification package.

## Performance posture

v0.22A records a first benchmark rather than imposing an unreviewed performance gate. The baseline uses a 500-event checkpoint cadence and measures seven full reductions plus 100 deterministic seek positions. Serialized checkpoint memory is intentionally reported without hiding its cost. Optimization or a compact checkpoint representation requires a later measured decision and may not change reducer semantics.

## Prohibited scope

v0.22A does not authorize reported leader or margin analytics, percent reporting, outstanding or expected vote, Decision Desk inference, projections, calls, electoral-call allocation, election winner, React, deck.gl replay layers, playback animation, a user-facing timeline, camera behavior, reporting-order editing, Studio, video, backend, accounts, memberships, or deployment changes.

The proposed next milestone is separately authorized v0.22B derived reported-state analytics. It may derive only facts from applied reducer state and must not gain endpoint or future-event access.
