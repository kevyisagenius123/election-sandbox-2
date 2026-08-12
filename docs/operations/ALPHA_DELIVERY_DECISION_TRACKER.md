# External Alpha Delivery Decision Tracker

**Current gate:** Blocked

**Participant build:** v0.19.1, frozen

**Rule:** An automated acknowledgment, silence, or general statement that data are public is not approval.

## Agency requests

| Jurisdiction | Recipient | Request sent | First follow-up | Second follow-up | Response received | Current decision |
| --- | --- | --- | --- | --- | --- | --- |
| Pennsylvania | `RA-Elections@pa.gov` | Not sent | Not scheduled | Not scheduled | No | Excluded from external alpha |
| Michigan | `ElectionData@Michigan.gov`; CC `Elections@Michigan.gov` | Not sent | Not scheduled | Not scheduled | No | Excluded from external alpha |

## Decision requirements

A jurisdiction may enter the participant build only after all applicable fields are recorded.

| Field | Pennsylvania | Michigan |
| --- | --- | --- |
| Responding authority and role | Pending | Pending |
| Response date | Pending | Pending |
| Source artifacts covered | Pending | Pending |
| Download and normalization allowed | Pending | Pending |
| Public web display allowed | Pending | Pending |
| Derived artifact redistribution allowed | Pending | Pending |
| Public GitHub repository allowed | Pending | Pending |
| Non-commercial alpha allowed | Pending | Pending |
| Continued public demonstration allowed | Pending | Pending |
| Commercial use status | Pending | Pending |
| Required attribution | Pending | Pending |
| Required disclaimer | Pending | Pending |
| Expiration or revocation terms | Pending | Pending |
| Written evidence stored privately | No | No |
| Engineering decision | Exclude | Exclude |

## Exact derivatives under review

### Pennsylvania

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/data/pa-2024-counties.json` | 31,082 | `967e1c7f3195e1a547e48218ad1610c762aa97debebd10d806d72dd120ec9836` |
| `public/data/pa/2024/reporting-units.json` | 5,468,866 | `88857f3dafb4fd1b3419e22cd0c1c4aba2eca662f2c080fa542429e2d3f7c106` |

### Michigan

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/data/mi-2024-counties.json` | 38,287 | `1892421bf06899501b041b87da2ae60409589aab116a690fa7e254722612a4e0` |
| `public/data/mi/2024/reporting-units.json` | 2,258,986 | `0270c0a35636d1bf6cccb8a5e20c27dbdb40a318dd8390f9ea1d68ca70acca19` |

Crosswalks and compact demographic artifacts that embed source-result totals inherit the result artifact's delivery decision even when their geometry or Census inputs are independently approved.

## Response classification

Choose one per jurisdiction:

- **Approved as requested:** Every intended use is expressly covered.
- **Approved with conditions:** All conditions are implementable and recorded before deployment.
- **Non-commercial alpha only:** A separate participant delivery is permitted, but continuing or commercial deployment remains excluded.
- **Ambiguous:** The reply does not clearly cover public hosting and derived redistribution. Follow up.
- **Denied:** Do not deliver the artifact externally.
- **No response:** Do not deliver the artifact externally.

## Replacement decision

If either request is denied, ambiguous after follow-up, or unanswered after two follow-ups, document one replacement path:

1. an alternative source with explicit redistribution terms and exact reconciliation;
2. a participant build that excludes the affected detailed state and clearly changes the study scope;
3. a local supervised study on the project owner's machine, only if reviewed as a lawful non-distribution method;
4. suspension of the human alpha until the gate is resolved.

Any replacement that changes visible product behavior or the five tasks requires supervisor review because the v0.19A to v0.19B comparison may no longer be valid.

## Final clearance

- [ ] Pennsylvania delivery approved or replaced
- [ ] Michigan delivery approved or replaced
- [ ] Conditions implemented without expanding product scope
- [ ] Exact participant URL identified
- [ ] Frozen build rerun through local and remote gates
- [ ] `docs/data/REDISTRIBUTION_INVENTORY.md` updated with evidence-backed decisions
- [ ] `HUMAN_ALPHA_READINESS.md` marks recruitment unblocked
- [ ] H01, H02, and H03 invitations may begin

This is an engineering release record, not legal advice.
