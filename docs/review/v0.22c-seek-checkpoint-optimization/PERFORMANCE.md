# v0.22C seek/checkpoint performance record

Date: 2026-08-22

Command: `npm run benchmark:seek`

Environment: Node v22.19.0 with explicit garbage collection enabled. Both fixtures contain 13,704 canonical events. The index cadence is 250 events, producing 56 checkpoints and a maximum 249-event tail.

## Cold full replay

| Fixture | p50 | p95 / worst |
|---|---:|---:|
| Certified | 3,538.925 ms | 3,904.094 ms |
| Complex | 2,714.931 ms | 2,916.297 ms |

## Named event-position seeks

| Fixture and position | Full-prefix p50 | Indexed p50 | Indexed p95 | Indexed worst |
|---|---:|---:|---:|---:|
| Certified, early (100) | 15.388 ms | 13.820 ms | 16.815 ms | 16.889 ms |
| Certified, midpoint (6,852) | 1,200.178 ms | 16.425 ms | 19.959 ms | 26.791 ms |
| Certified, near final (13,604) | 3,250.299 ms | 25.313 ms | 32.691 ms | 48.338 ms |
| Complex, early (100) | 10.986 ms | 13.501 ms | 21.391 ms | 22.853 ms |
| Complex, midpoint (6,852) | 1,028.092 ms | 18.333 ms | 21.266 ms | 24.073 ms |
| Complex, near final (13,604) | 2,094.727 ms | 24.932 ms | 34.976 ms | 37.544 ms |

The index is intentionally not claimed to improve a tiny event-100 reconstruction in every run. Its benefit appears as the target moves away from zero: midpoint median speed improves about 73x certified and 56x complex; near-final median improves about 128x certified and 84x complex.

## 100 deterministic random seeks

| Fixture | Path | p50 | p95 | p99 | Worst |
|---|---|---:|---:|---:|---:|
| Certified | Full prefix | 1,319.334 ms | 3,432.496 ms | 4,001.425 ms | 4,320.151 ms |
| Certified | Indexed | 17.813 ms | 56.321 ms | 61.889 ms | 151.144 ms |
| Complex | Full prefix | 1,259.712 ms | 2,530.223 ms | 2,751.674 ms | 3,389.484 ms |
| Complex | Indexed | 20.385 ms | 59.302 ms | 72.639 ms | 79.751 ms |

The random-seek p50 improves about 74x for certified and 62x for complex. Baseline and indexed checksums match exactly for both workloads.

## Repeated backward/forward indexed seeks

| Fixture | p50 | p95 | p99 | Worst |
|---|---:|---:|---:|---:|
| Certified | 0.055 ms | 39.725 ms | 71.044 ms | 113.773 ms |
| Complex | 0.061 ms | 49.626 ms | 62.368 ms | 68.528 ms |

The deliberately hostile 100-seek sequence repeatedly crosses zero, final, midpoint, event 1, event 100, and event 1,000. Exact checkpoint hits explain the very small median; the tail-bound percentiles are the more representative upper evidence.

## Construction and memory

| Fixture | Construction | Measured heap increase | Final state serialized | Logical serialization of all full snapshots |
|---|---:|---:|---:|---:|
| Certified | 2,893.521 ms | 26,440,248 bytes | 5,333,517 bytes | 152,371,856 bytes |
| Complex | 2,878.391 ms | 27,611,328 bytes | 5,332,514 bytes | 152,339,329 bytes |

The heap values are runtime measurements after explicit garbage collection and should be treated as environment-specific observations. The approximately 152 MB logical figures describe independently serializing every full checkpoint state. The implementation does not do that: it retains structurally shared immutable objects and 322 bytes of serialized metadata. This is evidence for keeping the index process-local, not a proposed storage format.

## Conclusion

The optimization delivers large, reproducible gains for realistic midpoint, late, random, and backward/forward reconstruction without changing reducer or analytics semantics. Very early seeks remain approximately baseline-cost because both paths apply nearly the same short canonical prefix.
