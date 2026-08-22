# 0036: Separate logical replay control from wall-clock and presentation behavior

Date: 2026-08-22

## Status

Accepted for the v0.22D supervisor-review candidate under the authorization issued with final v0.22C approval.

## Decision

`playbackCursor.ts` owns a pure, immutable, process-local controller over the canonical reducer and v0.22C seek index. It accepts explicit commands and explicit integer logical-time deltas. It never reads a wall clock and never schedules itself.

The controller supports:

```text
PLAY
PAUSE
RESET
ADVANCE_LOGICAL_TIME(deltaMs)
SEEK_EVENT_COUNT(eventCount)
SEEK_ABSOLUTE_TIME(absoluteReplayTimeMs)
STEP_NEXT_EVENT_TIME
```

The same initial cursor plus the same ordered command values always produces the same cursor and reducer state.

## Time law

The zero cursor is paused one integer millisecond before the first canonical event. The final boundary is the last canonical event time. Logical advancement is clamped at that final boundary and cannot overflow safe-integer time.

No `Date.now`, `performance.now`, timer, animation frame, playback speed, or presentation clock exists in the controller. A later runtime may decide how wall time produces authorized logical deltas, but that adapter cannot change controller semantics.

## Simultaneous-event atomicity

All canonical events sharing one absolute replay timestamp become visible together. Time seeks naturally include the complete timestamp group. Event-count seeks that would land inside a simultaneous group snap forward to its end. `STEP_NEXT_EVENT_TIME` applies the entire next group and returns paused.

No controller state may expose a partial timestamp group.

## Status law

- Zero and reset are paused.
- Play changes a non-complete paused cursor to playing.
- Pause changes a playing cursor to paused.
- Logical advancement changes time only while playing.
- Explicit seeks preserve playing only when the previous cursor was playing and the target is incomplete.
- Seeking backward from complete returns paused.
- Applying the final canonical event produces complete.
- Play and step are idempotent at completion; reset or an explicit backward seek is required to leave it.

## Authority and isolation

The reducer state embedded in a cursor remains canonical reducer output. The controller does not cache or derive analytics, inspect endpoints or future vote vectors, add events, infer reporting, call races, allocate EV, or mutate the seek index.

Cursors are immutable and process-local. Cloned or fabricated cursor objects fail closed. State identity is bound to controller version, reducer version, source stream fingerprint, canonical time boundaries, applied event count, and complete timestamp-group reconciliation.

## Prohibited scope

No React, deck.gl, map, playback UI, `requestAnimationFrame`, timer, speed control, animation, Decision Desk, projection, call, remaining-vote model, persistence, network stream, analytics cache, or presentation behavior is included.

The roughly 2.9-second seek-index construction cost remains a future worker-boundary integration requirement. v0.22D does not add that worker.
