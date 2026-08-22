# v0.22A reducer performance baseline

Date: 2026-08-21

## Scope

Command:

```bash
npm run benchmark:reducer
```

The benchmark compiles and validates the accepted certified national stream before timing. Compiler setup is excluded from the reducer measurements. The timed stream contains 13,704 canonical events.

No release limits were authorized for v0.22A. These measurements establish a reproducible first baseline.

## Result

```text
Benchmark                         Median       p95       Worst
Full 13,704-event reduction      6,129 ms   6,412 ms   6,412 ms
Checkpoint seek, 100 positions      35 ms     101 ms     165 ms
```

Checkpoint configuration and memory:

```text
Cadence                          500 events
Checkpoints                      29
Checkpoint construction         31,186 ms
Serialized final state           5,333,517 bytes
Serialized checkpoint set       80,206,132 bytes
```

## Interpretation

The reducer establishes trustworthy deterministic behavior, not a final interactive performance budget. Checkpoint seeking is already much faster than zero-to-prefix reconstruction, but the first canonical JSON checkpoint representation is memory-heavy and expensive to construct.

Before mounting replay state into an interactive workspace, profile a compact or structurally shared checkpoint representation. Any optimization must reproduce the frozen state fingerprints and all seek-equivalence tests. Do not remove hierarchy, off-map identity, or five-candidate state merely to improve the numbers.
