# Fresh-agent cognitive evaluation protocol

## Classification

This is a **fresh-agent cognitive evaluation**, not user testing and not v0.19B human evidence.

Each evaluator runs in an isolated context with no inherited Sandbox conversation. The evaluator receives only:

- one assigned user perspective;
- the local application URL;
- seven task statements;
- three adversarial questions; and
- an explicit prohibition on reading repository source, tests, reports, README files, or documentation.

If application access fails, the evaluator must report the infrastructure failure and may not replace observation with source archaeology.

## Evaluator profiles

1. First-time casual user.
2. Evidence-first journalist.
3. Hostile product critic.
4. Election-literate outsider.
5. Analytical campaign user.
6. Software/product reviewer.

## Tasks

1. Create a Pennsylvania scenario that improves Harris.
2. Stop short of flipping Pennsylvania and find the exact additional movement required.
3. Flip Pennsylvania and identify the largest counties and VTDs responsible.
4. Build or select a Path to 270 and explain Required, Modeled, and Satisfied.
5. Copy and restore the scenario URL.
6. Audit the Pennsylvania and Michigan Data/evidence surfaces.
7. Explain the resulting Electoral College change.

After each task the evaluator must explain what they believe happened and why before reporting outcome, wrong turns, help, confidence, and misleading wording or trust concerns.

## Adversarial questions

1. Is this a forecast? Explain using only the interface.
2. If Wisconsin appears in a Path to 270, does that mean Sandbox modeled Wisconsin precincts?
3. What geographic evidence underlies Pennsylvania compared with Michigan?

## Severity scale

- **P0:** Wrong election arithmetic, corrupted reconstruction, lost data distinction, or a defect that makes the product's central claim false.
- **P1:** Repeated severe misunderstanding, blocked core task, or wording that creates confident but materially incorrect interpretation.
- **P2:** Recoverable discoverability, hierarchy, explanation, or trust problem that should be corrected after the release gate.
- **P3:** Polish, convenience, or future-work observation.

## Interpretation limits

Agent reports may reveal hierarchy, wording, consistency, obvious trust gaps, and regressions. They cannot establish real hesitation, attention, motor behavior, fatigue, emotional response, genuine trust, sharing behavior, or normal-human task time. Counts are diagnostic, not statistical.

