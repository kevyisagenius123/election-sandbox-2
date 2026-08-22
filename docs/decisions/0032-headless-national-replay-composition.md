# 0032: Compose all 51 jurisdictions without inventing local returns

Date: 2026-08-21

## Status

Accepted by the product owner after supervisor authorization of bounded v0.21E.

## Decision

The headless replay package may compile and compose one complete 2024 presidential-election endpoint containing the 50 states and District of Columbia. Pennsylvania and Michigan remain detailed. The other 49 jurisdictions remain honestly coarse.

```text
Pennsylvania detailed stream
+ Michigan detailed stream
+ 49 exact statewide atomic streams
        ↓
generic admission
        ↓
absolute-time canonical merge
        ↓
one exact zero-to-endpoint national stream
```

The national layer validates, admits, orders, merges, sequences, audits, and fingerprints independently compiled jurisdiction streams. It does not generate votes, divide statewide totals into local batches, calculate leaders, estimate outstanding vote, or make calls.

## Capability law

The national replay contains exactly:

- two `detailed` jurisdictions: Pennsylvania and Michigan;
- 49 `coarse` jurisdictions;
- 51 admitted jurisdictions and 538 accepted electoral votes.

Pennsylvania continues to distinguish 2024 reporting units from 2020 Census VTD terrain. Michigan continues to distinguish its geometry-linked 2024 precinct result units from explicit off-map unmatched, central-count, and adjustment units. A coarse jurisdiction claims no county, precinct, batch, reporting-percentage, or local map geography.

Each coarse jurisdiction emits exactly three events:

1. `POLL_CLOSE`;
2. one `RETURN_PUBLISHED` event carrying its complete locked five-candidate statewide vector;
3. `REPLAY_COMPLETED`.

That atomic return is deliberately coarse. It must not be presented as historical reporting chronology.

## Clock and return-eligibility law

The generic clock now records both:

- `pollCloseInstant`, the first applicable legal closing boundary represented by the jurisdiction clock; and
- `returnEligibilityInstant`, the earliest instant at which the stream's indivisible return may legally represent all territory included in that return.

For a single-boundary jurisdiction the instants are identical. For a coarse multi-boundary jurisdiction, the statewide return is held until the latest applicable closing boundary. No synthetic time-zone vote bucket is invented.

The versioned `us-2024-poll-close-eligibility-v1` table owns the 51 clock rules. Detailed Pennsylvania and Michigan retain compiler-owned local scheduling. In particular, Michigan's Central Time county gate remains inside the Michigan compiler rather than being rearranged nationally.

The canonical global order remains:

```text
absoluteReplayTimeMs
→ unsigned orderTieBreaker
→ canonical eventId
```

## National scheduling law

One synthetic national profile is accepted: `us-synthetic-jurisdiction-wave-v1`.

Its root seed may alter only the timing of the 49 coarse atomic returns. Pennsylvania and Michigan continue to own their detailed compiler definitions and seeds. Changing the national seed cannot change votes, event identity, detailed-state streams, or the locked endpoint.

## Conservation and Electoral College law

Every event preserves the five locked candidate buckets:

```text
Harris
Trump
Stein
Oliver
Other/write-in residual
```

Every national prefix is bounded by the final endpoint. Every jurisdiction must reconcile independently before its totals enter the national sum, so equal and opposite corruption in different states cannot hide inside a correct-looking national total.

The 538 electoral votes are an endpoint reconciliation fact only. v0.21E does not call jurisdictions, assign projected winners, or create an Electoral College timeline.

## Fingerprint law

The national stream fingerprint covers the national schema and compiler versions, endpoint content fingerprint, complete normalized definition, all independently audited admissions, and the canonical composition. Metadata outside locked content cannot change it.

Frozen records:

```text
Certified national endpoint
sha256:ede060670bd8ece5d2933055c62a2053c3a87e4b2275546440993a5c10939aab

Certified national stream
sha256:e3239ba2fcd783207709582f4b7a75498b364e717951a04285909c399e8d3696

Complex national endpoint
sha256:05c391f4ecda01cfb831552f350793e9dcedfc303cf42441e80de29880212de1

Complex national stream
sha256:eb90e5c85c43cdf41b2c7ac1e5d66933283dddb36fa09c89a73c9912e17a9089
```

Both national streams contain 13,704 events: 13,602 exact return events and 102 control events.

## Prohibited scope

v0.21E does not authorize a replay reducer, cursor, reported-vote application state, leader tracking, expected vote, Decision Desk, projections, calls, React, deck.gl integration, animation, historical reporting chronology, reporting queue editing, Studio, video, backend, rooms, accounts, memberships, public deployment, or State #3 detailed admission.

The likely next milestone is a separately authorized v0.22A headless replay reducer. It may consume the frozen national stream but may not weaken any compiler, clock, evidence, or conservation law recorded here.
