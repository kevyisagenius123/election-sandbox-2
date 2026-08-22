# v0.21A Replay Contracts and Endpoint Lock Verification

Date: 2026-08-21

## Verdict

**PASS as a supervisor-review candidate for v0.21A.**

This record does not authorize v0.21B. It demonstrates the exact bounded implementation authorized by the supervisor: contracts, canonical endpoint, validation, content fingerprints, deterministic seed namespace, serialization, event identity, and invariant tests.

## Scope delivered

- Pure `packages/election-replay` boundary with no React or deck.gl dependency.
- Canonical JSON serialization with Unicode NFC, sorted keys, safe integers, explicit null semantics, and rejection of undefined or sparse values.
- Immutable national endpoint lock with 51 jurisdictions, detailed Pennsylvania local units, coarse honest jurisdiction-total units elsewhere, and exact 538-EV reconciliation.
- Separate lock metadata and canonical election content.
- SHA-256 content fingerprint excluding `createdAt`, scenario metadata, and the fingerprint field itself.
- Complete five-bucket candidate vectors: Harris, Trump, Stein, Oliver, and explicit Other/write-in residual.
- Canonical evidence content included in the fingerprint.
- Versioned `rme-prng-sha256-xoshiro128ss-v1` named stream derivation with golden output.
- Canonical event identity independent of sequence and replay time.
- Certified-baseline and complex-counterfactual Pennsylvania fixtures produced from the existing scenario engine.
- No return generator, replay reducer, Decision Desk, React UI, map change, backend, membership, room, or video work.

## Constitutional definitions

```text
contentFingerprint =
SHA-256(UTF-8(canonicalSerialize({ schemaVersion, content })))
```

Canonical replay seed derivation:

```text
SHA-256(canonicalSerialize([
  "rme-prng-sha256-xoshiro128ss-v1",
  rootSeed,
  namespace,
  streamName
]))
```

The first 128 digest bits, decoded as four big-endian unsigned 32-bit words, seed xoshiro128**. Canonical compilation contains no `Math.random()` call.

## Golden fixtures

| Fixture | Content fingerprint |
|---|---|
| Pennsylvania certified baseline | `sha256:bbb5c3e94b2413829b7d9d8d243fcb9ed44e68ddfd4bde567cec1e91079b91c9` |
| Pennsylvania complex counterfactual | `sha256:07de00195da9ab840f9b82947fa7b75c3e64400f086605926836d516e9c716d2` |

Named stream fixture:

```text
root seed:  supervisor-fixture-seed
namespace: activation/state/PA
stream:    state-wave
seed:      7c535ba97c57290caf4308faca279826
uint32:    2837155814, 3359726438, 1783370652
```

Event identity fixture:

```text
event:de849938994aa9a085c03f83eb282fdd13559a883576f25d3c0a15d4d94d772a
```

## Release-blocking test coverage

The new tests prove:

- identical election content locked at different times has the same fingerprint;
- scenario ID and recipe fingerprint metadata do not alter endpoint content identity;
- input array order does not alter canonical content identity;
- changing one fully reconciled candidate vote changes the fingerprint;
- changing canonical evidence changes the fingerprint;
- the fingerprint field is excluded from its own preimage;
- tampered fingerprints and tampered reconciliation summaries fail closed;
- floating vote totals fail closed;
- missing or unknown candidate vectors fail closed;
- candidate ordering is deterministic;
- a county total changed by one vote without matching unit changes fails closed;
- an internally reconciled 537-EV election still fails the national 538 invariant;
- serialization and deserialization reproduce byte-identical canonical output;
- event identity is independent of compiled sequence and replay time;
- named random streams are deterministic and namespace-independent;
- the replay package contains no React, deck.gl, or `Math.random()` dependency.

## Verification commands

### Model and contract tests

```text
npm test
62 passed, 0 failed
```

This comprises 52 existing model/data checks and 10 new v0.21A replay-contract checks.

### Lint

```text
npm run lint
PASS
```

### Production build

```text
npm run build
PASS
```

The existing approximately 1.6 MB minified deck.gl chunk warning remains. v0.21A does not add replay code to the application bundle because no replay UI is mounted.

### Browser regression

The aggregate suite ran 38 current journeys plus three deliberate review/environment skips. Thirty-six current journeys passed in the aggregate run. Two navigation-heavy journeys timed out after abnormal suite-level delay without a product assertion failure:

- Required Michigan route lifecycle;
- National/Laboratory shell preservation.

Both were rerun immediately and passed in isolation:

```text
Required Michigan route: 1 passed in 16.7s
National/Laboratory shell: 1 passed in 7.2s
```

Combined current-journey disposition: **38 of 38 pass**, with the aggregate-run timeout documented rather than hidden.

## Public-release boundary

This private implementation does not clear PA/MI redistribution, participant delivery, public deployment, memberships, or paid delivery. It does not replace deferred human testing.

## Requested supervisor decision

Choose exactly one:

1. **Authorize v0.21B** - endpoint law is accepted; begin the headless Pennsylvania event compiler.
2. **Correct v0.21A** - specify a bounded contract or verification correction.
3. **Hold** - do not generate return events.
