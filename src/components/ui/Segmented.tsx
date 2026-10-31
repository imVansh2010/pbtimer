import { cn } from "../../lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

const selectedClass = "bg-accent-soft text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  label,
  size = "md",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-ink-900/80 p-0.5",
        disabled && "opacity-45",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative cursor-pointer rounded-[9px] font-medium transition-[background-color,color,box-shadow] duration-150",
              "disabled:cursor-not-allowed",
              size === "sm"
                ? "h-6 px-2 text-[10.5px] pointer-coarse:h-9 pointer-coarse:px-3"
                : "h-7 px-3 text-[11.5px] pointer-coarse:h-10 pointer-coarse:px-4",
              selected ? selectedClass : "text-faint hover:text-chalk-dim hover:bg-white/[0.04]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
