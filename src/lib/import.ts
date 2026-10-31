import { sanitizeSolve } from "./sync";
import type { Solve } from "./types";

export interface ParsedBackup {
  solves: Solve[];
  /** Entries that were not solves, duplicated, or impossible. */
  rejected: number;
}

/**
 * Reads a backup written by this app: either the object the download produces
 * or a bare array of solves. Every entry goes through the same validator the
 * cloud rows do, so a hand-edited or damaged file cannot inject anything.
 */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const list = Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        Array.isArray((data as { solves?: unknown }).solves)
      ? (data as { solves: unknown[] }).solves
      : null;
  if (!list) throw new Error("That file isn't a pbtimer backup.");

  const solves: Solve[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const entry of list) {
    const solve = sanitizeSolve(entry);
    if (!solve || seen.has(solve.id)) {
      rejected += 1;
      continue;
    }
    seen.add(solve.id);
    solves.push(solve);
  }

  solves.sort((a, b) => b.date - a.date);
  return { solves, rejected };
}

export interface ImportMerge {
  solves: Solve[];
  added: number;
  duplicates: number;
}

/** Adds imported solves to the ones already here, skipping ids already known. */
export function mergeImported(existing: Solve[], imported: Solve[], limit: number): ImportMerge {
  const byId = new Map(existing.map((solve) => [solve.id, solve]));
  let added = 0;
  let duplicates = 0;

  for (const solve of imported) {
    if (byId.has(solve.id)) {
      duplicates += 1;
      continue;
    }
    byId.set(solve.id, solve);
    added += 1;
  }

  const merged = [...byId.values()].sort((a, b) => b.date - a.date).slice(0, limit);
  return { solves: merged, added, duplicates };
}
