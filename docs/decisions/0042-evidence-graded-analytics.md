# Decision 0042: Evidence-graded analytics

Date: 2026-08-23

## Decision

Sandbox 2.0 will classify every analytic as certified, reported, scenario, derived, modeled, or decision. Each value will have one authoritative formula and an explicit unit, denominator, geography, time scope, source identity, and transform version.

The old Sandbox's descriptive analytics are design input, not implementation input. Unsupported win probabilities, race calls, outstanding-vote leans, bellwether claims, and composite importance scores will not be ported.

## Rationale

The legacy product mixed exact arithmetic with heuristic projections and displayed them at similar visual authority. Duplicate probability formulas and invented fallback trajectories made the interface richer while weakening interpretability.

Sandbox 2.0 already has deterministic endpoint, contribution, Electoral College, and current-prefix replay contracts. A formal analytic envelope lets the product regain depth without weakening those foundations.

## Consequences

- v0.25 begins with a headless analytic registry, not a chart redesign.
- Swingometer analytics remain directly tied to scenario operations and the shared map.
- Election Night analytics remain directly tied to canonical return events and the shared bottom dock.
- Modeled estimates and Decision Desk outputs require later independent authorization.
- Missing evidence remains unavailable rather than becoming a neutral numeric fallback.
