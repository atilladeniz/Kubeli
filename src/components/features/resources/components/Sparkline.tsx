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

    let min = values[0];
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }
    const range = max - min;
    const pad = 1;

    const coords = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      // Flat data (range=0): draw line at vertical center instead of bottom
      const y = range === 0
        ? height / 2
        : pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return coords.join(" ");
  }, [values, width, height]);

  if (!points) return null;

  // Hex colors get 26 (hex) = ~15% opacity suffix; rgb() colors get rgba transform
  const fill = fillColor || `${color}26`;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={fill}
      />
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
}, (prev, next) => {
  if (prev.width !== next.width || prev.height !== next.height
    || prev.color !== next.color || prev.fillColor !== next.fillColor
    || prev.values.length !== next.values.length) return false;
  // Only compare last value -- if it hasn't changed, skip re-render
  const len = prev.values.length;
  return len === 0 || prev.values[len - 1] === next.values[len - 1];
});
