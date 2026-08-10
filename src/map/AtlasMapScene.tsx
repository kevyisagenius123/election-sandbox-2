/* eslint-disable react-hooks/refs -- deck.gl stores these callbacks and invokes them after render. */
import {
  AmbientLight,
  COORDINATE_SYSTEM,
  DirectionalLight,
  LightingEffect,
  OrbitView,
  type PickingInfo,
} from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import type { Feature } from "geojson";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyTwoPartyVoteTransfer,
} from "../../packages/election-model/src/scenario.ts";
import type {
  CountyPresidentialResult,
  CountyScenarioResult,
  StatewidePresidentialResult,
} from "../../packages/election-model/src/scenario.ts";
import {
  loadPennsylvaniaPrecinctCounty,
  type LoadedPennsylvaniaPrecinctCounty,
  type PrecinctResultProperties,
} from "../data/paPrecincts.ts";
import type { StateDatum } from "../data/states.ts";
import {
  atlasController,
  countyFeatures,
  featureBounds,
  featureFips,
  NATIONAL_VIEW,
  stateCodeByFips,
  stateFeatures,
  stateFipsByCode,
  type AtlasViewState,
} from "./atlasGeometry.ts";
import { ATLAS_NEUTRAL, atlasMarginColor, hexToDeckColor } from "./atlasPalette.ts";

type ViewMode = "actual" | "scenario" | "difference";

type AtlasMapSceneProps = {
  actualStates: readonly StateDatum[];
  scenarioStates: readonly StatewidePresidentialResult[];
  actualPennsylvaniaCounties: readonly CountyPresidentialResult[];
  scenarioPennsylvaniaCounties: readonly CountyScenarioResult[];
  activeStateCode: string | null;
  activeCountyFips: string | null;
  viewMode: ViewMode;
  onActiveStateChange: (code: string | null) => void;
  onActiveCountyChange: (fips: string | null) => void;
};

type VoteResult = Pick<StatewidePresidentialResult, "harrisVotes" | "trumpVotes" | "totalVotes">;

function signedMargin(result: VoteResult) {
  return ((result.harrisVotes - result.trumpVotes) / result.totalVotes) * 100;
}

function resultColor(result: VoteResult | undefined) {
  if (!result) return ATLAS_NEUTRAL;
  const resultMargin = signedMargin(result);
  return atlasMarginColor(Math.abs(resultMargin), resultMargin > 0 ? "DEM" : "GOP");
}

export function AtlasMapScene({
  actualStates,
  scenarioStates,
  actualPennsylvaniaCounties,
  scenarioPennsylvaniaCounties,
  activeStateCode,
  activeCountyFips,
  viewMode,
  onActiveStateChange,
  onActiveCountyChange,
}: AtlasMapSceneProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const viewFrameRef = useRef<number | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const cameraAnimationRef = useRef<number | null>(null);
  const pendingViewRef = useRef<AtlasViewState | null>(null);
  const cameraRef = useRef<AtlasViewState>(NATIONAL_VIEW);
  const [viewState, setViewState] = useState<AtlasViewState>(NATIONAL_VIEW);
  const [countyRaised, setCountyRaised] = useState(false);
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [hoveredCountyFips, setHoveredCountyFips] = useState<string | null>(null);
  const [precinctLoad, setPrecinctLoad] = useState<{
    countyFips: string | null;
    county: LoadedPennsylvaniaPrecinctCounty | null;
    error: string | null;
  }>({ countyFips: null, county: null, error: null });
  const [hoveredPrecinctGeoid, setHoveredPrecinctGeoid] = useState<string | null>(null);
  const [selectedPrecinctGeoid, setSelectedPrecinctGeoid] = useState<string | null>(null);
  const [heightMode, setHeightMode] = useState<"ballots" | "flat">("ballots");
  const precinctCounty = activeCountyFips && precinctLoad.countyFips === activeCountyFips
    ? precinctLoad.county
    : null;
  const precinctLoading = Boolean(activeCountyFips && precinctLoad.countyFips !== activeCountyFips);
  const precinctError = activeCountyFips && precinctLoad.countyFips === activeCountyFips
    ? precinctLoad.error
    : null;

  const atlasView = useMemo(() => new OrbitView({ id: "sandbox-atlas", controller: true }), []);
  const atlasEffects = useMemo(() => {
    const ambientLight = new AmbientLight({ color: [255, 250, 238], intensity: 0.72 });
    const keyLight = new DirectionalLight({ color: [255, 244, 222], intensity: 0.82, direction: [-3, -5, -8] });
    const fillLight = new DirectionalLight({ color: [150, 190, 205], intensity: 0.24, direction: [4, 1, -3] });
    return [new LightingEffect({ ambientLight, keyLight, fillLight })];
  }, []);

  const actualByCode = useMemo(
    () => new Map(actualStates.map((state) => [state.code, state])),
    [actualStates],
  );
  const scenarioByCode = useMemo(
    () => new Map(scenarioStates.map((state) => [state.code, state])),
    [scenarioStates],
  );
  const actualCountyByFips = useMemo(
    () => new Map(actualPennsylvaniaCounties.map((county) => [county.fips, county])),
    [actualPennsylvaniaCounties],
  );
  const scenarioCountyByFips = useMemo(
    () => new Map(scenarioPennsylvaniaCounties.map((county) => [county.fips, county])),
    [scenarioPennsylvaniaCounties],
  );
  const maxPennsylvaniaCountyVotes = useMemo(
    () => Math.max(...actualPennsylvaniaCounties.map((county) => county.totalVotes), 1),
    [actualPennsylvaniaCounties],
  );
  const activeActualCounty = activeCountyFips
    ? actualCountyByFips.get(activeCountyFips)
    : undefined;
  const activeScenarioCounty = activeCountyFips
    ? scenarioCountyByFips.get(activeCountyFips)
    : undefined;
  const scenarioPrecinctByGeoid = useMemo(() => {
    const map = new Map<string, PrecinctResultProperties & { netHarrisGain: number }>();
    if (!precinctCounty || !activeActualCounty || !activeScenarioCounty) return map;
    const actualPrecincts = precinctCounty.features.features.map(
      (item) => item.properties,
    );
    const towardHarris = activeScenarioCounty.netHarrisGain >= 0;
    const countyAvailable = towardHarris
      ? activeActualCounty.trumpVotes
      : activeActualCounty.harrisVotes;
    const mappedAvailable = actualPrecincts.reduce(
      (sum, result) => sum + (towardHarris ? result.trumpVotes : result.harrisVotes),
      0,
    );
    const mappedTransfer = countyAvailable === 0
      ? 0
      : Math.round(
        Math.abs(activeScenarioCounty.netHarrisGain) * mappedAvailable / countyAvailable,
      ) * (towardHarris ? 1 : -1);
    for (const result of applyTwoPartyVoteTransfer(actualPrecincts, mappedTransfer)) {
      map.set(result.geoid, result);
    }
    return map;
  }, [activeActualCounty, activeScenarioCounty, precinctCounty]);
  const maxPrecinctVotes = useMemo(
    () => Math.max(
      ...(precinctCounty?.features.features.map((item) => item.properties.totalVotes) ?? []),
      1,
    ),
    [precinctCounty],
  );
  const precinctElevationUnit = useMemo(() => {
    if (!precinctCounty) return 1;
    const [minX, minY, maxX, maxY] = precinctCounty.metadata.bounds;
    const horizontalSpan = Math.max(maxX - minX, maxY - minY);
    return Math.max(0.45, horizontalSpan * 0.052);
  }, [precinctCounty]);

  const activeStateFips = activeStateCode ? stateFipsByCode[activeStateCode] : null;
  const activeStateFeature = useMemo(
    () => stateFeatures.features.find((item) => featureFips(item, 2) === activeStateFips),
    [activeStateFips],
  );
  const activeCounties = useMemo(
    () => activeStateFips
      ? countyFeatures.features.filter((item) => featureFips(item, 5).startsWith(activeStateFips))
      : [],
    [activeStateFips],
  );

  const animateCamera = useCallback((destination: AtlasViewState, duration = 780) => {
    if (cameraAnimationRef.current != null) window.cancelAnimationFrame(cameraAnimationRef.current);
    const start = performance.now();
    const origin = cameraRef.current;
    const originTarget = [...origin.target] as [number, number, number];

    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next: AtlasViewState = {
        target: [
          originTarget[0] + (destination.target[0] - originTarget[0]) * eased,
          originTarget[1] + (destination.target[1] - originTarget[1]) * eased,
          originTarget[2] + (destination.target[2] - originTarget[2]) * eased,
        ],
        zoom: origin.zoom + (destination.zoom - origin.zoom) * eased,
        rotationX: origin.rotationX + (destination.rotationX - origin.rotationX) * eased,
        rotationOrbit: origin.rotationOrbit + (destination.rotationOrbit - origin.rotationOrbit) * eased,
      };
      cameraRef.current = next;
      setViewState(next);
      if (progress < 1) cameraAnimationRef.current = window.requestAnimationFrame(frame);
      else cameraAnimationRef.current = null;
    };

    cameraAnimationRef.current = window.requestAnimationFrame(frame);
  }, []);

  const destinationForBounds = useCallback((
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: { widthRatio: number; heightRatio: number; minZoom: number; maxZoom: number; rotationX: number },
  ): AtlasViewState => {
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const containerWidth = shellRef.current?.clientWidth ?? window.innerWidth;
    const containerHeight = shellRef.current?.clientHeight ?? window.innerHeight;
    const scale = Math.min(
      containerWidth * options.widthRatio / width,
      containerHeight * options.heightRatio / height,
    );
    return {
      target: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0],
      zoom: Math.min(options.maxZoom, Math.max(options.minZoom, Math.log2(scale) + 0.18)),
      rotationX: options.rotationX,
      rotationOrbit: 0,
    };
  }, []);

  const nationalDestination = useCallback((): AtlasViewState => {
    const containerWidth = shellRef.current?.clientWidth ?? window.innerWidth;
    const containerHeight = shellRef.current?.clientHeight ?? window.innerHeight;
    const scale = Math.min(
      containerWidth * 0.92 / 975,
      containerHeight * 0.72 / 610,
    );
    return {
      ...NATIONAL_VIEW,
      zoom: Math.min(-0.2, Math.log2(Math.max(scale, 0.1))),
    };
  }, []);

  const openState = useCallback((code: string) => {
    const fips = stateFipsByCode[code];
    const stateFeature = stateFeatures.features.find((item) => featureFips(item, 2) === fips);
    if (!stateFeature) return;
    const bounds = featureBounds(stateFeature);

    setCountyRaised(false);
    setHoveredCountyFips(null);
    onActiveCountyChange(null);
    onActiveStateChange(code);
    animateCamera(destinationForBounds(bounds, {
      widthRatio: 0.72,
      heightRatio: 0.58,
      minZoom: 0.85,
      maxZoom: 2.25,
      rotationX: 58,
    }));
  }, [animateCamera, destinationForBounds, onActiveCountyChange, onActiveStateChange]);

  const openCounty = useCallback((fips: string) => {
    const countyFeature = activeCounties.find((item) => featureFips(item, 5) === fips);
    if (!countyFeature) return;
    setHoveredCountyFips(null);
    setHoveredPrecinctGeoid(null);
    setSelectedPrecinctGeoid(null);
    onActiveCountyChange(fips);
    animateCamera(destinationForBounds(featureBounds(countyFeature), {
      widthRatio: 0.72,
      heightRatio: 0.64,
      minZoom: 2.3,
      maxZoom: 6.8,
      rotationX: 55,
    }), 720);
  }, [activeCounties, animateCamera, destinationForBounds, onActiveCountyChange]);

  const closeCounty = useCallback(() => {
    if (!activeStateFeature) return;
    setHoveredPrecinctGeoid(null);
    setSelectedPrecinctGeoid(null);
    onActiveCountyChange(null);
    animateCamera(destinationForBounds(featureBounds(activeStateFeature), {
      widthRatio: 0.72,
      heightRatio: 0.58,
      minZoom: 0.85,
      maxZoom: 2.25,
      rotationX: 58,
    }), 680);
  }, [activeStateFeature, animateCamera, destinationForBounds, onActiveCountyChange]);

  const closeState = useCallback(() => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setCountyRaised(false);
      setHoveredCountyFips(null);
      setHoveredPrecinctGeoid(null);
      setSelectedPrecinctGeoid(null);
      onActiveCountyChange(null);
      onActiveStateChange(null);
      closeTimerRef.current = null;
    }, 260);
    animateCamera(nationalDestination());
  }, [animateCamera, nationalDestination, onActiveCountyChange, onActiveStateChange]);

  useEffect(() => {
    if (!activeStateCode) return;
    const timer = window.setTimeout(() => setCountyRaised(true), 180);
    return () => window.clearTimeout(timer);
  }, [activeStateCode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || activeStateCode) return;
    const updateNationalView = () => {
      if (layoutFrameRef.current != null) window.cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = window.requestAnimationFrame(() => {
        const next = nationalDestination();
        cameraRef.current = next;
        setViewState(next);
        layoutFrameRef.current = null;
      });
    };
    updateNationalView();
    const resizeObserver = new ResizeObserver(updateNationalView);
    resizeObserver.observe(shell);
    return () => {
      resizeObserver.disconnect();
      if (layoutFrameRef.current != null) window.cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = null;
    };
  }, [activeStateCode, nationalDestination]);

  useEffect(() => {
    if (!activeCountyFips) return;

    const controller = new AbortController();
    loadPennsylvaniaPrecinctCounty(activeCountyFips, controller.signal)
      .then((county) => {
        setPrecinctLoad({ countyFips: activeCountyFips, county, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPrecinctLoad({
          countyFips: activeCountyFips,
          county: null,
          error: error instanceof Error ? error.message : "Precinct geometry could not be loaded",
        });
      });
    return () => controller.abort();
  }, [activeCountyFips]);

  useEffect(() => {
    if (!activeCountyFips || !precinctCounty) return;
    const [minX, minY, maxX, maxY] = precinctCounty.metadata.bounds;
    animateCamera(destinationForBounds({ minX, minY, maxX, maxY }, {
      widthRatio: 0.72,
      heightRatio: 0.64,
      minZoom: 2.3,
      maxZoom: 6.8,
      rotationX: 55,
    }), 520);
  }, [activeCountyFips, animateCamera, destinationForBounds, precinctCounty]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeCountyFips) closeCounty();
      else if (activeStateCode) closeState();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeCountyFips, activeStateCode, closeCounty, closeState]);

  useEffect(() => () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    if (viewFrameRef.current != null) window.cancelAnimationFrame(viewFrameRef.current);
    if (layoutFrameRef.current != null) window.cancelAnimationFrame(layoutFrameRef.current);
    if (cameraAnimationRef.current != null) window.cancelAnimationFrame(cameraAnimationRef.current);
    closeTimerRef.current = null;
    viewFrameRef.current = null;
    layoutFrameRef.current = null;
    cameraAnimationRef.current = null;
    pendingViewRef.current = null;
  }, []);

  const layers = useMemo(() => {
    const stateLayer = new GeoJsonLayer({
      id: "sandbox-2-states",
      data: stateFeatures,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      extruded: true,
      filled: true,
      stroked: true,
      pickable: !activeStateCode,
      lineWidthUnits: "pixels",
      getLineWidth: 1,
      getLineColor: [255, 255, 247, activeStateCode ? 0 : 185],
      getFillColor: (item: Feature) => {
        const code = stateCodeByFips[featureFips(item, 2)];
        const actual = actualByCode.get(code);
        const scenario = scenarioByCode.get(code);
        if (viewMode === "difference") {
          if (!actual || !scenario) return hexToDeckColor(ATLAS_NEUTRAL, activeStateCode ? 0 : 255);
          const difference = signedMargin(scenario) - signedMargin(actual);
          if (Math.abs(difference) < 0.05) return hexToDeckColor(ATLAS_NEUTRAL, activeStateCode ? 0 : 255);
          return hexToDeckColor(atlasMarginColor(Math.abs(difference), difference > 0 ? "DEM" : "GOP"), activeStateCode ? 0 : 255);
        }
        return hexToDeckColor(resultColor(viewMode === "actual" ? actual : scenario), activeStateCode ? 0 : 255);
      },
      getElevation: (item: Feature) => {
        if (activeStateCode) return 0;
        const code = stateCodeByFips[featureFips(item, 2)];
        const result = actualByCode.get(code);
        const electoralVotes = (result?.harrisElectoralVotes ?? 0) + (result?.trumpElectoralVotes ?? 0);
        return 12 + Math.max(3, electoralVotes) * 1.15;
      },
      material: { ambient: 0.72, diffuse: 0.52, shininess: 5, specularColor: [18, 20, 18] },
      transitions: {
        getElevation: { duration: 520 },
        getFillColor: { duration: 420 },
      },
      updateTriggers: {
        getElevation: [activeStateCode],
        getFillColor: [activeStateCode, viewMode, scenarioStates],
      },
      onHover: (info: PickingInfo) => {
        const item = info.object as Feature | undefined;
        setHoveredStateCode(item ? stateCodeByFips[featureFips(item, 2)] ?? null : null);
      },
      onClick: (info: PickingInfo) => {
        const item = info.object as Feature | undefined;
        const code = item ? stateCodeByFips[featureFips(item, 2)] : undefined;
        if (code) openState(code);
      },
    });

    if (!activeStateCode || !activeStateFeature) return [stateLayer];

    const countyLayer = new GeoJsonLayer({
      id: `sandbox-2-counties-${activeStateCode}`,
      data: { type: "FeatureCollection", features: activeCounties },
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      extruded: true,
      filled: true,
      stroked: true,
      wireframe: true,
      pickable: activeStateCode === "PA" && !activeCountyFips,
      autoHighlight: activeStateCode === "PA" && !activeCountyFips,
      highlightColor: [255, 248, 226, 95],
      lineWidthUnits: "pixels",
      getLineWidth: 1.1,
      getLineColor: [65, 77, 74, 160],
      getFillColor: (item: Feature) => {
        const fips = featureFips(item, 5);
        const actual = actualCountyByFips.get(fips);
        const scenario = scenarioCountyByFips.get(fips);
        if (!actual || !scenario) return hexToDeckColor(ATLAS_NEUTRAL, 255);
        if (viewMode === "difference") {
          const difference = signedMargin(scenario) - signedMargin(actual);
          if (Math.abs(difference) < 0.05) return hexToDeckColor(ATLAS_NEUTRAL, 255);
          return hexToDeckColor(atlasMarginColor(Math.abs(difference), difference > 0 ? "DEM" : "GOP"), 255);
        }
        return hexToDeckColor(resultColor(viewMode === "actual" ? actual : scenario), 255);
      },
      getElevation: (item: Feature) => {
        const actual = actualCountyByFips.get(featureFips(item, 5));
        if (!actual) return 4;
        if (heightMode === "flat") return 7;
        return 4 + 18 * Math.sqrt(actual.totalVotes / maxPennsylvaniaCountyVotes);
      },
      material: { ambient: 0.74, diffuse: 0.5, shininess: 4, specularColor: [16, 18, 16] },
      transitions: {
        getElevation: { duration: 700, enter: () => 0 },
        getFillColor: { duration: 680 },
      },
      updateTriggers: {
        getElevation: [heightMode, maxPennsylvaniaCountyVotes],
        getFillColor: [viewMode, scenarioPennsylvaniaCounties],
      },
      onHover: (info: PickingInfo) => {
        const item = info.object as Feature | undefined;
        setHoveredCountyFips(item ? featureFips(item, 5) : null);
      },
      onClick: (info: PickingInfo) => {
        const item = info.object as Feature | undefined;
        if (item) openCounty(featureFips(item, 5));
      },
    });

    if (activeCountyFips && precinctCounty) {
      const precinctLayer = new GeoJsonLayer({
        id: `sandbox-2-precincts-${activeCountyFips}`,
        data: precinctCounty.features,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        extruded: true,
        filled: true,
        stroked: true,
        wireframe: false,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 248, 226, 105],
        lineWidthUnits: "pixels",
        getLineWidth: 0.8,
        getLineColor: [61, 75, 72, 150],
        getFillColor: (item: Feature) => {
          const actual = item.properties as unknown as PrecinctResultProperties;
          const scenario = scenarioPrecinctByGeoid.get(actual.geoid);
          if (actual.resultQuality === "unmatched_geometry" || actual.totalVotes === 0) {
            return hexToDeckColor(ATLAS_NEUTRAL, 205);
          }
          if (viewMode === "difference") {
            if (!scenario) return hexToDeckColor(ATLAS_NEUTRAL, 225);
            const difference = signedMargin(scenario) - signedMargin(actual);
            if (Math.abs(difference) < 0.05) return hexToDeckColor(ATLAS_NEUTRAL, 255);
            return hexToDeckColor(
              atlasMarginColor(Math.abs(difference), difference > 0 ? "DEM" : "GOP"),
              255,
            );
          }
          return hexToDeckColor(resultColor(viewMode === "actual" ? actual : scenario), 255);
        },
        getElevation: (item: Feature) => {
          const result = item.properties as unknown as PrecinctResultProperties;
          if (result.totalVotes === 0) return precinctElevationUnit * 0.18;
          if (heightMode === "flat") return precinctElevationUnit * 0.72;
          return precinctElevationUnit * (
            0.32 + 1.48 * Math.sqrt(result.totalVotes / maxPrecinctVotes)
          );
        },
        material: { ambient: 0.76, diffuse: 0.48, shininess: 3, specularColor: [14, 17, 15] },
        transitions: {
          getElevation: { duration: 680, enter: () => 0 },
          getFillColor: { duration: 520 },
        },
        updateTriggers: {
          getElevation: [heightMode, maxPrecinctVotes, precinctElevationUnit],
          getFillColor: [viewMode, scenarioPrecinctByGeoid],
        },
        onHover: (info: PickingInfo) => {
          const item = info.object as Feature | undefined;
          const properties = item?.properties as unknown as PrecinctResultProperties | undefined;
          setHoveredPrecinctGeoid(properties?.geoid ?? null);
        },
        onClick: (info: PickingInfo) => {
          const item = info.object as Feature | undefined;
          const properties = item?.properties as unknown as PrecinctResultProperties | undefined;
          if (properties) setSelectedPrecinctGeoid(properties.geoid);
        },
      });
      return [precinctLayer];
    }

    // Once counties rise, remove the transparent national layer. Keeping it in
    // the depth buffer can hide shorter county prisms on some GPUs.
    return countyRaised ? [countyLayer] : [stateLayer];
  }, [
    activeCounties,
    activeCountyFips,
    activeStateCode,
    activeStateFeature,
    actualCountyByFips,
    actualByCode,
    countyRaised,
    heightMode,
    maxPennsylvaniaCountyVotes,
    maxPrecinctVotes,
    openCounty,
    openState,
    precinctCounty,
    precinctElevationUnit,
    scenarioByCode,
    scenarioCountyByFips,
    scenarioPennsylvaniaCounties,
    scenarioPrecinctByGeoid,
    scenarioStates,
    viewMode,
  ]);

  const inspectedCountyFips = hoveredCountyFips;
  const inspectedActualCounty = inspectedCountyFips ? actualCountyByFips.get(inspectedCountyFips) : undefined;
  const inspectedScenarioCounty = inspectedCountyFips ? scenarioCountyByFips.get(inspectedCountyFips) : undefined;
  const inspectedScenarioMargin = inspectedScenarioCounty ? signedMargin(inspectedScenarioCounty) : null;
  const inspectedPrecinctGeoid = hoveredPrecinctGeoid ?? selectedPrecinctGeoid;
  const inspectedActualPrecinct = inspectedPrecinctGeoid
    ? precinctCounty?.features.features.find(
      (item) => item.properties.geoid === inspectedPrecinctGeoid,
    )?.properties
    : undefined;
  const inspectedScenarioPrecinct = inspectedPrecinctGeoid
    ? scenarioPrecinctByGeoid.get(inspectedPrecinctGeoid)
    : undefined;
  const inspectedPrecinctMargin = inspectedScenarioPrecinct && inspectedScenarioPrecinct.totalVotes > 0
    ? signedMargin(inspectedScenarioPrecinct)
    : null;

  return (
    <div className="atlas-map-scene" ref={shellRef}>
      <DeckGL
        controller={atlasController}
        effects={atlasEffects}
        getCursor={({ isDragging, isHovering }) => isDragging ? "grabbing" : isHovering ? "pointer" : "grab"}
        layers={layers}
        onClick={(info) => {
          if (info.object) return;
          if (activeStateCode && !activeCountyFips) closeState();
        }}
        onViewStateChange={({ viewState: next, interactionState }) => {
          if (interactionState.isDragging || interactionState.isZooming) {
            if (cameraAnimationRef.current != null) window.cancelAnimationFrame(cameraAnimationRef.current);
            cameraAnimationRef.current = null;
          }
          const nextView = next as unknown as AtlasViewState;
          cameraRef.current = nextView;
          pendingViewRef.current = nextView;
          if (viewFrameRef.current == null) {
            viewFrameRef.current = window.requestAnimationFrame(() => {
              viewFrameRef.current = null;
              if (pendingViewRef.current) setViewState(pendingViewRef.current);
            });
          }
        }}
        views={atlasView}
        viewState={viewState}
      />

      {!activeStateCode && hoveredStateCode && (
        <div className="atlas-hover-label">{actualByCode.get(hoveredStateCode)?.name ?? hoveredStateCode}</div>
      )}

      {activeStateCode && (
        <>
          <button
            className="atlas-back-button"
            onClick={activeCountyFips ? closeCounty : closeState}
            type="button"
          >
            <span aria-hidden="true">←</span> {activeCountyFips ? "All counties" : "All states"} <kbd>Esc</kbd>
          </button>
          <div className="atlas-data-note">
            <span className="overline">
              {activeCountyFips ? "Verified precinct returns" : activeStateCode === "PA" ? "Verified county returns" : "County terrain"}
            </span>
            <strong>{activeCountyFips ? activeActualCounty?.name : actualByCode.get(activeStateCode)?.name}</strong>
            {activeCountyFips ? (
              <>
                {precinctLoading && <p className="atlas-load-status">Loading this county’s Census VTD geometry…</p>}
                {precinctError && <p className="atlas-load-status error">{precinctError}</p>}
                {precinctCounty && (
                  <p>
                    {precinctCounty.metadata.resultVoteCoveragePct.toFixed(1)}% of precinct-file votes map to these polygons.
                    {" "}{precinctCounty.metadata.unmatchedReportingUnitCount} unmatched reporting units remain outside the terrain.
                  </p>
                )}
                <div className="atlas-height-switch" aria-label="Precinct height mode">
                  <span>Height</span>
                  <button aria-pressed={heightMode === "ballots"} onClick={() => setHeightMode("ballots")} type="button">Ballots</button>
                  <button aria-pressed={heightMode === "flat"} onClick={() => setHeightMode("flat")} type="button">Flat</button>
                </div>
              </>
            ) : activeStateCode === "PA" ? (
              <>
                <p>Color is presidential margin. Height is normalized named-candidate ballots. Click a county to open its voting-district terrain.</p>
                <div className="atlas-height-switch" aria-label="County height mode">
                  <span>Height</span>
                  <button aria-pressed={heightMode === "ballots"} onClick={() => setHeightMode("ballots")} type="button">Ballots</button>
                  <button aria-pressed={heightMode === "flat"} onClick={() => setHeightMode("flat")} type="button">Flat</button>
                </div>
              </>
            ) : (
              <p>Geometry connected. This state remains neutral until its official county results reconcile.</p>
            )}
          </div>
          {activeStateCode === "PA" && !activeCountyFips && inspectedActualCounty && inspectedScenarioCounty && (
            <div className="atlas-county-readout" aria-live="polite">
              <span className="overline">County under cursor · click to open</span>
              <strong>{inspectedActualCounty.name}</strong>
              <div>
                <span>{inspectedActualCounty.totalVotes.toLocaleString()} named votes</span>
                <span>{inspectedScenarioMargin != null && Math.abs(inspectedScenarioMargin) >= 0.005 ? `${inspectedScenarioMargin >= 0 ? "D" : "R"} +${Math.abs(inspectedScenarioMargin).toFixed(1)}` : "Even"}</span>
              </div>
              <p>{inspectedScenarioCounty.netHarrisGain === 0 ? "No scenario change" : `${inspectedScenarioCounty.netHarrisGain.toLocaleString()} votes transferred toward Harris`}</p>
            </div>
          )}
          {activeCountyFips && inspectedActualPrecinct && inspectedScenarioPrecinct && (
            <div className="atlas-county-readout atlas-precinct-readout" aria-live="polite">
              <span className="overline">{hoveredPrecinctGeoid ? "VTD under cursor" : "Pinned VTD"}</span>
              <strong>{inspectedActualPrecinct.sourceName ?? inspectedActualPrecinct.censusName}</strong>
              <div>
                <span>{inspectedActualPrecinct.totalVotes.toLocaleString()} named votes</span>
                <span>
                  {inspectedPrecinctMargin == null
                    ? "No matched return"
                    : Math.abs(inspectedPrecinctMargin) < 0.005
                      ? "Even"
                      : `${inspectedPrecinctMargin >= 0 ? "D" : "R"} +${Math.abs(inspectedPrecinctMargin).toFixed(1)}`}
                </span>
              </div>
              <p>
                {inspectedActualPrecinct.resultQuality === "official_exact_vtd"
                  ? "Exact county and Census VTD identifier match."
                  : inspectedActualPrecinct.resultQuality === "official_canonical_name"
                    ? "Unique exact canonical-name match within this county."
                    : "Census geometry has no matched 2024 return and stays neutral."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
