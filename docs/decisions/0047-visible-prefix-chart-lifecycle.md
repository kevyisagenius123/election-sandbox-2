# Decision 0047: Visible-prefix chart lifecycle

Date: 2026-08-23

## Decision

Sandbox 2.0 will use regular ECharts for bounded Election Night analytical lenses while preserving deck.gl as the sole geographic renderer.

The first admitted lens is a reported-margin timeline. Its data contract contains only already-published PA, MI, and WI returns and exposes:

- logical replay time;
- deterministic replay progress;
- national reported margin;
- state reported margins;
- the identity, geography, and ballot volume of each represented return.

## Lifecycle law

- The worker may pre-index the locked replay, but it may send only the observed prefix.
- The browser subscribes to timeline payloads only while the Timeline tab is open.
- The payload is capped at 320 deterministic display points.
- The latest observed return is always retained.
- Lead changes are retained before neutral sampling slots are filled.
- Hidden future candidate vectors cannot change the visible dataset.
- The chart is dynamically imported, owns exactly one canvas, observes its container size, and disposes both its observer and ECharts instance when closed.
- Clicking the chart seeks the existing replay worker. It does not own a second clock or map state.

## Consequences

- The main application bundle does not eagerly include ECharts.
- Hidden tabs create no chart rendering and receive no repeated timeline payload.
- The old Sandbox's simultaneous deck.gl and ECharts GL workload is not reproduced.
- ECharts GL remains outside the admitted runtime until a later comparative research gate.
