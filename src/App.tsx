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
import { SessionMenu } from "./components/SessionMenu";
import { ScrambleBar } from "./components/ScrambleBar";
import { TimerDisplay } from "./components/TimerDisplay";
import { TypeInTimer } from "./components/TypeInTimer";
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
import { useScramble } from "./hooks/useScramble";
import { useTimer } from "./hooks/useTimer";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./hooks/useCloudSync";
import { averageOf, computeStats, recentValidTimes } from "./lib/stats";
import { buildBackupJson, backupFilename, buildExportText, downloadText } from "./lib/export";
import {
  adoptOrphans,
  cleanSessionName,
  createSession,
  importGroups,
  readActiveSessions,
  readSessions,
  resolveActiveSession,
  solvesOfSession,
  type ImportGroup,
} from "./lib/sessions";
import { isPuzzleId, puzzleById } from "./lib/puzzles";
import { readStore, STORAGE_KEYS, writeStore } from "./lib/storage";
import type { PbEvent, PbKind } from "./components/PbNotice";
import { readSettings } from "./lib/settings";
import { applyAccent } from "./lib/accents";
import { cn, uid } from "./lib/cn";
import type { Penalty, PuzzleId, Session, Settings, Solve } from "./lib/types";

/** Phones and tablets drive the timer by touching it, not by pressing space. */
const COARSE_POINTER = "(pointer: coarse)";

// One MediaQueryList, shared: the snapshot is read on every render, and a new
// one per frame is needless work while the timer runs.
let coarseQuery: MediaQueryList | null = null;
function coarsePointerQuery(): MediaQueryList {
  coarseQuery ??= window.matchMedia(COARSE_POINTER);
  return coarseQuery;
}

function subscribePointer(onChange: () => void) {
  const media = coarsePointerQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readCoarsePointer() {
  return coarsePointerQuery().matches;
}
const MAX_SOLVES = 5000;
/** How long the undo button for a deleted solve stays in the panel. */
const UNDO_MS = 5000;

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

type DialogId = "settings" | "stats" | "export" | "help" | null;

/** A newly set average beats the old best only if there was one to beat. */
function improvedAverage(before: number | null, after: number | null): after is number {
  return before !== null && after !== null && Number.isFinite(after) && after < before;
}

/** One confirmation slot, so every destructive action shares the same dialog. */
interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => void;
}

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

  const [sessions, setSessions] = useState<Session[]>(readSessions);
  const [activeByPuzzle, setActiveByPuzzle] = useState<Record<string, string>>(readActiveSessions);

  const [settings, setSettings] = useState<Settings>(readSettings);

  const [puzzle, setPuzzle] = useState<PuzzleId>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.puzzle, "333");
    return isPuzzleId(stored) ? stored : "333";
  });

  const [dialog, setDialog] = useState<DialogId>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [pb, setPb] = useState<PbEvent | null>(null);
  const pbSeq = useRef(0);
  /** Bumped after an import so the upload runs once the new list is in state. */
  const [flushToken, setFlushToken] = useState(0);

  /** The solve the timer just produced, so its penalty can be shown and edited. */
  const [settledId, setSettledId] = useState<string | null>(null);

  /** Solves deleted moments ago, kept so the panel can offer an undo. */
  const [undoBuffer, setUndoBuffer] = useState<{
    solves: Solve[];
    settledId: string | null;
  } | null>(null);
  const undoTimer = useRef<number | null>(null);
  /** True while the digits on the timer belong to a solve that was deleted. */
  const [deletedSettled, setDeletedSettled] = useState(false);

  const [showNet, setShowNet] = useState<boolean>(() => {
    const stored = readStore<unknown>(STORAGE_KEYS.cubeNet, true);
    return stored !== false;
  });

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    // A tablet has no pointer to aim with, so the panel starts as narrow as it
    // goes and the timer takes the rest of the screen; dragging widens it.
    const fallback = readCoarsePointer() ? PANEL_MIN : DEFAULT_PANEL;
    const stored = readStore<unknown>(STORAGE_KEYS.panel, fallback);
    return clampPanel(typeof stored === "number" && Number.isFinite(stored) ? stored : fallback);
  });
  const resizeFrom = useRef<{ x: number; width: number } | null>(null);
  /** The typed-time field, so a click anywhere on the stage can refocus it. */
  const typedTimeInput = useRef<HTMLInputElement>(null);
  /** True while a press that started on the stage is still waiting for its up. */
  const stagePress = useRef(false);

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
  const { solveSaved, solveDeleted, solveRestored, clearCloud, preferencesChanged, syncNow } = sync;

  useLayoutEffect(() => {
    applyAccent(settings.accent);
  }, [settings.accent]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.solves, solves);
  }, [solves]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.sessions, sessions);
  }, [sessions]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.activeSessions, activeByPuzzle);
  }, [activeByPuzzle]);

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

  // Solves written before sessions existed, and solves pulled from the cloud
  // (which has no session column), get a session of their own instead of
  // vanishing from a panel that only shows the open session.
  useEffect(() => {
    const adopted = adoptOrphans(solves, sessions);
    if (!adopted) return;
    setSolves(adopted.solves);
    setSessions(adopted.sessions);
  }, [solves, sessions]);

  useEffect(() => {
    function onResize() {
      setPanelWidth((width) => clampPanel(width));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    };
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

  const activeSession = useMemo(
    () => resolveActiveSession(sessions, activeByPuzzle, puzzle),
    [sessions, activeByPuzzle, puzzle],
  );
  const sessionSolves = useMemo(
    () => solvesOfSession(solves, activeSession?.id),
    [solves, activeSession],
  );
  const eventSolves = useMemo(
    () => solves.filter((solve) => solve.puzzle === puzzle),
    [solves, puzzle],
  );
  const stats = useMemo(() => computeStats(sessionSolves), [sessionSolves]);
  const allTime = useMemo(() => computeStats(eventSolves), [eventSolves]);

  /**
   * The strongest personal best the finished solve just set, if any. Adding a
   * solve at the front only creates new average windows at the front, so the
   * current average is compared with the old best — no full rescan needed.
   */
  const findPersonalBest = useCallback(
    (solve: Solve, effective: number): { kind: PbKind; scope: "session" | "all" } | null => {
      if (allTime.best !== null && effective < allTime.best)
        return { kind: "single", scope: "all" };
      if (stats.best !== null && effective < stats.best)
        return { kind: "single", scope: "session" };

      const sizes: Array<{ size: 5 | 12 | 50 | 100; key: "ao5" | "ao12" | "ao50" | "ao100" }> = [
        { size: 5, key: "ao5" },
        { size: 12, key: "ao12" },
        { size: 50, key: "ao50" },
        { size: 100, key: "ao100" },
      ];

      for (const scope of ["all", "session"] as const) {
        const before = scope === "all" ? allTime : stats;
        const list = scope === "all" ? eventSolves : sessionSolves;
        const bestOf = {
          ao5: before.bestAo5,
          ao12: before.bestAo12,
          ao50: before.bestAo50,
          ao100: before.bestAo100,
        };
        for (const { size, key } of sizes) {
          const after = averageOf([solve, ...list], size);
          if (improvedAverage(bestOf[key], after)) return { kind: key, scope };
        }
      }
      return null;
    },
    [allTime, eventSolves, sessionSolves, stats],
  );

  const handleComplete = useCallback(
    ({ ms, penalty }: { ms: number; penalty: Penalty }) => {
      const effective = penalty === "dnf" ? Infinity : ms + (penalty === "plus2" ? 2000 : 0);

      // The first solve of an event opens its session, so a solve is never
      // recorded outside one and always shows up in the panel.
      const session = activeSession ?? createSession(puzzle, sessions);
      if (!activeSession) {
        setSessions((previous) => [...previous, session]);
        setActiveByPuzzle((previous) => ({ ...previous, [puzzle]: session.id }));
      }

      const solve: Solve = {
        id: uid(),
        ms,
        penalty,
        scramble,
        puzzle,
        date: Date.now(),
        sessionId: session.id,
      };

      setSolves((previous) => [solve, ...previous].slice(0, MAX_SOLVES));
      setSettledId(solve.id);
      setDeletedSettled(false);
      nextScramble();
      solveSaved(solve);

      const best = findPersonalBest(solve, effective);
      if (best) {
        pbSeq.current += 1;
        setPb({ id: pbSeq.current, ms: effective, kind: best.kind, scope: best.scope });
      }
    },
    [activeSession, findPersonalBest, sessions, puzzle, scramble, nextScramble, solveSaved],
  );

  /** A typed time is a clean solve; the parser has already rounded it. */
  const recordTypedSolve = useCallback(
    (ms: number) => handleComplete({ ms, penalty: "ok" }),
    [handleComplete],
  );

  const modalOpen = dialog !== null || confirmation !== null;

  const touch = useSyncExternalStore(subscribePointer, readCoarsePointer, () => false);

  /**
   * Typed times replace the clock on a desktop. A touch screen has no keyboard
   * to type on, so the option is ignored there even when it arrives turned on
   * from another device.
   */
  const typedMode = settings.typeInTime && !touch;

  const timer = useTimer({
    inspection: settings.inspection,
    holdMs: settings.holdMs,
    active: !modalOpen && !typedMode,
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

  const trend = useMemo(() => recentValidTimes(sessionSolves, 30), [sessionSolves]);
  const lastSolve = sessionSolves[0] ?? null;

  // Reading the penalty off the recorded solve keeps the timer in step with
  // edits, and stops it showing a stale penalty if that solve is deleted.
  const settledPenalty: Penalty = useMemo(
    () => solves.find((solve) => solve.id === settledId)?.penalty ?? "ok",
    [solves, settledId],
  );
  const running = timer.status === "running";
  const netAvailable = supportsNet(puzzle);

  // The next attempt takes the digits back, so the deleted mark goes with it.
  useEffect(() => {
    if (focusing) setDeletedSettled(false);
  }, [focusing]);

  // The typed-time field is the timer, so it holds focus unless a dialog owns
  // it; clicking anywhere on the stage puts the caret back.
  useEffect(() => {
    if (!typedMode || modalOpen) return;
    typedTimeInput.current?.focus();
  }, [typedMode, modalOpen]);

  const exportText = useMemo(
    () => (dialog === "export" ? buildExportText(sessions, solves) : ""),
    [dialog, sessions, solves],
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

  const deleteSolves = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const targets = new Set(ids);
      const removed = solves.filter((solve) => targets.has(solve.id));
      const removedSettled = settledId !== null && targets.has(settledId) ? settledId : null;

      setSolves((previous) => previous.filter((solve) => !targets.has(solve.id)));
      if (removedSettled) {
        setSettledId(null);
        setDeletedSettled(true);
      }
      solveDeleted(ids);

      // A delete is easy to misclick, so it stays reversible for a few seconds.
      if (removed.length > 0) {
        setUndoBuffer({ solves: removed, settledId: removedSettled });
        if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
        undoTimer.current = window.setTimeout(() => {
          undoTimer.current = null;
          setUndoBuffer(null);
        }, UNDO_MS);
      }
    },
    [solves, settledId, solveDeleted],
  );

  const undoDelete = useCallback(() => {
    if (!undoBuffer) return;
    if (undoTimer.current !== null) {
      window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    const restored = undoBuffer.solves;
    setSolves((previous) =>
      [...previous, ...restored].sort((a, b) => b.date - a.date).slice(0, MAX_SOLVES),
    );
    if (undoBuffer.settledId) {
      setSettledId(undoBuffer.settledId);
      setDeletedSettled(false);
    }
    solveRestored(restored);
    setUndoBuffer(null);
  }, [undoBuffer, solveRestored]);

  const deleteSolve = useCallback((id: string) => deleteSolves([id]), [deleteSolves]);

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
      // The panel now shows another event, so the settled solve and any pending
      // undo belong to a view that is no longer on screen.
      setSettledId(null);
      setDeletedSettled(false);
      setUndoBuffer(null);
      preferencesChanged();
    },
    [preferencesChanged],
  );

  /** Finishes the open session and opens a fresh one for the same event. */
  const startSession = useCallback(() => {
    const session = createSession(puzzle, sessions);
    setSessions((previous) => [...previous, session]);
    setActiveByPuzzle((previous) => ({ ...previous, [puzzle]: session.id }));
    setSettledId(null);
    setDeletedSettled(false);
    setUndoBuffer(null);
  }, [puzzle, sessions]);

  const openSession = useCallback((session: Session) => {
    setPuzzle(session.puzzle);
    setActiveByPuzzle((previous) => ({ ...previous, [session.puzzle]: session.id }));
    setSettledId(null);
    setDeletedSettled(false);
    setUndoBuffer(null);
    setDialog(null);
  }, []);

  const renameSession = useCallback((session: Session, name: string) => {
    const cleaned = cleanSessionName(name, session.name);
    setSessions((previous) =>
      previous.map((entry) => (entry.id === session.id ? { ...entry, name: cleaned } : entry)),
    );
  }, []);

  const requestDeleteSession = useCallback(
    (session: Session) => {
      const owned = solvesOfSession(solves, session.id);
      setConfirmation({
        title: `Delete ${session.name}?`,
        description: `Deletes the ${owned.length} solve${owned.length === 1 ? "" : "s"} in ${
          session.name
        } (${puzzleById(session.puzzle).label}). Export first if you want a copy.`,
        confirmLabel: "Delete session",
        action: () => {
          const removedSettled =
            settledId !== null && owned.some((solve) => solve.id === settledId);
          setSolves((previous) => previous.filter((solve) => solve.sessionId !== session.id));
          setSessions((previous) => previous.filter((entry) => entry.id !== session.id));
          setUndoBuffer(null);
          setDialog(null);
          if (removedSettled) {
            setSettledId(null);
            setDeletedSettled(true);
          }
          if (owned.length > 0) solveDeleted(owned.map((solve) => solve.id));
        },
      });
    },
    [solves, settledId, solveDeleted],
  );

  const requestReset = useCallback(() => {
    setConfirmation({
      title: "Reset everything?",
      description:
        "Deletes every solve and session in this browser, for good. Export first if you want to keep a copy.",
      confirmLabel: "Reset everything",
      action: () => {
        setSolves([]);
        setSessions([]);
        setActiveByPuzzle({});
        setSettledId(null);
        setDeletedSettled(false);
        setUndoBuffer(null);
        clearCloud();
      },
    });
  }, [clearCloud]);

  const importSolveGroups = useCallback(
    (groups: ImportGroup[]) => {
      const result = importGroups({ sessions, solves }, groups, MAX_SOLVES);
      if (result.added > 0) {
        setSessions(result.sessions);
        setSolves(result.solves);
        // Show what arrived: open the first imported session of its event.
        const first = result.created[0];
        if (first) {
          setPuzzle(first.puzzle);
          setActiveByPuzzle((previous) => ({ ...previous, [first.puzzle]: first.id }));
        }
        setFlushToken((token) => token + 1);
      }
      return {
        sessions: result.created.length,
        added: result.added,
        duplicates: result.duplicates,
      };
    },
    [sessions, solves],
  );

  const backup = useCallback(
    () => downloadText(backupFilename(), buildBackupJson(sessions, solves), "application/json"),
    [sessions, solves],
  );

  // Reconciling straight after setSolves would read the previous list, so the
  // upload waits one render for the imported solves to reach state and storage.
  useEffect(() => {
    if (flushToken === 0) return;
    syncNow();
  }, [flushToken, syncNow]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (modalOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
        // An open menu owns its keys: N, 2, D and Delete must not act behind it.
        if (target.closest('[role="dialog"], [role="listbox"]')) return;
      }

      if (event.key === "Escape") {
        cancelInspection();
        return;
      }

      // Changing the scramble or the last solve mid-attempt would attach the
      // wrong scramble to the result, so these wait for the timer to stop.
      // This covers inspection too: the scramble is already on the clock, and
      // the header is hidden, so a shortcut must not swap it unseen.
      if (focusing) return;

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
  }, [modalOpen, lastSolve, focusing, nextScramble, applyPenalty, deleteSolve, cancelInspection]);

  const hint = (() => {
    if (typedMode) return "Type a time, then press Enter";
    if (timer.inspecting) {
      if (timer.status === "ready") return "Release to start the solve";
      return touch ? "Hold until the timer turns green" : "Hold space until the timer turns green";
    }
    if (timer.status === "running") return touch ? "Tap anywhere to stop" : "Press any key to stop";
    if (timer.status === "ready") return "Release to start";
    if (timer.status === "holding") return "Keep holding…";
    if (timer.status === "stopped") {
      return touch ? "Tap anywhere for the next solve" : "Press space for the next solve";
    }
    if (settings.inspection) {
      return touch ? "Tap anywhere to begin inspection" : "Tap space to begin inspection";
    }
    return touch ? "Hold anywhere to arm, release to start" : "Hold space to arm, release to start";
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

  /**
   * The stage as a whole is the timer: pressing almost anywhere arms it, and on
   * a touch screen a tap begins inspection outright. Anything interactive keeps
   * its own presses, and a press that started elsewhere never releases one here.
   */
  function onStagePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;

    // The typing field owns the stage: a press only puts the caret back, and
    // must never arm the clock that is not on screen.
    if (typedMode) {
      typedTimeInput.current?.focus();
      return;
    }

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, select, textarea, [role='separator'], [role='listbox']")
    ) {
      return;
    }

    // A finger rarely gives a clean press and release: the layout moves under
    // it, and the browser may cancel the pointer. Starting inspection on the
    // press itself is what makes a single tap enough.
    if (
      touch &&
      settings.inspection &&
      !timer.inspecting &&
      (timer.status === "idle" || timer.status === "stopped")
    ) {
      timer.startInspection();
      return;
    }

    // Captured, so the release still arrives if the layout shifts mid-press.
    event.currentTarget.setPointerCapture(event.pointerId);
    stagePress.current = true;
    timer.press();
  }

  function onStagePointerUp() {
    if (!stagePress.current) return;
    stagePress.current = false;
    timer.release();
  }

  function onStagePointerCancel() {
    if (!stagePress.current) return;
    stagePress.current = false;
    timer.abortPress();
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-ink-950 lg:h-dvh lg:overflow-hidden">
      <header
        className={cn(
          "relative z-20 h-12 shrink-0 items-center gap-3 border-b border-white/[0.055] px-3 sm:h-13 sm:px-6",
          // Gone entirely during an attempt, so the stage is the whole window
          // and the digits can sit at its exact centre.
          focusing ? "hidden" : "flex",
        )}
      >
        <PbNotice event={pb} />
        <Wordmark />
        <div aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-white/[0.07] sm:block" />
        <PuzzleSelect value={puzzle} onChange={changePuzzle} disabled={focusing} />
        <SessionMenu
          puzzle={puzzle}
          sessions={sessions}
          solves={solves}
          activeSession={activeSession}
          onSelect={openSession}
          onNew={startSession}
          onRename={renameSession}
          onDelete={requestDeleteSession}
          disabled={focusing}
        />
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
        </div>
      </header>

      <main
        className="app-main relative z-10 min-h-0 flex-1"
        style={{ "--panel-width": `${focusing ? 0 : panelWidth}px` } as CSSProperties}
      >
        {/* On a phone the timer owns the first screen, with the top of the side
            panel peeking out as a hint that there is more below. */}
        {/* Closing a dialog must give the page back exactly as it was, so the
            stage only changes layout while an attempt is actually in progress. */}
        <section
          onPointerDown={onStagePointerDown}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerCancel}
          className={cn(
            // `overflow-x-clip` keeps a sub-pixel of glyph overflow from ever
            // producing a horizontal scrollbar under the timer. `manipulation`
            // removes the double-tap zoom without blocking a scroll.
            "@container relative touch-manipulation select-none min-h-[calc(100svh-6.5rem)] overflow-x-clip sm:min-h-[calc(100svh-7rem)] lg:min-h-0 lg:overflow-y-auto",
            // While focusing the stage stops being a three-row grid and becomes
            // a single column holding only the timer, which then fills it. With
            // the panel collapsed too (below), the digits are centred in the
            // whole window rather than in the leftover column.
            focusing ? "flex flex-col" : "grid grid-cols-1 grid-rows-[1fr_auto_1fr]",
          )}
        >
          {/* Hidden rather than unmounted while focusing: keeping the children in
              the same positions means the timer element is never remounted, so a
              pointer held down to arm it never loses its capture. `display: none`
              also stops the cube net painting for a frame while the layout
              changes, which is what made it flash to the side. */}
          <ScrambleBar
            scramble={scramble}
            loading={loading}
            puzzleLabel={puzzleById(puzzle).label}
            onNext={nextScramble}
            className={cn("col-start-1 row-start-1 self-start", focusing && "hidden")}
          />

          {/* The stage is three rows: the scramble, the digits, the hint. The two
              outer rows share the leftover height equally, so the digits land in
              the middle of the screen however tall the scramble is. Centring them
              in the space left under the scramble instead pulled the timer down
              with the scramble — a 7×7 or a wrapped 4×4 moved the digits 45px —
              which is why no single padding value ever sat right. Equal rows also
              keep the digits clear of the scramble: when the scramble is too tall
              for its half, that row grows to fit it and pushes the digits down
              instead of letting them land behind the text.

              Once an attempt starts, everything but the digits disappears and
              the stage turns into one flexible cell, so the digits are centred
              no matter how long the scramble is. */}
          <div
            className={cn(
              "col-start-1 row-start-2 flex items-center justify-center px-3 py-2 sm:px-4",
              focusing && "relative z-10 flex-1 py-0",
            )}
          >
            <div
              className={cn(
                "w-full max-w-[1100px] rounded-2xl px-2 py-3 @container",
                typedMode ? "cursor-text" : "cursor-pointer",
              )}
            >
              {typedMode ? (
                <TypeInTimer
                  inputRef={typedTimeInput}
                  onSubmit={recordTypedSolve}
                  disabled={modalOpen}
                />
              ) : (
                <TimerDisplay
                  status={timer.status}
                  elapsed={timer.elapsed}
                  clock={timer.clock}
                  inspecting={timer.inspecting}
                  inspectionLeft={timer.inspectionLeft}
                  hideRunningTime={settings.hideRunningTime}
                  inspectionEnabled={settings.inspection}
                  penalty={settledPenalty}
                  zoomed={focusing}
                  deleted={deletedSettled}
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              "relative col-start-1 row-start-3 items-center self-end pb-2 sm:pb-5",
              focusing ? "hidden" : "flex flex-col",
            )}
          >
            {/* Above the hint on phones, anchored to the bottom corner on wider
                screens where there is room beside the hint. The toggle shares
                the same 16px left/bottom inset as the net so the block reads as
                one corner widget. */}
            {netAvailable ? (
              <div className="pointer-events-none absolute bottom-full left-4 mb-2 transition-opacity duration-200 @min-[700px]:bottom-4 @min-[700px]:mb-0">
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
            <p className="hidden h-5 items-center gap-2 text-[11px] text-faint transition-opacity duration-200 sm:flex">
              {touch ? null : typedMode ? (
                <kbd className="kbd">enter</kbd>
              ) : (
                <kbd className="kbd">space</kbd>
              )}
              <span>{hint}</span>
            </p>
          </div>
        </section>

        {/* Sitting on the seam rather than inside the panel: a finger needs a
            wide target, but every pixel of the strip over the panel is a pixel
            of a solve row that cannot be tapped. */}
        {focusing ? null : (
          <div
            role="separator"
            aria-label="Resize side panel"
            aria-orientation="vertical"
            aria-valuenow={panelWidth}
            aria-valuemin={PANEL_MIN}
            aria-valuemax={PANEL_MAX}
            tabIndex={0}
            title="Drag to resize · double-click to reset"
            style={{ right: "var(--panel-width)" } as CSSProperties}
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
            className="absolute top-0 bottom-0 z-30 hidden w-2 translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-accent/25 focus-visible:bg-accent/25 pointer-coarse:w-6 lg:block"
          >
            {/* Drawn, because a handle nobody can see is a handle nobody uses. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 pointer-coarse:bg-white/30"
            />
          </div>
        )}

        <aside
          className={cn(
            "relative min-h-0 flex-col border-t border-white/[0.055] bg-ink-950/50 lg:overflow-hidden lg:border-l lg:border-t-0",
            // Out of the layout while focusing, so the collapsed column cannot
            // overflow and the digits centre on the whole screen.
            focusing ? "hidden" : "flex",
          )}
        >
          <StatsPanel
            sessionName={activeSession?.name ?? "Session"}
            eventLabel={puzzleById(puzzle).short}
            stats={stats}
            trend={trend}
            disabled={running}
            onOpenStats={() => openDialog("stats")}
          />

          <SolveList
            solves={sessionSolves}
            onPenalty={applyPenalty}
            onDelete={deleteSolve}
            onDeleteMany={deleteSolves}
            onReset={requestReset}
            undo={undoBuffer ? { count: undoBuffer.solves.length } : null}
            onUndo={undoDelete}
          />
        </aside>
      </main>

      <SettingsDialog
        open={dialog === "settings"}
        settings={settings}
        typeInAvailable={!touch}
        onChange={updateSettings}
        onClose={() => setDialog(null)}
        onExport={() => openDialog("export")}
        onBackup={backup}
        onImport={importSolveGroups}
        onReset={requestReset}
      />

      <StatsDialog
        open={dialog === "stats"}
        onClose={() => setDialog(null)}
        sessions={sessions}
        solves={solves}
        puzzle={puzzle}
        activeSession={activeSession}
        onOpenSession={openSession}
        onNewSession={startSession}
        onDeleteSession={requestDeleteSession}
        onRenameSession={renameSession}
      />

      <ExportDialog
        open={dialog === "export"}
        onClose={() => setDialog(null)}
        text={exportText}
        solveCount={solves.length}
        sessionCount={sessions.length}
        onBackup={backup}
      />

      <HelpDialog open={dialog === "help"} onClose={() => setDialog(null)} />

      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
        onConfirm={() => {
          const action = confirmation?.action;
          setConfirmation(null);
          action?.();
        }}
        onClose={() => setConfirmation(null)}
      />
    </div>
  );
}
