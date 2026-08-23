# v0.26C verification: ECharts GL research gate

Date: 2026-08-23

## Verdict

**PASS research gate. REJECT ECharts GL production admission.**

The experiment answered its bounded question without changing the product. The 2D control communicates ballot waves, partisan movement, and stalls more directly than the GL candidate. The GL view is therefore not connected to Sandbox 2.0.

## Shared data contract

- Detailed returns: 20,499
- Detailed ballots: 16,145,836
- Fixed replay-time bins: 48
- State rows: PA, MI, WI
- Shared marks: 144
- Fixture fingerprint: `sha256:468ce7ca3cfb4bb3665b3c4cb5468ef9f7bc20223309ee0c3188dc3e9150b5a6`

Both views use the same bounded JSON fixture. Height in the GL candidate and bubble area in the 2D control both encode `ballotsPublished`. Color in both forms encodes signed Harris-minus-Trump two-party movement.

## Correctness checks

Six dedicated headless tests pass:

1. deterministic, bounded, and honest empty-prefix output;
2. exact visible-prefix ballot and five-bucket candidate conservation;
3. no future event identity exposure;
4. hidden future candidate changes cannot affect the visible dataset;
5. exact full endpoint and state reconciliation;
6. ECharts GL remains outside production source and dependencies.

The full aggregate model, data, replay, and analytics suite passes 212 of 212 tests in 857.679 seconds.

## Browser and lifecycle checks

- Two research browser journeys pass.
- The 2D control owns one canvas.
- The GL candidate owns two canvases.
- Switching forms disposes the inactive chart.
- Ten repeated mount/dispose cycles per form retain zero benchmark canvases.
- A representative local run measured 43.8 ms average for 2D and 175.1 ms for GL.
- The automated test requires GL average cycle time to exceed the 2D control and does not freeze device-specific timing values.
- The 390 by 844 2D layout has no body-level horizontal overflow.

## Bundle boundary

Isolated research build:

```text
echarts-gl                     603.46 kB minified / 166.47 kB gzip
echarts                        699.23 kB minified / 230.65 kB gzip
GL support chunk              435.33 kB minified / 148.64 kB gzip
research application            8.99 kB minified /   3.61 kB gzip
```

Production build:

```text
deck.gl map                 1,604.89 kB minified / 503.38 kB gzip
regular ECharts renderer      532.57 kB minified / 179.40 kB gzip
margin lens                     3.70 kB minified /   1.86 kB gzip
velocity lens                   3.77 kB minified /   1.88 kB gzip
ECharts GL                         absent
```

ESLint and the production TypeScript/Vite build pass. The existing deck.gl and regular-ECharts chunk warning remains.

## Visual evidence

- `screenshots/count-landscape-2d-desktop.png`
- `screenshots/count-landscape-gl-desktop.png`
- `screenshots/count-landscape-2d-mobile.png`

The GL screenshot shows the core comprehension failure: perspective compresses state rows and lets tall bars obscure later marks. The 2D screenshot exposes all three state timelines at once.

## Commands

```bash
npm run research:v026c:fixture
npm run research:v026c:build
npm run research:v026c:test
node --experimental-strip-types --test tests/count-landscape-research.test.mjs
npm run lint
npm run build
```
