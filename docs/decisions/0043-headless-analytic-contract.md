# Decision 0043: Headless analytic contract

Date: 2026-08-23

## Decision

Sandbox 2.0 will produce analytics through a separate, deterministic `election-analytics` package before any analytic reaches React or deck.gl.

Every admitted value must match a registered definition and carry its semantic class, integer unit, candidate scope, geography, time scope, source identities, transform version, availability, and any required ratio operands.

## Contract law

- Missing is represented by `unavailable` plus a null value. It is never silently converted to zero.
- Zero remains an available numeric observation.
- Ratios carry explicit numerator and denominator values in the same registered unit.
- Current-prefix replay analytics may contain only information observable in the current prefix.
- Signed contributions and Electoral College consequences preserve direction.
- Residual and off-map geography remain explicit.
- Canonical serialization and SHA-256 fingerprints make collections deterministic and tamper-evident.
- Unknown definitions, duplicate identities, invalid scopes, fractional values, and malformed envelopes fail closed.

## Consequences

- Existing scenario and replay engines remain the sources of truth.
- The analytics package calculates no probability, projection, race call, candidate lean for unreported votes, or demographic causality.
- The application interface remains unchanged in v0.25A.
- v0.25B may build the scenario delta ledger as a consumer of this contract.
