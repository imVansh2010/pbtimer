import { memo, useId } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatStat } from "../lib/format";
import type { SessionStats } from "../lib/stats";
import { cn } from "../lib/cn";

interface StatsPanelProps {
  /** Name of the session the panel is showing. */
  sessionName: string;
  eventLabel: string;
  /** Stats for the open session only. */
  stats: SessionStats;
  trend: number[];
  onOpenStats: () => void;
  disabled?: boolean;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  const dnf = value === "DNF";
  const hasSub = sub !== "—";
  return (
    <div className="panel rounded-xl border border-white/[0.055] bg-ink-900/70 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div
        className={cn(
          "mt-1.5 font-mono text-[21px] leading-none tabular-nums tracking-[-0.02em] sm:text-[23px]",
          dnf ? "text-bad" : "text-chalk",
        )}
      >
        {value}
      </div>
      <div className="mt-2 truncate text-[10px] text-faint">
        best <span className={hasSub ? "text-accent" : "text-muted"}>{sub}</span>
      </div>
    </div>
  );
}

export const StatsPanel = memo(function StatsPanel({
  sessionName,
  eventLabel,
  stats,
  trend,
  onOpenStats,
  disabled = false,
}: StatsPanelProps) {
  return (
    <section className="px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-baseline gap-1.5">
          <span className="eyebrow truncate">{sessionName}</span>
          <span className="shrink-0 font-mono text-[10px] text-faint">{eventLabel}</span>
        </h2>
        <button
          type="button"
          onClick={onOpenStats}
          disabled={disabled}
          className="inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] text-muted transition-colors hover:text-chalk disabled:pointer-events-none disabled:opacity-40 pointer-coarse:px-2 pointer-coarse:py-1.5"
        >
          All stats
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <StatTile label="Ao5" value={formatStat(stats.ao5)} sub={formatStat(stats.bestAo5)} />
        <StatTile label="Ao12" value={formatStat(stats.ao12)} sub={formatStat(stats.bestAo12)} />
      </div>

      <div className="mt-2 grid grid-cols-3 divide-x divide-white/[0.055] overflow-hidden rounded-xl border border-white/[0.055] bg-ink-900/45">
        <MiniStat label="Best" value={formatStat(stats.best)} />
        <MiniStat label="Mean" value={formatStat(stats.mean)} />
        <MiniStat
          label="Solves"
          value={String(stats.count)}
          sub={stats.dnfCount > 0 ? `${stats.dnfCount} DNF` : undefined}
        />
      </div>

      <div className="mt-2 rounded-xl border border-white/[0.055] bg-ink-900/35 px-2.5 pb-1.5 pt-2 sm:px-3 sm:pb-2">
        <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.16em] text-faint">
          <span>Trend</span>
          <span>last {trend.length || 30}</span>
        </div>
        <TrendChart values={trend} />
      </div>
    </section>
  );
});

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-1.5 py-1.5 text-center sm:px-2 sm:py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 truncate font-mono text-[12.5px] tabular-nums sm:text-[13.5px]",
          value === "DNF" ? "text-bad" : "text-chalk-dim",
        )}
      >
        {value}
      </div>
      {/* Always drawn so all three values share one baseline, with or without a DNF count. */}
      <div className="mt-0.5 text-[9px] leading-[1.2] text-faint">{sub ?? "\u00a0"}</div>
    </div>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const gradientId = useId().replace(/:/g, "");
  const hasData = values.length >= 2;

  const width = 300;
  const height = 34;
  const padding = 3;

  let points = "";
  if (hasData) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    points = values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - padding - ((value - min) / span) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="mt-1 h-9">
      {hasData ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`url(#${gradientId})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="flex h-full items-center text-[10.5px] text-faint">
          Your trend appears after two solves.
        </div>
      )}
    </div>
  );
}
