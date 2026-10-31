import { computeStats, effectiveMs } from "./stats";
import { formatDate, formatPreciseTime, formatTime } from "./format";
import { PUZZLE_GROUPS, puzzleById } from "./puzzles";
import type { Solve } from "./types";

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

function formatMaybe(value: number | null): string {
  if (value === null) return "—";
  if (!Number.isFinite(value)) return "DNF";
  return formatTime(value);
}

/** Plain-text log grouped by puzzle, with the same penalties shown in the UI. */
export function buildExportText(solves: Solve[]): string {
  const lines: string[] = [];

  lines.push("PBTIMER — SOLVE LOG");
  lines.push(`${formatDate(Date.now())} · ${solves.length} solve${solves.length === 1 ? "" : "s"}`);
  lines.push("");

  if (solves.length === 0) {
    lines.push("No solves recorded yet.");
    return lines.join("\n");
  }

  for (const group of PUZZLE_GROUPS) {
    for (const item of group.items) {
      // `solves` is newest-first, which is what the stats helpers expect.
      const puzzleSolves = solves.filter((solve) => solve.puzzle === item.id);
      if (puzzleSolves.length === 0) continue;

      const stats = computeStats(puzzleSolves);
      const chronological = [...puzzleSolves].reverse();

      lines.push("────────────────────────────────────────────────────────");
      lines.push(`${puzzleById(item.id).short.toUpperCase()} — ${puzzleSolves.length} solves`);
      lines.push("");
      lines.push(
        `${padStart("#", 4)}  ${pad("TIME", 11)}${pad("PEN", 5)}${pad("CLOCK", 7)}SCRAMBLE`,
      );

      chronological.forEach((solve, index) => {
        const number = padStart(String(index + 1), 4);
        const time = pad(formatTime(effectiveMs(solve)), 11);
        const penalty = solve.penalty === "plus2" ? "+2" : solve.penalty === "dnf" ? "DNF" : "OK";
        const clock = pad(new Date(solve.date).toTimeString().slice(0, 5), 7);
        const scramble = solve.scramble.replace(/\n/g, " / ");
        lines.push(`${number}  ${time}${pad(penalty, 5)}${clock}${scramble}`);
      });

      lines.push("");
      lines.push("  STATS");
      lines.push(`    best single   ${stats.best !== null ? formatPreciseTime(stats.best) : "—"}`);
      lines.push(`    best ao5      ${formatMaybe(stats.bestAo5)}`);
      lines.push(`    best ao12     ${formatMaybe(stats.bestAo12)}`);
      lines.push(`    mean          ${formatMaybe(stats.mean)}`);
      lines.push(`    current ao5   ${formatMaybe(stats.ao5)}`);
      lines.push(`    current ao12  ${formatMaybe(stats.ao12)}`);
      lines.push(`    DNFs          ${stats.dnfCount} of ${stats.count}`);
      lines.push("");
    }
  }

  const session = computeStats(solves);
  lines.push("────────────────────────────────────────────────────────");
  lines.push(`Best single:    ${formatMaybe(session.best)}`);
  lines.push(`Session mean:   ${formatMaybe(session.mean)}`);
  lines.push(`Solves:         ${session.count}`);
  lines.push("Exported from pbtimer");

  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Everything needed to restore a session elsewhere, with nothing reformatted. */
export function buildBackupJson(solves: Solve[]): string {
  return JSON.stringify(
    { app: "pbtimer", version: 1, exportedAt: new Date().toISOString(), solves },
    null,
    2,
  );
}

function dateStamp(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function exportFilename(): string {
  return `pbtimer-${dateStamp()}.txt`;
}

export function backupFilename(): string {
  return `pbtimer-backup-${dateStamp()}.json`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
