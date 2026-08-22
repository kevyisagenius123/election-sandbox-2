# 0035: Keep checkpoints process-local and subordinate to the canonical reducer

Date: 2026-08-22

## Status

Accepted for the v0.22C supervisor-review candidate under the bounded authorization following approval of v0.22B.

## Decision

`replaySeekIndex.ts` provides an immutable, process-local reconstruction index over canonical reducer states. The index stores deterministic interval positions and reducer states produced only by `reduceReplayToEventCount`. Those states structurally share frozen reducer objects.

A seek selects the nearest checkpoint at or before event position `N`, then applies the canonical tail:

```text
canonical events[0:N]
          =
checkpoint state at C, where C <= N
+ canonical events[C:N]
```

The result must have byte-identical reducer serialization, reducer fingerprint, reported-analytics serialization, and analytics fingerprint to a full replay from event zero.

## Authority boundary

The reducer remains the only authority. A seek index:

- is not serializable or externally meaningful;
- cannot be reconstructed from an untrusted clone;
- cannot be edited;
- cannot introduce or reorder events;
- cannot contain analytics;
- cannot produce analytics directly;
- cannot act as persistence, local storage, a public API, or an alternate state model.

Only indexes constructed and registered in the current process are accepted. Stream fingerprint, reducer version, event count, schema, and implementation version must match the active reducer context.

## Deterministic indexing

The v1 index uses a configurable positive safe-integer event cadence. It always stores event zero and the final event position. Intermediate checkpoints appear at exact cadence boundaries. Lookup uses binary search and reduces at most `cadence - 1` tail events.

The accepted benchmark cadence is 250 events, producing 56 checkpoints for each 13,704-event national fixture and a maximum 249-event reconstruction tail.

## Performance and memory

The canonical benchmark is `npm run benchmark:seek`, recorded in `docs/review/v0.22c-seek-checkpoint-optimization/PERFORMANCE.md`. It compares cold replay, named seeks, 100 deterministic random seeks, hostile backward/forward movement, construction time, measured heap growth, and logical full-snapshot serialization for certified and complex fixtures.

Runtime checkpoint states structurally share immutable objects. The logical size of independently serialized full states is recorded only to demonstrate why this process-local index must not become a persistence format.

## Prohibited scope

No React, deck.gl, replay controls, timeline, animation, playback speed, election-night clock presentation, interpolation, reporting prediction, remaining-vote inference, Decision Desk, projections, calls, EV allocation, persistence, streaming, public API, new event type, or canonical fixture mutation is part of v0.22C.

Any playback controller is a later, separately authorized milestone.
