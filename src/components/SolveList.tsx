import { memo, useCallback, useEffect, useState } from "react";
import { Check, Timer, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { effectiveMs } from "../lib/stats";
import { fitDigits } from "../lib/fit";
import { formatDateTime, formatTime } from "../lib/format";
import type { Penalty, Solve } from "../lib/types";

interface SolveListProps {
  solves: Solve[];
  onPenalty: (id: string, penalty: Penalty) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onReset: () => void;
  /** Set for a few seconds after a delete, so it can be taken back. */
  undo: { count: number } | null;
  onUndo: () => void;
}

export const SolveList = memo(function SolveList({
  solves,
  onPenalty,
  onDelete,
  onDeleteMany,
  onReset,
  undo,
  onUndo,
}: SolveListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // A deleted solve, or a switch to another session, must not leave ids behind
  // in the selection — Delete would then send ids that no longer exist.
  useEffect(() => {
    setSelected((previous) => {
      if (previous.size === 0) return previous;
      const alive = new Set(solves.map((solve) => solve.id));
      const next = new Set([...previous].filter((id) => alive.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [solves]);

  useEffect(() => {
    if (solves.length === 0) setSelecting(false);
  }, [solves.length]);

  const toggle = useCallback((id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = solves.length > 0 && selected.size === solves.length;

  return (
    <section className="relative mt-3 flex min-h-0 flex-1 flex-col border-t border-white/[0.055]">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
        {selecting ? (
          <>
            <span className="min-w-0 text-[11px] text-faint">
              <span className="font-mono text-chalk-dim">{selected.size}</span> of {solves.length}{" "}
              selected
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(solves.map((solve) => solve.id)))
                }
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-muted transition-colors hover:bg-white/[0.05] hover:text-chalk pointer-coarse:px-2.5 pointer-coarse:py-2"
              >
                {allSelected ? "None" : "All"}
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => {
                  onDeleteMany([...selected]);
                  setSelected(new Set());
                  setSelecting(false);
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-bad transition-colors hover:bg-bad/12 disabled:pointer-events-none disabled:opacity-40 pointer-coarse:px-2.5 pointer-coarse:py-2"
              >
                <Trash2 className="size-3" aria-hidden="true" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelecting(false);
                  setSelected(new Set());
                }}
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-faint transition-colors hover:bg-white/[0.05] hover:text-chalk pointer-coarse:px-2.5 pointer-coarse:py-2"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="flex min-w-0 items-baseline gap-1.5">
              <span className="eyebrow">Solves</span>
              <span className="font-mono text-[10.5px] text-faint">{solves.length}</span>
            </h2>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSelecting(true)}
                disabled={solves.length === 0}
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-faint transition-colors hover:bg-white/[0.05] hover:text-chalk disabled:pointer-events-none disabled:opacity-40 pointer-coarse:px-2.5 pointer-coarse:py-2"
              >
                Select
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={solves.length === 0}
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-faint transition-colors hover:bg-bad/10 hover:text-bad disabled:pointer-events-none disabled:opacity-40 pointer-coarse:px-2.5 pointer-coarse:py-2"
              >
                Reset
              </button>
            </div>
          </>
        )}
      </header>

      {solves.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <div className="rounded-full border border-accent-line/60 bg-accent-soft p-2.5 text-accent">
            <Timer className="size-4" aria-hidden="true" />
          </div>
          <p className="text-[12.5px] text-muted">No solves in this session yet</p>
          <p className="text-[11px] leading-5 text-faint">
            <span className="pointer-coarse:hidden">
              Hold <kbd className="kbd">space</kbd> to arm, release to start.
            </span>
            <span className="hidden pointer-coarse:inline">
              Hold the timer to arm, release to start.
            </span>
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 sm:px-2">
          {solves.map((solve, index) => {
            const number = solves.length - index;
            const value = effectiveMs(solve);
            const isPlus2 = solve.penalty === "plus2";
            const isDnf = solve.penalty === "dnf";
            const checked = selected.has(solve.id);
            const open = selecting ? checked : expanded === solve.id;
            const showScramble = !selecting && expanded === solve.id;

            return (
              <li key={solve.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-lg pr-1 transition-colors",
                    open ? "bg-white/[0.05]" : "hover:bg-white/[0.035]",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={selecting ? undefined : showScramble}
                    aria-checked={selecting ? checked : undefined}
                    role={selecting ? "checkbox" : undefined}
                    title={
                      selecting ? (checked ? "Deselect solve" : "Select solve") : "Show scramble"
                    }
                    onClick={() => {
                      if (selecting) {
                        toggle(solve.id);
                        return;
                      }
                      setExpanded(showScramble ? null : solve.id);
                    }}
                    className="@container flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1 text-left transition-colors pointer-coarse:gap-2.5 pointer-coarse:py-2 pointer-coarse:pl-2 sm:gap-2.5 sm:pl-2"
                  >
                    {selecting ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors",
                          checked
                            ? "border-accent bg-accent text-ink-950"
                            : "border-white/20 bg-white/[0.03] text-transparent",
                        )}
                      >
                        <Check className="size-3" strokeWidth={3.5} />
                      </span>
                    ) : (
                      <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-faint">
                        {number}
                      </span>
                    )}
                    {/* The digits take whatever the row has left after the
                        number and the penalty badge, however long the time. */}
                    <span
                      className={cn(
                        "font-mono text-[15px] tabular-nums tracking-[-0.02em] whitespace-nowrap",
                        isDnf ? "text-bad" : isPlus2 ? "text-warn" : "text-chalk",
                      )}
                    >
                      <span
                        style={{
                          fontSize: fitDigits(formatTime(value), {
                            reserve: isPlus2 ? 84 : 60,
                            max: "1em",
                          }),
                        }}
                      >
                        {formatTime(value)}
                      </span>
                    </span>
                    {isPlus2 ? (
                      <span className="rounded-[4px] border border-warn/25 bg-warn/10 px-1 py-px font-mono text-[9px] uppercase leading-[1.35] tracking-wide text-warn">
                        +2
                      </span>
                    ) : null}
                  </button>

                  {selecting ? null : (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`Mark solve ${number} +2`}
                        aria-pressed={isPlus2}
                        title={isPlus2 ? "Remove +2" : "Add +2 penalty"}
                        onClick={() => onPenalty(solve.id, isPlus2 ? "ok" : "plus2")}
                        className={cn(
                          "inline-flex h-6 min-w-7 cursor-pointer items-center justify-center rounded-md px-1 font-mono text-[9.5px] font-medium transition-colors pointer-coarse:h-8 pointer-coarse:min-w-9",
                          isPlus2
                            ? "bg-warn/15 text-warn"
                            : "text-faint hover:bg-warn/12 hover:text-warn",
                        )}
                      >
                        +2
                      </button>
                      <button
                        type="button"
                        aria-label={`Mark solve ${number} DNF`}
                        aria-pressed={isDnf}
                        title={isDnf ? "Remove DNF" : "Mark as DNF"}
                        onClick={() => onPenalty(solve.id, isDnf ? "ok" : "dnf")}
                        className={cn(
                          "inline-flex h-6 min-w-7 cursor-pointer items-center justify-center rounded-md px-1 font-mono text-[9.5px] font-medium transition-colors pointer-coarse:h-8 pointer-coarse:min-w-9",
                          isDnf
                            ? "bg-bad/15 text-bad"
                            : "text-faint hover:bg-bad/12 hover:text-bad",
                        )}
                      >
                        DNF
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete solve ${number}`}
                        title="Delete solve"
                        onClick={() => onDelete(solve.id)}
                        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-bad/12 hover:text-bad pointer-coarse:size-8"
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {showScramble ? (
                  <div className="mt-1 mb-2 ml-7 mr-1 overflow-hidden rounded-lg border border-white/[0.055] bg-ink-850/80 px-2.5 py-2 sm:ml-8">
                    <p className="break-words whitespace-pre-line text-[10.5px] leading-[1.55] tracking-[0.01em] text-muted">
                      {solve.scramble}
                    </p>
                    <p className="mt-1.5 text-[10px] text-faint">
                      {formatDateTime(solve.date)} · raw {formatTime(solve.ms)}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {undo ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
          <div
            role="status"
            aria-live="polite"
            className="panel pointer-events-auto flex animate-panel-in items-center gap-2 rounded-full border border-white/[0.1] bg-ink-850/95 py-1 pl-3 pr-1.5"
          >
            <span className="text-[11px] text-muted">
              {undo.count} solve{undo.count === 1 ? "" : "s"} deleted
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="cursor-pointer rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-white/[0.12] pointer-coarse:px-3 pointer-coarse:py-2"
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
});
