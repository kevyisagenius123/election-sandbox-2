# Decision 0020: Geographic route construction from verified state recipes

**Status:** Accepted  
**Release:** v0.17

## Context

The v0.16 route engine can calculate statewide combinations and exact target-margin requirements, but a route remains purely mathematical. Pennsylvania and Michigan already have audited detailed foundations capable of testing whether explicit turnout, preference, and third-party assumptions actually change a statewide winner.

Route construction must survive the moment a state flips. Recalculating the closest routes removes a newly won state from the remaining requirements, so a selected route cannot be identified only by its current rank or a transient route object. At the same time, computed vote totals and statuses must not become competing URL authority.

## Decision

A selected construction route persists as a sorted set of state codes plus the existing target candidate. Schema-2 URLs encode that blueprint in `plan`. All route progress is rebuilt from:

1. certified statewide results;
2. verified current scenario states;
3. active detailed-state recipes;
4. registered detailed-state manifests.

For every selected state, the construction model derives:

- the certified net target-margin movement required to move past a tie;
- net target-margin movement produced by the current scenario;
- the exact remaining margin-vote gap;
- whether a detailed model is available;
- the state's Required, Modeled, or Satisfied status;
- verified electoral votes supplied by a Satisfied result.

The statuses have strict meanings:

- **Required:** no active detailed recipe satisfies the requirement;
- **Modeled:** an active detailed recipe exists, but its verified state result is still allocated to the opponent;
- **Satisfied:** the verified scenario result allocates the state to the target candidate.

Opening a state, moving its margin in the target direction, or reaching 100 percent of a visual progress bar cannot award electoral votes. Only the deterministic statewide winner and election-year allocation determine Satisfied status.

Supported route rows open the existing Pennsylvania or Michigan laboratory. The route context reports the certified requirement, signed modeled movement, remaining gap, and verified consequence. Unsupported states remain noninteractive mathematical requirements and never receive county or reporting-unit claims.

On the national map, route states receive numbered markers and status-dependent outlines. A satisfied state uses a check mark. These symbols ensure that status is not communicated by color alone.

Changing the target candidate clears the selected route because the blueprint was chosen for a different directional objective. Invalid, duplicate, oversized, Maine, or Nebraska route plans fail closed. Maine and Nebraska remain excluded until district allocation is supported.

The reconstructed blueprint must still project to the majority threshold. A syntactically valid but electorally insufficient manual plan is labeled Insufficient rather than Complete, even if every listed state is already allocated to the target.

## Consequences

- A route remains understandable before, during, and after a state flip.
- Reloading does not trust serialized margins, progress, status, or electoral totals.
- Partial movement is visible without being mistaken for an Electoral College consequence.
- Reversing a scenario below the winner threshold immediately removes Satisfied status.
- The current two detailed states reuse their audited engines and geography rather than introducing a separate route model.
- A route containing unsupported states can be partially constructed but cannot be described as fully geographically modeled.

## Verification

- Model tests cover Required, Modeled, and Satisfied transitions, exact remaining-gap arithmetic, verified EV contribution, and invalid split-state plans.
- Browser replay opens Michigan from a selected route, verifies an insufficient movement, crosses the winner threshold, reloads the same blueprint and recipe, and reverses below the threshold.
- Existing Pennsylvania, Michigan, portfolio, URL, worker-race, and consequence journeys remain release gates.
