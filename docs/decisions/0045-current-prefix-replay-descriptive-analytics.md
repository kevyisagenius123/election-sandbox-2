# Decision 0045: Current-prefix replay descriptive analytics

Date: 2026-08-23

## Decision

Sandbox 2.0 will derive Election Night diagnostics from the observed canonical event prefix, the matching reducer state, explicit logical replay time, and user-supplied progress denominators.

The headless contract may describe:

- the newest published return;
- five-, fifteen-, and thirty-minute logical windows;
- ballots and returns published in each window;
- return and represented-ballot progress as separate ratios;
- current county and reporting-unit margins;
- recent county and reporting-unit movement;
- whether the current reported margin is still mathematically open under the explicit modeled-ballot denominator;
- chronology stalls under an explicit user-selected threshold.

## Contract law

- The derivation receives only observed events, never the complete replay stream.
- The observed event prefix must reconcile exactly to national, jurisdiction, mapped, off-map, county, and reporting-unit reducer state.
- Events must preserve canonical sequence, identity uniqueness, time order, and poll-close, return, and completion lifecycle order.
- Time windows are start-exclusive and end-inclusive.
- Publication rates are integer milli-units calculated from logical replay time, never wall time.
- Return-count progress and represented-ballot progress remain distinct and carry explicit denominators.
- Missing denominators remain unavailable and cannot be inferred.
- Mathematical openness is arithmetic, not a probability, projection, or race call.
- A chronology stall is an explicit elapsed-time diagnostic, not evidence of data failure or candidate advantage.
- Canonical serialization and SHA-256 fingerprints bind the complete descriptive output.

## Consequences

- Election Night can now explain what has arrived, where movement occurred, and whether the synthetic count has paused without exposing the hidden endpoint.
- The visible Election Night interface remains unchanged in v0.25C.
- v0.25D may present these diagnostics in the shared Atlas-style workspace and bottom dock without reimplementing their arithmetic in React.
