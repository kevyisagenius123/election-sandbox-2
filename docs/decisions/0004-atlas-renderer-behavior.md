# ADR 0004: Port the Atlas 3D renderer behavior

## Status

Accepted.

## Context

The Presidential Atlas already established successful three-dimensional map behavior: corrected Albers orientation for OrbitView, restrained lighting, smooth cancellable camera transitions, delayed county extrusion, and removal of transparent parent layers that can occlude shorter child geometry.

Sandbox 2.0 is an independent product, but independence does not require discarding a proven renderer.

## Decision

Sandbox 2.0 will maintain its own copy of the relevant Atlas renderer behavior and adapt it to the new reporting-unit and scenario contracts.

The new repository will not import Atlas source files at runtime. The port owns its dependencies, tests, lifecycle, and future changes.

## Preserved behavior

- deck.gl `OrbitView` with drag rotation and inertia.
- Corrected screen-Y orientation for preprojected Albers geometry.
- Cubic eased, cancellable camera transitions.
- A higher state drilldown camera angle for readable extrusion comparisons.
- State layer fade followed by county rise.
- Removal of the transparent state layer after county activation to avoid depth-buffer occlusion.
- Restrained ambient, key, and fill lighting.
- `requestAnimationFrame` throttling for view-state updates.
- Cleanup of animation frames, timers, and pending view state.

## Consequences

- The new product begins with the visual and interaction quality of the Atlas.
- Sandbox-specific data and scenario logic remain independent.
- County and reporting-unit geometry can replace the current neutral onboarding terrain without redesigning the scene.
- Future renderer fixes must be applied deliberately rather than inherited through a hidden dependency.
