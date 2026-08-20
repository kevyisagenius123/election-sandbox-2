# Frozen verification record

**Candidate reference:** `v0.19.1-supervisor-review`  
**Product version:** `0.19.1`  
**Verification date:** 2026-08-20  
**Application code:** Unchanged from the tested v0.19.1 correction build  
**Human participants:** None

## Freeze contract

The candidate permits documentation, verification evidence, and review screenshots only. Product interface, model, data, and runtime changes are outside the candidate unless a newly discovered P0 correctness, security, restoration, or participant-delivery defect requires reopening the freeze.

State #3 and Run My Election remain excluded. PA/MI redistribution status remains Review / Blocked. Permission email drafts remain unsent.

## Release gates

| Gate | Command or evidence | Result |
| --- | --- | --- |
| Model and URL contracts | `npm test` | PASS: 48 / 48 |
| Static analysis | `npm run lint` | PASS: no findings |
| Production build | `npm run build` | PASS: two HTML entries and lazy deck.gl bundle emitted; existing 500 kB chunk warning only |
| Corrected alpha browser journeys | `npm run test:browser -- tests/browser/alpha-corrections.spec.ts` | PASS: 5 / 5 |
| Runtime ownership and stale-resource defense | `npm run test:browser -- tests/browser/runtime-hardening.spec.ts` | PASS: 2 / 2 |
| Scenario replay | `npm run test:browser -- tests/browser/scenario-replay.spec.ts` | PASS: 8 / 8 |
| Viewport and navigation laboratory | `npm run test:browser -- tests/browser/viewport-laboratory.spec.ts` | PASS: 9 / 9 |
| Canonical visual regression | `npm run test:browser -- tests/browser/visual-regression.spec.ts` | PASS: 9 / 9, including reduced motion |
| Supervisor screenshot generation | `npm run test:browser -- tests/browser/supervisor-review.spec.ts` | PASS: 1 / 1; six PNGs generated and visually inspected |
| PA runtime profile | `npm run profile:pa` | PASS: scenario median 49.07 ms, p95 76.36 ms; retained heap delta 13.01 MiB |

Browser total: **34 / 34** checks passed in bounded groups. The Windows wrapper retained the Vite child process after Playwright printed each completed group, so the already-completed wrapper was terminated between groups. No test failed, and each subsequent group acquired the strict port cleanly.

## Runtime profile detail

```text
Artifact               854.1 KiB
VTDs                    9,178
Model units             9,140
JSON parse median/p95   6.01 / 12.43 ms
Decode median/p95       14.63 / 29.28 ms
Scenario median/p95     49.07 / 76.36 ms
Audit median/p95        0.68 / 4.44 ms
Retained heap delta     13.01 MiB
```

## Access-boundary verification

| Surface | Expected | Verified state |
| --- | --- | --- |
| Full GitHub repository | Authenticated collaborators only | Private through authenticated API; anonymous HTTP 404 |
| Former full-product Pages | Unavailable | Anonymous HTTP 404 |
| Sanitized demo repository | Public | Anonymous HTTP 200 |
| Sanitized demo Pages | Public | Page, JavaScript, and CSS HTTP 200 |

The full product was not republished for this review. Fresh-agent evaluation ran against the frozen local server at `127.0.0.1`, and no participant invitation was issued.

## Fresh-agent execution status

Three isolated contexts attempted to initialize the required visible browser against the running local candidate. All three failed before navigation with the same trusted-path error in the installed browser integration. The attempt was stopped after the third identical failure instead of producing three more duplicate non-evaluations.

This is an evaluator-infrastructure blocker, not a Sandbox P0. No fresh agent saw the application, no interface-only task result exists, and no score was imputed. See `FRESH_AGENT_COGNITIVE_EVALUATION.md`.

## Evidence classification

- Automated tests prove deterministic contracts and regression behavior.
- Screenshots prove the reviewed presentation state at fixed viewports.
- Synthetic personas and fresh agents provide predicted comprehension evidence only.
- None of these records establish real-user comprehension, trust, attention, fatigue, motor performance, or willingness to share.
