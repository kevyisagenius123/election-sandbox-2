import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { DetailedStateCode } from "../data/detailedStateManifest.ts";
import type {
  NightPaceMeasure,
  NightReportingPace,
} from "../replay/visibleReportingPace.ts";

echarts.use([
  AriaComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const STATE_CODES: readonly DetailedStateCode[] = ["PA", "MI", "WI"];
const SERIES_COLORS = {
  National: "#173b4c",
  PA: "#2e83a4",
  MI: "#9b8347",
  WI: "#c05f49",
} as const;

export type ReportingVelocityMetric = "ballots" | "returns";

interface ElectionNightReportingVelocityProps {
  pace: NightReportingPace;
  metric: ReportingVelocityMetric;
  focusStateCode: DetailedStateCode | null;
  onSeek: (progressMillionths: number) => void;
}

function metricValue(measure: NightPaceMeasure, metric: ReportingVelocityMetric) {
  return metric === "ballots"
    ? measure.ballotsPerMinuteMilli / 1_000
    : measure.returnsPerMinuteMilli / 1_000;
}

function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function seriesData(
  pace: NightReportingPace,
  stateCode: DetailedStateCode | null,
  metric: ReportingVelocityMetric,
) {
  return pace.points.map((point) => [
    point.atMs,
    metricValue(stateCode === null ? point.national : point.jurisdictions[stateCode], metric),
    point.eventId,
    point.returningJurisdictionId,
  ]);
}

export default function ElectionNightReportingVelocity({
  pace,
  metric,
  focusStateCode,
  onSeek,
}: ElectionNightReportingVelocityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const onSeekRef = useRef(onSeek);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const handleClick = (event: { offsetX: number; offsetY: number }) => {
      const converted = chart.convertFromPixel(
        { gridIndex: 0 },
        [event.offsetX, event.offsetY],
      ) as number[];
      const atMs = converted?.[0];
      if (!Number.isFinite(atMs)) return;
      const duration = pace.endsAtMs - pace.startsAtMs;
      const progress = duration <= 0
        ? 1_000_000
        : Math.round((atMs - pace.startsAtMs) * 1_000_000 / duration);
      onSeekRef.current(Math.max(0, Math.min(1_000_000, progress)));
    };
    chart.getZr().on("click", handleClick);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      chart.getZr().off("click", handleClick);
      chart.dispose();
      chartRef.current = null;
    };
  }, [pace.endsAtMs, pace.startsAtMs]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const series = [
      { name: "National", stateCode: null },
      ...STATE_CODES.map((stateCode) => ({ name: stateCode, stateCode })),
    ].map(({ name, stateCode }) => {
      const isFocused = focusStateCode === null || stateCode === null || stateCode === focusStateCode;
      return {
        name,
        type: "line",
        data: seriesData(pace, stateCode, metric),
        showSymbol: false,
        connectNulls: false,
        sampling: "lttb",
        animation: false,
        lineStyle: {
          width: stateCode === null ? 2.35 : 1.45,
          color: SERIES_COLORS[name as keyof typeof SERIES_COLORS],
          opacity: isFocused ? 0.95 : 0.2,
        },
        areaStyle: stateCode === null ? {
          color: "rgba(48, 112, 135, 0.08)",
          opacity: 1,
        } : undefined,
        itemStyle: { color: SERIES_COLORS[name as keyof typeof SERIES_COLORS] },
        emphasis: { focus: "series" },
        markLine: stateCode === null ? {
          silent: true,
          symbol: ["none", "none"],
          label: { show: false },
          lineStyle: { color: "rgba(185, 143, 43, 0.68)", width: 1 },
          data: [{ xAxis: pace.currentTimeMs }],
        } : undefined,
      };
    });
    chart.setOption({
      animation: false,
      aria: {
        enabled: false,
      },
      color: Object.values(SERIES_COLORS),
      legend: {
        top: 0,
        right: 4,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 3,
        textStyle: { color: "#61767f", fontFamily: "DM Mono", fontSize: 8 },
      },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        confine: true,
        axisPointer: { type: "line", lineStyle: { color: "#9a8245", width: 1 } },
        formatter: (raw: unknown) => {
          const params = Array.isArray(raw) ? raw as Array<{ seriesName: string; value: unknown[] }> : [];
          if (!params.length) return "No reporting activity";
          const atMs = Number(params[0].value[0]);
          const lines = [new Date(atMs).toLocaleString("en-US", {
            timeZone: "America/New_York",
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })];
          for (const entry of params) {
            const value = Number(entry.value[1]);
            if (Number.isFinite(value)) lines.push(
              `${entry.seriesName}  ${metric === "ballots" ? compact(value) : value.toFixed(1)}/min`,
            );
          }
          return lines.join("\n");
        },
        textStyle: { color: "#254657", fontFamily: "DM Mono", fontSize: 9 },
        backgroundColor: "rgba(250, 249, 243, 0.96)",
        borderColor: "rgba(45, 79, 91, 0.18)",
      },
      grid: { top: 30, right: 18, bottom: 28, left: 50, containLabel: false },
      xAxis: {
        type: "time",
        min: pace.startsAtMs,
        max: pace.endsAtMs,
        splitNumber: 4,
        axisLabel: {
          color: "#7a8c92",
          fontFamily: "DM Mono",
          fontSize: 7,
          hideOverlap: true,
          formatter: (value: number) => new Date(value).toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }),
        },
        axisLine: { lineStyle: { color: "rgba(50, 80, 90, 0.16)" } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: {
          color: "#7a8c92",
          fontFamily: "DM Mono",
          fontSize: 7,
          formatter: (value: number) => metric === "ballots" ? compact(value) : value.toFixed(1),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(50, 80, 90, 0.09)" } },
      },
      series,
    }, { notMerge: true, lazyUpdate: true, silent: true });
  }, [focusStateCode, metric, pace]);

  return <figure
    aria-label={`Reporting velocity timeline showing ${metric} per logical minute. Click to seek the count.`}
    className="night-margin-timeline-figure"
    data-observed-returns={pace.observedReturnCount}
    role="img"
  ><div className="night-reporting-velocity-chart" ref={containerRef} /></figure>;
}
