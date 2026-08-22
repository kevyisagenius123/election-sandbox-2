# 0034: Derive only arithmetic facts from reported observable state

Date: 2026-08-21

## Status

Accepted by the product owner after the supervisor passed v0.22A and authorized bounded v0.22B.

## Decision

`reportedAnalytics.ts` may consume only `ReplayObservableState`. It may derive reported-vote leaders, exact reported margins, deterministic five-candidate rankings, explicit-denominator all-candidate and Harris-Trump shares, exact return counts, and available national, jurisdiction, county, published-unit, mapped, and off-map summaries.

The generic leader considers all five candidates. Zero votes produce `none`; equal top totals produce `tie`; canonical candidate ordering stabilizes serialization but never resolves an electoral tie. Harris-Trump arithmetic is separately and explicitly named.

Shares use integer rational facts plus rounded parts per million:

```text
numeratorVotes
denominatorVotes
partsPerMillion
```

Zero denominators produce `null`, never invented zero-percent shares.

## Isolation law

The module imports no endpoint, compiled stream, event array, checkpoint, Decision Desk, React, or deck.gl contract. Identical observable state under different valid futures produces byte-identical analytics.

Prohibited outputs include final winner, electoral votes, remaining or expected vote, generic percent reporting, projection, call status, or any inference about unfinished votes.

## Performance law

Headline APIs derive national, jurisdiction, county, or unit analytics without constructing the full snapshot. Full canonical snapshot derivation remains separately available for audit and serialization. The first baseline is recorded in `docs/review/v0.22b-reported-state-analytics/PERFORMANCE.md`.

## Identity

`rme-reported-analytics-v1` and `rme-headless-reported-analytics-v1` define the schema and implementation. Envelopes bind a reducer-state fingerprint, complete derived analytics, and canonical SHA-256 analytics fingerprint. Certified and complex fixtures freeze zero, event 1, event 100, event 1,000, midpoint, and final analytics fingerprints.

## Prohibited scope

No remaining-vote model, expected vote, Decision Desk, projection, call, Electoral College allocation, winner, React, map replay, playback controller, timeline, checkpoint optimization, backend, account, or deployment change is authorized.

The proposed next milestone is v0.22C Compact State/Checkpoint Runtime, separately authorized after review.
