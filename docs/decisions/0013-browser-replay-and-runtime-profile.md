# ADR 0013: Browser replay and runtime profile

## Status

Accepted for v0.10.

## Context

Unit tests already proved allocation and reconciliation invariants, and manual browser checks had confirmed versioned scenario restoration. Neither protected the complete user-facing replay flow in the repository. The compact artifact also expands into 9,178 VTD objects and drives 9,140 model units on the main thread, so a second detailed state could not be planned responsibly without measuring that path.

## Decision

Keep three Playwright browser replays as release gates:

1. The canonical complex URL must load the compact artifact, restore every visible mode and geography, display the ALEPPO inspector, and reproduce Pennsylvania R +5.8.
2. Official alphanumeric VTD GEOID `4200300A000` must survive URL parsing and open the Pittsburgh Ward 15 District 09 inspector.
3. An unsupported future URL schema must apply no partial state, show the compatibility notice, and return to the certified baseline and clean URL.

Keep a separate diagnostic profiler for JSON parsing, validated artifact decoding, model-unit conversion, the full three-operation scenario, contribution derivation, and retained heap. Timings are reported rather than asserted because developer hardware and CI runners differ.

Optimize only semantics-preserving hot paths. Baseline validation and identifier indexes may be cached by readonly array identity. Largest-remainder allocation must retain the same remainder and original-index tie ordering. Scenario and URL engine versions do not advance when outputs remain identical.

## Consequences

- Replay regressions now fail in the same public UI a user sees.
- Browser installation is explicit through `npm run test:browser:install`.
- The local complex-scenario median improves from about 100 ms to roughly 75 ms; contribution derivation improves from about 16 ms to under 2 ms.
- A roughly 75 ms synchronous scenario still exceeds a single animation frame. Detailed multi-state work therefore requires a Web Worker boundary rather than assuming Pennsylvania performance will scale linearly on the main thread.
- Playwright output, traces, screenshots, and Chromium debug logs are ignored as generated artifacts.
