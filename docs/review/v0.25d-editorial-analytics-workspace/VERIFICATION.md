# v0.25D verification: Editorial analytics workspace

Date: 2026-08-23

## Verdict

**PASS for supervisor review.** The accepted v0.25B scenario ledger and v0.25C current-prefix replay diagnostics are now visible in the shared-map product without moving analytic arithmetic into React.

## Contract coverage

- Swingometer contributor rows derive from the accepted scenario-delta ledger.
- Actual, Scenario, Delta, operation movement, county rankings, reporting-unit rankings, and residual geography reconcile to that ledger.
- Election Night analytics derive inside the worker from the current visible PA, MI, and WI prefix.
- The adapter preserves candidate vectors, state and county reconciliation, mapped/off-map status, and VTD/precinct/ward unit semantics.
- Poll close, first return, current return, and completion states remain explicit.
- Five-, fifteen-, and thirty-minute windows are displayed without reading future candidate results.
- Return progress and represented-ballot progress remain visibly distinct.
- Mathematical openness remains descriptive arithmetic and is not presented as a call.
- Stall alerts use the user-selected threshold and do not alter the schedule or result.
- Unsupported states remain inert during Election Night.

## Verification record

```text
visible-replay adapter tests                 4 / 4 passed
focused three-state scheduling tests        6 / 6 passed
aggregate model/replay/analytics tests    197 / 197 passed
aggregate duration                           586.307 s
focused integrated browser journey           1 / 1 passed
TypeScript production build                      passed
ESLint                                            passed
git diff integrity                                passed
```

Manual browser inspection covered Swingometer and Election Night at 1440 by 900 and 390 by 844. Both modes had no horizontal overflow. The bottom dock retained the shared map, desktop hierarchy, operation filters, window ledgers, local movers, and mobile stacking.

The production build retains the known lazy deck.gl chunk warning. The map chunk is 1,604.88 kB minified and 503.36 kB compressed. This is a recorded optimization issue, not a v0.25D correctness failure.

## Non-scope

No probability, expected candidate share, projection, Decision Desk call, demographic calibration, backend, membership, public restricted-data delivery, or deployment changed.
