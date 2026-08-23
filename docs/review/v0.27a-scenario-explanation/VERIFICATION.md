# v0.27A verification: Scenario explanation hierarchy

Date: 2026-08-23

## Verdict

**PASS.** The Swingometer now connects exact statewide movement, its dominant modeled operation, its strongest honest geography, and its Electoral College consequence without adding another calculation path or chart.

## Contract checks

Three focused headless tests prove:

1. dominant operation, geography, and EV consequence are connected correctly;
2. opposing local movement remains identifiable without changing statewide direction;
3. zero movement is explicit and input ordering cannot change the explanation.

The full aggregate model, data, analytics, compiler, reducer, and replay suite passes 215 of 215 tests in 760.945 seconds.

## Browser checks

Two focused browser journeys prove:

- the canonical Pennsylvania scenario identifies Preference, Allegheny County, a mapped VTD, a Harris state flip, and 19 EV changing hands;
- the 390 by 844 layout converts the chain to one column and has no body-level horizontal overflow.

Desktop visual inspection confirmed that the chain fits the expanded and working drawer states without covering the map or duplicating the national rail.

Visual references:

- `screenshots/scenario-explanation-desktop.png`
- `screenshots/scenario-explanation-mobile.png`

## Verification commands

```bash
node --experimental-strip-types --test tests/scenario-explanation.test.mjs
npx playwright test tests/browser/scenario-explanation.spec.ts
npm test
npm run lint
npm run build
git diff --check
```

The production build retains the existing deck.gl and regular-ECharts chunk warnings. No renderer or lifecycle boundary changed in this release.
