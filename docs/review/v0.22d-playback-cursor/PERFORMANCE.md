# v0.22D playback-controller performance record

Date: 2026-08-22

Command: `npm run benchmark:playback`

Environment: Node v22.19.0. Both fixtures contain 13,704 events and use the frozen v0.22C checkpoint cadence of 250. These are headless logical operations, not browser-frame measurements.

## Cursor creation and random position seek

| Fixture | Creation p50 | Random seek p50 | Random seek p95 | Random seek p99 | Worst |
|---|---:|---:|---:|---:|---:|
| Certified | 0.005 ms | 26.105 ms | 69.465 ms | 84.217 ms | 91.284 ms |
| Complex | 0.009 ms | 26.558 ms | 53.811 ms | 72.943 ms | 78.625 ms |

Each random workload contains 100 deterministic positions. The controller adds status, time-boundary, timestamp-group, and process-local validation around the accepted v0.22C seek path. No cadence retuning was performed.

## Full replay in 1,000 logical-time partitions

| Fixture | Total | Per-advance p50 | p95 | p99 | Worst | Final votes |
|---|---:|---:|---:|---:|---:|---:|
| Certified | 3,322.642 ms | 0.792 ms | 11.002 ms | 13.857 ms | 16.042 ms | 155,238,302 |
| Complex | 2,908.197 ms | 0.663 ms | 10.070 ms | 13.649 ms | 22.650 ms | 155,417,654 |

The controller advances from its current canonical reducer state, so partitioned playback performs the full reduction once across the complete logical night instead of reconstructing every partition from zero.

## Step through every canonical timestamp

| Fixture | Timestamp groups | Total | Per-step p50 | p95 | p99 | Worst |
|---|---:|---:|---:|---:|---:|---:|
| Certified | 13,652 | 3,412.921 ms | 0.222 ms | 0.462 ms | 0.698 ms | 3.190 ms |
| Complex | 13,657 | 3,028.162 ms | 0.170 ms | 0.445 ms | 0.906 ms | 5.863 ms |

The group counts are smaller than event counts because events sharing a timestamp are applied atomically. Both stepping and partitioned playback end at the same exact final candidate totals.

## Interpretation

The controller adds negligible creation cost and keeps ordinary forward logical advancement well below a browser-frame interval in this headless environment. Random jump performance remains within the accepted v0.22C envelope with expected controller validation overhead.

This record does not authorize UI-thread index construction. The accepted v0.22C construction cost of approximately 2.9 seconds still requires a worker/runtime boundary when browser integration is eventually authorized.
