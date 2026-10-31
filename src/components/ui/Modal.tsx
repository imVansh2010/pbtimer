import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** `lg` is for the one dialog with a tab strip under the title. */
  titleSize?: "md" | "lg";
}

const titleSizes = {
  md: "text-[16px] sm:text-[15px]",
  lg: "text-[19px] sm:text-[18px]",
};

const widths = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Matches the exit animation in `index.css` plus a frame of slack. */
const EXIT_MS = 200;

/* Two dialogs overlap for the length of an exit animation (opening Export from
   Settings, say), so the scroll lock is reference counted — otherwise the
   outgoing dialog would hand the page back its scrollbar underneath the new one. */
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll(): () => void {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;

  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
  };
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  titleSize = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // `visible` keeps the panel mounted through its exit animation; `exiting`
  // swaps the animation classes. Both are driven only by `open`, so a render
  // can never restart or skip the transition.
  const [visible, setVisible] = useState(open);
  const [exiting, setExiting] = useState(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Closing must not depend on the caller passing a fresh callback.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
      return;
    }
    if (!visibleRef.current) return;

    setExiting(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Focus and scroll are only released once the panel is really gone, so the
  // page behind never scrolls or takes focus while the exit still plays.
  useEffect(() => {
    if (open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const release = lockScroll();
      const frame = requestAnimationFrame(() => panelRef.current?.focus());

      return () => {
        cancelAnimationFrame(frame);
        release();
      };
    }

    if (visible) return;
    triggerRef.current?.focus({ preventScroll: true });
    triggerRef.current = null;
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === panel)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!visible) return null;

  return createPortal(
    <div
      className={cn(
        // Phone sheets keep a margin on every side: edge-to-edge they read as
        // too wide, and the bottom inset has to clear the home indicator.
        "fixed inset-0 z-50 flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6",
        exiting && "pointer-events-none",
      )}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-sm",
          exiting ? "animate-fade-out" : "animate-fade-in",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "panel relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900",
          // Slightly shorter than a desktop dialog on a phone: the viewport is
          // shorter, and a sheet that nearly fills it leaves no sense of the
          // page behind it.
          "max-h-[88svh] sm:max-h-[92dvh]",
          exiting ? "animate-panel-out" : "animate-panel-in",
          widths[size],
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.055] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className={cn("font-semibold tracking-[-0.01em] text-chalk", titleSizes[titleSize])}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-[12px] leading-4 text-faint sm:text-[11.5px]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-white/[0.06] hover:text-chalk pointer-coarse:size-11 sm:size-7"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/[0.055] px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
