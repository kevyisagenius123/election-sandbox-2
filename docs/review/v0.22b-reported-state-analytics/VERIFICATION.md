# v0.22B verification: Headless derived reported-state analytics

Date: 2026-08-21

## Candidate verdict

**PASS for supervisor review.** The layer reports only arithmetic facts derived from applied observable state. It includes no unfinished-election inference or UI.

## Verified contract

- Overall reported leader considers all five candidates; third parties may lead.
- Zero has no leader, margin, or shares. Ties remain ties.
- All-candidate and Harris-Trump shares expose explicit vote denominators.
- Harris-Trump margin is exact and separately named from overall leadership.
- National, PA, MI, county, published-unit, mapped, and off-map values equal reducer state.
- Coarse jurisdictions expose no local analytics.
- Identical observable prefixes under different futures produce byte-identical analytics.
- No endpoint, stream, event, checkpoint, remaining-vote, expected-vote, EV, projection, call, winner, React, or deck.gl dependency exists.
- Final analytics equal final reducer arithmetic because every return has occurred, not because analytics reads the endpoint.
- Canonical serialization, observable-state validation, envelopes, and fingerprints fail closed.

## Frozen analytics fingerprints

| Position | Certified | Complex |
|---|---|---|
| Zero | `sha256:ececb415944baeb1d3b35c8fd7af691d2097120844c8a49c68419fbcf3304e69` | `sha256:8d8258e6cca4f10bda0656bb86607bab52a9d431eb766faaf0d646d8ee4a7ada` |
| Event 1 | `sha256:d2dc0cf9f18eeae923dd3391510b01fe895dd49f014a6b24aa6b97db2f70cf56` | `sha256:52dcd406554d82fcc67a9686c0857871c92b7d6e7a752f84686bd471404e3ba3` |
| Event 100 | `sha256:097f3892989a1b57fbd684c0c436d231f1e12bfa813db2410b0c65889cf7d8b2` | `sha256:7be618e826379647739e4975d93d43cab3495bcaee062940155bf775bd4b7f4b` |
| Event 1,000 | `sha256:22f3490dfa9a8c905fbff45430eecd5875d880b64076e79fd35ff010c07e6352` | `sha256:14bc98a32fc96cd362cc9f913f2671b248b1fcf568dd1490aba79e1561509fa0` |
| Midpoint | `sha256:0b95d5fb80ab35360e5f1430994f4e940b0bb6c9fbb3de0f82db7edc2d9c866d` | `sha256:50dc4ce46dc282a2001ac07af68ab11f2f4106dc3408470bff13b47a2a1bd4f0` |
| Final | `sha256:b5342ab583ae1d5450bbcd354d181fcf1d1da6167b75e078958058642f610837` | `sha256:ea5aa298f6b3617163ca164a1e5c43c1b7b29833195434d2164c4e0fd4adaae4` |

## Gates

```text
Dedicated v0.22B suite   8 / 8 passed
npm run benchmark:analytics passed
Prior v0.22A aggregate   122 / 122 passed
npm run lint             passed
npm run build            passed
git diff --check         passed
```

The v0.22B suite imports and exercises the accepted endpoint, national compiler, reducer, both national fixtures, all reducer positions, and frozen predecessor fingerprints. The prior 122-test aggregate remains the predecessor record; the new analytics suite passes separately as eight grouped tests.

The required performance record is [PERFORMANCE.md](PERFORMANCE.md). The production build retains the existing deck.gl chunk-size warning; v0.22B adds no application-bundle dependency. The standing browser disposition remains unchanged because the application imports no replay or analytics code.

## Proposed next decision

If accepted, v0.22C should compact runtime state/checkpoints and profile realistic seek workloads while preserving every canonical reducer and analytics fingerprint.
