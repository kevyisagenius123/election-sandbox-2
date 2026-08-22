# 0037: Give presentation current knowledge, not replay authority

Date: 2026-08-22

## Status

Accepted for the v0.22E supervisor-review candidate under the authorization issued with approval of v0.22D.

## Decision

`playbackObservation.ts` is the epistemic firewall between the trusted replay kernel and any future presentation runtime. It defines two immutable, canonical, process-local outputs:

- a snapshot of what is observable at one valid cursor;
- a transition describing what became observable between two valid cursors.

The contract answers what presentation may know. It does not define how a browser subscribes, how often observations are created, or how they are transported.

## Snapshot law

A snapshot exposes:

```text
controller status
current logical replay time
current applied event count

accepted national reported analytics
accepted jurisdiction reported analytics
currently reporting counties
currently published detailed units
current poll-close/completion facts
current mapped/off-map facts
```

Reported leader, margin, ranking, and share logic is imported from v0.22B. It is not reimplemented.

County and unit rows copy only already-applied candidate vectors and geography identity. Counties with no published return and units that have not published are absent. The snapshot never returns the reducer object, cursor object, seek index, endpoint, or canonical event stream.

## Transition law

A transition exposes:

```text
stationary / forward / backward
previous sanitized controller position
current sanitized controller position
timestamp groups that became observable during a forward transition
jurisdictions whose observable state changed
```

New timestamp groups are constructed only from the applied interval `(previousEventCount, currentEventCount]`. A backward or reset transition has no newly observed timestamp group. The contract never exposes a next group or future schedule.

## Blindness law

Stream fingerprint, final replay boundary, endpoint totals, remaining event count, next-event time, future unit order, and any other future-sensitive identity are excluded.

If two streams have byte-identical observable prefixes and controller positions, their snapshots serialize byte-identically even when their futures and endpoints diverge. If two applied transitions are identical, their sanitized transitions also serialize byte-identically.

This equality is the primary v0.22E guarantee.

## Serialization and validation

Snapshot and transition serialization is canonical and fingerprintable. Deserialization re-derives the expected value from validated process-local cursors and fails closed on any difference. Foreign, cloned, fabricated, or cross-stream cursors remain rejected by the v0.22D validator.

The serialized observation intentionally contains no source-stream fingerprint. Fingerprints identify the observation content itself, not the hidden future containing it.

## Performance interpretation

The baseline is recorded in `docs/review/v0.22e-playback-observation/PERFORMANCE.md`.

One-group transitions are compact and inexpensive. Full current-state snapshots grow with already-published detailed units and reach roughly 4.87 MB and 152–226 ms median at completion. That is acceptable for an auditable snapshot contract but unsuitable for per-frame browser transport.

No caching, incremental transport, subscription, worker, or UI optimization is authorized here. Those measurements constrain a future runtime/worker protocol milestone.

## Prohibited scope

No future event, next-event payload or time, endpoint total, remaining-vote fact, final winner, projection, Decision Desk state, EV call, editorial string, map style, animation instruction, camera state, React/deck.gl object, browser clock, command channel, EventEmitter, Observable transport, worker protocol, persistence, or network stream is part of v0.22E.
