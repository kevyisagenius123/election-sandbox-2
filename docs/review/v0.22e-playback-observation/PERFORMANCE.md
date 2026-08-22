# v0.22E sanitized-observation performance record

Date: 2026-08-22

Command: `npm run benchmark:observation`

Environment: Node v22.19.0. Both fixtures contain 13,704 events and use the frozen 250-event seek cadence. Stream fingerprints appear only in the benchmark envelope, never in sanitized output.

## Snapshot derivation

| Fixture and position | p50 | p95 | p99 / worst | Serialized bytes |
|---|---:|---:|---:|---:|
| Certified zero | 3.486 ms | 6.584 ms | 7.084 / 7.311 ms | 51,174 |
| Certified midpoint | 54.751 ms | 84.025 ms | 173.499 ms | 2,498,220 |
| Certified final | 151.600 ms | 246.972 ms | 246.972 ms | 4,871,669 |
| Complex zero | 3.151 ms | 5.783 ms | 6.682 / 8.893 ms | 51,174 |
| Complex midpoint | 83.397 ms | 110.423 ms | 112.088 ms | 2,497,487 |
| Complex final | 225.670 ms | 287.741 ms | 287.741 ms | 4,870,610 |

At midpoint, 147 counties and 6,729 detailed units have current reported state. At completion, 150 counties and 13,553 detailed units are observable. Snapshot size grows only with facts already published.

## Transition derivation

| Fixture and movement | p50 | p95 | p99 | Worst | Serialized bytes |
|---|---:|---:|---:|---:|---:|
| Certified stationary | 8.540 ms | 13.023 ms | 14.945 ms | 21.835 ms | — |
| Certified one group | 8.586 ms | 12.674 ms | 14.865 ms | 23.655 ms | 526 |
| Certified zero → midpoint | 13.383 ms | 18.183 ms | 19.576 ms | 19.576 ms | 883,286 |
| Certified midpoint → zero | 9.007 ms | 11.927 ms | 12.328 ms | 12.397 ms | 627 |
| Complex stationary | 8.356 ms | 14.133 ms | 16.232 ms | 19.864 ms | — |
| Complex one group | 6.399 ms | 11.566 ms | 13.806 ms | 16.290 ms | 526 |
| Complex zero → midpoint | 17.816 ms | 23.270 ms | 25.131 ms | 25.131 ms | 883,803 |
| Complex midpoint → zero | 6.595 ms | 13.686 ms | 15.434 ms | 16.151 ms | 627 |

A large forward jump truthfully enumerates every timestamp group that became observable, so its serialized transition is intentionally much larger than a normal one-group transition. Backward movement contains no newly observed groups and remains compact.

## Conclusion

The sanitized contract is suitable as an audit and current-knowledge boundary. It is not yet a browser feed. A future separately authorized worker/runtime protocol should decide how to avoid sending complete multi-megabyte snapshots or large jump histories on every presentation update without weakening blindness.
