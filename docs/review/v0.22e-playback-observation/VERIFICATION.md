# v0.22E verification: Headless sanitized playback observation contract

Date: 2026-08-22

## Candidate verdict

**PASS for supervisor review.** Snapshots and transitions expose only facts observable at valid current cursors. Identical observed prefixes and transitions remain byte-identical across certified and complex streams with different futures.

## Verified contract

- Zero snapshot contains no votes, reported geography, or hidden future information.
- Play and pause change controller status but leave election knowledge byte-identical.
- One and simultaneous timestamp groups expose only complete newly observable group facts.
- Forward, backward, reset, stationary, and completion transitions are explicit.
- Backward/reset transitions expose no newly observed timestamp groups.
- Certified and complex streams with identical observable prefixes produce byte-identical snapshots before divergence.
- Their identical applied transitions also produce byte-identical transition serialization.
- Reported leader, margin, ranking, and shares come from accepted v0.22B APIs.
- County and unit rows contain only already-published copied vote vectors.
- Canonical serialization, fingerprints, round-trip validation, and tamper rejection pass.
- Foreign cursors fail closed.
- Source fingerprints, final boundaries, next-event information, remaining structure, endpoint totals, inference, presentation, transport, and UI fields are absent.
- No EventEmitter, Observable transport, worker subscription, React, deck.gl, timer, persistence, or network protocol was added.

## Gates

```text
Dedicated v0.22E suite      8 / 8 passed
npm run benchmark:observation passed
npm run lint                passed
npm run build               passed
Prior v0.22D aggregate      144 / 144 passed
git diff --check            passed
```

The predecessor aggregate remains the accepted v0.22D record. The new observation suite imports and exercises the accepted endpoint, compiler, reducer, seek index, controller, analytics, certified fixture, and complex fixture as eight additional grouped tests. It is recorded separately rather than relaunching the unchanged 17-minute predecessor aggregate, following the supervisor's warning about the default feedback loop.

The benchmark record is [PERFORMANCE.md](PERFORMANCE.md). It deliberately records both compact one-group transitions and the multi-megabyte final current-state snapshot so a later transport milestone cannot pretend full snapshots are free.

## Proposed next decision

No transport or UI begins automatically. If v0.22E passes supervisor review, a likely v0.22F is a headless runtime adapter/worker protocol that converts external logical deltas into controller commands and transmits sanitized observations without exposing future state. That milestone must preserve the firewall and keep the approximately 2.9-second index construction off the UI thread.
