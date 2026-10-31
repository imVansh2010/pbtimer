import { memo, useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { IconButton } from "./ui/Button";
import { copyText } from "../lib/export";
import { cn } from "../lib/cn";

interface ScrambleBarProps {
  scramble: string;
  loading: boolean;
  puzzleLabel: string;
  onNext: () => void;
  /** Fades the block back while the timer is being armed or inspected. */
  dimmed?: boolean;
}

export const ScrambleBar = memo(function ScrambleBar({
  scramble,
  loading,
  puzzleLabel,
  onNext,
  dimmed = false,
}: ScrambleBarProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!scramble) return;
    const ok = await copyText(scramble);
    if (ok) setCopied(true);
  }

  // 4×4 and up, Megaminx and Square-1 produce scrambles several times the
  // length of a 3×3's, which used to wrap into a tall stack and shove the timer
  // down the page. Those get a wider column and a step down in type size, so
  // they spread out instead of growing taller. Keyed off character count rather
  // than the puzzle id so imported or unusual scrambles adapt the same way.
  const length = scramble.length;
  const density: "base" | "long" | "dense" = length > 170 ? "dense" : length > 90 ? "long" : "base";

  const width = {
    base: "max-w-3xl",
    long: "max-w-4xl",
    dense: "max-w-5xl",
  }[density];

  const type = {
    base: "text-[19.5px] leading-[1.5] sm:text-[24.5px] sm:leading-[1.55]",
    long: "text-[17.5px] leading-[1.45] sm:text-[21.5px] sm:leading-[1.5]",
    dense: "text-[15.5px] leading-[1.4] sm:text-[18.5px] sm:leading-[1.45]",
  }[density];

  return (
    <section
      className={cn(
        "px-3 pt-3 transition-opacity duration-200 sm:px-6 sm:pt-5",
        dimmed && "pointer-events-none opacity-[0.12]",
      )}
    >
      <div className={cn("mx-auto w-full", width)}>
        <div className="mb-1.5 flex items-center justify-between pl-0.5">
          <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-faint">
            Scramble · {puzzleLabel}
          </span>
          <div className="flex items-center gap-0.5">
            <IconButton
              label={copied ? "Scramble copied" : "Copy scramble"}
              size="icon-xs"
              onClick={handleCopy}
              disabled={loading || !scramble}
            >
              {copied ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
            </IconButton>
            <IconButton label="New scramble (N)" size="icon-xs" onClick={onNext}>
              <RefreshCw className="size-3.5" />
            </IconButton>
          </div>
        </div>

        <div
          className={cn(
            "panel flex min-h-[60px] items-center justify-center rounded-xl border border-white/[0.055] bg-ink-900/55 px-3 py-3",
            "sm:min-h-[74px] sm:px-5 sm:py-3.5",
          )}
        >
          {loading || !scramble ? (
            <div className="flex w-full flex-col items-center gap-2" aria-hidden="true">
              <span className="h-2.5 w-[76%] animate-pulse rounded-full bg-white/[0.06]" />
              <span className="h-2.5 w-[48%] animate-pulse rounded-full bg-white/[0.04]" />
            </div>
          ) : (
            <p
              className={cn(
                "whitespace-pre-line text-center tracking-[0.02em] text-chalk",
                density === "base" ? "text-balance" : "text-pretty",
                type,
              )}
            >
              {scramble}
            </p>
          )}
        </div>
      </div>
    </section>
  );
});
