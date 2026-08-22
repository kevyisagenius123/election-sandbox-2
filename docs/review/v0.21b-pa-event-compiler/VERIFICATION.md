# v0.21B Headless Pennsylvania Event Compiler Verification

Date: 2026-08-21

## Verdict

**PASS as a supervisor-review candidate for v0.21B.**

This record implements only the authorized private, headless Pennsylvania compiler. It does not authorize v0.21C, public delivery, election-night UI, Decision Desk logic, other-state replay, a backend, memberships, rooms, or video.

## Scope delivered

- Pure TypeScript compiler inside `packages/election-replay` with no React or deck.gl dependency.
- One atomic `RETURN_PUBLISHED` event for each of Pennsylvania's 9,140 locked reporting units.
- Complete five-candidate vectors copied exactly from the locked endpoint only after candidate-blind scheduling.
- Explicit zero-vote `POLL_CLOSE` and `REPLAY_COMPLETED` control events.
- Candidate-blind scheduling from unit identity, county identity, unit type, total ballot workload, profile, and named deterministic streams.
- Two explicitly synthetic, versioned Pennsylvania profiles: rural-first and metropolitan-late.
- Stable event identity independent of replay time and compiled sequence.
- Canonical order by replay time, unsigned deterministic tie breaker, then canonical event ID.
- Canonical event-stream serialization and SHA-256 fingerprinting.
- Headless audit of event identity, order, control structure, evidence links, unit vectors, counties, off-map units, prefixes, and final Pennsylvania totals.
- Exact xoshiro128** all-zero fallback: `[0x6d2b79f5, 0x1b56c4e9, 0x9e3779b9, 0x243f6a88]`.

## Constitutional behavior

The compiler schedules votes but never models or changes them:

```text
Locked Pennsylvania endpoint
        -> candidate-blind atomic-unit schedule
        -> attach each exact locked five-candidate vector once
        -> canonical deterministic order
        -> exact locked Pennsylvania endpoint
```

Every stream begins with zero reported votes. Every return is nonnegative, integral, and atomic. At every prefix, each candidate's reported total remains between zero and that candidate's locked total. The final event reconstruction equals every reporting unit, all 67 counties, every explicit off-map unit, and Pennsylvania exactly.

The scheduler has no candidate-vector or winner input. Adding winner labels or different candidate-share objects to otherwise identical scheduler inputs does not change the schedule. No lead-change, desired-outcome, call, or drama objective exists in the compiler.

## Versioned named streams

The compiler uses independent namespaces rather than one global random sequence:

```text
activation/county/{countyId}
timing/unit/{unitId}
timing/statewide-residual/{unitId}
```

Adding draws to one concern therefore does not perturb another concern's stream. Both profiles are explicitly synthetic and must not be described as historical Pennsylvania reporting chronology.

## Golden compiled fixtures

Definition:

```text
profile:   pa-synthetic-rural-first-v1
root seed: supervisor-pa-compiler-seed-v1
compiler:  pa-atomic-event-compiler-v1
schema:    rme-compiled-events-v1
```

| Fixture | Locked endpoint fingerprint | Compiled event-stream fingerprint |
|---|---|---|
| Certified baseline | `sha256:bbb5c3e94b2413829b7d9d8d243fcb9ed44e68ddfd4bde567cec1e91079b91c9` | `sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c` |
| Complex counterfactual | `sha256:07de00195da9ab840f9b82947fa7b75c3e64400f086605926836d516e9c716d2` | `sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8` |

Changing lock time, scenario metadata, or collection insertion order reproduces the same baseline compiled fingerprint and byte stream. Changing the seed or synthetic profile changes scheduling while preserving event identities and every vote.

## Release-blocking coverage

The tests prove all 20 supervisor requirements:

1. Same endpoint, configuration, and seed produce a byte-identical stream.
2. Different `createdAt` values produce the same stream.
3. Different scenario metadata produces the same stream.
4. A different seed may alter scheduling but not votes.
5. All five candidate buckets reconcile exactly.
6. Every Pennsylvania county reconciles exactly.
7. Every detailed reporting unit reconciles exactly.
8. Off-map and residual votes remain explicit and conserved.
9. Event identities are unique.
10. Rescheduling preserves identity.
11. Sequence is not identity.
12. Fractional votes are rejected.
13. Negative votes are rejected.
14. No prefix over-reports a locked candidate total.
15. Empty or malformed endpoints fail closed.
16. A tampered endpoint fingerprint fails before compilation.
17. The replay package contains no `Math.random()` call.
18. The replay package contains no React or deck.gl import.
19. Compilation does not mutate the endpoint.
20. Final reconstructed Pennsylvania totals equal the locked endpoint exactly.

Additional gates prove input-order stability, candidate-blind scheduling, strict profile identity, evidence-link conservation, exact control-event structure, both synthetic profiles, and compiled-stream tamper detection.

## Verification commands

```text
npm test
73 passed, 0 failed

npm run lint
PASS

npm run build
PASS
```

The existing approximately 1.6 MB minified deck.gl chunk warning remains. The compiler is not mounted into the React application, so v0.21B adds no replay interface or deck.gl behavior.

## Browser-suite record

No application behavior changed in v0.21B, and the pure package is not imported by the application bundle. The accepted v0.21A browser record remains stated exactly as observed: 36 of 38 current journeys passed in the aggregate run, two navigation-heavy journeys timed out at suite level and then passed in isolation, and three deliberate review/environment journeys were skipped. This is a combined 38-of-38 current-journey disposition, not a claim that one aggregate invocation passed all 38.

## Requested supervisor decision

Choose exactly one:

1. **Authorize v0.21C** - accept the Pennsylvania compiler and separately scope multi-state reporting contracts.
2. **Correct v0.21B** - specify a bounded compiler, audit, or verification correction.
3. **Hold** - do not begin another state or a reducer.
