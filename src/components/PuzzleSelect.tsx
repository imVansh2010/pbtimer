import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { PUZZLE_GROUPS, puzzleById } from "../lib/puzzles";
import type { PuzzleId } from "../lib/types";

interface PuzzleSelectProps {
  value: PuzzleId;
  onChange: (puzzle: PuzzleId) => void;
  disabled?: boolean;
}

const flat = PUZZLE_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

export function PuzzleSelect({ value, onChange, disabled = false }: PuzzleSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedWithKeyboard = useRef(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = puzzleById(value);

  useEffect(() => {
    if (!open) return;
    const index = flat.findIndex((item) => item.id === value);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open, value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(id: PuzzleId) {
    onChange(id);
    setOpen(false);
    // Only keyboard users need focus handed back — restoring it after a mouse
    // pick would leave Space bound to this button instead of the timer.
    if (openedWithKeyboard.current) triggerRef.current?.focus();
    openedWithKeyboard.current = false;
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Space is the timer key globally; keep it inside the menu while it is open.
    if (["ArrowDown", "ArrowUp", "Home", "End", "Escape", " ", "Enter"].includes(event.key)) {
      event.stopPropagation();
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Puzzle: ${selected.label}`}
        disabled={disabled}
        onClick={(event) => {
          openedWithKeyboard.current = event.detail === 0;
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          // Space stays with the timer; Enter and ArrowDown open the menu.
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            openedWithKeyboard.current = true;
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] pl-2.5 pr-2 text-[12px] text-chalk-dim transition-colors",
          "hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-chalk",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.035]",
          "sm:h-8 pointer-coarse:h-9",
        )}
      >
        <span className="font-medium">{selected.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 text-faint transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && !disabled ? (
        <div
          role="listbox"
          aria-label="Puzzle"
          aria-activedescendant={`puzzle-option-${flat[activeIndex]?.id ?? ""}`}
          onKeyDown={onListKeyDown}
          className="panel absolute left-0 top-full z-40 mt-2 w-60 animate-panel-in rounded-xl border border-white/[0.08] bg-ink-850 p-1.5"
        >
          {PUZZLE_GROUPS.map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              <div className="px-2 pb-1 pt-2 text-[9.5px] font-medium uppercase tracking-[0.16em] text-faint">
                {group.label}
              </div>
              {group.items.map((item) => {
                const index = flat.findIndex((entry) => entry.id === item.id);
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    id={`puzzle-option-${item.id}`}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                      isSelected
                        ? "bg-white/[0.07] text-chalk"
                        : "text-muted hover:bg-white/[0.045] hover:text-chalk",
                      index === activeIndex && !isSelected && "bg-white/[0.04]",
                    )}
                  >
                    <span>{item.label}</span>
                    {isSelected ? (
                      <Check className="size-3.5 text-accent" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
