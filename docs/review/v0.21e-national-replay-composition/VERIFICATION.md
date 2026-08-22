# v0.21E verification: Headless national replay composition

Date: 2026-08-21

## Candidate verdict

**PASS for supervisor review.** This is a bounded headless national-composition proof. It does not authorize a reducer, replay interface, Decision Desk, public delivery, or State #3 detailed admission.

## Implemented contract

- Exactly 50 states and District of Columbia enter one complete deterministic timeline.
- Pennsylvania and Michigan retain their accepted detailed compilers and different geography/evidence contracts.
- The other 49 jurisdictions each publish one exact statewide five-candidate return with no invented local geography or intermediate batches.
- Generic admission audits every jurisdiction before composition.
- The national layer only validates, admits, orders, merges, sequences, audits, and fingerprints.
- All five candidate buckets reconcile at every jurisdiction, authoritative detailed hierarchy, national prefix, and final national endpoint.
- Complete composition reconciles exactly 538 accepted electoral votes without implementing calls.
- Poll close and atomic-return eligibility are separate, versioned clock facts.
- The national seed can change coarse timing but cannot change votes, detailed streams, or event identity.

## Frozen fingerprints

| Fixture | Locked endpoint | Compiled national stream |
|---|---|---|
| Certified baseline | `sha256:ede060670bd8ece5d2933055c62a2053c3a87e4b2275546440993a5c10939aab` | `sha256:e3239ba2fcd783207709582f4b7a75498b364e717951a04285909c399e8d3696` |
| Complex PA/MI counterfactual | `sha256:05c391f4ecda01cfb831552f350793e9dcedfc303cf42441e80de29880212de1` | `sha256:eb90e5c85c43cdf41b2c7ac1e5d66933283dddb36fa09c89a73c9912e17a9089` |

Accepted detailed-state stream goldens remain unchanged:

```text
PA certified  sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c
PA complex    sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8
MI certified  sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484
MI complex    sha256:a5391fbda94477926d06f90885e22120d4e8801e8fdcd49e9063d55f1461dba6
```

## Stream inventory

| Contract fact | Value |
|---|---:|
| Admitted jurisdictions | 51 |
| Detailed jurisdictions | 2 |
| Coarse jurisdictions | 49 |
| Total events | 13,704 |
| `RETURN_PUBLISHED` events | 13,602 |
| Control events | 102 |
| Accepted electoral votes | 538 |

The 13,602 returns are 9,140 Pennsylvania returns, 4,413 Michigan returns, and 49 coarse statewide returns. The 102 controls are `POLL_CLOSE` and `REPLAY_COMPLETED` for each jurisdiction.

## Clock disclosure

`us-2024-poll-close-eligibility-v1` records a canonical UTC poll-close instant, IANA presentation zone, and atomic-return eligibility instant for every jurisdiction. Where one coarse statewide vector covers more than one legal closing boundary, its return cannot publish until the latest represented boundary. This avoids both premature statewide publication and invented time-zone vote buckets.

Detailed compiler ownership is preserved. Pennsylvania begins from its accepted statewide close. Michigan begins from its accepted Eastern boundary and independently gates Central Time counties before their local close.

This table is a 2024 replay contract, not reusable timeless election law and not historical return chronology. A later election cycle requires a newly reviewed clock-contract version.

## Release-blocking evidence

The v0.21E grouped invariant suite covers the supervisor's 40 required checks:

1. Certified and complex national endpoints and streams are deterministic and frozen.
2. Pennsylvania and Michigan certified and complex stream goldens remain unchanged.
3. Exactly 51 expected jurisdictions are admitted once; partial or duplicate coverage fails closed.
4. Exactly two jurisdictions are detailed and 49 are coarse.
5. Pennsylvania VTD and Michigan exact-cycle precinct capability claims remain distinct.
6. Every coarse jurisdiction has one exact statewide return and claims no local geography.
7. Endpoint collection order, lock metadata, admission order, worker-completion order, and repeated runs cannot alter output.
8. A different national seed may alter coarse timing but never votes or detailed streams.
9. Every jurisdiction reconciles independently before national aggregation.
10. Detailed units, counties, off-map units, states, national totals, and every prefix conserve exactly.
11. Cross-jurisdiction compensation cannot conceal a corrupted jurisdiction.
12. Multi-boundary coarse returns cannot publish before their latest represented close.
13. Global ordering is canonical and every event identity is unique.
14. National, admission, stream, and endpoint tampering fails before use.
15. Serialization round-trips byte-identically with complete capability and evidence lineage.
16. Composition changes zero votes and reconciles exactly 538 endpoint electoral votes.
17. The package remains headless, React/deck.gl-free, and contains no `Math.random()`.

## Commands

```bash
node --experimental-strip-types --test tests/national-replay-composition.test.mjs
npm test
npm run lint
npm run build
git diff --check
```

Current gate result:

```text
Dedicated v0.21E suite  11 / 11 passed
npm test                108 / 108 passed
npm run lint            passed
npm run build           passed
git diff --check        passed
```

The production build retains the existing approximately 1.6 MB minified deck.gl chunk warning. The headless replay package is not imported by the application bundle, so v0.21E adds no replay interface code or bundle regression.

The standing browser disposition remains unchanged because the application bundle still does not import the replay package:

```text
Aggregate invocation: 36 / 38 current journeys passed
2 timed out at suite level
Isolation reruns: 2 / 2 passed
Combined current-journey disposition: 38 / 38
```

## Explicit omissions

No replay reducer, playback cursor, reported-vote store, leader tracker, expected-vote model, Decision Desk, projection, call, React component, map integration, animation, historical chronology, reporting editor, Studio, video, backend, rooms, accounts, memberships, deployment change, or State #3 detailed work is included.

## Proposed next decision

If the supervisor accepts this proof, the proposed next milestone is a separately bounded **v0.22A Headless Replay Reducer**. It should prove deterministic zero-state, event application, checkpoint/reseek equivalence, prefix totals, completion, and future-data isolation before any interface consumes the replay.
