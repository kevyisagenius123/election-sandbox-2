# ADR 0022: Separate editorial and laboratory viewport shells

**Status:** Accepted
**Release:** v0.18.1

## Context

The national map and a detailed state model serve different tasks. National mode supports editorial exploration and route discovery. A detailed state supports repeated analytical editing, geographic inspection, and causal explanation. Rendering both in one long document compressed the map, created duplicated hierarchy, and made the detailed workflow dependent on document scrolling.

## Decision

The application exposes two presentation modes around one persistent scenario and runtime owner:

- National uses the existing editorial three-column composition.
- Detailed geographies use a fixed-height Laboratory workspace on desktop.
- The Laboratory right rail is bounded and scrolls internally.
- Behavior, Contributors, Inspector, Assumptions, and Data panels live in a semantic three-snap drawer: collapsed, working, and expanded.
- Pointer dragging enhances explicit snap buttons and keyboard-operable tabs.
- Drawer state, active tab, camera, hover, and alternatives expansion remain local workspace state and are excluded from canonical scenario URLs.
- Drawer changes never reframe the map. `Fit selection` is the explicit reframing action.
- Route alternatives are hidden behind an explicit comparison control in Laboratory mode.
- A compact causal strip preserves the visible chain from model assumption to margin movement to route consequence.

The application tree remains shared. Shell changes are expressed by layout state and CSS rather than mounting separate election applications, workers, or map renderers.

## Consequences

- National and detailed navigation preserve recipes, target candidate, selected route, worker ownership, and WebGL ownership.
- Detailed desktop pages do not require document scrolling; the rail and drawer own overflow.
- Drawer controls have explicit ARIA tab relationships, keyboard navigation, reduced-motion behavior, and focus restoration for route alternatives.
- Runtime diagnostics publish the current map view so camera invariants can be tested.
- The old long-page detailed visual references are retired in favor of ten viewport-specific shell references.
- This release intentionally changes no model, data artifact, URL schema, or state-admission policy.
