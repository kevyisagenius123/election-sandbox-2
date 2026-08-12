# v0.18 runtime and bundle budgets

**Status:** Passing release contract

**Applies to:** Pennsylvania and Michigan private alpha

## Canonical lifecycle journey

The deterministic journey starts from the same two-state portfolio on every run. Pennsylvania and Michigan both use a +2.5-point Democratic preference recipe. One cycle is:

1. open Michigan;
2. open its highest-ranked changed precinct and wait for audited geometry;
3. switch to Pennsylvania and wait for its verified foundation;
4. open its highest-ranked changed VTD and wait for audited geometry;
5. switch back to Michigan;
6. force garbage collection in the controlled Chromium profile;
7. record runtime diagnostics, heap, and cycle time;
8. verify Harris 260, Trump 278, the Wisconsin route to exactly 270, and both recipe fingerprints.

The GitHub lifecycle gate uses six cycles. The controlled profile uses five warm-up cycles followed by thirty measured cycles. Both run the identical cycle.

## Deterministic release gates

| Metric | Pass condition |
|---|---:|
| Detailed workers | Exactly 1 after settlement |
| Portfolio workers | Exactly 1 for the two-state portfolio |
| Map mounts | Exactly 1 |
| WebGL contexts | Exactly 1 |
| Geometry cache entries | At most 6 |
| Geometry cache bytes | Sum of declared source shard bytes for retained entries |
| Pending geometry fetches | 0 after settlement |
| Pending scenario requests | 0 after settlement |
| Active animation handles | 0 after settlement |
| Active detailed layers | Must match the final state and geographic level |
| National totals | Harris 260, Trump 278 for the canonical recipe |
| Route consequence | Wisconsin projects Harris from 260 to 270 |
| Recipes | Exactly 2, with deterministic fingerprints |

The hostile journey delays a real precinct request, replaces PA and MI ownership before completion, and applies the same final reconciliation gates. A stale response may never publish after its state loses ownership.

## Controlled heap and latency budgets

These budgets are evaluated only after the 35-cycle profile has completed successfully on the controlled Windows Chromium environment:

- Warm-up: first 5 cycles excluded.
- Measurement: cycles 6 through 35.
- Heap samples follow an explicit Chromium garbage collection request.
- Final five-cycle heap median must be no more than **20 MB and 20%** above the first five-cycle measured median.
- Linear retained-heap slope must be below **0.5 MB per measured cycle**.
- Cycle-time p95 must remain below **15 seconds** on the reference development machine.
- The final cycle must satisfy every deterministic lifecycle and correctness gate above.

Percentage and absolute ceilings are both required. A run that fails either condition remains evidence of an unresolved regression. These thresholds may change only through a documented before-and-after profile, never to excuse a single failing run.

## Bundle budget

v0.17 production baseline:

| Chunk | Minified | Gzip |
|---|---:|---:|
| Atlas map / deck.gl | 1,602.96 kB | 502.70 kB |
| Main application | 339.64 kB | 96.23 kB |

v0.18 diagnostics baseline after instrumentation:

| Chunk | Minified | Gzip |
|---|---:|---:|
| Atlas map / deck.gl | 1,603.67 kB | 502.98 kB |
| Main application | 340.93 kB | 96.68 kB |

The increase is the narrow development diagnostic lifecycle and is accepted for v0.18. No optimization ships without a hypothesis, before/after sizes, startup and interaction checks, and browser regression verification. The current release makes no speculative renderer optimization.

## v0.18 controlled result

The release profile completed 35 cycles on 2026-08-12. The first five were excluded and the remaining thirty produced:

| Metric | Result | Budget | Status |
|---|---:|---:|---|
| Opening five-cycle heap median | 44,873,612 bytes | Reference | Pass |
| Closing five-cycle heap median | 46,044,576 bytes | Reference | Pass |
| Median heap growth | 1,170,964 bytes / 2.61% | At most 20 MiB and 20% | Pass |
| Linear heap slope | 75,047 bytes/cycle | At most 524,288 bytes/cycle | Pass |
| Cycle-time p95 | 7,279 ms | At most 15,000 ms | Pass |

Every recorded sample also retained exactly one detailed worker, one portfolio worker, one map mount, and one WebGL context after settlement. Pending geometry fetches, scenario requests, and animation handles returned to zero. This is a bounded reference result, not a promise about every device.

## Measurement limitations

- Browser heap is available through Chromium debugging and is not a cross-browser guarantee.
- WebGL context count is an ownership invariant, not a GPU-memory estimate.
- Geometry bytes are audited compressed shard sizes declared by the committed manifests; decoded GPU allocation is not reported as though it were observable.
- Timing numbers describe the reference environment and are not a universal device-performance claim.
