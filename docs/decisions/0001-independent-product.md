# ADR 0001: Sandbox 2.0 is an independent product

## Status

Accepted.

## Decision

Sandbox 2.0 will use its own repository, deployments, data registry, APIs, storage, and application code. It will not import source code, routes, stores, endpoints, databases, or build artifacts from the existing Sandbox.

The product may adopt proven ideas and broadly related editorial design principles, but implementations must be new and independently testable.

## Consequences

- Existing Sandbox regressions cannot be introduced by Sandbox 2.0 development.
- Data contracts can be designed around reporting units rather than inherited county assumptions.
- Features that move between products require explicit export or API contracts.
- Initial setup costs are higher, but long-term coupling is substantially lower.
