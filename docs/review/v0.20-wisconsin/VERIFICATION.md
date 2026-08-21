# v0.20 Wisconsin admission verification

**Date:** 2026-08-20

**Verdict:** PASS for private internal State #3 development

**External release:** HOLD. Human validation is deferred, not passed, and PA/MI participant-delivery rights remain unresolved.

## Data gate

- Official source: Wisconsin Legislative Technology Services Bureau `2024 Election Data with 2025 Wards`.
- Source item owner: `WI_Legislature`.
- Source item states that the data is open and publicly available.
- Source snapshot SHA-256: `02e19c18503b928b1f53826b6224475a6391bbfb8e53afad9fbf4abb143734fd`.
- 72 counties, 7,086 ward polygons, 6,946 result-bearing rows, and 140 explicit geometry-only wards.
- Harris 1,668,229; Trump 1,697,626; Other 57,063; Total 3,422,918.
- 100% of statewide ballots are represented in the LTSB reconstruction.
- Ward values are labeled population-disaggregated estimates on January 2025 wards, never raw certified ward returns.

## Product gate

- Wisconsin opens from the national detailed-state controls and Path to 270.
- State click reveals the county layer; county drilldown replaces it with 3D ward terrain.
- Result, Scenario, and Shift modes use the shared Atlas renderer.
- Turnout, preference, third-party, contribution, inspector, state-flip, EV, and URL contracts operate through the shared state manifest.
- A +1.5-point Democratic preference transfer changes Wisconsin from R+0.9 to D+0.6 and awards 10 Harris EV.
- The exact scenario and selected ward restore after reload.
- Desktop state, desktop ward, and 390px state references pass visual comparison.

## Engineering gate

- `npm test`: 52 / 52 passed.
- `npm run lint`: passed.
- `npm run build`: passed with the existing large deck.gl chunk warning.
- `npm run test:browser`: 38 passed, 3 correctly skipped. The skips are the remote-only smoke and two frozen v0.19.1 evidence-capture journeys.
- `npm run profile:runtime`: 35-cycle three-state profile passed after five warm-up cycles.
- Heap growth: 972,572 bytes / 2.37%.
- Heap slope: 41,238 bytes per measured cycle.
- Three-state cycle p95: 24,108 ms against a 30,000 ms ceiling.
- One active detailed worker, one portfolio worker, one map mount, one WebGL context, at most six county shards, and zero settled pending requests or animations.

## Visual references

- `tests/browser/__screenshots__/09-wi-laboratory.png`
- `tests/browser/__screenshots__/10-wi-ward-laboratory.png`
- `tests/browser/__screenshots__/11-wi-bottom-sheet-390.png`

## Review findings

The initial long profile found no leak but exceeded the provisional latency ceiling because state changes deleted county shards and forced repeated decode work. The existing LRU was made cross-state, still capped at six entries. The final profile improved p95 without materially changing heap growth.

No unresolved P0 or P1 product, data, or lifecycle issue was found in this admission. This is AI technical-supervisor and automated evidence, not human usability evidence.
