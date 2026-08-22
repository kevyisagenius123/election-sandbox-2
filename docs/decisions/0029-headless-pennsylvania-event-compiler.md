# 0029: Compile Pennsylvania as atomic, synthetic, endpoint-conserving returns

Date: 2026-08-21

## Status

Accepted by the product owner after supervisor authorization of v0.21B.

## Decision

v0.21A endpoint law is accepted. v0.21B may implement only a private, headless Pennsylvania event compiler inside the pure replay package.

The compiler is a deterministic partition-and-order operation over an already verified locked endpoint. It may schedule votes. It may not create, remove, transfer, infer, or narratively arrange votes.

Every Pennsylvania reporting unit is atomic in v0.21B. One locked unit produces one `RETURN_PUBLISHED` event containing its complete five-candidate vector. The compiler does not invent intermediate reporting percentages or sub-unit batches.

## Scheduling boundary

Scheduling consumes only administrative fields:

- unit ID;
- county ID;
- unit type;
- total ballots;
- county workload and unit count;
- selected synthetic profile;
- named deterministic streams.

It does not receive candidate vote shares, the statewide winner, the electoral allocation winner, or a desired narrative. Candidate vectors are attached to already scheduled unit identities only after scheduling is complete.

## Initial profiles

- `pa-synthetic-rural-first-v1`
- `pa-synthetic-metropolitan-late-v1`

Both are explicitly synthetic. Their times are not represented as historical Pennsylvania return timestamps.

## Ordering

Canonical compiled order is:

```text
replayTimeMs
→ unsigned deterministic tie breaker
→ canonical eventId
```

Sequence numbers are assigned only after that complete comparison. Event identity excludes replay time and sequence.

## Conservation

The compiler and audit must prove:

- exact five-candidate reconciliation for every unit;
- exact unit-plus-residual reconciliation for every county;
- exact county-plus-statewide-residual reconciliation for Pennsylvania;
- no negative or fractional deltas;
- no prefix exceeding the locked state total for any candidate;
- one unique return identity per atomic reporting unit;
- unchanged endpoint content and fingerprint after compilation.

## Reproducibility

The compiled stream fingerprint binds:

```text
endpoint content fingerprint
+ replay schema version
+ compiler version
+ reporting profile
+ root seed
+ canonical ordered events
```

Lock timestamps and scenario metadata do not participate. Identical election content, configuration, and seed must produce byte-identical output.

## Prohibited scope

v0.21B does not authorize a reducer UI, Decision Desk, calls, outstanding-vote estimates, national or other-state compilation, map animation, playback controls, reporting editor, camera, video, backend, accounts, memberships, rooms, public delivery, or State #3 work.

v0.21C-F remain unauthorized.
