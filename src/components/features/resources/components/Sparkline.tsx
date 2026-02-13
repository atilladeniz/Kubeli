import { memo, useMemo } from "react";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export const Sparkline = memo(function Sparkline({
  values,
  width = 50,
  height = 16,
  color = "#3b82f6",
  fillColor,
}: SparklineProps) {
  const points = useMemo(() => {
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 1; // 1px vertical padding

    const coords = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = padding + (1 - (v - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return coords.join(" ");
  }, [values, width, height]);

  if (!points) return null;

  const fill = fillColor || color.replace(")", ",0.15)").replace("rgb(", "rgba(");

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      {/* Area fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={fill}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
});
