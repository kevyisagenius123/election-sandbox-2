import { applyBehaviorScenario } from "../../packages/election-model/src/scenario.ts";
import { getDetailedStateRuntimeAdapter } from "../data/detailedStateRuntimeLoaders.ts";
import { toBehaviorScenarioSettings } from "../data/scenarioPortfolio.ts";
import {
  compileThreeStateElectionNight,
  type CompiledThreeStateNight,
  type ThreeStateReturnEvent,
} from "../replay/threeStateElectionNight.ts";
import {
  NIGHT_PROGRESS_MAX,
  THREE_STATE_NIGHT_PROTOCOL,
  type NightAggregate,
  type NightCandidateVote,
  type NightCurrentReturn,
  type NightHeadline,
  type NightJurisdiction,
  type NightPublishedUnit,
  type NightReportedCounty,
  type ThreeStateNightWorkerRequest,
  type ThreeStateNightWorkerResponse,
} from "./threeStateNightProtocol.ts";

type MutableAggregate = {
  harris: number;
  trump: number;
  stein: number;
  oliver: number;
  residual: number;
  total: number;
  returns: number;
};

const zero = (): MutableAggregate => ({
  harris: 0,
  trump: 0,
  stein: 0,
  oliver: 0,
  residual: 0,
  total: 0,
  returns: 0,
});

function candidateVotes(value: MutableAggregate): NightCandidateVote[] {
  return [
    { candidateId: "harris", votes: value.harris },
    { candidateId: "trump", votes: value.trump },
    { candidateId: "stein", votes: value.stein },
    { candidateId: "oliver", votes: value.oliver },
    { candidateId: "other-residual", votes: value.residual },
  ];
}

function aggregate(value: MutableAggregate): NightAggregate {
  return {
    candidateVotes: candidateVotes(value),
    totalReportedVotes: value.total,
    returnsPublished: value.returns,
  };
}

function add(target: MutableAggregate, event: ThreeStateReturnEvent) {
  target.harris += event.harrisVotes;
  target.trump += event.trumpVotes;
  target.stein += event.steinVotes;
  target.oliver += event.oliverVotes;
  target.residual += event.residualOtherVotes;
  target.total += event.totalVotes;
  target.returns += 1;
}

class ThreeStateNightRuntime {
  replay: CompiledThreeStateNight | null = null;
  playheadMs = 0;
  eventIndex = 0;
  status: "paused" | "playing" | "complete" = "paused";
  national = zero();
  states = new Map<string, MutableAggregate>();
  counties = new Map<string, MutableAggregate>();
  units = new Map<string, NightPublishedUnit>();
  currentReturn: NightCurrentReturn | null = null;

  async handle(request: ThreeStateNightWorkerRequest): Promise<ThreeStateNightWorkerResponse> {
    try {
      if (request.protocolVersion !== THREE_STATE_NIGHT_PROTOCOL) {
        throw new Error("Election-night worker protocol mismatch");
      }
      if (request.type === "INITIALIZE") return this.initialize(request);
      if (!this.replay) throw new Error("Election-night worker is not initialized");
      return this.command(request.requestId, request.command);
    } catch (error: unknown) {
      return {
        protocolVersion: THREE_STATE_NIGHT_PROTOCOL,
        requestId: request.requestId,
        type: "ERROR",
        message: error instanceof Error ? error.message : "Election-night worker failed",
      };
    }
  }

  async initialize(request: Extract<ThreeStateNightWorkerRequest, { type: "INITIALIZE" }>) {
    if (this.replay) throw new Error("Election-night worker can initialize only once");
    const scenarios = await Promise.all(request.states.map(async (state) => {
      const response = await fetch(state.artifactUrl);
      if (!response.ok) throw new Error(`${state.stateCode} data returned ${response.status}`);
      const adapter = getDetailedStateRuntimeAdapter(state.loader);
      const foundation = adapter.decode(await response.json());
      const units = adapter.toBehaviorModelUnits(foundation);
      return {
        stateCode: state.stateCode,
        units: applyBehaviorScenario(units, toBehaviorScenarioSettings(state.settings)).units,
      };
    }));
    this.replay = compileThreeStateElectionNight(scenarios, request.behavior);
    this.playheadMs = this.replay.startsAtMs;
    this.resetAggregates();
    return this.response(request.requestId, "READY", [], [], true);
  }

  command(
    requestId: number,
    command: Extract<ThreeStateNightWorkerRequest, { type: "COMMAND" }>["command"],
  ): ThreeStateNightWorkerResponse {
    if (!this.replay) throw new Error("Election-night worker is not initialized");
    if (command.type === "PLAY") {
      if (this.status !== "complete") this.status = "playing";
      return this.response(requestId, "UPDATE", [], [], false);
    }
    if (command.type === "PAUSE") {
      if (this.status !== "complete") this.status = "paused";
      return this.response(requestId, "UPDATE", [], [], false);
    }
    if (command.type === "RESET") {
      this.playheadMs = this.replay.startsAtMs;
      this.resetAggregates();
      return this.response(requestId, "UPDATE", [], [], true);
    }
    let target = this.playheadMs;
    if (command.type === "STEP_NEXT_EVENT_TIME") {
      target = this.replay.events[this.eventIndex]?.atMs ?? this.replay.endsAtMs;
    } else if (command.type === "ADVANCE_LOGICAL_TIME") {
      if (!Number.isFinite(command.deltaMs) || command.deltaMs < 0) throw new Error("Invalid replay advance");
      target = Math.min(this.replay.endsAtMs, this.playheadMs + command.deltaMs);
    } else if (command.type === "SEEK_PROGRESS") {
      if (!Number.isSafeInteger(command.progressMillionths)
        || command.progressMillionths < 0
        || command.progressMillionths > NIGHT_PROGRESS_MAX) {
        throw new Error("Election-night timeline position is invalid");
      }
      target = this.replay.startsAtMs + Math.round(
        (this.replay.endsAtMs - this.replay.startsAtMs)
        * command.progressMillionths / NIGHT_PROGRESS_MAX,
      );
    }
    const backward = target < this.playheadMs;
    if (backward) this.resetAggregates();
    const changedCounties = new Set<string>();
    const changedUnits: NightPublishedUnit[] = [];
    while (this.eventIndex < this.replay.events.length) {
      const event = this.replay.events[this.eventIndex];
      if (event.atMs > target) break;
      this.applyEvent(event, changedCounties, changedUnits);
      this.eventIndex += 1;
    }
    this.playheadMs = target;
    this.status = this.eventIndex >= this.replay.events.length ? "complete" : "paused";
    if (command.type === "ADVANCE_LOGICAL_TIME" && this.status !== "complete") this.status = "playing";
    return this.response(
      requestId,
      "UPDATE",
      backward ? this.allCounties() : this.countiesFor(changedCounties),
      backward ? [...this.units.values()] : changedUnits,
      backward,
    );
  }

  resetAggregates() {
    this.eventIndex = 0;
    this.status = "paused";
    this.national = zero();
    this.states = new Map([["PA", zero()], ["MI", zero()], ["WI", zero()]]);
    this.counties.clear();
    this.units.clear();
    this.currentReturn = null;
  }

  applyEvent(
    event: ThreeStateReturnEvent,
    changedCounties: Set<string>,
    changedUnits: NightPublishedUnit[],
  ) {
    add(this.national, event);
    add(this.states.get(event.stateCode)!, event);
    if (event.countyId) {
      const key = `${event.stateCode}:${event.countyId}`;
      const county = this.counties.get(key) ?? zero();
      add(county, event);
      this.counties.set(key, county);
      changedCounties.add(key);
    }
    const unitAggregate = zero();
    add(unitAggregate, event);
    const unit: NightPublishedUnit = {
      jurisdictionId: event.stateCode,
      unitId: event.unitId,
      countyId: event.countyId,
      geometryId: event.geometryId,
      ...aggregate(unitAggregate),
    };
    this.units.set(`${event.stateCode}:${event.unitId}`, unit);
    changedUnits.push(unit);
    this.currentReturn = {
      eventId: event.eventId,
      atMs: event.atMs,
      jurisdictionId: event.stateCode,
      countyId: event.countyId,
      unitId: event.unitId,
      geometryId: event.geometryId,
      totalVotes: event.totalVotes,
    };
  }

  countiesFor(keys: ReadonlySet<string>): NightReportedCounty[] {
    return [...keys].flatMap((key) => {
      const value = this.counties.get(key);
      if (!value) return [];
      const [jurisdictionId, countyId] = key.split(":");
      return [{
        jurisdictionId: jurisdictionId as "PA" | "MI" | "WI",
        countyId,
        ...aggregate(value),
      }];
    });
  }

  allCounties() {
    return this.countiesFor(new Set(this.counties.keys()));
  }

  response(
    requestId: number,
    type: "READY" | "UPDATE",
    reportedCounties: readonly NightReportedCounty[],
    publishedUnits: readonly NightPublishedUnit[],
    replaceLocalState: boolean,
  ): ThreeStateNightWorkerResponse {
    if (!this.replay) throw new Error("Election-night worker is not initialized");
    const jurisdictions = (["PA", "MI", "WI"] as const).map((jurisdictionId): NightJurisdiction => ({
      jurisdictionId,
      geographyAvailability: "detailed",
      expectedReturns: this.replay!.stateReturnTotals[jurisdictionId],
      ...aggregate(this.states.get(jurisdictionId)!),
    }));
    const current: NightHeadline = {
      controller: {
        status: this.status,
        logicalReplayTimeMs: this.playheadMs,
        appliedEventCount: this.eventIndex,
      },
      election: {
        national: aggregate(this.national),
        jurisdictions,
        complete: this.status === "complete",
      },
    };
    const duration = this.replay.endsAtMs - this.replay.startsAtMs;
    const progress = duration <= 0
      ? NIGHT_PROGRESS_MAX
      : Math.round((this.playheadMs - this.replay.startsAtMs) / duration * NIGHT_PROGRESS_MAX);
    return {
      protocolVersion: THREE_STATE_NIGHT_PROTOCOL,
      requestId,
      type,
      current,
      reportedCounties,
      publishedUnits,
      currentReturn: this.currentReturn,
      replaceLocalState,
      timelineProgressMillionths: Math.max(0, Math.min(NIGHT_PROGRESS_MAX, progress)),
    };
  }
}

const runtime = new ThreeStateNightRuntime();
let queue = Promise.resolve();

self.onmessage = (event: MessageEvent<ThreeStateNightWorkerRequest>) => {
  queue = queue.then(async () => {
    const response = await runtime.handle(event.data);
    self.postMessage(response);
  });
};
