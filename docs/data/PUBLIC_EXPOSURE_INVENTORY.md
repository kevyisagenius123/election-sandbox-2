# PA/MI Public Exposure Inventory

**Audit date:** 2026-08-12

**Repository:** `Electaris/election-sandbox-2`

**Audit commit before containment:** `c6aeb0e`

**Status at audit:** Public repository and live GitHub Pages deployment

**Containment completed:** 2026-08-20

**Current state:** Full repository public again as verified 2026-08-23; former Pages URL returns 404; sanitized public demo live at `https://electaris.github.io/election-sandbox-demo/`

## Finding

The unresolved official-result derivatives are not limited to `reporting-units.json`. Candidate totals are embedded in county summaries, every PA/MI TopoJSON geometry shard, both geometry manifests, and both compact demographic runtime artifacts. Source-dependent registries and crosswalks are also visible in the public repository.

The only safe immediate containment boundary is therefore the entire repository and Pages deployment. Removing one or two files from the current build would not contain all copies of the unresolved result data.

## Public and Pages-delivered runtime artifacts

| State | Classification | Files | Bytes | Inventory decision |
| --- | --- | ---: | ---: | --- |
| PA | Official-result reporting-unit derivative | 1 | 5,468,866 | Exclude pending permission or replacement |
| PA | Geometry shards embedding result totals | 67 | 12,578,086 | Exclude while PA results are unresolved |
| PA | Geometry manifest embedding result totals | 1 | 62,717 | Exclude while PA results are unresolved |
| PA | Census demographic derivative embedding result totals | 1 | 874,568 | Exclude while PA results are unresolved |
| MI | Official-result reporting-unit derivative | 1 | 2,258,986 | Exclude pending permission or replacement |
| MI | Geometry shards embedding result totals | 83 | 7,248,319 | Exclude while MI results are unresolved |
| MI | Geometry manifest embedding result totals | 1 | 73,822 | Exclude while MI results are unresolved |
| MI | Census demographic derivative embedding result totals | 1 | 628,735 | Exclude while MI results are unresolved |

Totals:

- Pennsylvania: 70 runtime files, 18,984,237 bytes.
- Michigan: 86 runtime files, 10,209,862 bytes.
- Combined: 156 runtime files, 29,194,099 bytes.

Every file under these runtime paths is inside the containment boundary:

```text
public/data/pa/
public/data/mi/
```

The individual SHA-256 checksums are reproducible with:

```powershell
Get-ChildItem public/data/pa,public/data/mi -Recurse -File |
  Get-FileHash -Algorithm SHA256
```

## County summaries bundled into application JavaScript

These files are imported by the application and incorporated into the compiled Pages JavaScript rather than copied as visible JSON paths.

| Artifact | Bytes | SHA-256 | Decision |
| --- | ---: | --- | --- |
| `src/data/pa-2024-counties.json` | 31,082 | `967e1c7f3195e1a547e48218ad1610c762aa97debebd10d806d72dd120ec9836` | Exclude pending PA basis |
| `src/data/mi-2024-counties.json` | 38,287 | `1892421bf06899501b041b87da2ae60409589aab116a690fa7e254722612a4e0` | Exclude pending MI basis |

## Public repository-only source-dependent records

The public repository exposes the normalized data and transformation evidence through:

```text
data-sources/pennsylvania/2024-general-presidential.json
data-sources/pennsylvania/2024-vtd-crosswalk.json
data-sources/pennsylvania/2020-pl94-vtd-demographics.json
data-sources/michigan/2024-general-presidential.json
data-sources/michigan/2024-precinct-crosswalk.json
data-sources/michigan/2020-pl94-precinct-demographics.json
src/data/pa-2024-counties.json
src/data/mi-2024-counties.json
```

Several engineering documents and tests also state or reproduce aggregate result totals. Containing the repository, rather than attempting a hurried partial redaction, preserves the frozen build and reduces the risk of omitting another derivative.

## Independently lower-risk inputs

These inputs have a documented independent basis, but their generated runtime outputs are mixed with unresolved results and remain inside containment:

- U.S. Census Bureau PA VTD geometry.
- U.S. Census Bureau P.L. 94-171 demographic data.
- Michigan Bureau of Elections GIS geometry whose manifest records verified source metadata.
- Federal Election Commission statewide baseline.

This classification does not authorize extracting and republishing a new build without a documented delivery design.

## Pages mapping

The GitHub Actions workflow copies the full Vite `public/` tree into `dist`, and application imports bundle the two county summaries into JavaScript. Consequently, the live Pages deployment distributes:

- all 156 files under `public/data/pa` and `public/data/mi`;
- PA and MI county summaries inside the compiled application bundle;
- visible product and provenance language derived from the same source package.

## Containment verification

Containment is complete only when:

- [x] The former Pages URL returns HTTP 404 and no longer serves the application.
- [x] The full repository reports `private` through the authenticated GitHub API and returns HTTP 404 anonymously.
- [x] The automatic Pages deployment workflow was removed from the current private branch before the containment commit.
- [x] The resulting visibility and deployment state were verified from an anonymous HTTP client.
- [x] A fresh-history public demo was deployed separately and verified at `https://electaris.github.io/election-sandbox-demo/`.
- [ ] Historical Git objects are handled as a separate decision if later evidence requires purging them.

The public demo contains only FEC statewide totals, national `us-atlas` state geometry, and original demo interface/model code. A repository scan confirmed that it contains no county, precinct, VTD, reporting-unit, local demographic, crosswalk, or detailed-state scenario artifacts. Its initial Pages workflow completed successfully, and the page plus both production assets returned HTTP 200.

No Git history rewrite, object purge, or research-artifact deletion was performed or is authorized by this inventory.

The checklist above records the completed 2026-08-20 containment event. Repository visibility was subsequently changed back to public. The repository-only exposure described in this inventory is therefore active again, although the full-product Pages deployment remains disabled.

This is a conservative engineering containment record, not a determination that prior redistribution was unlawful and not legal advice.
