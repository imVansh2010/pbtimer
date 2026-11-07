/** Inter's tabular figures advance about 0.6em; the timer tracks them tighter. */
const GLYPH_EM = 0.62;
/** A little slack, so the last glyph has margin rather than landing on it. */
const SLACK = 0.97;

interface FitOptions {
  /** Width in pixels that siblings in the same row take up. */
  reserve?: number;
  /** Caps the result, so short numbers keep the size the design asks for. */
  max?: string;
}

/**
 * A font size that keeps a run of digits inside its container however many
 * digits it has, so a time like 5482:13.53 shrinks to fit its card instead of
 * spilling out of it. The element must sit inside a query container, which the
 * `@container` class provides.
 */
export function fitDigits(text: string, { reserve = 0, max }: FitOptions = {}): string {
  const chars = Math.max(1, text.length);
  const available = reserve > 0 ? `(100cqw - ${reserve}px)` : "100cqw";
  const sized = `calc(${available} * ${(SLACK / (GLYPH_EM * chars)).toFixed(4)})`;
  return max ? `min(${max}, ${sized})` : sized;
}
