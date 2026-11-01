import { isPuzzleId } from "./puzzles";
import { cleanSessionName, sanitizeSession, type ImportGroup } from "./sessions";
import { sanitizeSolve } from "./sync";
import type { Penalty, PuzzleId } from "./types";

export interface ParsedImport {
  groups: ImportGroup[];
  /** Entries that were not solves, were duplicated, or were impossible to place. */
  rejected: number;
}

/** `9.870`, `9.87` or `1:02.555` back to milliseconds. */
function parseLogTime(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2})\.(\d{2,3})$/.exec(value.trim());
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  const fraction = Number(match[3]!.padEnd(3, "0"));
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(fraction)) {
    return null;
  }
  return minutes * 60_000 + seconds * 1000 + fraction;
}

/**
 * A stable id for a log row, which carries no id of its own. Two imports of the
 * same log produce the same ids, and the merge then recognises the repeats.
 * Four salted 32-bit hashes give a UUID-shaped value the database will accept.
 */
function stableId(seed: string): string {
  const hash = (text: string, salt: number): number => {
    let value = salt >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value >>> 0;
  };
  const hex = [1, 2, 3, 4]
    .map((salt) => hash(seed, Math.imul(salt, 0x9e3779b1)).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/* ------------------------------------------------------------------- JSON -- */

interface RawSessionMeta {
  puzzle: PuzzleId;
  name: string;
  createdAt: number;
}

function parseJsonBackup(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const record =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as { solves?: unknown; sessions?: unknown })
      : null;
  const list = Array.isArray(data)
    ? data
    : record && Array.isArray(record.solves)
      ? record.solves
      : null;
  if (!list) throw new Error("That file isn't a pbtimer backup.");

  const metaById = new Map<string, RawSessionMeta>();
  if (record && Array.isArray(record.sessions)) {
    for (const entry of record.sessions) {
      const session = sanitizeSession(entry);
      if (session) {
        metaById.set(session.id, {
          puzzle: session.puzzle,
          name: session.name,
          createdAt: session.createdAt,
        });
      }
    }
  }

  const groups = new Map<string, ImportGroup>();
  const seen = new Set<string>();
  let rejected = 0;

  for (const entry of list) {
    const solve = sanitizeSolve(entry);
    if (!solve || seen.has(solve.id)) {
      rejected += 1;
      continue;
    }
    seen.add(solve.id);

    const meta = solve.sessionId ? metaById.get(solve.sessionId) : undefined;
    const key = meta ? `session:${solve.sessionId}` : `puzzle:${solve.puzzle}`;
    const group = groups.get(key) ?? {
      puzzle: meta?.puzzle ?? solve.puzzle,
      name: meta?.name ?? "Imported solves",
      createdAt: meta?.createdAt ?? solve.date,
      solves: [],
    };
    group.createdAt = Math.min(group.createdAt, solve.date);
    group.solves.push(solve);
    groups.set(key, group);
  }

  return { groups: [...groups.values()], rejected };
}

/* -------------------------------------------------------------------- log -- */

const SESSION_LINE = /^session:\s*([a-z0-9]+)\s*\|(.*)\|(\S+)\s*$/i;
const ROW_LINE = /^\s*\d+\s+(\S+)\s+(OK|\+2|DNF)\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(\S.*)$/;

function parseLog(text: string): ParsedImport {
  const groups: ImportGroup[] = [];
  let rejected = 0;
  let current: ImportGroup | null = null;

  for (const line of text.split(/\r?\n/)) {
    const sessionMatch = SESSION_LINE.exec(line.trim());
    if (sessionMatch) {
      const puzzle = sessionMatch[1]!.toLowerCase();
      const started = Date.parse(sessionMatch[3]!);
      if (!isPuzzleId(puzzle) || !Number.isFinite(started)) {
        current = null;
        rejected += 1;
        continue;
      }
      current = {
        puzzle,
        name: cleanSessionName(sessionMatch[2], "Imported"),
        createdAt: started,
        solves: [],
      };
      groups.push(current);
      continue;
    }

    const rowMatch = ROW_LINE.exec(line);
    if (!rowMatch) continue;
    if (!current) {
      rejected += 1;
      continue;
    }

    const ms = parseLogTime(rowMatch[1]!);
    const date = Date.parse(rowMatch[3]!);
    if (ms === null || !Number.isFinite(date)) {
      rejected += 1;
      continue;
    }

    const token = rowMatch[2]!;
    const penalty: Penalty = token === "+2" ? "plus2" : token === "DNF" ? "dnf" : "ok";
    // A +2 line prints the raw time, so the stored milliseconds need no undo.
    const scramble = rowMatch[4]!.replace(/ \/ /g, " ").trim();
    const id = stableId(`${current.puzzle}|${date}|${ms}|${penalty}|${scramble}`);
    const solve = sanitizeSolve({
      id,
      ms,
      penalty,
      scramble,
      puzzle: current.puzzle,
      date,
    });
    if (!solve) {
      rejected += 1;
      continue;
    }
    current.solves.push(solve);
  }

  const filled = groups.filter((group) => group.solves.length > 0);
  for (const group of filled) {
    group.solves.sort((a, b) => a.date - b.date);
  }
  return { groups: filled, rejected };
}

/**
 * Reads either file this app can write: the `.json` backup, or the `.txt` log.
 * Both come back as groups of solves that are ready to become sessions.
 */
export function parseImportFile(text: string): ParsedImport {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error("That file is empty.");

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonBackup(trimmed);
  }

  const parsed = parseLog(trimmed);
  if (parsed.groups.length === 0) {
    const hasRows = trimmed.split(/\r?\n/).some((line) => ROW_LINE.test(line));
    throw new Error(
      hasRows
        ? "That log is missing its session headers, so the event of each solve is unknown."
        : "That file isn't a pbtimer log or backup.",
    );
  }
  return parsed;
}
