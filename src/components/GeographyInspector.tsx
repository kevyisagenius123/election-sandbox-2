import type { ThirdPartyCandidate } from "../../packages/election-model/src/scenario.ts";
import type { GeographyInspectorModel } from "../data/detailedStateInspector.ts";

type GeographyInspectorProps = {
  model: GeographyInspectorModel;
  onClearVtd: () => void;
};

const thirdPartyLabels: Record<ThirdPartyCandidate, string> = {
  stein: "Stein",
  oliver: "Oliver",
  residual_other: "Other/write-in",
};

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatDelta(value: number) {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

function formatPreference(value: number) {
  if (value === 0) return "Off";
  return `${formatNumber(Math.abs(value))} ${value > 0 ? "Trump → Harris" : "Harris → Trump"}`;
}

function formatMarginContribution(value: number) {
  if (value === 0) return "No movement";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))} ${value > 0 ? "D" : "R"}`;
}

function denominatorLabel(status: GeographyInspectorModel["denominatorStatus"]) {
  if (status === "available") return "Available";
  if (status === "mixed") return "Mixed coverage";
  if (status === "ballots_exceed_2020_vap") return "Capacity capped";
  if (status === "demographic_bridge_unavailable") return "Demographic bridge unavailable";
  return "No matched 2024 result";
}

function matchLabel(model: GeographyInspectorModel) {
  if (model.kind === "county") {
    return `${formatNumber(model.coverage.exactSourceUnitCount)} exact units · ${formatNumber(model.coverage.canonicalSourceUnitCount)} alternate-key units · ${formatNumber(model.coverage.unmatchedGeographyCount)} unmatched polygons`;
  }
  const electionMatch = model.coverage.resultMatchMethod === "exact_vtd_identifier"
    ? "Exact Census VTD identifier"
    : model.coverage.resultMatchMethod === "exact_canonical_name"
      ? "Unique canonical-name match"
      : model.coverage.resultMatchMethod === "mixed"
        ? "Mixed exact-ID and canonical-name links"
        : model.coverage.resultMatchMethod === "exact_official_ward_key"
          ? "Exact official ward and precinct key"
          : model.coverage.resultMatchMethod === "unique_official_precinct_key"
            ? "Unique official precinct key"
            : "No matched 2024 return";
  const demographicMatch = model.coverage.demographicMatchMethod === "official_vtdst_bridge"
    ? "Direct official 2020 VTD bridge"
    : model.coverage.demographicMatchMethod === "registered_voter_weighted_vtd_split"
      ? "Registered-voter-weighted 2020 VTD split"
      : model.coverage.demographicMatchMethod === "unavailable"
        ? "Demographic bridge unavailable"
        : null;
  return demographicMatch ? `${electionMatch} · ${demographicMatch}` : electionMatch;
}

export function GeographyInspector({ model, onClearVtd }: GeographyInspectorProps) {
  const candidateRows = [
    { key: "harris", label: "Harris", actual: model.actualVotes.harrisVotes, scenario: model.scenarioVotes.harrisVotes },
    { key: "trump", label: "Trump", actual: model.actualVotes.trumpVotes, scenario: model.scenarioVotes.trumpVotes },
    { key: "stein", label: "Stein", actual: model.actualVotes.steinVotes, scenario: model.scenarioVotes.steinVotes },
    { key: "oliver", label: "Oliver", actual: model.actualVotes.oliverVotes, scenario: model.scenarioVotes.oliverVotes },
    { key: "other", label: "Other/write-in", actual: model.actualVotes.residualOtherVotes, scenario: model.scenarioVotes.residualOtherVotes },
  ];
  const thirdPartyDelta = model.operations.thirdPartyCandidateDelta;
  const matchSummary = matchLabel(model);

  return (
    <section className="inspector-card" aria-label={`Data inspector for ${model.name}`}>
      <div className="inspector-heading">
        <div>
          <span className="overline">Selected geography · {model.geographyLabel}</span>
          <strong>{model.name}</strong>
          <small>{model.context}</small>
        </div>
        {model.kind === "precinct" && (
          <button onClick={onClearVtd} type="button">County</button>
        )}
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">
          <strong>Candidate ledger</strong>
          <span>Certified → scenario</span>
        </div>
        <div className="candidate-ledger">
          {candidateRows.map((candidate) => (
            <div className="candidate-ledger-row" data-candidate={candidate.key} key={candidate.key}>
              <span>{candidate.label}</span>
              <b>{formatNumber(candidate.actual)}</b>
              <i aria-hidden="true">→</i>
              <strong>{formatNumber(candidate.scenario)}</strong>
              <em>{formatDelta(candidate.scenario - candidate.actual)}</em>
            </div>
          ))}
          <div className="candidate-ledger-total">
            <span>Total ballots</span>
            <strong>{formatNumber(model.scenarioVotes.totalVotes)}</strong>
            <em>{formatDelta(model.operations.ballotDelta)}</em>
          </div>
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">
          <strong>Denominator</strong>
          <span>2020 Census VAP</span>
        </div>
        <div className="inspector-metrics">
          <div><span>Voting-age population</span><strong>{formatNumber(model.votingAgePopulation)}</strong></div>
          <div><span>2024 ballots / VAP</span><strong>{model.turnoutRatePct == null ? "Unavailable" : `${model.turnoutRatePct.toFixed(1)}%`}</strong></div>
          <div><span>Usable capacity</span><strong>{formatNumber(model.turnoutCapacity)}</strong></div>
          <div><span>Model status</span><strong>{denominatorLabel(model.denominatorStatus)}</strong></div>
        </div>
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">
          <strong>Scenario contribution</strong>
          <span>Operation audit</span>
        </div>
        <div className="operation-audit">
          <div><span>Turnout addition</span><strong>{formatDelta(model.operations.turnoutAddedVotes)}</strong></div>
          <div><span>Two-party transfer</span><strong>{formatPreference(model.operations.preferenceNetHarrisGain)}</strong></div>
          <div><span>{thirdPartyLabels[model.operations.thirdPartyCandidate]} exchange</span><strong>{thirdPartyDelta === 0 ? "Off" : `${formatDelta(thirdPartyDelta)} votes`}</strong></div>
          <div className="operation-total"><span>Harris minus Trump</span><strong>{formatMarginContribution(model.operations.marginDelta)}</strong></div>
        </div>
      </div>

      <div className="inspector-section inspector-coverage">
        <div className="inspector-section-title">
          <strong>Source and match</strong>
          <span>{model.kind === "county" ? `${model.coverage.mappedBallotPct?.toFixed(1) ?? "—"}% ballot coverage` : `${formatNumber(model.coverage.sourceUnitCount)} source unit${model.coverage.sourceUnitCount === 1 ? "" : "s"}`}</span>
        </div>
        <p>{matchSummary}</p>
        {model.kind === "county" && model.coverage.residualBallots > 0 && (
          <p>{formatNumber(model.coverage.residualBallots)} county ballots remain in explicit non-terrain units.</p>
        )}
        <small>
          {model.kind === "county"
            ? "Official county totals remain authoritative. VTD coverage describes only the ballots linked to audited terrain."
            : model.coverage.resultMatchMethod
              ? "Election returns are linked to this audited polygon through the documented state crosswalk."
              : "This polygon has no assigned 2024 return and remains neutral in result-based views."}
        </small>
      </div>
    </section>
  );
}
