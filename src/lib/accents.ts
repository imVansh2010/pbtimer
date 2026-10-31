export interface AccentPalette {
  id: string;
  label: string;
  /** Primary signal colour. */
  base: string;
  /** Lighter tone for hover and highlights. */
  strong: string;
  /** Solid, low-luminance button surface. */
  soft: string;
  /** Border and hover lift for soft surfaces. */
  line: string;
}

export const ACCENTS: AccentPalette[] = [
  {
    id: "blue",
    label: "Blue",
    base: "#4c8dff",
    strong: "#7aa9ff",
    soft: "#142138",
    line: "#294165",
  },
  {
    id: "violet",
    label: "Violet",
    base: "#a78bfa",
    strong: "#c4b0ff",
    soft: "#1f1a33",
    line: "#3d3163",
  },
  {
    id: "emerald",
    label: "Emerald",
    base: "#35d39a",
    strong: "#63e3b5",
    soft: "#10261e",
    line: "#225242",
  },
  {
    id: "amber",
    label: "Amber",
    base: "#f0b34a",
    strong: "#ffc96f",
    soft: "#291f11",
    line: "#584422",
  },
  {
    id: "rose",
    label: "Rose",
    base: "#f2595f",
    strong: "#ff8589",
    soft: "#2a1518",
    line: "#5a2a2f",
  },
  {
    id: "cyan",
    label: "Cyan",
    base: "#22d3ee",
    strong: "#63e3f6",
    soft: "#0f252b",
    line: "#1f4b56",
  },
];

export const DEFAULT_ACCENT = "blue";

export function isAccentId(value: unknown): value is string {
  return typeof value === "string" && ACCENTS.some((accent) => accent.id === value);
}

export function accentById(id: string): AccentPalette {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0]!;
}

/** Rewrites the four accent custom properties used by every accent utility. */
export function applyAccent(id: string): void {
  const accent = accentById(id);
  const root = document.documentElement;
  root.style.setProperty("--color-accent", accent.base);
  root.style.setProperty("--color-accent-strong", accent.strong);
  root.style.setProperty("--color-accent-soft", accent.soft);
  root.style.setProperty("--color-accent-line", accent.line);
}
