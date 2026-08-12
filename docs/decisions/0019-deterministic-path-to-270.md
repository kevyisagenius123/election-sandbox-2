# Decision 0019: Deterministic Path to 270 routes

**Status:** Accepted  
**Release:** v0.16

## Context

The v0.15 consequence ledger explains what the user's detailed state scenarios did to the Electoral College. It does not yet answer which additional state movements could give the selected target candidate a majority.

A route must remain mathematically honest. Most states do not have a production-ready county or reporting-unit foundation in this repository, and Maine and Nebraska split electoral votes by congressional district. The interface therefore cannot imply local geographic precision or winner-take-all allocation where the data contract does not support it.

## Decision

The application derives Path to 270 from the current verified national scenario, the explicit target candidate, and the election-year electoral allocation.

For each eligible state not currently allocated to the target, the engine calculates:

- the state's target-signed current margin;
- the smallest integer improvement in `target votes - opponent votes` needed to move past a tie;
- the equivalent required margin-point movement under the current total vote count;
- the electoral votes gained if the statewide allocation changes;
- whether a production detailed-state model exists;
- its current Actual or Modeled classification and its Required route classification.

Required is a mathematical classification. It is not a turnout model, persuasion model, probability, forecast, or geographic allocation.

The search caps accumulated electoral votes at the target's remaining need and keeps a bounded Pareto set of competitive partial combinations. Completed routes have stable tie breakers and can be ranked by:

1. fewest states;
2. aggregate required margin-point movement;
3. aggregate required net margin votes.

The selected metric remains visible and is persisted in URL schema 2. The engine returns a small ranked set rather than exposing an unbounded national subset search.

Route completeness is explicit:

- **Mathematical** when the route contains Required movements and no existing target-gain Modeled state;
- **Partially modeled** when verified Modeled target gains already contribute to the current score and Required states remain;
- **Fully modeled** only when no Required movement remains.

If the target already holds a majority, the engine returns no Required route. A supported PA or MI requirement may open that state's detailed laboratory, but the state remains Required until a verified user scenario actually changes its allocation. Unsupported states do not receive a drilldown affordance.

Maine and Nebraska are excluded from route enumeration until congressional-district results and allocation rules are modeled. Their statewide totals are not substituted for district-level electoral votes.

## Consequences

- The national portfolio now answers both what changed and what could mathematically complete a majority.
- Route ordering is reproducible across reloads and shared links.
- Users can compare state-count efficiency with statewide movement and vote-volume efficiency.
- The interface does not invent county, precinct, or demographic sources for unsupported states.
- The next release can turn a supported Required row into a Modeled result through the existing detailed state laboratory without changing route arithmetic.
- The bounded frontier is deliberately a product-scale deterministic search, not an exhaustive proof that every possible national subset was retained.

## Verification

- Model tests verify exact net margin-vote arithmetic, exact-270 projection, metric-dependent stable ordering, split-allocation exclusion, and the already-majority case.
- Browser replay verifies a Pennsylvania and Michigan portfolio produces a Wisconsin route to exactly 270, preserves the Actual to Required distinction, and restores the chosen ranking metric after reload.
- Model tests, seven browser replays, lint, and the production build pass for v0.16.
