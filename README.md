# Sandbox 2.0

Sandbox 2.0 is a standalone precinct and reporting-unit counterfactual simulator for United States presidential elections.

It is intentionally independent from the existing Sandbox. It has its own application, contracts, data registry, tests, deployment configuration, and Git history.

## Current phase

Milestone 0 establishes:

- the first responsive product shell;
- a clearly labeled Pennsylvania behavior-editor prototype;
- reporting-unit and scenario contracts;
- deterministic reconciliation invariants;
- a source-registry schema;
- architecture decision records;
- a production-compatible build and test workflow.

The visual turnout response is illustrative until verified Pennsylvania reporting-unit and demographic data are connected. It is not a forecast.

## Product invariant

```text
No scenario mutations = exact historical result
```

The future data pipeline must satisfy:

```text
reporting units + county reporting buckets = county
counties = state
states = national popular vote
state and district allocation = Electoral College
```

## Key directories

```text
app/                    Product interface
packages/data-contracts Canonical records and scenario types
packages/election-model Deterministic model invariants
data-registry/          Source provenance schema and records
docs/decisions/         Architecture decision records
tests/                  Render and model tests
```

See [PRODUCT_AND_ENGINEERING_PLAN.md](./PRODUCT_AND_ENGINEERING_PLAN.md) for the complete delivery plan.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
npm run lint
```
