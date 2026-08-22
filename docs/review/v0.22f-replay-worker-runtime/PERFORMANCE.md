# v0.22F replay-worker performance record

Date: 2026-08-22

Command: `npm run benchmark:worker`

Environment: Node v22.19.0, certified national fixture, 13,704 canonical events, 250-event checkpoint cadence. The benchmark exercises the same runtime object used inside the module worker. Endpoint construction occurs before the recorded initialization interval.

| Operation | Time | Serialized response |
|---|---:|---:|
| Worker initialization: compile, reducer context, seek index, zero cursor and snapshot | 32,305.08 ms | 51,289 bytes |
| Step next timestamp, p50 | 8.691 ms | 57,773-byte median |
| Step next timestamp, p95 | 16.141 ms | 51,822–63,750 bytes |
| Seek to normalized midpoint | 52.534 ms | 1,069,240 bytes |
| Full midpoint resynchronization | 86.790 ms | 2,748,595 bytes |

The normalized midpoint update is large because the accepted transition truthfully lists every newly observed timestamp group crossed by the seek. It is still not a full state snapshot. Normal one-group transitions plus current national/state headlines remain bounded well below the multi-megabyte full snapshot.

The 32-second initialization is a first-visible-slice loading cost, not an interface-thread freeze. v0.22F deliberately does not add persistence or a precompiled replay cache. That cost must be observed in the real browser slice before a later optimization is justified.
