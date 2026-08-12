# Decision 0023: Separate editorial Home from the United States Laboratory

**Status:** Accepted

**Release:** v0.18.2

## Context

The previous national surface both introduced Sandbox 2.0 and represented the United States as an analytical geography. Returning from Pennsylvania to the United States therefore changed not only geographic scope but the entire information architecture. That made national analysis inconsistent with the viewport Laboratory established in v0.18.1.

## Decision

Workspace presentation and geographic level are independent state domains:

```text
workspace: home | laboratory
geography: national | state | county | reporting unit
```

The editorial Home lives at `/`. The analytical application lives at `/app/`, where the United States is a first-class Laboratory geography. Geographic navigation always remains in the Laboratory. Product Home and logo controls are the only routes back to the editorial surface.

Scenario URLs are canonicalized to `/app/` and continue to serialize only election state. Drawer snap, tab, camera, hover, and Home/Laboratory presentation remain transient workspace state. Legacy scenario query strings placed at the repository root are accepted and normalized into the Laboratory.

The production build has separate Home and Laboratory HTML entry points that load the same application bundle. This gives static hosting a real `/app/` target without creating a second React tree, renderer, worker foundation, scenario store, or model implementation.

National Laboratory mode reuses the v0.18.1 viewport, drawer, and right rail. It provides national summaries and supported-state entry points but does not expose a state behavior editor or invent unsupported national detail.

## Consequences

- Home can remain spacious and explanatory while every analytical geography uses one consistent instrument.
- State and county back navigation no longer masquerades as product Home navigation.
- Shared links bypass the editorial surface and reconstruct directly in the Laboratory.
- Static deployment must publish both `index.html` and `app/index.html`.
- The existing one-map, bounded-worker, deterministic-recipe resource contract remains unchanged.
- Election-model and data semantics are unchanged in this release.
