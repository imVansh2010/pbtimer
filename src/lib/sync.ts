import type { Penalty, PuzzleId, Solve, Settings } from "./types";
import type { SolveRow } from "./supabase";
import { uid } from "./cn";
import { isPuzzleId } from "./puzzles";
import { sanitizeSettings } from "./settings";

/** Longest scramble accepted from any source; the database enforces this too. */
export const MAX_SCRAMBLE_LENGTH = 600;
/** A solve cannot be longer than a day, same bound as the database check. */
export const MAX_SOLVE_MS = 86_400_000;

/** Same window the `solves.solved_at` column accepts, so nothing is rejected on upload. */
export const MIN_SOLVE_DATE = Date.UTC(2000, 0, 1);
export const MAX_SOLVE_DATE = Date.UTC(2100, 0, 1);

/** Matches the canonical UUID text form, which is what the uuid column accepts. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_SHAPE.test(value);
}

/**
 * Rewrites any id that predates the account feature (or came from an insecure
 * origin) into a UUID, once, so the same solve keeps its cloud identity.
 */
export function ensureSolveIds(solves: Solve[]): { solves: Solve[]; changed: boolean } {
  let changed = false;
  const next = solves.map((solve) => {
    if (isUuid(solve.id)) return solve;
    changed = true;
    return { ...solve, id: uid() };
  });
  return { solves: changed ? next : solves, changed };
}

/** The row shape the `solves` table expects. */
export function toSolveRow(solve: Solve, userId: string): SolveRow {
  return {
    id: solve.id,
    user_id: userId,
    puzzle: solve.puzzle,
    scramble: solve.scramble,
    ms: Math.round(solve.ms),
    penalty: solve.penalty,
    solved_at: new Date(solve.date).toISOString(),
    updated_at: new Date(solveStamp(solve)).toISOString(),
    deleted_at: null,
  };
}

/** Reads a cloud row defensively; anything malformed is dropped, not crashed on. */
export function fromSolveRow(row: SolveRow): RemoteSolve | null {
  const solvedAt = Date.parse(row.solved_at);
  const updatedAt = Date.parse(row.updated_at);
  if (!Number.isFinite(solvedAt)) return null;
  const solve = sanitizeSolve({
    id: row.id,
    ms: row.ms,
    penalty: row.penalty as Penalty,
    scramble: row.scramble,
    puzzle: row.puzzle,
    date: solvedAt,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : solvedAt,
  });
  if (!solve) return null;
  const deletedAt = row.deleted_at ? Date.parse(row.deleted_at) : Number.NaN;
  return { solve, deletedAt: Number.isFinite(deletedAt) ? deletedAt : null };
}
/** The moment a solve last changed: an edit outranks the original time. */
export function solveStamp(solve: Solve): number {
  return typeof solve.updatedAt === "number" && Number.isFinite(solve.updatedAt)
    ? Math.max(solve.updatedAt, solve.date)
    : solve.date;
}

/**
 * Normalises anything that claims to be a solve and rejects what cannot be one.
 * Used on stored data, on rows read from the cloud, and before uploading.
 */
export function sanitizeSolve(value: unknown): Solve | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Partial<Solve>;
  if (!isPuzzleId(input.puzzle)) return null;
  if (typeof input.ms !== "number" || !Number.isFinite(input.ms)) return null;
  if (input.ms <= 0 || input.ms > MAX_SOLVE_MS) return null;
  const penalty: Penalty =
    input.penalty === "plus2" || input.penalty === "dnf" ? input.penalty : "ok";
  if (typeof input.date !== "number" || !Number.isFinite(input.date)) return null;
  if (input.date < MIN_SOLVE_DATE || input.date > MAX_SOLVE_DATE) return null;
  if (typeof input.scramble !== "string") return null;

  const scramble = stripUnsafe(input.scramble, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SCRAMBLE_LENGTH);
  if (scramble.length === 0) return null;

  const id = isUuid(input.id) ? input.id : uid();
  const updatedAt =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : undefined;

  return {
    id,
    ms: Math.round(input.ms),
    penalty,
    scramble,
    puzzle: input.puzzle,
    date: input.date,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  };
}

export interface RemoteSolve {
  solve: Solve;
  /** Set for a row deleted on another device; such rows never come back. */
  deletedAt: number | null;
}

export interface SolveMerge {
  /** What this device should hold afterwards, newest solve first. */
  merged: Solve[];
  /** Solves whose local copy is newer than the cloud copy. */
  upload: Solve[];
  /** Ids deleted locally that the cloud still holds. */
  deleteIds: string[];
}

export function mergeSolves(local: Solve[], remote: RemoteSolve[]): SolveMerge {
  const remoteById = new Map<string, RemoteSolve>();
  for (const entry of remote) remoteById.set(entry.solve.id, entry);

  const merged = new Map<string, Solve>();
  const upload: Solve[] = [];
  const deleteIds: string[] = [];

  for (const solve of local) {
    const match = remoteById.get(solve.id);
    // A deletion anywhere wins, so an old copy on this device cannot resurrect it.
    if (match?.deletedAt != null) continue;
    if (!match) {
      merged.set(solve.id, solve);
      upload.push(solve);
      continue;
    }
    if (solveStamp(solve) > solveStamp(match.solve)) {
      merged.set(solve.id, solve);
      upload.push(solve);
    } else {
      merged.set(solve.id, match.solve);
    }
  }

  for (const entry of remote) {
    const { id } = entry.solve;
    if (merged.has(id)) continue;
    if (entry.deletedAt != null) continue;
    if (local.some((solve) => solve.id === id)) continue;
    merged.set(id, entry.solve);
  }

  return {
    merged: [...merged.values()].sort((a, b) => b.date - a.date),
    upload,
    deleteIds,
  };
}

export interface PreferenceSnapshot {
  settings: Settings;
  puzzle: PuzzleId;
  updatedAt: number;
}

export interface PreferencesMerge extends PreferenceSnapshot {
  /** True when the local copy is the one worth uploading. */
  upload: boolean;
}

export function mergePreferences(
  local: PreferenceSnapshot,
  remote: PreferenceSnapshot | null,
): PreferencesMerge {
  if (!remote) return { ...local, upload: true };
  if (remote.updatedAt > local.updatedAt) {
    return {
      settings: remote.settings,
      puzzle: remote.puzzle,
      updatedAt: remote.updatedAt,
      upload: false,
    };
  }
  return { ...local, upload: true };
}

/** Accepts a cloud preferences row without trusting any of its fields. */
export function readRemotePreferences(
  value: { settings?: unknown; puzzle?: unknown; updated_at?: unknown } | null,
): PreferenceSnapshot | null {
  if (!value) return null;
  const updatedAt =
    typeof value.updated_at === "string" ? Date.parse(value.updated_at) : Number.NaN;
  if (!Number.isFinite(updatedAt)) return null;
  return {
    settings: sanitizeSettings(value.settings),
    puzzle: isPuzzleId(value.puzzle) ? value.puzzle : "333",
    updatedAt,
  };
}

/* ------------------------------------------------------------------ names -- */

/**
 * Display names can come from Google, from an email local part, or from a field
 * someone typed into another device. Control characters, bidi overrides and
 * zero-width joiners are stripped so a name cannot reorder or break the header;
 * the length cap keeps the navbar from growing without bound.
 */
export function sanitizeDisplayName(value: unknown, fallback = "Solver"): string {
  if (typeof value !== "string") return fallback;
  const collapsed = stripUnsafe(value.normalize("NFC")).replace(/\s+/g, " ").trim();
  // Count whole graphemes so an emoji is never cut in half at the cap.
  const cleaned = graphemesOf(collapsed).slice(0, MAX_NAME_GRAPHEMES).join("");
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Longest display name we keep, in visible characters. */
export const MAX_NAME_GRAPHEMES = 40;

/**
 * Removes characters that have no business in a name or a scramble: control
 * codes, zero-width spaces, bidi overrides and byte-order marks. A name can be
 * emoji or any script; it just cannot reorder or break the layout around it.
 *
 * Zero-width joiners (U+200C, U+200D) are *kept*: they are how a family emoji or
 * a Devanagari ligature is spelled, and removing them visibly mangles the name.
 * They cannot reorder text, which is the attack that matters here.
 */
function stripUnsafe(value: string, replacement = ""): string {
  let clean = "";
  for (const char of value) {
    clean += isUnsafe(char) ? replacement : char;
  }
  return clean;
}

function isUnsafe(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    code < 0x20 ||
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f) ||
    code === 0x200b ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/**
 * Avatar text: the first letter of two words ("VA"), one letter for a single
 * word, and a whole emoji where that is what the name starts with — never half
 * of a surrogate pair.
 */
export function initialsFor(name: string, fallback = "?"): string {
  const cleaned = sanitizeDisplayName(name, "");
  if (cleaned.length === 0) return fallback;
  const words = cleaned.split(" ");
  const first = graphemesOf(words[0]!)[0];
  if (!first) return fallback;
  if (!/[\p{L}\p{N}]/u.test(first)) return first.toUpperCase();
  const nextWord = words[1];
  if (nextWord) {
    const second = graphemesOf(nextWord)[0];
    if (second && /[\p{L}\p{N}]/u.test(second)) return (first + second).toUpperCase();
  }
  return first.toUpperCase();
}

function graphemesOf(value: string): string[] {
  const segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string,
        options?: { granularity: string },
      ) => {
        segment(input: string): Iterable<{ segment: string }>;
      };
    }
  ).Segmenter;
  if (segmenter) {
    try {
      return Array.from(
        new segmenter(undefined, { granularity: "grapheme" }).segment(value),
        (part) => part.segment,
      );
    } catch {
      // fall through to the code point split
    }
  }
  return Array.from(value);
}

/** Name shown for an account: the Google profile name, else the email prefix. */
export function accountName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.full_name, metadata.name, metadata.display_name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return sanitizeDisplayName(candidate);
    }
  }
  const email = typeof user.email === "string" ? user.email : "";
  const local = email.split("@")[0] ?? "";
  return sanitizeDisplayName(local, "Solver");
}

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
