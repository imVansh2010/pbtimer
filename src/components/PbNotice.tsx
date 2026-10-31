import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

export interface PbEvent {
  /** Changes on every personal best so a repeat can retrigger the animation. */
  id: number;
  ms: number;
}

const HOLD_MS = 2800;
const EXIT_MS = 180;

/**
 * Spans the header and fades in on a personal best: in, hold for a beat, out.
 * Rendered inside the header rather than over it, so the notice never covers a
 * control the user might be reaching for.
 */
export function PbNotice({ event }: { event: PbEvent | null }) {
  const [shown, setShown] = useState<PbEvent | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setShown(event);
    setLeaving(false);
    const hold = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const clear = window.setTimeout(() => setShown(null), HOLD_MS + EXIT_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(clear);
    };
  }, [event]);

  if (!shown) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-ink-950/95 px-3",
        leaving ? "animate-fade-out" : "animate-fade-in",
      )}
    >
      <span className="text-center text-[clamp(10px,2.6vw,15px)] font-semibold tracking-[0.12em] whitespace-nowrap text-accent uppercase">
        Congratulations on your new PB!
      </span>
    </div>
  );
}
