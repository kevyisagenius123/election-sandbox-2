# v0.19B Human Alpha Readiness

**Prepared:** 2026-08-20

**Product build:** v0.19.1

**Phase status:** Research build contained; participant delivery remains blocked

## What is ready

- The unchanged five-task protocol is documented in `docs/research/HUMAN_ALPHA_PROTOCOL.md`.
- A consistent per-participant evidence template is documented in `docs/research/HUMAN_ALPHA_SESSION_TEMPLATE.md`.
- The public editorial Home and `/app/` laboratory were reachable during the readiness audit.
- The deployed `/app/` entry exposed the corrected `Change United States` and `Open controls` language.
- The release continues to distinguish synthetic walkthroughs from human evidence.
- The v0.19.1 product build is under the decision-0025 research freeze through Session 1.
- Every task now records confidence before explanation on a 1–5 scale.
- `HUMAN_ALPHA_REPORT.md` is the required closing-report shell.
- `v0.19.1-supervisor-review` is the frozen supervisor candidate, with its review packet under `docs/review/v0.19.1-supervisor-review/`.

## Readiness verification

Reverified on 2026-08-20 against the unchanged v0.19.1 product build:

- `npm test`: 48 of 48 deterministic model and URL-contract tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; the existing lazy deck.gl chunk-size warning remains.
- Browser suite: all 34 local checks passed in bounded groups, including the new six-image supervisor capture.
- Historical deployed remote smoke: 1 of 1 passed before the full-product Pages deployment was contained. The former URL now intentionally returns 404.
- `npm run profile:pa`: passed; scenario calculation median 49.07 ms and p95 76.36 ms on this machine; retained heap delta 13.01 MiB.

## What remains before recruitment

- Obtain written permission or an applicable documented legal basis for the Pennsylvania and Michigan result artifacts, or approve a replacement source and delivery method. The current artifacts are explicitly excluded from external alpha delivery.
- The former public repository and Pages deployment have been contained. The full research repository is private, its former Pages URL returns 404, and the current branch no longer contains an automatic Pages workflow.
- The separate `election-sandbox-demo` repository is a public national-only product preview. It contains no PA/MI local-result derivatives and is not the v0.19B participant build.
- Permission-request drafts and the evidence tracker are ready in `docs/operations/ALPHA_DATA_PERMISSION_REQUESTS.md` and `docs/operations/ALPHA_DELIVERY_DECISION_TRACKER.md`. They have not been sent.
- Permission emails are postponed by owner decision. `docs/data/PUBLIC_EXPOSURE_INVENTORY.md` records the completed containment and replacement-demo verification.
- Recruit at least three genuinely new users, preferably five to ten across the participant matrix.
- Rerun the six-profile fresh-agent cognitive evaluation after the installed evaluator browser can navigate to the local candidate. Three isolated attempts failed before navigation and produced no product evidence.

## Evidence that does not yet exist

There is no v0.19B human task evidence yet. The synthetic reports predict likely failure modes but cannot establish human comprehension, patience, discoverability, or trust.

The fresh-agent review-candidate pass also has no task evidence. Its infrastructure-blocked attempt is documented separately and must not be represented as a failed product test or as completed user research.

## Completion checklist

- [ ] External-alpha delivery and redistribution method cleared
- [x] Participant build frozen and remote smoke passed
- [ ] H01 completed
- [ ] H02 completed
- [ ] H03 completed
- [ ] Additional mixed participants completed where available
- [ ] P0 findings resolved
- [ ] P1 findings resolved
- [ ] No repeated severe epistemic-status misunderstanding remains
- [ ] Participants can find the evidence chain when asked
- [ ] Synthetic versus human comparison written
- [x] Post-correction repository gates passed
- [ ] v0.19B closing decision recorded

## Phase boundary

State #3 and Run My Election remain outside v0.19B. State #3 requires the completed `HUMAN_ALPHA_REPORT.md`, zero unresolved P0 and P1 findings, no repeated severe epistemic-status misunderstanding, trusted deterministic restoration, discoverable evidence, resolved delivery status, and green post-correction gates. The state-admission contract may later carry replay-readiness metadata, but the replay engine remains a separate bounded product track.
