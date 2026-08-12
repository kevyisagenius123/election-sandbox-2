# Decision 0018: Target-aware Electoral College consequence ledger

**Status:** Accepted  
**Release:** v0.15

## Context

The v0.14 portfolio can aggregate several detailed state scenarios, but a national score alone does not explain what the assumptions did to the election. Active states also need to remain visible when their modeled margins change without changing an electoral allocation.

Path to 270 will eventually calculate Required state movements. Before that work begins, the product needs a deterministic account of consequences produced by states the user has actually Modeled.

## Decision

The application derives a target-aware Electoral College consequence model from three canonical inputs:

1. certified state results;
2. the verified multi-state scenario aggregate;
3. the set of active state recipes.

The target candidate is explicit and is stored in URL schema 2. Schema 1 retains its original Harris-default semantics. Scores, changed-state rows, threshold distance, and causal language are derived locally and are not serialized as additional sources of truth.

Every active state receives a ledger row containing its Actual margin, Scenario margin, winner change, election-year EV allocation, and EV consequence from the target candidate's perspective. A state remains in the ledger with `0 EV` when its modeled result changes but its winner does not.

Threshold classification is deterministic:

- `exact-majority`: the target has exactly the minimum majority, 270 of 538 in 2024;
- `above-majority`: the target exceeds that threshold and the interface reports EV above it;
- `below-majority`: the target has not reached it and the interface reports EV still required;
- `tie`: both candidates have the same EV total below a majority, including 269–269 in 2024.

A tie is never treated as a target victory. National aggregation must preserve the certified election-year total allocation or fail closed.

The causal sentence is generated from consequence rows rather than free-form text. It reports target EV gained or lost and the states whose winners changed. If active states do not flip, it explicitly says their modeled changes produced no Electoral College allocation change.

## Consequences

- The product explains causality instead of displaying only a scoreboard.
- Negative target movement is visible and uses signed EV consequences.
- State modification and electoral consequence remain distinct concepts.
- Shared schema-2 URLs restore the target and deterministically rebuild the same score and ledger.
- Route enumeration can consume the same target and threshold contract in v0.16 without redefining portfolio results.

## Verification

- Model tests cover exact 270, 269–269, above-majority distance, negative EV movement, active-but-unflipped state rows, and allocation failure.
- Browser replay covers Harris and Trump target perspectives, signed two-state consequences, reload persistence, state switching, and a zero-EV active state.
- Desktop and 390-pixel mobile visual QA show no horizontal overflow and retain readable ledger hierarchy.
