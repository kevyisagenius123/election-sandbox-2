# Decision 0050: Derive one causal scenario explanation from the accepted ledger

Date: 2026-08-23

## Decision

The Swingometer will explain each detailed-state scenario through one deterministic causal chain:

```text
main operation -> strongest geography -> electoral consequence
```

The chain is computed by the headless election-analytics package from the existing scenario delta ledger. React only formats the accepted result.

## Rules

- Dominant operation means the operation with the largest absolute signed Harris minus Trump margin movement.
- Ties use the fixed operation order: turnout, preference, third party.
- The operation share uses gross absolute operation movement, so opposing operations remain visible rather than being netted away.
- Supporting and opposing geography follow the direction of statewide movement and use the existing deterministic contribution ranking.
- Only units with honest mapped geometry may be named as the strongest local unit.
- State winner and EV consequence are derived from exact certified and scenario endpoints, independent of the selected national target candidate.
- Zero movement produces an explicit certified-baseline explanation rather than invented geography.

## Consequences

- No chart, probability, projection, or new renderer is added.
- The detailed operation waterfall and county/local rankings remain available below the summary.
- The right rail remains the national portfolio view; it is not duplicated inside the drawer.
- The contract is reusable for Pennsylvania, Michigan, and Wisconsin and is covered by order-independence tests.
