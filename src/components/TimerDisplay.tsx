import { useSyncExternalStore } from "react";
import { cn } from "../lib/cn";
import { formatTime } from "../lib/format";
import type { TimerClock, TimerStatus } from "../hooks/useTimer";
import type { Penalty } from "../lib/types";

interface TimerDisplayProps {
  status: TimerStatus;
  /** The finished time. While running the digits read the clock instead. */
  elapsed: number;
  /** Fires only when the hundredths change, so the rest of the app stays still. */
  clock: TimerClock;
  inspecting: boolean;
  inspectionLeft: number | null;
  hideRunningTime: boolean;
  /** WCA inspection is on, so a press is about to start the countdown. */
  inspectionEnabled: boolean;
  /** Penalty on the solve that was just recorded. */
  penalty: Penalty;
  /** Inspection or a running attempt: the digits step up and own the screen. */
  zoomed?: boolean;
  /** The solve on screen was deleted, so the digits stay but are marked. */
  deleted?: boolean;
}

/**
 * The timer, plus a caption line above the digits. Inspection uses that line
 * for its label; a settled solve uses it for +2 / DNF, which keeps the penalty
 * visible without the digits ever moving — anything beside the number would
 * shift the time sideways the moment a penalty appeared.
 */
export function TimerDisplay({
  status,
  elapsed,
  clock,
  inspecting,
  inspectionLeft,
  hideRunningTime,
  inspectionEnabled,
  penalty,
  zoomed = false,
  deleted = false,
}: TimerDisplayProps) {
  // With inspection on, the press that begins it must not show the previous
  // solve first: a quick tap would flash that time for a frame before the
  // countdown replaced it. The countdown's starting value stands in instead.
  const pendingInspection = inspectionEnabled && !inspecting && status === "holding";
  // The countdown survives arming: replacing it with 0.00 the moment the timer
  // turned green put a different number on screen just before the solve began.
  const showCountdown = inspecting || pendingInspection;
  const overInspection = showCountdown && inspectionLeft !== null && inspectionLeft <= 0;
  const warning =
    showCountdown && inspectionLeft !== null && inspectionLeft <= 3 && inspectionLeft > 0;

  const countdown =
    inspectionLeft !== null && inspectionLeft <= 0
      ? "+2"
      : String(Math.max(0, Math.ceil(inspectionLeft ?? 15)));

  const hidden = hideRunningTime && status === "running" && !showCountdown;

  // Counted in hundredths, so the digits never re-render for a frame that lands
  // inside the same hundredth.
  const liveCentis = useSyncExternalStore(clock.subscribe, clock.read, () => 0);
  const shown = status === "running" ? liveCentis * 10 : elapsed;

  // The solve still on screen keeps its time and penalty until the next attempt
  // takes over. Keyed off the elapsed value rather than the phase so the digits
  // don't change while space is held to arm, which used to flash 0.00 on the way
  // into inspection.
  const settled = !showCountdown && status !== "running" && elapsed > 0;
  const removed = settled && deleted;
  const plus2 = settled && !removed && penalty === "plus2";
  const dnf = settled && !removed && penalty === "dnf";

  const value = showCountdown ? countdown : plus2 ? formatTime(shown + 2000) : formatTime(shown);

  const tone = overInspection
    ? "text-bad"
    : warning || plus2
      ? "text-warn"
      : dnf
        ? "text-bad"
        : removed
          ? "text-muted"
          : status === "ready"
            ? "text-good"
            : "text-chalk";

  const caption = showCountdown
    ? "inspection"
    : removed
      ? "deleted"
      : plus2
        ? "+2"
        : dnf
          ? "DNF"
          : "";
  // One scale value, so arming and focusing cannot fight over the transform.
  // Arming always happens while focused, so it only needs the armed step. That
  // step is deliberately small: a large one widened the ink past the layout
  // box, which both clipped the digits and left a scrollbar. It only applies
  // from `sm` up, because on a phone the digits already fill their column and
  // any extra width there is what used to force a horizontal scrollbar.
  const scale =
    status === "ready" ? "scale-[1.045] sm:scale-[1.07]" : zoomed ? "sm:scale-[1.03]" : "";
  // A time with a minutes field is three glyphs longer, so it steps down a size
  // rather than overflowing the column it sits in.
  const longValue = value.length >= 6;

  return (
    <div className="relative flex w-full items-center justify-center select-none">
      {/* Out of the flow so the digits themselves sit dead centre. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-center whitespace-nowrap uppercase transition-colors duration-200",
          caption ? "text-[10px] font-medium tracking-[0.3em]" : "text-[10px] tracking-[0.3em]",
          showCountdown
            ? overInspection
              ? "text-bad"
              : "text-faint"
            : removed
              ? "text-bad"
              : plus2
                ? "text-warn"
                : dnf
                  ? "text-bad"
                  : "text-transparent",
        )}
      >
        {caption || "inspection"}
      </span>

      <div
        role="timer"
        aria-label={
          showCountdown
            ? `Inspection, ${countdown}${overInspection ? " seconds over" : " seconds remaining"}`
            : `Timer ${formatTime(shown)}${plus2 ? ", plus two penalty" : dnf ? ", did not finish" : ""}`
        }
        className={cn(
          // Inter at 400: proportional-pitch digits with tabular figures, no
          // slashed zero, and a touch more weight than a mono hairline.
          "relative text-center font-sans font-normal leading-[0.9] tracking-[-0.045em] tabular-nums",
          // Letter-spacing is also applied after the final digit, so the layout
          // box ends up narrower than the glyphs by the tracking amount and the
          // whole number drifts right of centre. The right padding hands that
          // trailing space back, which centres the ink instead of the box.
          "pr-[0.045em]",
          // Container width sets the size, but a short window (a phone held in
          // landscape) caps it by height so the digits can never outgrow the screen.
          "transition-[color,scale] duration-150 ease-out",
          // The `cqw` ratios are the ones that were tuned to fit the longest
          // string the class allows; the rem ceiling is what can grow. A wider
          // timer column (and the panel collapsing during a solve) therefore
          // makes the digits bigger without ever pushing them out of their box.
          longValue
            ? "text-[clamp(4.4rem,min(26.4cqw,33svh),16rem)] sm:text-[clamp(4.15rem,min(25.4cqw,33svh),16rem)]"
            : "text-[clamp(5.4rem,min(30.8cqw,37svh),18rem)] sm:text-[clamp(4.9rem,min(28.9cqw,37svh),18rem)]",
          scale,
          tone,
        )}
      >
        <span className={cn(hidden && "text-ink-500")}>{hidden ? "solve" : value}</span>
      </div>
    </div>
  );
}
