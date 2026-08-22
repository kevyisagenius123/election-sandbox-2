# 0030: Generalize replay law before compiling another detailed jurisdiction

Date: 2026-08-21

## Status

Accepted by the product owner after supervisor authorization of v0.21C.

## Decision

v0.21B and both Pennsylvania compiled fingerprints are accepted. v0.21C may introduce only the pure contracts required to admit and deterministically compose independently valid jurisdiction streams.

Pennsylvania may remain internally specialized, but its output must satisfy a jurisdiction-independent stream contract. The accepted baseline and complex compiled fingerprints may not change for architectural convenience.

## Explicit capability

Every admitted jurisdiction declares one validated replay capability:

- `detailed`: legitimate local reporting units exist;
- `coarse`: one honest jurisdiction-total unit exists and no local geography is claimed;
- `hybrid`: legitimate local units coexist with explicit residual or off-map units.

Capability is supplied as contract metadata and validated against the locked endpoint. It is never inferred merely from a child-array length. Source-unit and map-geography labels remain separate so Pennsylvania VTD terrain cannot be confused with Michigan exact-cycle precinct geography.

## Common envelope and admission

Downstream composition consumes a generic compiled-jurisdiction stream. Admission binds it to:

- one locked endpoint fingerprint;
- one jurisdiction ID and electoral allocation;
- an explicit capability;
- an absolute poll-close instant and IANA presentation time zone;
- compiler, profile, replay-definition, and event-stream identities;
- canonical evidence identifiers;
- exact five-candidate endpoint totals.

A jurisdiction is audited independently before admission. Composition cannot repair a bad local stream.

## Time and ordering

Jurisdiction streams retain integer milliseconds relative to their own poll-close control event. Admission supplies a canonical ISO-8601 UTC poll-close instant. Composition converts each relative time to an absolute Unix epoch millisecond.

Canonical cross-jurisdiction order is:

```text
absoluteReplayTimeMs
→ unsigned deterministic tie breaker
→ canonical eventId
```

Global sequence is assigned only after this comparison. Local sequence and time remain separate from event identity. Presentation time zones never determine ordering.

## Composition boundary

The v0.21C compositor merges already accepted jurisdiction streams. It does not generate, partition, transfer, or reallocate votes. It reports whether coverage is partial or complete, sums only accepted endpoint totals, and separately verifies that the locked election retains exactly 538 electoral votes.

The coarse contract fixture may emit one atomic jurisdiction-total return. It may not fabricate counties, precincts, wards, or reporting percentages.

## Namespace isolation

State and local timing streams include jurisdiction identity, for example:

```text
activation/state/{jurisdictionId}
timing/unit/{jurisdictionId}/{unitId}
```

Identical local unit IDs in different jurisdictions remain separate both in deterministic randomness and canonical event identity.

## Prohibited scope

v0.21C does not authorize a Michigan compiler, national vote generator, replay reducer, playback state machine, React or deck.gl integration, map animation, Decision Desk, projections, calls, historical chronology, reporting-order editor, video, rooms, backend, public deployment, membership work, or State #3 admission.

The human, redistribution, and public-release gates remain unchanged.
