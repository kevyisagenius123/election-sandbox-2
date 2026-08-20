# Fresh-agent cognitive evaluation

**Candidate:** `v0.19.1-supervisor-review`  
**Attempt date:** 2026-08-20  
**Classification:** Pre-alpha synthetic evidence attempt  
**Human participants:** None  
**Result:** BLOCKED BY EVALUATOR INFRASTRUCTURE

## Executive finding

The requested blind evaluation did not run. Three independent fresh contexts received only the local application URL, their assigned profile, the seven tasks, the adversarial questions, and a prohibition on source or documentation. Each failed before browser discovery or navigation with the same installed browser-integration error:

```text
Trusted RPC dependency must resolve within a configured trusted code path:
file:///C:/Users/kilom/.codex/plugins/cache/openai-bundled/browser/
26.814.41407/scripts/browser-service.mjs
```

The attempted profiles were:

1. first-time casual user;
2. evidence-first journalist; and
3. hostile product critic.

All three correctly refused to invent observations or substitute repository archaeology. The evaluation was stopped after the third identical infrastructure failure. Running three more contexts against the same unavailable browser would not create independent product evidence.

## Classification discipline

This is **not a Sandbox P0**. The candidate itself remained reachable through its checked-in Playwright harness, and all 34 candidate browser checks passed. The failure occurred in the external evaluator's browser integration before the application was requested.

It is recorded as:

```text
EVAL-01  Fresh-context browser integration unavailable
Class    Evaluation infrastructure blocker
Effect   Pass B produces no comprehension evidence
Scope    Codex browser integration, not Sandbox product behavior
```

No P0, P1, P2, or P3 product finding can be inferred from a surface the evaluators never saw.

## Task evidence

| Task | Evaluable sessions | Result |
| --- | ---: | --- |
| Create a Pennsylvania scenario | 0 | Not evaluated |
| Stop short and find exact movement | 0 | Not evaluated |
| Flip PA and identify contributors | 0 | Not evaluated |
| Build and explain a Path to 270 | 0 | Not evaluated |
| Copy and restore scenario URL | 0 | Not evaluated |
| Audit PA and MI evidence surfaces | 0 | Not evaluated |
| Explain the Electoral College change | 0 | Not evaluated |
| Answer three adversarial questions | 0 | Not evaluated |

## What remains valid

- The same-eight v0.19.1 regression pass remains valid against the unchanged product code.
- The new candidate release gates and screenshots remain valid.
- This attempt does not weaken or strengthen the product-comprehension claims.
- Human alpha and State #3 remain blocked exactly as before.

## Required rerun condition

Rerun all six isolated profiles from fresh contexts only after the visible browser integration can navigate to the local candidate. Do not reuse these failed contexts, supply definitions, reveal prior results, or allow repository documentation to rescue a task.

The future rerun must append a new dated section rather than overwriting this failed attempt.

