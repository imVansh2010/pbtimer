import { useId, useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Segmented";
import { cn } from "../../lib/cn";
import { fitDigits } from "../../lib/fit";
import { formatDate, formatStat, formatTime, formatTotalTime } from "../../lib/format";
import {
  computeStats,
  medianOfValues,
  trendSeries,
  validTimes,
  type SessionStats,
} from "../../lib/stats";
import { PUZZLE_GROUPS, puzzleById } from "../../lib/puzzles";
import { solvesOfSession } from "../../lib/sessions";
import { DistributionChart, TrendChart } from "../charts";
import type { PuzzleId, Session, Solve } from "../../lib/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "averages", label: "Averages" },
  { id: "trend", label: "Trend" },
  { id: "distribution", label: "Spread" },
  { id: "sessions", label: "Sessions" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type Scope = "session" | "event";

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
  sessions: Session[];
  solves: Solve[];
  puzzle: PuzzleId;
  activeSession: Session | null;
  onOpenSession: (session: Session) => void;
  onNewSession: () => void;
  onDeleteSession: (session: Session) => void;
  onRenameSession: (session: Session, name: string) => void;
}

export function StatsDialog({
  open,
  onClose,
  sessions,
  solves,
  puzzle,
  activeSession,
  onOpenSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
}: StatsDialogProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [scope, setScope] = useState<Scope>("session");
  const tabListId = useId();

  const eventLabel = puzzleById(puzzle).short;
  const sessionSolves = useMemo(
    () => solvesOfSession(solves, activeSession?.id),
    [solves, activeSession],
  );
  const eventSolves = useMemo(
    () => solves.filter((solve) => solve.puzzle === puzzle),
    [solves, puzzle],
  );

  // A scope of "session" is meaningless without one, so it falls back to the event.
  const effectiveScope: Scope = scope === "session" && !activeSession ? "event" : scope;
  const scoped = effectiveScope === "session" ? sessionSolves : eventSolves;

  // The scoped stats are one of these two, so they are computed once and reused.
  const sessionStats = useMemo(() => computeStats(sessionSolves), [sessionSolves]);
  const eventStats = useMemo(() => computeStats(eventSolves), [eventSolves]);
  const stats = effectiveScope === "session" ? sessionStats : eventStats;
  const series = useMemo(() => trendSeries(scoped, 5), [scoped]);
  const times = useMemo(() => validTimes(scoped), [scoped]);
  const median = useMemo(() => medianOfValues(times), [times]);

  const scopeLabel =
    effectiveScope === "session" ? (activeSession?.name ?? "This session") : `All ${eventLabel}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statistics"
      description="The open session, or the whole event."
      size="xl"
      titleSize="lg"
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Statistics sections"
          id={tabListId}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:pb-0"
        >
          {TABS.map((entry) => {
            const selected = entry.id === tab;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`${tabListId}-${entry.id}`}
                aria-selected={selected}
                aria-controls={`stats-panel-${entry.id}`}
                onClick={() => setTab(entry.id)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors pointer-coarse:py-2",
                  selected
                    ? "bg-white/[0.07] text-chalk shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-faint hover:bg-white/[0.035] hover:text-chalk-dim",
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {tab === "sessions" ? (
          <Button variant="default" size="sm" onClick={onNewSession}>
            <Plus className="size-3.5" aria-hidden="true" />
            New session
          </Button>
        ) : (
          <Segmented
            label="Statistics scope"
            size="lg"
            value={effectiveScope}
            onChange={(value) => setScope(value)}
            className="w-full [&>button]:flex-1 sm:w-auto sm:[&>button]:flex-none"
            options={[
              ...(activeSession ? [{ value: "session" as const, label: "Session" }] : []),
              { value: "event" as const, label: eventLabel },
            ]}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id={`stats-panel-${tab}`}
        aria-labelledby={`${tabListId}-${tab}`}
        className="space-y-3"
      >
        {tab === "overview" ? (
          <>
            <SessionComparison
              puzzleLabel={puzzleById(puzzle).short}
              sessionName={activeSession?.name ?? "No session yet"}
              session={sessionStats}
              event={eventStats}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Figure
                label="Solves"
                value={String(stats.count)}
                hint={`${stats.validCount} valid`}
              />
              <Figure label="DNF rate" value={dnfRate(stats)} hint={`${stats.dnfCount} DNF`} />
              <Figure label="Best single" value={formatStat(stats.best)} />
              <Figure label="Mean" value={formatStat(stats.mean)} />
              <Figure label="Median" value={formatStat(median)} />
              <Figure
                label="Std deviation"
                value={stats.stdDev === null ? "—" : formatTime(stats.stdDev)}
                hint={
                  stats.stdDev !== null && stats.mean
                    ? `${Math.round((stats.stdDev / stats.mean) * 100)}% of mean`
                    : undefined
                }
              />
              <Figure
                label="Current ao5"
                value={formatStat(stats.ao5)}
                hint={`best ${formatStat(stats.bestAo5)}`}
              />
              <Figure
                label="Current ao12"
                value={formatStat(stats.ao12)}
                hint={`best ${formatStat(stats.bestAo12)}`}
              />
              <Figure label="Time on the clock" value={formatTotalTime(stats.totalMs)} />
            </div>

            <Card title={`${scopeLabel} · trend`} aside={`${times.length} valid`}>
              <TrendChart points={series} height={180} />
            </Card>
          </>
        ) : null}

        {tab === "averages" ? (
          <>
            <AveragesTable stats={stats} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Figure label="Best single" value={formatStat(stats.best)} />
              <Figure label="Worst single" value={formatStat(stats.worst)} />
              <Figure label="Mean" value={formatStat(stats.mean)} />
              <Figure label="Median" value={formatStat(median)} />
              <Figure label="Best ao50" value={formatStat(stats.bestAo50)} />
              <Figure label="Best ao100" value={formatStat(stats.bestAo100)} />
            </div>
            <p className="text-[11.5px] leading-[1.6] text-faint">
              WCA trimming: the fastest and slowest of each window are dropped, a DNF counts as the
              slowest, and two DNFs make the average a DNF.
            </p>
          </>
        ) : null}

        {tab === "trend" ? (
          <>
            <Card title={`${scopeLabel} · every solve`} aside={`last ${formatStat(stats.ao5)} ao5`}>
              <TrendChart points={series} height={250} />
            </Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Fastest" value={formatStat(stats.best)} />
              <Figure label="Median" value={formatStat(median)} />
              <Figure label="Slowest" value={formatStat(stats.worst)} />
              <Figure label="Solves" value={String(stats.count)} hint={`${stats.dnfCount} DNF`} />
            </div>
            <p className="text-[11.5px] leading-[1.6] text-faint">
              Solid: every solve in order. Dashed: rolling mean of five. The green dot is the
              fastest.
            </p>
          </>
        ) : null}

        {tab === "distribution" ? (
          <>
            <Card title={`${scopeLabel} · spread`} aside={`${times.length} valid`}>
              <DistributionChart values={times} height={250} />
            </Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Fastest" value={formatStat(stats.best)} />
              <Figure label="Median" value={formatStat(median)} />
              <Figure label="Slowest" value={formatStat(stats.worst)} />
              <Figure
                label="Consistency"
                value={stats.stdDev === null ? "—" : `±${formatTime(stats.stdDev)}`}
                hint="standard deviation"
              />
            </div>
            <p className="text-[11.5px] leading-[1.6] text-faint">
              Each bar counts the solves in that slice of time. A tight cluster with a long tail to
              the right is the usual shape.
            </p>
          </>
        ) : null}

        {tab === "sessions" ? (
          <SessionBrowser
            sessions={sessions}
            solves={solves}
            activeSession={activeSession}
            onOpenSession={onOpenSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        ) : null}
      </div>
    </Modal>
  );
}

function dnfRate(stats: SessionStats): string {
  return stats.count > 0 ? `${Math.round((stats.dnfCount / stats.count) * 100)}%` : "—";
}

function Card({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.055] bg-ink-950/30 px-2 py-2 sm:px-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] uppercase tracking-[0.14em] text-faint">{title}</span>
        {aside ? <span className="shrink-0 font-mono text-[10px] text-faint">{aside}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Session versus every session of the same event — the two numbers asked for. */
function SessionComparison({
  sessionName,
  puzzleLabel,
  session,
  event,
}: {
  sessionName: string;
  puzzleLabel: string;
  session: SessionStats;
  event: SessionStats;
}) {
  const rows: Array<{ label: string; session: string; event: string }> = [
    { label: "Best single", session: formatStat(session.best), event: formatStat(event.best) },
    { label: "Best ao5", session: formatStat(session.bestAo5), event: formatStat(event.bestAo5) },
    { label: "Mean", session: formatStat(session.mean), event: formatStat(event.mean) },
    { label: "Solves", session: String(session.count), event: String(event.count) },
    { label: "DNFs", session: String(session.dnfCount), event: String(event.dnfCount) },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.055]">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-ink-850/80 text-[10px] uppercase tracking-[0.12em] text-faint">
            <th scope="col" className="px-2 py-2 text-left font-medium sm:px-3">
              Compare
            </th>
            <th scope="col" className="max-w-[10rem] truncate px-1.5 py-2 text-right font-medium">
              {sessionName}
            </th>
            <th
              scope="col"
              className="max-w-[10rem] truncate px-2 py-2 text-right font-medium sm:px-3"
            >
              All {puzzleLabel}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((row) => (
            <tr key={row.label}>
              <th
                scope="row"
                className="px-2 py-2 text-left text-[11.5px] font-medium text-muted sm:px-3"
              >
                {row.label}
              </th>
              <td className="px-1.5 py-2 text-right font-mono tabular-nums text-chalk">
                {row.session}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-chalk-dim sm:px-3">
                {row.event}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AveragesTable({ stats }: { stats: SessionStats }) {
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

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.055]">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-ink-850/80 text-[10px] uppercase tracking-[0.12em] text-faint">
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
                className="px-2 py-2.5 text-left text-[11.5px] font-medium text-muted sm:px-3 sm:py-2"
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
  );
}

function SessionBrowser({
  sessions,
  solves,
  activeSession,
  onOpenSession,
  onDeleteSession,
  onRenameSession,
}: {
  sessions: Session[];
  solves: Solve[];
  activeSession: Session | null;
  onOpenSession: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
  onRenameSession: (session: Session, name: string) => void;
}) {
  // Counted once for the whole list instead of filtering every solve per row.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const solve of solves) {
      if (!solve.sessionId) continue;
      map.set(solve.sessionId, (map.get(solve.sessionId) ?? 0) + 1);
    }
    return map;
  }, [solves]);

  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.055] bg-ink-950/30 px-3 py-6 text-center text-[12px] leading-5 text-faint">
        No sessions yet. Start one to keep the next solves separate.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {PUZZLE_GROUPS.map((group) => {
        const items = group.items.filter((item) =>
          sessions.some((session) => session.puzzle === item.id),
        );
        if (items.length === 0) return null;

        return (
          <div key={group.label}>
            <h3 className="eyebrow mb-1.5">{group.label}</h3>
            <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.055]">
              {items
                .flatMap((item) =>
                  sessions
                    .filter((session) => session.puzzle === item.id)
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((session) => ({ session, item })),
                )
                .map(({ session, item }) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    puzzleLabel={item.short}
                    active={session.id === activeSession?.id}
                    count={counts.get(session.id) ?? 0}
                    onOpen={onOpenSession}
                    onDelete={onDeleteSession}
                    onRename={onRenameSession}
                  />
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function SessionRow({
  session,
  puzzleLabel,
  active,
  count,
  onOpen,
  onDelete,
  onRename,
}: {
  session: Session;
  puzzleLabel: string;
  active: boolean;
  count: number;
  onOpen: (session: Session) => void;
  onDelete: (session: Session) => void;
  onRename: (session: Session, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  function save() {
    const next = draft.trim();
    if (next.length > 0 && next !== session.name) onRename(session, next);
    setEditing(false);
  }

  return (
    <li className={cn("flex items-center gap-2 px-2 py-2 sm:px-3", active && "bg-accent-soft/40")}>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={draft}
            maxLength={48}
            autoComplete="off"
            aria-label={`Rename ${session.name}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setDraft(session.name);
                setEditing(false);
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-accent-line/70 bg-ink-950/70 px-2 text-[12.5px] text-chalk outline-none focus:border-accent-line"
          />
          <Button type="submit" size="sm" variant="default" className="h-7 px-2 text-[11px]">
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              setDraft(session.name);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onOpen(session)}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span className="flex items-baseline gap-1.5">
              <span className="truncate text-[12.5px] font-medium text-chalk">{session.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-faint">{puzzleLabel}</span>
              {active ? (
                <span className="shrink-0 rounded-[4px] border border-accent-line/60 bg-accent-soft px-1 py-px text-[8.5px] uppercase tracking-wide text-accent">
                  open
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[10.5px] text-faint">
              {formatDate(session.createdAt)} · {count} solve{count === 1 ? "" : "s"}
              {session.source === "import" ? " · imported" : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(session.name);
              setEditing(true);
            }}
            aria-label={`Rename ${session.name}`}
            title="Rename session"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-white/[0.06] hover:text-chalk pointer-coarse:size-9"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(session)}
            aria-label={`Delete ${session.name}`}
            title="Delete session and its solves"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-bad/12 hover:text-bad pointer-coarse:size-9"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </li>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="@container rounded-xl border border-white/[0.055] bg-ink-950/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-[15px] tabular-nums whitespace-nowrap",
          value === "DNF" ? "text-bad" : "text-chalk",
        )}
      >
        <span style={{ fontSize: fitDigits(value, { max: "1em" }) }}>{value}</span>
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-faint/80">{hint}</div> : null}
    </div>
  );
}
