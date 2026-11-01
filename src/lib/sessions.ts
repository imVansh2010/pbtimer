import { uid } from "./cn";
import { isPuzzleId } from "./puzzles";
import { readStore, STORAGE_KEYS } from "./storage";
import type { PuzzleId, Session, Solve } from "./types";

/** Sessions are small; this only stops a runaway import from filling storage. */
const MAX_SESSIONS = 400;

/** A name safe for the header, the text export and its `|`-separated metadata. */
export function cleanSessionName(value: unknown, fallback = "Session"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = Array.from(value)
    // Control characters and the `|` that separates the text-log metadata.
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f || char === "|" ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  // Cap by code point, not UTF-16 unit, so an emoji at the limit is never cut
  // into a lone surrogate; a trailing space left by the cut goes with it.
  const capped = Array.from(cleaned).slice(0, 48).join("").trimEnd();
  return capped.length > 0 ? capped : fallback;
}

export function sanitizeSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Partial<Session>;
  if (typeof input.id !== "string" || input.id.length === 0) return null;
  if (!isPuzzleId(input.puzzle)) return null;
  if (typeof input.createdAt !== "number" || !Number.isFinite(input.createdAt)) return null;
  return {
    id: input.id,
    puzzle: input.puzzle,
    name: cleanSessionName(input.name, "Session"),
    createdAt: input.createdAt,
    source: input.source === "import" ? "import" : "timer",
    ...(input.adopted === true ? { adopted: true } : {}),
  };
}

/** The name the pre-session migration used before it became "Session 1". */
const LEGACY_ADOPTED_NAME = "Earlier solves";

export function readSessions(): Session[] {
  const stored = readStore<unknown>(STORAGE_KEYS.sessions, []);
  if (!Array.isArray(stored)) return [];
  const parsed = stored
    .map(sanitizeSession)
    .filter((session): session is Session => session !== null)
    .slice(-MAX_SESSIONS);

  // Solves that predate sessions were once parked in "Earlier solves". They are
  // the user's own solves, so they get a normal name and the timer source.
  const renamed: Session[] = [];
  for (const session of parsed) {
    if (session.name !== LEGACY_ADOPTED_NAME) {
      renamed.push(session);
      continue;
    }
    const index = renamed.filter((entry) => entry.puzzle === session.puzzle).length + 1;
    renamed.push({
      ...session,
      name: formatSessionName(renamed, session.puzzle, index),
      source: "timer",
      adopted: true,
    });
  }
  return renamed;
}

export function readActiveSessions(): Record<string, string> {
  const stored = readStore<unknown>(STORAGE_KEYS.activeSessions, {});
  if (typeof stored !== "object" || stored === null) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value === "string" && isPuzzleId(key)) result[key] = value;
  }
  return result;
}

/** Oldest first, which is the order sessions are listed and counted in. */
export function sessionsForPuzzle(sessions: Session[], puzzle: PuzzleId): Session[] {
  return sessions
    .filter((session) => session.puzzle === puzzle)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function formatSessionName(sessions: Session[], puzzle: PuzzleId, index: number): string {
  const taken = new Set(
    sessions
      .filter((session) => session.puzzle === puzzle)
      .map((session) => session.name.toLowerCase()),
  );
  let next = index;
  while (taken.has(`session ${next}`)) next += 1;
  return `Session ${next}`;
}

export function createSession(puzzle: PuzzleId, sessions: Session[]): Session {
  const count = sessions.filter((session) => session.puzzle === puzzle).length;
  return {
    id: uid(),
    puzzle,
    name: formatSessionName(sessions, puzzle, count + 1),
    createdAt: Date.now(),
    source: "timer",
  };
}

/**
 * The session the panel should show: the one this event last opened, else the
 * newest one. Falls back to null only when the event has never been solved.
 */
export function resolveActiveSession(
  sessions: Session[],
  activeByPuzzle: Record<string, string>,
  puzzle: PuzzleId,
): Session | null {
  const candidates = sessionsForPuzzle(sessions, puzzle);
  if (candidates.length === 0) return null;
  const chosen = activeByPuzzle[puzzle];
  const match = chosen ? candidates.find((session) => session.id === chosen) : undefined;
  return match ?? candidates[candidates.length - 1]!;
}

export function solvesOfSession(solves: Solve[], sessionId: string | undefined): Solve[] {
  if (!sessionId) return [];
  return solves.filter((solve) => solve.sessionId === sessionId);
}

/**
 * Gives session-less solves a home. This is how data written before sessions
 * existed (or arriving from the cloud, which has no session column) becomes
 * browsable instead of invisible: one ordinary named session per event,
 * reused on later passes so a sync cannot pile them up.
 */
export function adoptOrphans(
  solves: Solve[],
  sessions: Session[],
): { solves: Solve[]; sessions: Session[] } | null {
  const known = new Set(sessions.map((session) => session.id));
  const orphans = solves.filter((solve) => !solve.sessionId || !known.has(solve.sessionId));
  if (orphans.length === 0) return null;

  const byPuzzle = new Map<PuzzleId, Solve[]>();
  for (const solve of orphans) {
    const list = byPuzzle.get(solve.puzzle) ?? [];
    list.push(solve);
    byPuzzle.set(solve.puzzle, list);
  }

  const created: Session[] = [];
  const assignment = new Map<string, string>();

  for (const [puzzle, list] of byPuzzle) {
    const existing = sessions.find((session) => session.puzzle === puzzle && session.adopted);
    const sessionId = existing?.id ?? uid();
    if (!existing) {
      const index = sessions.filter((session) => session.puzzle === puzzle).length + 1;
      created.push({
        id: sessionId,
        puzzle,
        name: formatSessionName(sessions, puzzle, index),
        createdAt: Math.min(...list.map((solve) => solve.date)),
        source: "timer",
        adopted: true,
      });
    }
    for (const solve of list) assignment.set(solve.id, sessionId);
  }

  return {
    solves: solves.map((solve) =>
      assignment.has(solve.id) ? { ...solve, sessionId: assignment.get(solve.id)! } : solve,
    ),
    sessions: created.length > 0 ? [...sessions, ...created] : sessions,
  };
}

/** A group of solves from a file, before it becomes a real session. */
export interface ImportGroup {
  puzzle: PuzzleId;
  name: string;
  createdAt: number;
  solves: Solve[];
}

export interface ImportResult {
  sessions: Session[];
  solves: Solve[];
  /** Sessions that were actually created (groups of only duplicates are dropped). */
  created: Session[];
  added: number;
  duplicates: number;
}

/** Two solves with the same event, moment, time, penalty and scramble are one solve. */
function solveSignature(solve: Solve): string {
  return `${solve.puzzle}|${solve.date}|${solve.ms}|${solve.penalty}|${solve.scramble}`;
}

function uniqueSessionName(base: string, puzzle: PuzzleId, sessions: Session[]): string {
  const wanted = cleanSessionName(base, "Imported");
  const taken = new Set(
    sessions
      .filter((session) => session.puzzle === puzzle)
      .map((session) => session.name.toLowerCase()),
  );
  if (!taken.has(wanted.toLowerCase())) return wanted;
  let index = 2;
  while (taken.has(`${wanted} (${index})`.toLowerCase())) index += 1;
  return `${wanted} (${index})`;
}

/**
 * Files imported solves into brand-new sessions of their own, so an import can
 * never blend into the session being timed. Solves already here — by id or by
 * signature — are skipped, which makes importing the same file twice harmless.
 */
export function importGroups(
  state: { sessions: Session[]; solves: Solve[] },
  groups: ImportGroup[],
  limit: number,
): ImportResult {
  const knownIds = new Set(state.solves.map((solve) => solve.id));
  const knownSignatures = new Set(state.solves.map(solveSignature));
  const sessions = [...state.sessions];
  const created: Session[] = [];
  const added: Solve[] = [];
  let duplicates = 0;

  for (const group of groups) {
    const fresh: Solve[] = [];
    for (const solve of group.solves) {
      if (knownIds.has(solve.id) || knownSignatures.has(solveSignature(solve))) {
        duplicates += 1;
        continue;
      }
      knownIds.add(solve.id);
      knownSignatures.add(solveSignature(solve));
      fresh.push(solve);
    }
    if (fresh.length === 0) continue;

    const session: Session = {
      id: uid(),
      puzzle: group.puzzle,
      name: uniqueSessionName(group.name, group.puzzle, sessions),
      createdAt: group.createdAt,
      source: "import",
    };
    sessions.push(session);
    created.push(session);
    added.push(...fresh.map((solve) => ({ ...solve, sessionId: session.id })));
  }

  if (added.length === 0) {
    return { sessions, solves: state.solves, created: [], added: 0, duplicates };
  }

  const merged = [...state.solves, ...added].sort((a, b) => b.date - a.date).slice(0, limit);
  return { sessions, solves: merged, created, added: added.length, duplicates };
}
