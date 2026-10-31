import { cn } from "../lib/cn";
import { formatTime } from "../lib/format";
import type { TimerStatus } from "../hooks/useTimer";
import type { Penalty } from "../lib/types";

interface TimerDisplayProps {
  status: TimerStatus;
  elapsed: number;
  inspecting: boolean;
  inspectionLeft: number | null;
  hideRunningTime: boolean;
  /** Penalty on the solve that was just recorded. */
  penalty: Penalty;
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
  inspecting,
  inspectionLeft,
  hideRunningTime,
  penalty,
}: TimerDisplayProps) {
  const showCountdown = inspecting && status !== "ready";
  const overInspection = showCountdown && inspectionLeft !== null && inspectionLeft <= 0;
  const warning =
    showCountdown && inspectionLeft !== null && inspectionLeft <= 3 && inspectionLeft > 0;

  const countdown =
    inspectionLeft !== null && inspectionLeft <= 0
      ? "+2"
      : String(Math.max(0, Math.ceil(inspectionLeft ?? 15)));

  const hidden = hideRunningTime && status === "running" && !showCountdown;

  // The solve still on screen keeps its time and penalty until the next attempt
  // takes over. Keyed off the elapsed value rather than the phase so the digits
  // don't change while space is held to arm, which used to flash 0.00 on the way
  // into inspection.
  const settled = !showCountdown && status !== "running" && elapsed > 0;
  const plus2 = settled && penalty === "plus2";
  const dnf = settled && penalty === "dnf";

  const value = showCountdown
    ? countdown
    : plus2
      ? formatTime(elapsed + 2000)
      : formatTime(elapsed);

  const tone = overInspection
    ? "text-bad"
    : warning || plus2
      ? "text-warn"
      : dnf
        ? "text-bad"
        : status === "ready"
          ? "text-good"
          : "text-chalk";

  const caption = showCountdown ? "inspection" : plus2 ? "+2" : dnf ? "DNF" : "";
  const armed = status === "ready";
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
            : `Timer ${formatTime(elapsed)}${plus2 ? ", plus two penalty" : dnf ? ", did not finish" : ""}`
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
          longValue
            ? "text-[clamp(4.4rem,min(26.4cqw,33svh),13.5rem)] sm:text-[clamp(4.15rem,min(25.4cqw,33svh),13.5rem)]"
            : "text-[clamp(5.4rem,min(30.8cqw,37svh),15.4rem)] sm:text-[clamp(4.9rem,min(28.9cqw,37svh),15.4rem)]",
          armed && "scale-[1.045]",
          tone,
        )}
      >
        <span className={cn(hidden && "text-ink-500")}>{hidden ? "solve" : value}</span>
      </div>
    </div>
  );
}
