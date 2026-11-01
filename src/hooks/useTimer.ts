import { useCallback, useEffect, useRef, useState } from "react";
import type { Penalty } from "../lib/types";

export type TimerStatus = "idle" | "holding" | "ready" | "running" | "stopped";

const INSPECTION_MS = 15_000;
const INSPECTION_DNF_MS = 17_000;

export interface UseTimerOptions {
  /** WCA inspection before each attempt. */
  inspection: boolean;
  /** Hold duration before the timer arms. */
  holdMs: number;
  /** False while a dialog is open. */
  active: boolean;
  onSolveComplete: (result: { ms: number; penalty: Penalty }) => void;
}

export function useTimer(options: UseTimerOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [status, setStatus] = useState<TimerStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionLeft, setInspectionLeft] = useState<number | null>(null);

  const statusRef = useRef<TimerStatus>("idle");
  const inspectingRef = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const startAt = useRef(0);
  const inspectAt = useRef(0);
  const penaltyRef = useRef<Penalty>("ok");
  const ignoreRelease = useRef(false);
  /** Currently displayed whole second of inspection, to avoid idle re-renders. */
  const shownSecond = useRef<number | null>(null);

  function setPhase(next: TimerStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function stopLoop() {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }

  function startLoop() {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(tick);
  }

  function beginRun() {
    const start = performance.now();

    if (inspectingRef.current) {
      const inspectionMs = start - inspectAt.current;
      const penalty: Penalty =
        inspectionMs >= INSPECTION_DNF_MS ? "dnf" : inspectionMs > INSPECTION_MS ? "plus2" : "ok";
      penaltyRef.current = penalty;
      inspectingRef.current = false;
      shownSecond.current = null;
      setInspecting(false);
      setInspectionLeft(null);
    }

    startAt.current = start;
    setElapsed(0);
    setPhase("running");
    startLoop();
  }

  function stopRun() {
    const ms = performance.now() - startAt.current;
    if (ms < 40) return;

    stopLoop();
    setElapsed(ms);
    setPhase("stopped");
    ignoreRelease.current = true;

    const penalty = penaltyRef.current;
    penaltyRef.current = "ok";
    optionsRef.current.onSolveComplete({ ms, penalty });
  }

  function startInspection() {
    inspectingRef.current = true;
    inspectAt.current = performance.now();
    shownSecond.current = INSPECTION_MS / 1000;
    setInspecting(true);
    setInspectionLeft(INSPECTION_MS / 1000);
    setElapsed(0);
    setPhase("idle");
    startLoop();
  }

  function tick() {
    raf.current = null;
    const now = performance.now();

    if (inspectingRef.current) {
      const inspectionMs = now - inspectAt.current;

      if (inspectionMs >= INSPECTION_DNF_MS) {
        penaltyRef.current = "dnf";
        beginRun();
      } else {
        // Only whole seconds reach the screen, so only update when the digit
        // changes instead of re-rendering the tree sixty times a second.
        const seconds = Math.max(0, Math.ceil((INSPECTION_MS - inspectionMs) / 1000));
        if (seconds !== shownSecond.current) {
          shownSecond.current = seconds;
          setInspectionLeft(seconds);
        }
      }
    } else if (statusRef.current === "running") {
      setElapsed(now - startAt.current);
    }

    if (raf.current === null && (inspectingRef.current || statusRef.current === "running")) {
      raf.current = requestAnimationFrame(tick);
    }
  }

  function press() {
    const current = optionsRef.current;
    if (!current.active || ignoreRelease.current) return;

    if (statusRef.current === "running") {
      stopRun();
      return;
    }

    // A finished solve stays on screen while the next attempt is armed: the
    // digits only change once inspection or the run actually takes over.

    if (holdTimer.current !== null) return;

    setPhase("holding");
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (statusRef.current === "holding") {
        setPhase("ready");
      }
    }, current.holdMs);
  }

  function release() {
    if (ignoreRelease.current) {
      ignoreRelease.current = false;
      return;
    }
    if (!optionsRef.current.active) return;

    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (statusRef.current === "ready") {
      beginRun();
      return;
    }

    if (statusRef.current === "holding") {
      setPhase("idle");
      if (optionsRef.current.inspection && !inspectingRef.current) {
        startInspection();
      }
    }
  }

  // The key handlers must stay subscribed for the life of the app, so they read
  // the newest closures through refs instead of re-registering every render.
  const pressRef = useRef(press);
  const releaseRef = useRef(release);
  pressRef.current = press;
  releaseRef.current = release;

  /**
   * Drops a press that never became a real release, such as a pointer the
   * browser cancelled. Releasing in that case would start the solve, so the
   * press is unwound instead and the next one behaves normally.
   */
  const abortPress = useCallback(() => {
    ignoreRelease.current = false;
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (statusRef.current === "holding" || statusRef.current === "ready") {
      setPhase("idle");
    }
  }, []);

  const cancelInspection = useCallback(() => {
    const wasInspecting = inspectingRef.current;
    const wasArmed = statusRef.current === "holding" || statusRef.current === "ready";
    if (!wasInspecting && !wasArmed) return;

    // A press that is still waiting to arm must not survive the cancel, or the
    // timer would turn green a moment later with no attempt behind it.
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (wasArmed) setPhase("idle");
    if (!wasInspecting) return;

    inspectingRef.current = false;
    penaltyRef.current = "ok";
    shownSecond.current = null;
    stopLoop();
    setInspecting(false);
    setInspectionLeft(null);
    setElapsed(0);
  }, []);

  // Opening a dialog must not leave the timer half-armed.
  useEffect(() => {
    if (options.active) return;
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (statusRef.current === "holding" || statusRef.current === "ready") {
      setPhase("idle");
    }
  }, [options.active]);

  // Space bar is the primary control.
  useEffect(() => {
    function isTextInput(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    }

    /** Space is the timer's key everywhere except inside a text field. */
    function onKeyDown(event: KeyboardEvent) {
      if (!optionsRef.current.active) return;
      if (event.code !== "Space" || isTextInput(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      pressRef.current();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space" || isTextInput(event.target)) return;
      if (optionsRef.current.active) event.preventDefault();
      releaseRef.current();
    }

    function onBlur() {
      // A lost keyup must not leave the next press swallowed.
      ignoreRelease.current = false;
      if (holdTimer.current !== null) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      if (statusRef.current === "holding" || statusRef.current === "ready") {
        setPhase("idle");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopLoop();
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    };
  }, []);

  return {
    status,
    elapsed,
    inspecting,
    inspectionLeft,
    press,
    release,
    abortPress,
    cancelInspection,
  };
}
