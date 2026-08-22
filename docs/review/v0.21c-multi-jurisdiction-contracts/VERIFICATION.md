# v0.21C Multi-Jurisdiction Replay Contracts Verification

Date: 2026-08-21

## Verdict

**PASS as a supervisor-review candidate for v0.21C.**

This is contract law, not a Michigan compiler or national election-night product. It introduces the generic admission and composition boundary required for independently valid jurisdiction streams to coexist without weakening endpoint, identity, conservation, evidence, or timing rules.

## Scope delivered

- Generic `CompiledJurisdictionReplay` contract satisfied by the existing Pennsylvania output without changing its serialized shape.
- Generic compiled-stream serializer, deserializer, structural validator, and SHA-256 verification.
- Explicit `detailed`, `coarse`, and future `hybrid` geography capability types.
- Separate source-unit and map-unit labels, preserving Pennsylvania's 2024 reporting-unit versus 2020 Census VTD-terrain distinction.
- Explicit residual treatment rather than inference from array length.
- Absolute time contract using canonical ISO-8601 UTC poll-close instants, Unix epoch milliseconds, and independent IANA presentation zones.
- Generic jurisdiction audit and admission wrapper with exact endpoint, compiler, profile, replay-definition, stream, evidence, candidate, and EV traceability.
- One bounded coarse fixture compiler that emits one honest atomic jurisdiction-total return and claims no local geography.
- Deterministic compositor that merges accepted streams by absolute time, unsigned tie breaker, then global event identity.
- Partial-versus-complete composition coverage and separate accepted-versus-locked-election electoral totals.
- Safe verification caching only for already deep-frozen endpoints; mutable or cloned inputs still receive full fail-closed validation.
- No Pennsylvania output change, Michigan detailed compiler, national vote generator, reducer, UI, Decision Desk, backend, or deployment work.

## Frozen Pennsylvania outputs

The generic interface and serializer preserve the accepted v0.21B streams exactly:

| Fixture | Event-stream fingerprint |
|---|---|
| Pennsylvania certified baseline | `sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c` |
| Pennsylvania complex counterfactual | `sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8` |

Generic serialization round-trips the Pennsylvania stream byte-identically.

## Capability fixtures

### Detailed fixture: Pennsylvania

```text
capability:       detailed
source units:     2024 Pennsylvania election reporting units
map terrain:      2020 Census VTD terrain
residuals:        explicit off-map
reporting units:  9,140
counties:         67
```

This metadata does not claim that reporting units and map polygons are methodologically identical.

### Coarse fixtures: Michigan and Wisconsin

The existing locked national endpoint supplies one honest `jurisdiction-total` unit for each fixture. Each compiled fixture has exactly:

```text
POLL_CLOSE
RETURN_PUBLISHED  (one five-candidate statewide vector)
REPLAY_COMPLETED
```

No county, precinct, ward, batch percentage, or detailed chronology is fabricated. These are contract fixtures, not Michigan or Wisconsin detailed replay compilers.

### Composition fixture

Michigan and Wisconsin coarse streams demonstrate:

- input-order independence;
- worker-completion-order independence;
- Eastern and Central poll closes represented as distinct absolute instants;
- deterministic ordering of simultaneous controls;
- conflicting local unit IDs remaining globally distinct;
- exact candidate and accepted-EV sums;
- unchanged locked-election total of 538 EV;
- independent evidence and compiler traceability.

## Time contract

Every jurisdiction declares:

```text
epoch:              1970-01-01T00:00:00.000Z
pollCloseInstant:   canonical UTC instant
pollCloseEpochMs:   absolute integer milliseconds
timeZone:           validated IANA presentation zone
```

Jurisdiction event times remain integer milliseconds relative to poll close. Composition calculates absolute time before ordering. Locale strings and daylight-saving abbreviations never determine event order.

Canonical merge order is:

```text
absoluteReplayTimeMs
→ unsigned orderTieBreaker
→ canonical eventId
```

Global sequence is assigned afterward. Jurisdiction-local sequence is retained separately, and neither time nor sequence participates in event identity.

## Evidence and conservation

Every admitted jurisdiction carries:

- locked endpoint fingerprint;
- compiler version;
- profile ID;
- replay-definition fingerprint, which binds the root-seed definition;
- compiled stream fingerprint;
- canonical evidence IDs;
- exact five-candidate endpoint totals;
- exact electoral votes;
- explicit capability and clock.

Each jurisdiction fully reconciles before admission. The compositor revalidates every admission and cannot repair or conceal a broken jurisdiction stream. Composition sums accepted endpoints and their already-audited return events; it never partitions or reallocates votes.

## Release-blocking coverage

The 13 new tests collectively prove all 20 required supervisor gates:

1. Both Pennsylvania compiled fingerprints remain unchanged.
2. Generic PA serialization round-trips byte-identically.
3. Equal local IDs in different jurisdictions produce distinct event IDs.
4. Jurisdiction input order cannot change composed ordering.
5. Worker completion order cannot change composition.
6. Identical composition is byte-identical.
7. Absolute timestamps order different time zones correctly.
8. Simultaneous events use tie breaker then event identity.
9. Coarse endpoints participate without fabricated local geography.
10. Detailed and coarse capabilities are explicit and validated.
11. Candidate vectors remain complete, five-bucket, and exact.
12. Composition creates, removes, and reallocates zero votes.
13. Each jurisdiction reconciles independently before composition.
14. Composed candidate totals equal the sum of accepted endpoints.
15. The locked national Electoral College remains exactly 538.
16. Endpoint, compiler, profile, definition, stream, and evidence identities remain traceable.
17. State and unit PRNG namespaces do not collide across jurisdictions.
18. The package remains React and deck.gl free.
19. Canonical replay contains no `Math.random()` call.
20. A tampered jurisdiction stream fails before composition.

Additional tests reject incompatible capability claims and verify Pennsylvania's source-versus-map geography distinction explicitly.

## Verification commands

```text
npm test
86 passed, 0 failed

npm run lint
PASS

npm run build
PASS
```

The existing approximately 1.6 MB minified deck.gl warning remains unchanged. The replay package is not mounted into the application.

## Browser-suite record

No application behavior changed. The historical record remains exact: 36 of 38 current journeys passed in the aggregate invocation, two suite-level timeouts passed individually, and three deliberate review/environment journeys were skipped. The combined current-journey disposition is 38 of 38; this is not represented as one clean aggregate run.

## Requested supervisor decision

Choose exactly one:

1. **Authorize a bounded v0.21D** - specify whether the next proof is a Michigan compiler or a headless composition slice.
2. **Correct v0.21C** - specify a bounded contract, capability, time, evidence, or composition correction.
3. **Hold** - do not add another compiler or reducer.
