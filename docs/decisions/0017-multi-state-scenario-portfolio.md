# Decision 0017: Multi-state scenario portfolio

**Status:** Accepted  
**Release:** v0.14

## Context

Pennsylvania and Michigan can each run the deterministic behavior model, but v0.13 retained only one active state scenario. Keeping both expanded demographic foundations on the interface thread would make national composition easy at the cost of memory growth and ambiguous sources of truth.

Path to 270 needs several state assumptions to remain active while only one state laboratory is open. Shared links must also reproduce the same national result without serializing computed totals as authority.

## Decision

The application stores one compact, versioned `StateScenarioRecipe` per changed detailed state. Recipes are authoritative. A `StateScenarioSummary` is a derived cache containing exact candidate totals, margin, winner, EV allocation, and the fingerprint of the recipe that produced it.

The active state runs through the detailed worker and returns the foundation required by the map, contribution panel, and inspector. Inactive recipes are hydrated sequentially in a separate worker. That worker loads, validates, calculates, and discards one foundation at a time and returns only compact summaries.

National aggregation accepts an inactive summary only when its recipe fingerprint matches the current recipe. A missing, stale, or failed summary never enters the aggregate; the canonical certified state result remains in place and scenario sharing stays unavailable until verification completes.

State switching snapshots the departing recipe and restores the arriving recipe. County geometry uses a six-shard least-recently-used cache and state-level purge on detailed-state release. Worker lifecycle remains owned by React effects and terminates on replacement or unmount.

Scenario URL schema 2 serializes the sorted recipe portfolio, active detailed state, interface modes, and selected geography. Schema 1 remains accepted and is converted into a single-state recipe after successful local replay.

## Consequences

- Pennsylvania and Michigan assumptions coexist without retaining both full foundations on the main thread.
- A recipe, data version, engine version, and deterministic ordering semantics are sufficient to reconstruct a state exactly.
- Cross-state totals have one canonical replacement point per state and can be checked for double counting.
- Inactive-state hydration adds a short pending period before copying or publishing a result.
- The current worker reloads an inactive foundation whenever its recipe changes; broader memoization is deferred until profiling demonstrates a need.
- Path classification and route enumeration can build on the portfolio without weakening the distinction between Modeled and Required states.

## Verification

- Unit tests cover schema-1 compatibility, schema-2 two-state round trips, recipe fingerprints, and derived summary aggregation.
- Browser replay verifies simultaneous Pennsylvania and Michigan flips, national 260 to 278 aggregation, per-state margin display, and exact control restoration across repeated switches.
- Build, lint, and all deterministic model and browser tests pass for v0.14.
