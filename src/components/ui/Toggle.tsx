import { cn } from "../../lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-3 sm:py-3.5",
        disabled && "opacity-40",
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-chalk">{label}</div>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-faint">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 cursor-pointer rounded-full border transition-colors duration-200",
          "disabled:cursor-not-allowed",
          // The switch is smaller than a comfortable thumb target, so an
          // invisible padded area around it catches the tap instead.
          "before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:-inset-3",
          checked ? "border-accent/50 bg-accent/85" : "border-white/[0.08] bg-ink-700",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
