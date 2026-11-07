import { useRef, useState, type RefObject } from "react";
import { cn } from "../lib/cn";
import { fitDigits } from "../lib/fit";
import { parseTypedTime } from "../lib/format";

interface TypeInTimerProps {
  /** App owns the ref so a click anywhere on the stage can put the caret back. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** A recorded time, already rounded by the parser. */
  onSubmit: (ms: number) => void;
  /** A dialog is open, which owns the keys. */
  disabled?: boolean;
}

/**
 * The timer field when "type your time in" is on. It looks and sits where the
 * digits do, so the page does not move; Enter records a solve and clears the
 * field for the next one.
 */
export function TypeInTimer({ inputRef, onSubmit, disabled = false }: TypeInTimerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? fallbackRef;

  function submit() {
    const ms = parseTypedTime(text);
    if (ms === null) {
      setError(text.trim() !== "");
      return;
    }
    onSubmit(ms);
    setText("");
    setError(false);
    ref.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full"
    >
      <input
        ref={ref}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(false);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            setText("");
            setError(false);
          }
        }}
        disabled={disabled}
        aria-label="Type a solve time"
        aria-invalid={error}
        aria-describedby={error ? "typed-time-error" : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="decimal"
        className={cn(
          // The same type as the digits, scaled to fit a longer typed string.
          "w-full bg-transparent py-1 text-center font-sans font-normal leading-[1.1] tracking-[-0.03em] tabular-nums",
          "pr-[0.03em] caret-accent outline-none placeholder:text-ink-500",
          error ? "text-bad" : "text-chalk",
          disabled && "opacity-45",
        )}
        // Shrinks as the string grows, so a long time typed in stays inside the
        // field rather than scrolling its own digits out of sight.
        style={{ fontSize: fitDigits(text || "0.00", { max: "min(9rem, 24svh, 17cqw)" }) }}
      />
      <p
        id="typed-time-error"
        role="alert"
        className={cn(
          "mt-1.5 h-4 text-center text-[10px] font-medium uppercase tracking-[0.22em]",
          error ? "text-bad" : "text-transparent",
        )}
      >
        {error ? "not a time — try 12.34 or 1234" : "time"}
      </p>
    </form>
  );
}
