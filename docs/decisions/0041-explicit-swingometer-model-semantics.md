# 0041: Make Swingometer operation semantics explicit

**Status:** Accepted for v0.24

## Decision

Every Swingometer operation must expose a visible model contract beside its controls. The contract states:

- which population or ballot basis the slider uses;
- what the operation changes;
- what remains invariant;
- how the operation's feasible boundary is determined;
- whether the assumption is a scenario input rather than a forecast.

State-specific turnout evidence is centralized in `src/data/modelSemantics.ts` and remains linked to the existing provenance ledger. Pennsylvania, Michigan, and Wisconsin must not share generic denominator wording when their geographic and demographic methods differ.

Preference and third-party sliders display their calculated directional endpoints numerically. Requested and realized ballot effects remain visible so local capacity or candidate-supply constraints cannot be mistaken for an unbounded linear response.

## Consequences

- Users can explain a slider before moving it.
- The interface distinguishes VAP, counted ballots, and candidate vote supply.
- Full feasible two-party movement remains available in both directions without an arbitrary margin cap.
- State-specific data limitations travel with the operation that depends on them.
- The scenario engine and its arithmetic remain unchanged.

## Non-scope

This decision does not add a demographic preference model, survey calibration, CVAP estimation, population editing, uncertainty, forecasting, persuasion claims, ecological inference, or a new detailed state.
