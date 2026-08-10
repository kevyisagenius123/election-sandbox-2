# Decision 0008: Bidirectional preference and contribution tracing

## Status

Accepted for Sandbox 2.0 v0.5.

## Decision

The two-party preference control has no arbitrary interface ceiling. Its Republican endpoint transfers every available Harris ballot to Trump, and its Democratic endpoint transfers every available Trump ballot to Harris. Bounds are recalculated after turnout because turnout runs first. Candidate totals may reach zero but can never become negative.

Turnout composition similarly exposes the complete zero-to-100 percent Harris range. This does not remove the VAP capacity constraint on how many turnout ballots may be created.

Contribution is defined for every model unit as:

```text
(scenario Harris - scenario Trump) - (baseline Harris - baseline Trump)
```

Positive values move the margin toward Harris. Negative values move it toward Trump. Unit contributions aggregate exactly to counties and the statewide margin change. The VTD ranking includes mapped terrain only and separately discloses the contribution from reporting units outside that terrain.

Third-party movement is not folded into this two-party control. It will be introduced later as a separate multi-candidate operation that preserves total ballots and explicit candidate buckets.

## Consequences

- Republican and Democratic counterfactuals have symmetric model treatment.
- The UI cannot silently cap an analytically valid scenario at four points.
- Extreme endpoints remain mathematically valid even when they are politically implausible.
- The contribution panel explains where the result changed without pretending that Census demographics observe candidate preference.
