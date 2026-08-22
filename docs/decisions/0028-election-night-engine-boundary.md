# 0028: Begin Run My Election as an independent deterministic replay subsystem

Date: 2026-08-20

## Status

Accepted by the product owner for private development.

## Decision

The next engineering phase is v0.21 Run My Election. It begins with replay contracts and endpoint locking, not with UI animation, backend services, or additional state admission.

The existing counterfactual scenario engine remains deterministic and timeless. It produces an exact immutable election endpoint. A new replay subsystem compiles that endpoint into a versioned event log using state-specific reporting profiles and named deterministic random streams. The event log drives replay state, the 3D presentation, and later video rendering.

Reporting order, reporting timing, calls, playback, camera, and presentation cannot modify the locked endpoint.

The Decision Desk runs behind a sanitized worker contract and cannot receive future candidate totals, future batches, or the final winner. Its calls must be derived only from time-t results, public outstanding-vote estimates, approved priors, poll-close state, and its own independent seed.

The first implementation is local-first. A backend is deferred until accounts, cloud saves, membership enforcement, live rooms, publishing, or render jobs create a genuine server requirement.

The complete architecture, trust model, data contracts, test gates, release sequence, and definition of done are specified in `RUN_MY_ELECTION_ENGINE_PLAN.md`.

## v0.21A constitutional contract

The supervisor authorized v0.21A only. Four clarifications are release-blocking:

1. **Content fingerprint:** lock metadata and election content are separate. The fingerprint is `SHA-256(UTF-8(canonicalSerialize({ schemaVersion, content })))`. `createdAt`, `scenarioId`, `scenarioFingerprint`, and the fingerprint field itself are excluded. Locking identical content twice therefore produces the same content fingerprint even when lock metadata differs.
2. **Canonical serialization:** strings and object keys are Unicode NFC; object keys are sorted by normalized UTF-16 code units; endpoint candidate, jurisdiction, county, reporting-unit, evidence, allocation, and evidence-reference arrays are explicitly sorted before serialization; only finite safe integers are accepted as numbers; negative zero becomes zero; absent optional fields are omitted while explicit `null` remains distinct; undefined values are rejected.
3. **PRNG namespace:** canonical replay randomness uses version `rme-prng-sha256-xoshiro128ss-v1`. A SHA-256 derivation over a canonical tuple of version, root seed, namespace, and stream name produces a fixed 128-bit xoshiro128** state. If the first 128 digest bits are all zero, the state is replaced by `[0x6d2b79f5, 0x1b56c4e9, 0x9e3779b9, 0x243f6a88]`. Golden vectors define the implementation. `Math.random()` is prohibited from canonical replay compilation.
4. **Event identity:** event identity and event order are separate. A canonical event ID derives from replay schema version, jurisdiction, optional unit, event type, and stable batch ordinal. `sequence` and `replayTimeMs` describe placement in one compiled log and do not participate in event identity.

These rules may change only through an explicit schema or model-version decision. v0.21A passed supervisor review. Decision 0029 separately authorizes v0.21B; v0.21C-F remain unauthorized.

## Evidence boundary

Every event is labeled documented, reconstructed, modeled, user-defined, synthetic, or exact-endpoint. A documented poll close does not convert modeled return batches into historical facts. Wisconsin ward values remain LTSB reconstructed values and enter the first replay only as synthetic Scenario Night geography unless stronger chronology and local-result evidence is admitted.

## Release boundary

This decision permits private implementation only. It does not:

- resolve PA/MI redistribution or delivery status;
- authorize participant, public, or paid detailed-state delivery;
- replace the deferred human study;
- authorize arbitrary user uploads or manual result editing;
- start membership, live-room, or video-rendering backend work.

## Consequences

- Arizona and Georgia admission research is postponed while v0.21A proves the replay boundary.
- Detailed-state admission gains a separate replay-readiness supplement.
- The first proof uses two Pennsylvania event sequences with one exact endpoint.
- PA, MI, and WI are then used to prove multi-state contract differences before the polished UI is built.
- Backend and presentation choices cannot become competing election engines.
