# v0.22F verification: Minimal replay worker/runtime bridge

Date: 2026-08-22

## Candidate verdict

**PASS for the pre-authorized v0.23A visible slice.** Compilation, checkpoint construction, playback authority, and observation derivation now live behind one serialized worker boundary. The main thread receives only accepted current-state output.

## Verified contract

- Commands fail closed before initialization.
- Initialization is single-use and owns compilation, reducer-context creation, 250-event checkpoints, zero cursor, and initial sanitized snapshot.
- Worker requests execute in arrival order through one promise queue.
- Play, logical advance, reset, event-time stepping, and normalized seeking use the accepted v0.22D controller.
- Normal updates contain a sanitized transition plus compact current national/jurisdiction analytics and no full snapshot.
- Backward movement recommends resynchronization and exposes no newly observed future groups.
- Explicit resynchronization returns the accepted current full snapshot.
- Normalized timeline progress supports a scrubber without exposing private final boundaries or remaining events.
- Repeating reset plus step produces byte-identical output after request-envelope normalization.
- The compact headline remains byte-identical across the v0.22E certified/complex divergent-future fixture at an identical observable prefix.
- Response scans contain no source, endpoint, or national stream fingerprint, candidate event delta, final boundary, next event, remaining votes, or replay definition.
- The browser worker contains no `Math.random()` and the main-thread worker factory imports no compiler, reducer, or seek-index implementation.
- No React, deck.gl replay integration, Decision Desk, projection, call, server, persistence, event bus, or messaging framework was added.

## Gates

```text
Dedicated v0.22F suite      3 / 3 passed
v0.22E observation suite   8 / 8 passed, including compact-headline equality
npm run benchmark:worker   passed
npm run lint               passed
npm run build              passed
Prior v0.22E aggregate     accepted unchanged
git diff --check           passed
```

The dedicated suite constructs and compiles the certified 51-jurisdiction endpoint through the actual runtime class. The predecessor aggregate is not relaunched merely to repeat unchanged long-running compiler fixtures; targeted observation and worker coverage exercise the new boundary.

See [PERFORMANCE.md](PERFORMANCE.md) and [decision 0038](../../decisions/0038-minimal-replay-worker-runtime.md).

## Next milestone

The supervisor pre-authorized v0.23A after this gate: one visible replay screen with a national map, current candidate totals and reported margin, honest reporting representation where supported, logical clock, play/pause/reset/seek/step controls, state selection, and a basic county view. It must consume only worker responses. Decision Desk behavior, projections, calls, cinematic animation, export, backend, accounts, and commercial delivery remain excluded.
