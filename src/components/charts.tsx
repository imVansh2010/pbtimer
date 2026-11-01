import { memo, useEffect, useId, useRef, useState } from "react";
import { formatTime } from "../lib/format";
import { histogram, type ChartPoint } from "../lib/stats";

/**
 * SVG charts are drawn in real pixels rather than a scaled viewBox: stretching
 * a 0–560 box to the dialog width would also stretch the numerals and turn them
 * into a smear. The observer keeps the drawing in step with the panel.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(520);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, Math.max(240, width)] as const;
}

const AXIS = "var(--color-faint)";

interface TrendChartProps {
  points: ChartPoint[];
  height?: number;
  /** Hide the rolling mean, for the small chart in the side panel. */
  showMean?: boolean;
}

/** Solve times in recording order, with a rolling mean and a best-time marker. */
export const TrendChart = memo(function TrendChart({
  points,
  height = 200,
  showMean = true,
}: TrendChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const gradientId = useId().replace(/:/g, "");

  const valid = points.filter(
    (point): point is ChartPoint & { value: number } => point.value !== null,
  );

  if (valid.length < 2) {
    return (
      <div
        ref={ref}
        style={{ height }}
        className="flex items-center justify-center rounded-xl border border-white/[0.055] bg-ink-950/40 px-3 text-center text-[11.5px] text-faint"
      >
        Two solves and this chart draws itself.
      </div>
    );
  }

  const pad = { left: 48, right: 14, top: 16, bottom: 24 };
  const plotWidth = Math.max(1, width - pad.left - pad.right);
  const plotHeight = Math.max(1, height - pad.top - pad.bottom);

  const means = points
    .map((point) => point.mean)
    .filter((value): value is number => value !== null);
  const min = Math.min(...valid.map((point) => point.value), ...means);
  const max = Math.max(...valid.map((point) => point.value), ...means);
  const span = max - min || 1;
  const padded = span * 0.12;

  const x = (index: number) =>
    points.length === 1
      ? pad.left + plotWidth / 2
      : pad.left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) =>
    pad.top + plotHeight - ((value - (min - padded)) / (span + padded * 2)) * plotHeight;

  const line = valid
    .map((point) => `${x(point.index - 1).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");
  const meanLine = showMean
    ? points
        .filter((point): point is ChartPoint & { mean: number } => point.mean !== null)
        .map((point) => `${x(point.index - 1).toFixed(1)},${y(point.mean).toFixed(1)}`)
        .join(" ")
    : "";

  const best = valid.reduce((fastest, point) => (point.value < fastest.value ? point : fastest));
  const gridValues = [min - padded, min - padded + (span + padded * 2) / 2, max + padded];

  const last = points[points.length - 1]!.index;
  const middle = points[Math.floor((points.length - 1) / 2)]!.index;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Solve times, ${valid.length} available, fastest ${formatTime(best.value)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(value) + 3}
              textAnchor="end"
              fontSize={9.5}
              fill={AXIS}
              fontFamily="var(--font-mono)"
            >
              {formatTime(value)}
            </text>
          </g>
        ))}

        <polygon
          points={`${pad.left},${pad.top + plotHeight} ${line} ${width - pad.right},${pad.top + plotHeight}`}
          fill={`url(#${gradientId})`}
        />

        {showMean ? (
          <polyline
            points={meanLine}
            fill="none"
            stroke="var(--color-accent-strong)"
            strokeWidth={1.2}
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity={0.65}
          />
        ) : null}

        <polyline
          points={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {valid.map((point) => (
          <circle
            key={point.index}
            cx={x(point.index - 1)}
            cy={y(point.value)}
            r={point.index === best.index ? 3.4 : 1.9}
            fill={point.index === best.index ? "var(--color-good)" : "var(--color-accent)"}
            opacity={point.index === best.index ? 1 : 0.85}
          >
            <title>{`Solve ${point.index} · ${formatTime(point.value)}`}</title>
          </circle>
        ))}

        {[1, middle, last].map((index, position) => (
          <text
            key={`${index}-${position}`}
            x={x(index - 1)}
            y={height - 6}
            textAnchor={position === 0 ? "start" : position === 2 ? "end" : "middle"}
            fontSize={9.5}
            fill={AXIS}
            fontFamily="var(--font-mono)"
          >
            {index}
          </text>
        ))}
      </svg>
    </div>
  );
});

interface DistributionChartProps {
  values: number[];
  height?: number;
}

/** How the solves spread out: how many landed in each slice of time. */
export const DistributionChart = memo(function DistributionChart({
  values,
  height = 200,
}: DistributionChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const buckets = histogram(values, 10);

  if (buckets.length === 0) {
    return (
      <div
        ref={ref}
        style={{ height }}
        className="flex items-center justify-center rounded-xl border border-white/[0.055] bg-ink-950/40 px-3 text-center text-[11.5px] text-faint"
      >
        No valid solves to spread out yet.
      </div>
    );
  }

  const pad = { left: 32, right: 12, top: 18, bottom: 24 };
  const plotWidth = Math.max(1, width - pad.left - pad.right);
  const plotHeight = Math.max(1, height - pad.top - pad.bottom);
  const highest = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const slot = plotWidth / buckets.length;
  const barWidth = Math.max(6, slot * 0.62);

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Distribution of ${values.length} solves across ${buckets.length} time bands`}
      >
        {[0, highest / 2, highest].map((value) => (
          <g key={value}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + plotHeight - (value / highest) * plotHeight}
              y2={pad.top + plotHeight - (value / highest) * plotHeight}
              stroke="rgba(255,255,255,0.055)"
            />
            <text
              x={pad.left - 8}
              y={pad.top + plotHeight - (value / highest) * plotHeight + 3}
              textAnchor="end"
              fontSize={9.5}
              fill={AXIS}
              fontFamily="var(--font-mono)"
            >
              {Math.round(value)}
            </text>
          </g>
        ))}

        {buckets.map((bucket, index) => {
          const barHeight = (bucket.count / highest) * plotHeight;
          const x = pad.left + slot * index + (slot - barWidth) / 2;
          return (
            <g key={bucket.from}>
              <rect
                x={x}
                y={pad.top + plotHeight - barHeight}
                width={barWidth}
                height={Math.max(bucket.count > 0 ? 2 : 0, barHeight)}
                rx={2.5}
                fill="var(--color-accent)"
                opacity={bucket.count > 0 ? 0.75 : 0.15}
              >
                <title>{`${formatTime(bucket.from)} – ${formatTime(bucket.to)} · ${bucket.count} solve${
                  bucket.count === 1 ? "" : "s"
                }`}</title>
              </rect>
            </g>
          );
        })}

        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + plotHeight}
          y2={pad.top + plotHeight}
          stroke="rgba(255,255,255,0.12)"
        />

        <text
          x={pad.left}
          y={height - 6}
          fontSize={9.5}
          fill={AXIS}
          fontFamily="var(--font-mono)"
          textAnchor="start"
        >
          {formatTime(buckets[0]!.from)}
        </text>
        <text
          x={width - pad.right}
          y={height - 6}
          fontSize={9.5}
          fill={AXIS}
          fontFamily="var(--font-mono)"
          textAnchor="end"
        >
          {formatTime(buckets[buckets.length - 1]!.to)}
        </text>
      </svg>
    </div>
  );
});
