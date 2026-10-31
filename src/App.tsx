import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  HelpCircle,
  Settings as SettingsIcon,
} from "lucide-react";
import { Wordmark } from "./components/Wordmark";
import { PuzzleSelect } from "./components/PuzzleSelect";
import { ScrambleBar } from "./components/ScrambleBar";
import { TimerDisplay } from "./components/TimerDisplay";
import { CubeNet, supportsNet } from "./components/CubeNet";
import { PbNotice } from "./components/PbNotice";
import { StatsPanel } from "./components/StatsPanel";
import { SolveList } from "./components/SolveList";
import { IconButton } from "./components/ui/Button";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { StatsDialog } from "./components/dialogs/StatsDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { HelpDialog } from "./components/dialogs/HelpDialog";
import { AuthDialog } from "./components/dialogs/AuthDialog";
import { AccountMenu } from "./components/AccountMenu";
import { useScramble } from "./hooks/useScramble";
import { useTimer } from "./hooks/useTimer";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./hooks/useCloudSync";
import { bestSingle, computeStats, recentValidTimes } from "./lib/stats";
import { buildBackupJson, backupFilename, buildExportText, downloadText } from "./lib/export";
import { mergeImported } from "./lib/import";
import { isPuzzleId, puzzleById } from "./lib/puzzles";
import { readStore, STORAGE_KEYS, writeStore } from "./lib/storage";
import type { PbEvent } from "./components/PbNotice";
import { readSettings } from "./lib/settings";
import { applyAccent } from "./lib/accents";
import { cn, uid } from "./lib/cn";
import type { Penalty, PuzzleId, Settings, Solve } from "./lib/types";

/** Phones and tablets drive the timer by touching it, not by pressing space. */
const COARSE_POINTER = "(pointer: coarse)";

function subscribePointer(onChange: () => void) {
  const media = window.matchMedia(COARSE_POINTER);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readCoarsePointer() {
  return window.matchMedia(COARSE_POINTER).matches;
}
const MAX_SOLVES = 5000;

const PANEL_MIN = 300;
const PANEL_MAX = 620;
const DEFAULT_PANEL = 420;

/** Keeps the panel usable while leaving the timer at least 460px on desktop. */
function clampPanel(value: number): number {
  const viewportMax =
    typeof window === "undefined" ? PANEL_MAX : Math.min(PANEL_MAX, window.innerWidth - 460);
  const max = Math.max(PANEL_MIN, viewportMax);
  return Math.round(Math.min(max, Math.max(PANEL_MIN, value)));
}

type DialogId = "settings" | "stats" | "export" | "reset" | "help" | "auth" | null;

function isSolve(value: unknown): value is Solve {
  if (typeof value !== "object" || value === null) return false;
  const solve = value as Partial<Solve>;
  return (
    typeof solve.id === "string" &&
    typeof solve.ms === "number" &&
    Number.isFinite(solve.ms) &&
    (solve.penalty === "ok" || solve.penalty === "plus2" || solve.penalty === "dnf") &&
    typeof solve.scramble === "string" &&
    typeof solve.date === "number" &&
    isPuzzleId(solve.puzzle)
  );
}

export default function App() {
  const [solves, setSolves] = useState<Solve[]>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.solves, []);
    return Array.isArray(stored) ? stored.filter(isSolve) : [];
  });

  const [settings, setSettings] = useState<Settings>(readSettings);

  const [puzzle, setPuzzle] = useState<PuzzleId>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.puzzle, "333");
    return isPuzzleId(stored) ? stored : "333";
  });

  const [dialog, setDialog] = useState<DialogId>(null);

  const [pb, setPb] = useState<PbEvent | null>(null);
  const pbSeq = useRef(0);
  /** Bumped after an import so the upload runs once the new list is in state. */
  const [flushToken, setFlushToken] = useState(0);

  /** The solve the timer just produced, so its penalty can be shown and edited. */
  const [settledId, setSettledId] = useState<string | null>(null);

  const [showNet, setShowNet] = useState<boolean>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.cubeNet, true);
    return stored !== false;
  });

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.panel, DEFAULT_PANEL);
    return clampPanel(
      typeof stored === "number" && Number.isFinite(stored) ? stored : DEFAULT_PANEL,
    );
  });
  const resizeFrom = useRef<{ x: number; width: number } | null>(null);

  const { scramble, loading, next: nextScramble } = useScramble(puzzle);

  const auth = useAuth();

  // Adopting another device's preferences must not look like a local edit, or
  // the two devices would keep overwriting each other. That is why this uses the
  // raw setters instead of the handlers that stamp a change.
  const applyPreferences = useCallback((snapshot: { settings: Settings; puzzle: PuzzleId }) => {
    setSettings(snapshot.settings);
    setPuzzle(snapshot.puzzle);
  }, []);

  const sync = useCloudSync({
    userId: auth.userId,
    solves,
    settings,
    puzzle,
    onApplySolves: setSolves,
    onApplyPreferences: applyPreferences,
  });
  const { solveSaved, solveDeleted, clearCloud, preferencesChanged, syncNow } = sync;

  useLayoutEffect(() => {
    applyAccent(settings.accent);
  }, [settings.accent]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.solves, solves);
  }, [solves]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.settings, settings);
  }, [settings]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.puzzle, puzzle);
  }, [puzzle]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.cubeNet, showNet);
  }, [showNet]);

  useEffect(() => {
    const id = window.setTimeout(() => writeStore(STORAGE_KEYS.panel, panelWidth), 250);
    return () => window.clearTimeout(id);
  }, [panelWidth]);

  useEffect(() => {
    function onResize() {
      setPanelWidth((width) => clampPanel(width));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Space belongs to the timer, so pointer clicks must not park focus on a
  // control: a focused button would swallow the next space press, and pressing
  // space while it is focused draws a focus ring on it. The check is against
  // `Element`, not `HTMLElement`, because icon buttons receive the click on the
  // <svg> inside them and the resize handle is a plain div.
  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("button, [role='separator']")) {
        event.preventDefault();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleComplete = useCallback(
    ({ ms, penalty }: { ms: number; penalty: Penalty }) => {
      const previousBest = bestSingle(solves);
      const effective = penalty === "dnf" ? Infinity : ms + (penalty === "plus2" ? 2000 : 0);

      const solve: Solve = {
        id: uid(),
        ms,
        penalty,
        scramble,
        puzzle,
        date: Date.now(),
      };

      setSolves((previous) => [solve, ...previous].slice(0, MAX_SOLVES));
      setSettledId(solve.id);
      nextScramble();
      solveSaved(solve);

      if (previousBest !== null && effective < previousBest) {
        pbSeq.current += 1;
        setPb({ id: pbSeq.current, ms: effective });
      }
    },
    [scramble, puzzle, nextScramble, solves, solveSaved],
  );

  const modalOpen = dialog !== null;

  const timer = useTimer({
    inspection: settings.inspection,
    holdMs: settings.holdMs,
    active: !modalOpen,
    onSolveComplete: handleComplete,
  });
  const { cancelInspection } = timer;

  /**
   * From the first press until the solve is recorded, everything except the
   * digits steps back — including the header. The page comes back only once the
   * solve is on the clock.
   */
  const focusing =
    timer.inspecting ||
    timer.status === "holding" ||
    timer.status === "ready" ||
    timer.status === "running";

  const stats = useMemo(() => computeStats(solves), [solves]);
  const trend = useMemo(() => recentValidTimes(solves, 30), [solves]);
  const lastSolve = solves[0] ?? null;

  // Reading the penalty off the recorded solve keeps the timer in step with
  // edits, and stops it showing a stale penalty if that solve is deleted.
  const settledPenalty: Penalty = useMemo(
    () => solves.find((solve) => solve.id === settledId)?.penalty ?? "ok",
    [solves, settledId],
  );
  const running = timer.status === "running";
  const netAvailable = supportsNet(puzzle);
  const attemptInProgress = timer.status === "holding" || timer.status === "ready" || running;

  const exportText = useMemo(
    () => (dialog === "export" ? buildExportText(solves) : ""),
    [dialog, solves],
  );

  const applyPenalty = useCallback(
    (id: string, penalty: Penalty) => {
      const updatedAt = Date.now();
      const target = solves.find((solve) => solve.id === id);
      setSolves((previous) =>
        previous.map((solve) => (solve.id === id ? { ...solve, penalty, updatedAt } : solve)),
      );
      if (target) solveSaved({ ...target, penalty, updatedAt });
    },
    [solves, solveSaved],
  );

  const deleteSolve = useCallback(
    (id: string) => {
      setSolves((previous) => previous.filter((solve) => solve.id !== id));
      solveDeleted(id);
    },
    [solveDeleted],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((previous) => ({ ...previous, ...patch }));
      preferencesChanged();
    },
    [preferencesChanged],
  );

  const changePuzzle = useCallback(
    (next: PuzzleId) => {
      setPuzzle(next);
      preferencesChanged();
    },
    [preferencesChanged],
  );

  const importSolves = useCallback(
    (imported: Solve[]) => {
      const result = mergeImported(solves, imported, MAX_SOLVES);
      if (result.added > 0) {
        setSolves(result.solves);
        setFlushToken((token) => token + 1);
      }
      return { added: result.added, duplicates: result.duplicates };
    },
    [solves],
  );

  // Reconciling straight after setSolves would read the previous list, so the
  // upload waits one render for the imported solves to reach state and storage.
  useEffect(() => {
    if (flushToken === 0) return;
    syncNow();
  }, [flushToken, syncNow]);

  const resetSession = useCallback(() => {
    setSolves([]);
    setDialog(null);
    clearCloud();
  }, [clearCloud]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (modalOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }

      if (event.key === "Escape") {
        cancelInspection();
        return;
      }

      // Changing the scramble or the last solve mid-attempt would attach the
      // wrong scramble to the result, so these wait for the timer to stop.
      if (attemptInProgress) return;

      const key = event.key.toLowerCase();

      if (key === "n") {
        event.preventDefault();
        nextScramble();
        return;
      }

      if (!lastSolve) return;

      if (event.key === "2") {
        applyPenalty(lastSolve.id, "plus2");
      } else if (key === "d") {
        applyPenalty(lastSolve.id, "dnf");
      } else if (event.key === "Delete") {
        deleteSolve(lastSolve.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    modalOpen,
    lastSolve,
    attemptInProgress,
    nextScramble,
    applyPenalty,
    deleteSolve,
    cancelInspection,
  ]);

  const touch = useSyncExternalStore(subscribePointer, readCoarsePointer, () => false);

  const hint = (() => {
    if (timer.inspecting) {
      if (timer.status === "ready") return "Release to start the solve";
      return touch ? "Hold until the timer turns green" : "Hold space until the timer turns green";
    }
    if (timer.status === "running") return touch ? "Tap the timer to stop" : "Press space to stop";
    if (timer.status === "ready") return "Release to start";
    if (timer.status === "holding") return "Keep holding…";
    if (timer.status === "stopped") {
      return touch ? "Tap the timer for the next solve" : "Press space for the next solve";
    }
    if (settings.inspection) {
      return touch ? "Tap the timer to begin inspection" : "Tap space to begin inspection";
    }
    return touch
      ? "Hold the timer to arm, release to start"
      : "Hold space to arm, release to start";
  })();
  // A dialog would cover a running timer and leave it unstoppable.
  const openDialog = useCallback(
    (next: DialogId) => {
      if (next !== null && running) return;
      setDialog(next);
    },
    [running],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      resizeFrom.current = { x: event.clientX, width: panelWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing-panel");
    },
    [panelWidth],
  );

  const moveResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeFrom.current;
    if (!start) return;
    setPanelWidth(clampPanel(start.width + (start.x - event.clientX)));
  }, []);

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeFrom.current) return;
    resizeFrom.current = null;
    document.body.classList.remove("resizing-panel");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col bg-ink-950 lg:h-dvh lg:overflow-hidden">
      <header
        className={cn(
          "relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.055] px-3 transition-opacity duration-200 sm:h-13 sm:px-6",
          focusing && "pointer-events-none opacity-[0.12]",
        )}
      >
        <PbNotice event={pb} />
        <Wordmark />
        <div aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-white/[0.07] sm:block" />
        <PuzzleSelect value={puzzle} onChange={changePuzzle} disabled={attemptInProgress} />
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Statistics" onClick={() => openDialog("stats")} disabled={running}>
            <BarChart3 className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="How it works" onClick={() => openDialog("help")} disabled={running}>
            <HelpCircle className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Settings" onClick={() => openDialog("settings")} disabled={running}>
            <SettingsIcon className="size-4" aria-hidden="true" />
          </IconButton>
          {auth.cloudEnabled ? (
            <>
              <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-white/[0.07] sm:block" />
              <AccountMenu auth={auth} sync={sync} onOpenAuth={() => openDialog("auth")} />
            </>
          ) : null}
        </div>
      </header>

      <main
        className="app-main relative z-10 min-h-0 flex-1"
        style={{ "--panel-width": `${panelWidth}px` } as CSSProperties}
      >
        {/* On a phone the timer owns the first screen, with the top of the side
            panel peeking out as a hint that there is more below. */}
        <section className="@container grid min-h-[calc(100svh-6.5rem)] grid-cols-1 grid-rows-[1fr_auto_1fr] sm:min-h-[calc(100svh-7rem)] lg:min-h-0 lg:overflow-y-auto">
          <ScrambleBar
            scramble={scramble}
            loading={loading}
            puzzleLabel={puzzleById(puzzle).label}
            onNext={nextScramble}
            dimmed={focusing}
            className="col-start-1 row-start-1 self-start"
          />

          {/* The stage is three rows: the scramble, the digits, the hint. The two
              outer rows share the leftover height equally, so the digits land in
              the middle of the screen however tall the scramble is. Centring them
              in the space left under the scramble instead pulled the timer down
              with the scramble — a 7×7 or a wrapped 4×4 moved the digits 45px —
              which is why no single padding value ever sat right. Equal rows also
              keep the digits clear of the scramble: when the scramble is too tall
              for its half, that row grows to fit it and pushes the digits down
              instead of letting them land behind the text. */}
          <div className="col-start-1 row-start-2 flex items-center justify-center px-3 py-2 sm:px-4">
            <div
              role="presentation"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                timer.press();
              }}
              onPointerUp={() => timer.release()}
              onPointerCancel={() => timer.release()}
              className="@container w-full max-w-[820px] cursor-pointer touch-none select-none rounded-2xl px-2 py-3"
            >
              <TimerDisplay
                status={timer.status}
                elapsed={timer.elapsed}
                inspecting={timer.inspecting}
                inspectionLeft={timer.inspectionLeft}
                hideRunningTime={settings.hideRunningTime}
                penalty={settledPenalty}
              />
            </div>
          </div>

          <div className="relative col-start-1 row-start-3 flex flex-col items-center self-end pb-2 sm:pb-5">
            {/* Above the hint on phones, anchored to the bottom corner on wider
                screens where there is room beside the hint. The toggle shares
                the same 16px left/bottom inset as the net so the block reads as
                one corner widget. */}
            {netAvailable ? (
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full left-4 mb-2 transition-opacity duration-200 @min-[700px]:bottom-4 @min-[700px]:mb-0",
                  focusing && "opacity-[0.12]",
                )}
              >
                <div className="relative">
                  {showNet ? <CubeNet scramble={scramble} puzzle={puzzle} /> : null}
                  <button
                    type="button"
                    onClick={() => setShowNet((visible) => !visible)}
                    aria-pressed={showNet}
                    aria-label={showNet ? "Hide cube state" : "Show cube state"}
                    title={showNet ? "Hide cube state" : "Show cube state"}
                    className={cn(
                      "pointer-events-auto grid size-5 cursor-pointer place-items-center rounded-[6px] border border-white/[0.07] text-faint transition-colors hover:border-white/[0.14] hover:text-chalk pointer-coarse:size-7",
                      showNet
                        ? "absolute -bottom-2 -left-2 bg-ink-950"
                        : "relative bg-ink-950/60 hover:bg-white/[0.06]",
                    )}
                  >
                    {showNet ? (
                      <ArrowDownLeft className="size-3" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {/* A phone drives the timer by touch, so the keyboard hint is just
                a line of text eating the vertical space the digits want. */}
            <p
              className={cn(
                "hidden h-5 items-center gap-2 text-[11px] text-faint transition-opacity duration-200 sm:flex",
                focusing && "opacity-[0.12]",
              )}
            >
              {touch ? null : <kbd className="kbd">space</kbd>}
              <span>{hint}</span>
            </p>
          </div>
        </section>

        <aside
          className={cn(
            "relative flex min-h-0 flex-col border-t border-white/[0.055] bg-ink-950/50 transition-opacity duration-200 lg:overflow-hidden lg:border-l lg:border-t-0",
            focusing && "pointer-events-none opacity-[0.12]",
          )}
        >
          <div
            role="separator"
            aria-label="Resize side panel"
            aria-orientation="vertical"
            aria-valuenow={panelWidth}
            aria-valuemin={PANEL_MIN}
            aria-valuemax={PANEL_MAX}
            tabIndex={0}
            title="Drag to resize · double-click to reset"
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onDoubleClick={() => setPanelWidth(DEFAULT_PANEL)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPanelWidth((width) => clampPanel(width + 16));
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setPanelWidth((width) => clampPanel(width - 16));
              }
            }}
            className="absolute top-0 left-0 z-30 hidden h-full w-2 cursor-col-resize touch-none transition-colors hover:bg-accent/25 focus-visible:bg-accent/25 lg:block"
          />
          <StatsPanel
            stats={stats}
            trend={trend}
            disabled={running}
            onOpenStats={() => openDialog("stats")}
          />

          <SolveList
            solves={solves}
            onPenalty={applyPenalty}
            onDelete={deleteSolve}
            onReset={() => setDialog("reset")}
          />
        </aside>
      </main>

      <SettingsDialog
        open={dialog === "settings"}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setDialog(null)}
        onExport={() => openDialog("export")}
        onBackup={() => downloadText(backupFilename(), buildBackupJson(solves))}
        onImport={importSolves}
        onReset={() => openDialog("reset")}
      />

      <StatsDialog open={dialog === "stats"} onClose={() => setDialog(null)} stats={stats} />

      <ExportDialog
        open={dialog === "export"}
        onClose={() => setDialog(null)}
        text={exportText}
        solveCount={solves.length}
      />

      <HelpDialog open={dialog === "help"} onClose={() => setDialog(null)} />

      <AuthDialog open={dialog === "auth"} onClose={() => setDialog(null)} auth={auth} />

      <ConfirmDialog
        open={dialog === "reset"}
        title="Reset session?"
        description="This permanently deletes every solve in this browser. Export first if you want to keep a copy."
        confirmLabel="Reset session"
        onConfirm={resetSession}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
