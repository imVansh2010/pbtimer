import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, ChevronDown, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { puzzleById } from "../lib/puzzles";
import { sessionsForPuzzle } from "../lib/sessions";
import type { PuzzleId, Session, Solve } from "../lib/types";

interface SessionMenuProps {
  puzzle: PuzzleId;
  sessions: Session[];
  solves: Solve[];
  activeSession: Session | null;
  onSelect: (session: Session) => void;
  onNew: () => void;
  onRename: (session: Session, name: string) => void;
  onDelete: (session: Session) => void;
  disabled?: boolean;
}

/**
 * Sessions belong to an event, so this lists the ones for the puzzle in the
 * header. Starting a new one leaves the old one intact and browsable here and
 * in the statistics section, and a name can be changed without leaving the
 * menu.
 */
export function SessionMenu({
  puzzle,
  sessions,
  solves,
  activeSession,
  onSelect,
  onNew,
  onRename,
  onDelete,
  disabled = false,
}: SessionMenuProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Newest first. Memoised because the header still re-renders on every timer
  // frame while it is hidden during an attempt.
  const list = useMemo(() => sessionsForPuzzle(sessions, puzzle).reverse(), [sessions, puzzle]);
  // Counted once for the list instead of filtering every solve per row.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const solve of solves) {
      if (!solve.sessionId) continue;
      map.set(solve.sessionId, (map.get(solve.sessionId) ?? 0) + 1);
    }
    return map;
  }, [solves]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    setEditingId(null);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function startRename(session: Session) {
    setEditingId(session.id);
    setDraft(session.name);
  }

  function saveRename(session: Session) {
    const next = draft.trim();
    if (next.length > 0 && next !== session.name) onRename(session, next);
    setEditingId(null);
  }

  function onPanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Space is the timer key globally; keep it inside the menu while it is open.
    if (event.key === " ") event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Session: ${activeSession?.name ?? "none"}`}
        title="Sessions"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
          if (event.key === " ") event.stopPropagation();
        }}
        className={cn(
          "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] pl-2 pr-1.5 text-[12px] text-chalk-dim transition-colors",
          "hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-chalk",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.035]",
          "sm:h-8 pointer-coarse:h-9",
        )}
      >
        <Layers className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
        <span className="hidden max-w-[7.5rem] truncate font-medium sm:inline">
          {activeSession?.name ?? "New session"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "hidden size-3.5 text-faint transition-transform duration-200 sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && !disabled ? (
        <div
          role="dialog"
          aria-label="Sessions"
          onKeyDown={onPanelKeyDown}
          className="panel absolute left-0 top-full z-40 mt-2 w-72 animate-panel-in rounded-xl border border-white/[0.08] bg-ink-850 p-1.5"
        >
          <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.16em] text-faint">
              Sessions · {puzzleById(puzzle).short}
            </span>
            <span className="font-mono text-[9.5px] text-faint">{list.length}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onNew();
              close(false);
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-accent-line/50 bg-accent-soft px-2 py-1.5 text-left text-[12.5px] font-medium text-accent transition-colors hover:border-accent-line hover:bg-accent-line/40 pointer-coarse:py-2.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New session
          </button>

          {list.length === 0 ? (
            <p className="px-2 py-2 text-[11.5px] leading-4 text-faint">
              The first solve on this event opens a session.
            </p>
          ) : (
            <ul className="mt-1 max-h-64 overflow-y-auto">
              {list.map((session) => {
                const count = counts.get(session.id) ?? 0;
                const selected = session.id === activeSession?.id;
                const editing = session.id === editingId;

                return (
                  <li
                    key={session.id}
                    className={cn(
                      "flex items-center gap-0.5 rounded-lg transition-colors",
                      editing
                        ? "bg-white/[0.06]"
                        : selected
                          ? "bg-white/[0.07]"
                          : "hover:bg-white/[0.045]",
                    )}
                  >
                    {editing ? (
                      <form
                        className="flex flex-1 items-center gap-1 px-1.5 py-1"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveRename(session);
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
                              setEditingId(null);
                            }
                          }}
                          className="h-6 min-w-0 flex-1 rounded-md border border-accent-line/70 bg-ink-950/70 px-1.5 text-[12px] text-chalk outline-none focus:border-accent-line"
                        />
                        <button
                          type="submit"
                          aria-label="Save name"
                          title="Save name"
                          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-good transition-colors hover:bg-good/15 pointer-coarse:size-8"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          onClick={() => {
                            onSelect(session);
                            close(false);
                          }}
                          className={cn(
                            "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors pointer-coarse:py-2.5",
                            selected ? "text-chalk" : "text-muted hover:text-chalk",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px]">{session.name}</span>
                            <span className="mt-0.5 block text-[10px] text-faint">
                              {formatDate(session.createdAt)} · {count} solve
                              {count === 1 ? "" : "s"}
                              {session.source === "import" ? " · imported" : ""}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => startRename(session)}
                          aria-label={`Rename ${session.name}`}
                          title="Rename session"
                          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-faint transition-colors hover:bg-white/[0.07] hover:text-chalk pointer-coarse:size-8"
                        >
                          <Pencil className="size-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            close(false);
                            onDelete(session);
                          }}
                          aria-label={`Delete ${session.name}`}
                          title="Delete session and its solves"
                          className="mr-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-faint transition-colors hover:bg-bad/12 hover:text-bad pointer-coarse:size-8"
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-1 border-t border-white/[0.055] px-2 pb-1 pt-2 text-[10.5px] leading-4 text-faint">
            Each event keeps its own sessions. Stats compare this one with the rest.
          </p>
        </div>
      ) : null}
    </div>
  );
}
