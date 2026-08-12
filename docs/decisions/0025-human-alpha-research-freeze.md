# 0025: v0.19B human-alpha research freeze

Date: 2026-08-12

## Status

Accepted for the v0.19B human-testing cycle.

## Decision

The participant build remains v0.19.1 from readiness authorization through the first human session. Product refinement stops so human behavior can be compared with the unchanged v0.19A tasks and predicted failure modes.

Allowed changes are limited to an alpha-delivery blocker, security issue, broken deterministic restoration, obvious P0 correctness defect, or the minimum implementation required by an approved artifact-delivery method. All other product and model work remains frozen.

Every task records factual correctness and confidence before explanation on a 1–5 scale. The closing report must identify high-confidence misunderstandings explicitly.

## Completion evidence

`HUMAN_ALPHA_REPORT.md` must contain de-identified profiles, task outcomes, first wrong actions, help required, comprehension answers, confidence ratings, trust reactions, P0–P3 findings, comparison with v0.19A predictions, proposed corrections, and one recommendation: Advance, Correct and retest, or Block.

State #3 requires zero unresolved P0 and P1 findings, no repeated severe misunderstanding of epistemic status, trusted deterministic restoration, discoverable evidence, resolved delivery status, and green post-correction release gates.

## Artifact-delivery finding

The current official-result artifacts are not cleared for external-alpha redistribution:

- Pennsylvania's Department of State provides public access to the returns, but the review found no explicit redistribution grant covering the specific `pa.gov` bulk and API artifacts used by the runtime. The separate `data.pa.gov` policy cannot be assumed to cover artifacts not sourced from that portal.
- Michigan publishes election-result downloads, but the statewide website terms restrict copying, distribution, modification, and automated access unless another law, department-specific term, or written permission permits it.

The PA and MI official-result artifacts therefore remain excluded from external alpha delivery until written permission, an applicable documented legal basis, or a replacement source and delivery method is approved. This record is an engineering delivery decision, not legal advice.

Official pages reviewed:

- [Pennsylvania historical elections data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)
- [Pennsylvania Open Data Portal policy](https://data.pa.gov/data-policy)
- [Michigan election results and data](https://www.michigan.gov/sos/elections/election-results-and-data)
- [Michigan.gov Terms of Use Policy](https://www.michigan.gov/som/footer/policies)
