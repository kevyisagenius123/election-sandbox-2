# 0038: Keep replay authority in one narrow browser worker

Date: 2026-08-22

## Status

Accepted for the v0.22F verification candidate under the supervisor authorization issued after v0.22E passed.

## Decision

The browser replay runtime is one dedicated module worker. The main thread may provide one locked endpoint and one national replay definition, then issue playback commands. The worker alone owns national compilation, reducer-context construction, checkpoint construction, the current playback cursor, and sanitized observation derivation.

The protocol has only three requests:

```text
INITIALIZE
COMMAND
RESYNCHRONIZE
```

and four responses:

```text
READY
UPDATE
RESYNCHRONIZED
ERROR
```

Requests are serialized through one worker-owned promise queue. Initialization is single-use. There is no general event bus, subscription abstraction, network transport, persistence layer, or application state framework.

## Transport law

`READY` and explicit `RESYNCHRONIZED` responses carry the accepted full current snapshot. Ordinary `UPDATE` responses carry:

- the accepted sanitized transition;
- a compact current headline containing controller position, national analytics, and jurisdiction analytics;
- normalized timeline progress for a presentation scrubber;
- a recommendation to resynchronize after backward movement.

The compact headline intentionally omits county and reporting-unit rows. A large forward seek still truthfully enumerates all newly observed timestamp groups and may therefore be large. Full snapshots are never sent continuously.

## Seek law

Presentation can seek through an integer `0..1,000,000` normalized progress command. The worker converts that value to its private absolute replay boundary and returns only the resulting current observation and normalized position. Final boundary, remaining events, next-event time, endpoint totals, stream identity, and future return order do not cross the boundary.

## Failure law

Invalid envelopes, commands before initialization, duplicate initialization, and invalid normalized progress fail as sanitized `ERROR` responses. Error responses do not echo the endpoint, definition, stream fingerprint, or event payload.

## Consequences

- Roughly 32 seconds of baseline compilation and checkpoint setup measured locally no longer blocks the browser interface thread.
- Ordinary state-level update responses measured 52–64 KB and roughly 9 ms median.
- A midpoint resynchronization remains materially large at about 2.75 MB and must be occasional.
- County/unit presentation may request an explicit resynchronization; it cannot infer unseen rows from hidden replay state.
- The first visible replay slice can consume one deterministic current-state source without importing replay authority into React.

## Prohibited scope

No Decision Desk, projections, calls, animation policy, camera choreography, Redux, EventEmitter, Observable, WebSocket, backend, storage, account, room, membership, export, or video behavior is introduced by this decision.
