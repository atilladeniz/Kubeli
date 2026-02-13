"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { MetricsSnapshot } from "@/lib/hooks/useMetricsHistory";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface MetricsChartProps {
  history: MetricsSnapshot[];
  type: "cpu" | "memory";
  height?: number;
}

function formatCpuValue(nanoCores: number): string {
  const milli = nanoCores / 1_000_000;
  if (milli >= 1000) return `${(milli / 1000).toFixed(1)}`;
  if (milli >= 1) return `${Math.round(milli)}m`;
  if (nanoCores > 0) return `${milli.toFixed(1)}m`;
  return "0m";
}

function formatMemoryValue(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}Mi`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}Ki`;
  return `${bytes}B`;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function MetricsChart({ history, type, height = 120 }: MetricsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [ready, setReady] = useState(false);

  const color = type === "cpu" ? "#3b82f6" : "#a855f7"; // blue-500 / purple-500
  const fillColor = type === "cpu" ? "rgba(59,130,246,0.1)" : "rgba(168,85,247,0.1)";
  const hasData = history.length >= 2;

  const data = useMemo((): uPlot.AlignedData => {
    if (history.length === 0) return [[], []];
    const timestamps = history.map((s) => s.timestamp);
    const values = history.map((s) =>
      type === "cpu" ? s.cpuNanoCores : s.memoryBytes,
    );
    return [timestamps, values];
  }, [history, type]);

  const opts = useMemo((): uPlot.Options => {
    const valueFormatter = type === "cpu" ? formatCpuValue : formatMemoryValue;
    return {
      width: 1, // will be auto-sized
      height,
      cursor: {
        show: true,
        x: true,
        y: false,
        points: { show: false },
      },
      legend: { show: false },
      axes: [
        {
          // X axis (time)
          stroke: "rgba(128,128,128,0.3)",
          grid: { stroke: "rgba(128,128,128,0.1)", width: 1 },
          ticks: { stroke: "rgba(128,128,128,0.2)", width: 1 },
          values: (_u: uPlot, vals: number[]) => vals.map(formatTime),
          font: "10px Inter, sans-serif",
          gap: 4,
        },
        {
          // Y axis (value)
          stroke: "rgba(128,128,128,0.3)",
          grid: { stroke: "rgba(128,128,128,0.1)", width: 1 },
          ticks: { show: false },
          values: (_u: uPlot, vals: number[]) => vals.map(valueFormatter),
          font: "10px Inter, sans-serif",
          size: 50,
          gap: 4,
        },
      ],
      series: [
        {}, // x-axis series (timestamps)
        {
          stroke: color,
          width: 1.5,
          fill: fillColor,
          points: { show: false },
        },
      ],
      scales: {
        x: { time: false },
        y: { auto: true, range: (_u: uPlot, min: number, max: number) => {
          const padding = (max - min) * 0.1 || 1;
          return [Math.max(0, min - padding), max + padding];
        }},
      },
      padding: [8, 0, 0, 0],
    };
  }, [type, height, color, fillColor]);

  // Track when container ref becomes available after transitioning from placeholder
  useEffect(() => {
    if (hasData && containerRef.current) {
      setReady(true);
    }
  }, [hasData]);

  // Create/destroy chart - depends on opts, ready state, and data availability
  useEffect(() => {
    if (!containerRef.current || !ready || data[0].length < 2) return;

    // Clean up previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const width = containerRef.current.clientWidth || 300;
    const chart = new uPlot(
      { ...opts, width },
      data,
      containerRef.current,
    );
    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, ready]);

  // Update data without re-creating the chart
  useEffect(() => {
    if (!chartRef.current || data[0].length < 2) return;
    chartRef.current.setData(data);
  }, [data]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartRef.current) {
          chartRef.current.setSize({
            width: entry.contentRect.width,
            height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height, ready]);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground rounded-md bg-muted/30 border border-border/50"
        style={{ height }}
      >
        Collecting data...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-md overflow-hidden bg-muted/30 border border-border/50"
      style={{ height, minHeight: height }}
    />
  );
}
