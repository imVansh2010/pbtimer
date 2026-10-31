export const STORAGE_KEYS = {
  solves: "pbtimer.solves.v1",
  settings: "pbtimer.settings.v1",
  puzzle: "pbtimer.puzzle.v1",
  panel: "pbtimer.panel.v1",
  cubeNet: "pbtimer.cubeNet.v1",
  /** Marker for when settings or the puzzle last changed, compared with the cloud. */
  preferencesAt: "pbtimer.preferencesAt.v1",
  /** Deletions that have not reached the cloud yet. */
  deletions: "pbtimer.deletions.v1",
  /** Which account this browser last synced, and when. */
  sync: "pbtimer.sync.v1",
  /** Solves set aside when a different account signs in on this browser. */
  previousSolves: "pbtimer.solves.previous.v1",
} as const;

/** Keys used before the rename, read once so no existing session is lost. */
const LEGACY_KEYS: Record<string, string> = {
  [STORAGE_KEYS.solves]: "cube-timer.solves.v1",
  [STORAGE_KEYS.settings]: "cube-timer.settings.v1",
  [STORAGE_KEYS.puzzle]: "cube-timer.puzzle.v1",
};

export function readStore<T>(key: string, fallback: T): T {
  try {
    const legacy = LEGACY_KEYS[key];
    const raw =
      window.localStorage.getItem(key) ?? (legacy ? window.localStorage.getItem(legacy) : null);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota) — the app still works.
  }
}
