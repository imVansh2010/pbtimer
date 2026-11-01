import { computeStats } from "./stats";
import { formatDate, formatPreciseTime, formatStat, formatTotalTime } from "./format";
import { puzzleById } from "./puzzles";
import type { Session, Solve } from "./types";

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const RULE = "────────────────────────────────────────────────────────────";

/** Where the text log and the backup meet: solves grouped into session-sized blocks. */
function exportGroups(
  sessions: Session[],
  solves: Solve[],
): Array<{ session: Session; solves: Solve[] }> {
  const known = new Set(sessions.map((session) => session.id));
  const bySession = new Map<string, Solve[]>();
  const orphans = new Map<Solve["puzzle"], Solve[]>();

  // One pass over the solves; filtering the whole list once per session was
  // quadratic and did not need to be.
  for (const solve of solves) {
    const sessionId = solve.sessionId;
    if (sessionId && known.has(sessionId)) {
      const owned = bySession.get(sessionId);
      if (owned) owned.push(solve);
      else bySession.set(sessionId, [solve]);
    } else {
      const unsorted = orphans.get(solve.puzzle);
      if (unsorted) unsorted.push(solve);
      else orphans.set(solve.puzzle, [solve]);
    }
  }

  const groups: Array<{ session: Session; solves: Solve[] }> = [];
  for (const session of [...sessions].sort((a, b) => a.createdAt - b.createdAt)) {
    const owned = bySession.get(session.id);
    if (!owned) continue;
    groups.push({ session, solves: owned.sort((a, b) => a.date - b.date) });
  }

  // Defensive: a solve whose session went missing is still worth exporting.
  for (const [puzzle, unsorted] of orphans) {
    groups.push({
      session: {
        id: "unsorted",
        puzzle,
        name: "Unsorted solves",
        createdAt: unsorted[0]!.date,
        source: "import",
      },
      solves: unsorted.sort((a, b) => a.date - b.date),
    });
  }

  return groups;
}

/**
 * Plain-text log grouped by session. Every line carries enough to rebuild the
 * solve — raw time, penalty, exact moment and scramble — so the same file can
 * be imported again, which is what the header promises.
 */
export function buildExportText(sessions: Session[], solves: Solve[]): string {
  const lines: string[] = [];

  lines.push("PBTIMER — SOLVE LOG");
  lines.push(
    `${formatDate(Date.now())} · ${plural(solves.length, "solve")} · ${plural(sessions.length, "session")}`,
  );
  lines.push("format: pbtimer-log/2");
  lines.push("TIME is the raw time, PEN is the penalty applied.");
  lines.push("Import this file from Settings → Data to restore it as new sessions.");
  lines.push("");

  const groups = exportGroups(sessions, solves);

  if (groups.length === 0) {
    lines.push("No solves recorded yet.");
    return lines.join("\n");
  }

  for (const group of groups) {
    const { session, solves: sessionSolves } = group;
    const stats = computeStats([...sessionSolves].reverse());

    lines.push(RULE);
    lines.push(
      `${session.name} · ${puzzleById(session.puzzle).label} · started ${formatDate(session.createdAt)}`,
    );
    lines.push(
      `session: ${session.puzzle}|${session.name}|${new Date(session.createdAt).toISOString()}`,
    );
    lines.push(RULE);
    lines.push("");
    lines.push(
      `${padStart("#", 4)}  ${pad("TIME", 10)}${pad("PEN", 6)}${pad("SOLVED AT", 28)}SCRAMBLE`,
    );

    sessionSolves.forEach((solve, index) => {
      const number = padStart(String(index + 1), 4);
      // Thousandths, so importing the log restores the exact time.
      const time = pad(formatPreciseTime(solve.ms), 10);
      const penalty = solve.penalty === "plus2" ? "+2" : solve.penalty === "dnf" ? "DNF" : "OK";
      const moment = pad(new Date(solve.date).toISOString(), 28);
      const scramble = solve.scramble.replace(/\n/g, " / ");
      lines.push(`${number}  ${time}${pad(penalty, 6)}${moment}${scramble}`);
    });

    lines.push("");
    lines.push("  STATS");
    lines.push(`    best single   ${stats.best !== null ? formatPreciseTime(stats.best) : "—"}`);
    lines.push(`    best ao5      ${formatStat(stats.bestAo5)}`);
    lines.push(`    best ao12     ${formatStat(stats.bestAo12)}`);
    lines.push(`    mean          ${formatStat(stats.mean)}`);
    lines.push(`    current ao5   ${formatStat(stats.ao5)}`);
    lines.push(`    current ao12  ${formatStat(stats.ao12)}`);
    lines.push(`    DNFs          ${stats.dnfCount} of ${stats.count}`);
    lines.push("");
  }

  const total = computeStats(solves);
  lines.push(RULE);
  lines.push(
    `All sessions · best ${formatStat(total.best)} · mean ${formatStat(total.mean)} · ${plural(
      total.count,
      "solve",
    )}`,
  );
  lines.push(`Total time: ${formatTotalTime(total.totalMs)} (sum of valid solves)`);
  lines.push("Exported from pbtimer");

  return lines.join("\n");
}

export function downloadText(
  filename: string,
  text: string,
  type = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface BackupBundle {
  app: "pbtimer";
  version: 2;
  exportedAt: string;
  sessions: Session[];
  solves: Solve[];
}

/** Everything needed to restore sessions and solves elsewhere, nothing reformatted. */
export function buildBackupJson(sessions: Session[], solves: Solve[]): string {
  const bundle: BackupBundle = {
    app: "pbtimer",
    version: 2,
    exportedAt: new Date().toISOString(),
    sessions,
    solves,
  };
  return JSON.stringify(bundle, null, 2);
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
