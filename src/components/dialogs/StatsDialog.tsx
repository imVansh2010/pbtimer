import { Modal } from "../ui/Modal";
import { cn } from "../../lib/cn";
import { formatStat, formatTime, formatTotalTime } from "../../lib/format";
import type { SessionStats } from "../../lib/stats";

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
  stats: SessionStats;
}

export function StatsDialog({ open, onClose, stats }: StatsDialogProps) {
  const windows: Array<{
    label: string;
    best: number | null;
    current: number | null;
    worst: number | null;
  }> = [
    { label: "Ao5", best: stats.bestAo5, current: stats.ao5, worst: stats.worstAo5 },
    { label: "Ao12", best: stats.bestAo12, current: stats.ao12, worst: stats.worstAo12 },
    { label: "Ao50", best: stats.bestAo50, current: stats.ao50, worst: stats.worstAo50 },
    { label: "Ao100", best: stats.bestAo100, current: stats.ao100, worst: stats.worstAo100 },
  ];

  const dnfRate = stats.count > 0 ? `${Math.round((stats.dnfCount / stats.count) * 100)}%` : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statistics"
      description="Everything measured across this session."
      size="md"
    >
      <div className="overflow-hidden rounded-xl border border-white/[0.055]">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-ink-850/80 text-[10px] uppercase tracking-[0.12em] text-faint sm:text-[9.5px] sm:tracking-[0.14em]">
              <th scope="col" className="px-2 py-2 text-left font-medium sm:px-3">
                Window
              </th>
              <th scope="col" className="px-1.5 py-2 text-right font-medium sm:px-2">
                Best
              </th>
              <th scope="col" className="px-1.5 py-2 text-right font-medium sm:px-2">
                Current
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">
                Worst
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {windows.map((window) => (
              <tr key={window.label}>
                <th
                  scope="row"
                  className="px-2 py-2.5 text-left text-[12px] font-medium text-muted sm:px-3 sm:py-2 sm:text-[11.5px]"
                >
                  {window.label}
                </th>
                <td className="px-1.5 py-2.5 text-right font-mono tabular-nums text-chalk sm:px-2 sm:py-2">
                  {formatStat(window.best)}
                </td>
                <td
                  className={cn(
                    "px-1.5 py-2.5 text-right font-mono tabular-nums sm:px-2 sm:py-2",
                    window.current === null || Number.isFinite(window.current)
                      ? "text-chalk-dim"
                      : "text-bad",
                  )}
                >
                  {formatStat(window.current)}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted sm:px-3 sm:py-2">
                  {formatStat(window.worst)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Figure label="Best single" value={formatStat(stats.best)} />
        <Figure label="Worst single" value={formatStat(stats.worst)} />
        <Figure label="Session mean" value={formatStat(stats.mean)} />
        <Figure
          label="Std deviation"
          value={stats.stdDev === null ? "—" : formatTime(stats.stdDev)}
        />
        <Figure
          label="Solves"
          value={`${stats.count}`}
          hint={`${stats.validCount} valid · ${stats.dnfCount} DNF`}
        />
        <Figure
          label="DNF rate"
          value={dnfRate}
          hint={`Total time ${formatTotalTime(stats.totalMs)}`}
        />
      </div>
    </Modal>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-ink-950/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint sm:text-[9.5px] sm:tracking-[0.14em]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[15px] tabular-nums",
          value === "DNF" ? "text-bad" : "text-chalk",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-faint/80 sm:text-[9.5px]">{hint}</div> : null}
    </div>
  );
}
