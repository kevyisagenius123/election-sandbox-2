# 0027: Defer human alpha while controlled state expansion resumes

Date: 2026-08-20

## Status

Accepted by the product owner.

## Decision

The v0.19B human alpha is deferred until the broader project is feature-complete enough for an end-to-end evaluation. It is not passed, waived, or replaced by AI review.

Internal development may resume in small state batches. Wisconsin is the first admission under this exception. Every batch must still pass its source admission, exact reconciliation, deterministic model, browser workflow, performance, provenance, and AI technical-supervisor gates before the next batch begins.

The frozen `v0.19.1-supervisor-review` tag remains unchanged as a historical candidate. Decision 0025 remains the record of the planned human protocol, but its product-development freeze is superseded for private internal work by this decision.

## External-release boundary

This decision does not authorize a public or paid detailed-state release. Before memberships, paid access, or broad participant delivery:

- the complete product must receive the deferred human study;
- unresolved P0 and P1 findings must be corrected and retested;
- Pennsylvania and Michigan artifact-delivery and redistribution status must have a documented supported disposition;
- the intended production delivery architecture must pass security, privacy, performance, and accessibility gates.

Gate B remains an AI technical-supervisor pass. Gate A remains unresolved for the PA/MI detailed artifacts. Wisconsin's LTSB source is separately documented as open/public in decision 0026.

## Development sequence

1. Admit one state or a small compatible batch.
2. Reconcile all ballots and geographic coverage.
3. Integrate through the shared manifest and worker contracts.
4. Run model, browser, lifecycle, visual, lint, and build gates.
5. Record limitations and review findings before admitting the next batch.
6. Run the comprehensive human study on the assembled product before public or paid release.

