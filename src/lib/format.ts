/** Format milliseconds as a WCA-style time: 9.87, 12.34, 1:02.55, DNF. */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms)) return "DNF";
  const total = Math.max(0, Math.floor(ms));
  const centis = Math.floor(total / 10) % 100;
  const totalSeconds = Math.floor(total / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const cc = String(centis).padStart(2, "0");

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${cc}`;
  }
  return `${seconds}.${cc}`;
}

/** Format an average or stat, where null means "not enough solves". */
export function formatStat(value: number | null): string {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return "DNF";
  return formatTime(value);
}

/**
 * Reads a time typed into the timer field. A dot means seconds (12.34), a
 * colon means minutes and seconds (1:02.55), and bare digits are milliseconds,
 * the way a stackmat shows them. Rounded to the hundredth the app records,
 * or null when the text is not a time.
 */
export function parseTypedTime(input: string): number | null {
  const text = input.trim();
  if (text === "") return null;

  let ms: number;

  if (text.includes(":")) {
    const match = /^(\d+):(\d+(?:\.\d*)?)$/.exec(text);
    if (!match) return null;
    ms = (Number(match[1]) * 60 + Number(match[2])) * 1000;
  } else if (text.includes(".")) {
    if (text === "." || !/^\d*\.\d*$/.test(text)) return null;
    ms = Number(text) * 1000;
  } else {
    if (!/^\d+$/.test(text)) return null;
    ms = Number(text);
  }

  const rounded = Math.round(ms / 10) * 10;
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  return rounded;
}

/** Full time including thousandths, used in the text export. */
export function formatPreciseTime(ms: number): string {
  if (!Number.isFinite(ms)) return "DNF";
  return `${formatTime(ms)}${String(Math.floor(ms) % 10)}`;
}

export function formatClock(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatDate(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} · ${formatClock(ts)}`;
}

/** Human readable total time, e.g. "1h 12m". */
export function formatTotalTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
