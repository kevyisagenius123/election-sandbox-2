# ADR 0014: Manifest-driven worker runtime

## Status

Accepted for v0.11.

## Context

Pennsylvania's detailed runtime was integrated directly into the application. Its paths, compatibility versions, Electoral College allocation, and geography assumptions appeared in several modules. The compact artifact validates in roughly 25 to 45 ms locally, and a complex 9,140-unit scenario takes roughly 75 ms. Those synchronous costs are manageable for one state but cannot remain on the interface thread as detailed states are added.

## Decision

Register each production-detailed state through a typed manifest. The manifest owns:

- State and election identity.
- Electoral votes.
- Dataset and deterministic engine versions.
- Runtime loader, artifact, schema, and encoding.
- Geography identifiers and runtime geometry manifest.
- Auditable source-registry paths.

Load and validate the compact artifact inside a dedicated module worker. The worker retains model units and returns the expanded inspection foundation once, followed by scenario results. Main-thread contribution derivation remains acceptable at under 2 ms locally.

Every worker request has a monotonically increasing identifier. The worker coalesces queued calculations to the newest waiting request. The React bridge ignores any response that does not match the newest settings. URL publication and link copying wait until the matching result is present.

Keep URL schema `1`, dataset `us2024-pa-vtd2020-v2`, and engine `pa-behavior-v1`. Moving unchanged deterministic calculations across a thread boundary does not justify breaking existing scenario links.

## Consequences

- Slider calculations no longer block map and interface interaction for the full scenario duration.
- Rapid input can finish at most one already-running stale calculation; queued intermediate calculations are discarded and stale responses cannot render.
- The main application bundle is smaller because worker-only engine code is emitted separately.
- The expanded foundation still crosses the worker boundary once because the inspector and map need VTD metadata. Memory and structured-clone cost must be re-profiled with the second state.
- A new state requires a manifest entry and loader implementation. It must not add another Pennsylvania-shaped hook or duplicate compatibility constants.
- GitHub Actions and the rapid-change browser replay enforce the boundary on every proposed change.
