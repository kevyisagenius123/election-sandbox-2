# v0.19B Human Alpha Readiness

**Prepared:** 2026-08-12

**Product build:** v0.19.1

**Phase status:** Authorized to enter human testing; participant delivery remains blocked

## What is ready

- The unchanged five-task protocol is documented in `docs/research/HUMAN_ALPHA_PROTOCOL.md`.
- A consistent per-participant evidence template is documented in `docs/research/HUMAN_ALPHA_SESSION_TEMPLATE.md`.
- The public editorial Home and `/app/` laboratory were reachable during the readiness audit.
- The deployed `/app/` entry exposed the corrected `Change United States` and `Open controls` language.
- The release continues to distinguish synthetic walkthroughs from human evidence.
- The v0.19.1 product build is under the decision-0025 research freeze through Session 1.
- Every task now records confidence before explanation on a 1–5 scale.
- `HUMAN_ALPHA_REPORT.md` is the required closing-report shell.

## Readiness verification

Completed on 2026-08-12 against v0.19.1:

- `npm test`: 48 of 48 deterministic model and URL-contract tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; the existing lazy deck.gl chunk-size warning remains.
- Browser suite: all 33 local application journeys passed when the long-running suite was completed in bounded groups; the remote-only smoke is intentionally skipped locally.
- Deployed remote smoke: 1 of 1 passed against `https://kevyisagenius123.github.io/election-sandbox-2/`, including scenario-link restoration.
- `npm run profile:pa`: passed; scenario calculation median 63.61 ms and p95 111.51 ms on this machine.

## What remains before recruitment

- Obtain written permission or an applicable documented legal basis for the Pennsylvania and Michigan result artifacts, or approve a replacement source and delivery method. The current artifacts are explicitly excluded from external alpha delivery.
- Because the public repository and Pages build currently contain or serve those artifacts, do not treat them as a cleared participant build. Before recruitment, either obtain the required basis, deploy an approved replacement build, or receive approval to suspend that public delivery.
- Permission-request drafts and the evidence tracker are ready in `docs/operations/ALPHA_DATA_PERMISSION_REQUESTS.md` and `docs/operations/ALPHA_DELIVERY_DECISION_TRACKER.md`. They have not been sent.
- Recruit at least three genuinely new users, preferably five to ten across the participant matrix.

## Evidence that does not yet exist

There is no v0.19B human task evidence yet. The synthetic reports predict likely failure modes but cannot establish human comprehension, patience, discoverability, or trust.

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
- [ ] Post-correction repository gates passed
- [ ] v0.19B closing decision recorded

## Phase boundary

State #3 and Run My Election remain outside v0.19B. State #3 requires the completed `HUMAN_ALPHA_REPORT.md`, zero unresolved P0 and P1 findings, no repeated severe epistemic-status misunderstanding, trusted deterministic restoration, discoverable evidence, resolved delivery status, and green post-correction gates. The state-admission contract may later carry replay-readiness metadata, but the replay engine remains a separate bounded product track.
