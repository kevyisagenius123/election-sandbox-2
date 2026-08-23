# 0040: Reuse the active Election Night worker and explain local return movement

**Status:** Accepted for v0.23B

## Decision

Election Night keeps one worker alive while the user remains inside the replay experience. Reapplying chronology settings reuses that worker rather than downloading and decoding Pennsylvania, Michigan, and Wisconsin again.

The worker owns two bounded, process-local caches:

- one decoded foundation for each of the three admitted detailed states;
- no more than three scenario-unit arrays, enough for the currently locked three-state endpoint.

Leaving Election Night or unmounting the application terminates the worker and releases both caches. Nothing is written to browser storage, promoted to URL authority, or shared with the Swingometer worker.

Certified, unchanged state recipes use a direct zero-change scenario-unit projection. A non-default recipe still runs through the accepted election-model transformation. Both paths produce the same `BehaviorScenarioUnit` contract before chronology is compiled.

Each published local return now exposes current-only arithmetic:

- its five-candidate vote vector;
- its net Harris-minus-Trump movement;
- state and county margin totals immediately before and after that event.

These facts are derived while the event is applied. They reveal no future return, endpoint remainder, projection, or call state.

## Consequences

- Chronology-only restarts avoid repeated network, JSON-decode, and scenario work.
- The cache cannot grow across an unbounded editing session.
- The map and scenario remain unchanged; only worker lifecycle and visible explanation improve.
- The local return tape can explain why the current state margin moved without introducing Decision Desk inference.

## Explicit non-scope

This decision does not add persistent replay artifacts, service-worker caching, IndexedDB, backend storage, projections, race calls, expected vote, unsupported-state returns, or partial precinct batches.
