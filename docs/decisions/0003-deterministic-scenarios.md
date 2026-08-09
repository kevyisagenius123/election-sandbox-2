# ADR 0003: Deterministic scenarios are the primary interaction model

## Status

Accepted.

## Decision

The main scenario engine returns one deterministic expected result for a fixed election, data version, engine version, ordered mutation ledger, and optional seed. Statistical uncertainty is a separate opt-in layer.

## Consequences

- Shared scenarios can be reproduced exactly.
- Resetting all mutations must reproduce the historical baseline.
- Mutation order is serialized because later operations may depend on earlier ones.
- Uncertainty cannot be used to hide a poorly specified behavioral transform.
