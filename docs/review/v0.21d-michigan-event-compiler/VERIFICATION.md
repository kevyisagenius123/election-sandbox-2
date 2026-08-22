# v0.21D verification: Headless Michigan event compiler

Date: 2026-08-21

## Candidate verdict

**PASS for supervisor review.** This is a bounded headless proof. It is not authorization for v0.21E, a replay reducer, UI work, public delivery, or State #3.

## Implemented contract

- Michigan compiles through the unchanged generic `CompiledJurisdictionReplay` envelope.
- The certified and complex scenario endpoints are produced by the existing deterministic Michigan scenario engine.
- One atomic return exists per 4,413 locked Michigan model units.
- 4,339 units retain exact-cycle mapped precinct geometry.
- 74 unmatched, central-count, and adjustment units remain explicit off-map returns.
- Five candidate buckets conserve exactly at every unit, county, state, and replay prefix.
- Scheduling is synthetic, versioned, seeded, deterministic, and candidate-blind.
- Michigan-owned PRNG namespaces and jurisdiction-bearing event identities cannot collide with Pennsylvania.
- A shared locked PA+MI endpoint admits and composes both detailed streams without a generic state branch.

## Frozen fingerprints

| Fixture | Locked endpoint | Compiled Michigan stream |
|---|---|---|
| Certified baseline | `sha256:4a9bb791497c487eea16c7fcab13af628afff27c6bf1f9c9ba91f8c82b7612c1` | `sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484` |
| Complex counterfactual | `sha256:2a81ff04b0ad19c583ce805f0af09455d227ece17151ba196caa87307c2b5e24` | `sha256:a5391fbda94477926d06f90885e22120d4e8801e8fdcd49e9063d55f1461dba6` |

Pennsylvania regression fixtures remain:

```text
sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c
sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8
```

## Release-blocking evidence

The v0.21D test group covers the supervisor's required laws in grouped invariant tests:

1. PA golden compiled fingerprints remain frozen.
2. MI certified and complex endpoints lock deterministically.
3. Same endpoint/profile/seed is byte-identical.
4. Lock metadata and input order cannot alter compiled content.
5. Seeds and profiles may alter timing but not event identity or votes.
6. Adversarial winner/share objects cannot alter the candidate-blind schedule.
7. Every unit, county, off-map structure, statewide candidate, and prefix reconciles.
8. Fractional and negative endpoint votes fail closed.
9. Generic serialization round-trips Michigan byte-identically.
10. Generic audit and admission accept valid Michigan output with exact evidence trace.
11. Tampered streams fail before composition and tampered endpoints fail before compilation.
12. Equal local IDs and PRNG stream labels remain jurisdiction-isolated.
13. Detailed PA+MI composition is input-order, completion-order, and repeated-run deterministic.
14. Composition changes zero votes and sums exactly 34 accepted EV against a 538-EV locked election.
15. Michigan cannot claim Pennsylvania's VTD map contract and Pennsylvania cannot claim Michigan's exact-cycle map contract.
16. The headless package remains React/deck.gl-free and contains no `Math.random()`.

## Geography disclosure

The source-unit label deliberately says `geometry-linked precinct result unit`, not raw precinct row. Michigan's existing foundation deterministically represents 4,347 official geographic source units as 4,339 exact-cycle mapped result units where the official geometry contract aggregates source identities. Eight unmatched geographic units, 65 central-count units, and the normalized statewide adjustment remain explicit off-map units.

The demographic bridge to 2020 Census VTDs is not used as replay terrain metadata.

## Time disclosure

The generic clock retains one canonical Michigan instant and one presentation zone. The first statewide poll-close boundary is 8 PM Eastern. Four Central Time counties receive a neutral one-hour local-close gate before any synthetic return may appear. That gate uses county identity only and cannot inspect outcome data.

## Commands

```bash
node --experimental-strip-types --test tests/michigan-replay-compiler.test.mjs
npm test
npm run lint
npm run build
```

Current gate result:

```text
npm test       97 / 97 passed
npm run lint   passed
npm run build  passed
```

The build retains the existing deck.gl chunk-size warning; it is not introduced by the headless replay package.

The standing browser disposition remains unchanged because application code does not import the replay package:

```text
Aggregate invocation: 36 / 38 current journeys passed
2 timed out at suite level
Isolation reruns: 2 / 2 passed
Combined current-journey disposition: 38 / 38
```

## Explicit omissions

No national 51-jurisdiction compiler, reducer, playback cursor, reported-vote store, lead tracker, expected-vote model, Decision Desk, projection, call, React component, map integration, animation, historical chronology, queue editor, Studio, video, backend, rooms, accounts, memberships, deployment change, or State #3 work is included.
