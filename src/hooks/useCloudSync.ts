import { useCallback, useEffect, useRef, useState } from "react";
import { cloudEnabled, supabase } from "../lib/supabase";
import type { SolveRow } from "../lib/supabase";
import { readStore, STORAGE_KEYS, writeStore } from "../lib/storage";
import type { PuzzleId, Settings, Solve } from "../lib/types";
import {
  chunk,
  fromSolveRow,
  mergePreferences,
  mergeSolves,
  readRemotePreferences,
  sanitizeSolve,
  toSolveRow,
} from "../lib/sync";
import type { PreferenceSnapshot, RemoteSolve } from "../lib/sync";

export type SyncStatus = "off" | "idle" | "syncing" | "error";

export interface CloudSyncOptions {
  userId: string | null;
  solves: Solve[];
  settings: Settings;
  puzzle: PuzzleId;
  onApplySolves: (solves: Solve[]) => void;
  onApplyPreferences: (snapshot: PreferenceSnapshot) => void;
}

interface Deletion {
  id: string;
  at: number;
}

interface SyncState {
  userId: string;
  at: number;
}

/** Solves belonging to an account that is not the one signed in right now. */
interface ParkedSolves {
  userId: string;
  solves: Solve[];
}

const PAGE = 500;
const BATCH = 100;
const MAX_DELETIONS = 500;
const RETRY_MS = 5_000;
const PREFS_DEBOUNCE_MS = 700;

function readDeletions(): Deletion[] {
  const stored = readStore<unknown>(STORAGE_KEYS.deletions, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (entry): entry is Deletion =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Deletion).id === "string" &&
      typeof (entry as Deletion).at === "number",
  );
}

function writeDeletions(list: Deletion[]): void {
  writeStore(STORAGE_KEYS.deletions, list.slice(-MAX_DELETIONS));
}

function readSyncState(): SyncState | null {
  const stored = readStore<Partial<SyncState> | null>(STORAGE_KEYS.sync, null);
  if (!stored || typeof stored.userId !== "string" || typeof stored.at !== "number") return null;
  return { userId: stored.userId, at: stored.at };
}

function readParked(): ParkedSolves | null {
  const stored = readStore<unknown>(STORAGE_KEYS.previousSolves, null);
  if (typeof stored !== "object" || stored === null) return null;
  const { userId, solves } = stored as Partial<ParkedSolves>;
  if (typeof userId !== "string" || !Array.isArray(solves)) return null;
  const clean = solves.map(sanitizeSolve).filter((solve): solve is Solve => solve !== null);
  return clean.length > 0 ? { userId, solves: clean } : null;
}

function readPreferencesAt(): number {
  const value = readStore<unknown>(STORAGE_KEYS.preferencesAt, 0);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function markPreferencesChanged(): void {
  writeStore(STORAGE_KEYS.preferencesAt, Date.now());
}

export function useCloudSync({
  userId,
  solves,
  settings,
  puzzle,
  onApplySolves,
  onApplyPreferences,
}: CloudSyncOptions) {
  const [status, setStatus] = useState<SyncStatus>("off");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const solvesRef = useRef(solves);
  solvesRef.current = solves;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const applySolvesRef = useRef(onApplySolves);
  applySolvesRef.current = onApplySolves;
  const applyPreferencesRef = useRef(onApplyPreferences);
  applyPreferencesRef.current = onApplyPreferences;

  const running = useRef(false);
  /** Guards against a request that never settles holding the lock forever. */
  const runningSince = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const prefsTimer = useRef<number | null>(null);
  const reconcileRef = useRef<() => Promise<void>>(async () => {});

  const clearRetry = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current !== null) return;
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void reconcileRef.current();
    }, RETRY_MS);
  }, []);

  const fail = useCallback(
    (message: string) => {
      setStatus("error");
      setError(message);
      scheduleRetry();
    },
    [scheduleRetry],
  );

  /**
   * The solves this account should be merged with. Signing in on a browser that
   * has never synced (the normal case) adopts what is already here, silently.
   * If the browser last synced a *different* account, those solves are parked
   * under that account instead of being uploaded into this one; signing back
   * into the parked account picks them up again.
   */
  const localForAccount = useCallback((id: string): Solve[] => {
    const last = readSyncState();
    if (last === null || last.userId === id) return solvesRef.current;

    const parked = readParked();
    const mine = parked && parked.userId === id ? parked.solves : [];
    writeStore(STORAGE_KEYS.previousSolves, {
      userId: last.userId,
      solves: solvesRef.current,
    } satisfies ParkedSolves);
    // Marking the switch now keeps a retry from parking the restored solves too.
    writeStore(STORAGE_KEYS.sync, { userId: id, at: last.at } satisfies SyncState);
    solvesRef.current = mine;
    applySolvesRef.current(mine);
    return mine;
  }, []);

  const reconcile = useCallback(async () => {
    const client = supabase;
    const id = userIdRef.current;
    if (!client || !id) return;
    if (running.current && Date.now() - runningSince.current < 20_000) return;
    running.current = true;
    runningSince.current = Date.now();

    try {
      setStatus("syncing");
      setError(null);

      // 1. Deletions first: they are the only change that cannot be inferred.
      const pending = readDeletions();
      if (pending.length > 0) {
        const deletedAt = new Date().toISOString();
        for (const batch of chunk(pending, BATCH)) {
          const { error: deleteError } = await client
            .from("solves")
            .update({ deleted_at: deletedAt })
            .eq("user_id", id)
            .in(
              "id",
              batch.map((entry) => entry.id),
            );
          if (deleteError) throw deleteError;
        }
        writeDeletions([]);
      }

      // 2. Pull every row, tombstones included, so deletions are visible here.
      const remote: RemoteSolve[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error: pullError } = await client
          .from("solves")
          .select("id,user_id,puzzle,scramble,ms,penalty,solved_at,updated_at,deleted_at")
          .eq("user_id", id)
          .order("solved_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (pullError) throw pullError;
        for (const row of (data ?? []) as SolveRow[]) {
          const parsed = fromSolveRow(row);
          if (parsed) remote.push(parsed);
        }
        if (!data || data.length < PAGE) break;
      }

      // 3. Merge in both directions.
      const localSolves = localForAccount(id);
      const { merged, upload } = mergeSolves(localSolves, remote);
      const localById = new Map(localSolves.map((solve) => [solve.id, solve]));
      const changedLocally =
        merged.length !== localSolves.length ||
        merged.some(
          (solve) => !localById.has(solve.id) || localById.get(solve.id)?.penalty !== solve.penalty,
        );
      if (changedLocally) applySolvesRef.current(merged);

      // 4. Upload whatever this device knows better.
      for (const batch of chunk(upload, BATCH)) {
        const { error: uploadError } = await client.from("solves").upsert(
          batch.map((solve) => toSolveRow(solve, id)),
          { onConflict: "id" },
        );
        if (uploadError) throw uploadError;
      }

      // 5. Settings and the selected puzzle.
      const { data: prefRow, error: prefError } = await client
        .from("preferences")
        .select("settings,puzzle,updated_at")
        .eq("user_id", id)
        .maybeSingle();
      if (prefError) throw prefError;

      const remotePrefs = readRemotePreferences(prefRow ?? null);
      const localPrefs: PreferenceSnapshot = {
        settings: settingsRef.current,
        puzzle: puzzleRef.current,
        updatedAt: Math.max(readPreferencesAt(), 0),
      };
      const prefs = mergePreferences(localPrefs, remotePrefs);
      if (prefs.upload) {
        const stamp = Math.max(prefs.updatedAt, Date.now());
        const { error: prefsError } = await client.from("preferences").upsert(
          {
            user_id: id,
            settings: prefs.settings,
            puzzle: prefs.puzzle,
            updated_at: new Date(stamp).toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (prefsError) throw prefsError;
        writeStore(STORAGE_KEYS.preferencesAt, stamp);
      } else if (prefs.updatedAt > localPrefs.updatedAt) {
        applyPreferencesRef.current(prefs);
      }

      const now = Date.now();
      writeStore(STORAGE_KEYS.sync, { userId: id, at: now } satisfies SyncState);
      setSyncedAt(now);
      setStatus("idle");
    } catch (thrown) {
      fail(thrown instanceof Error ? thrown.message : "Sync failed.");
    } finally {
      running.current = false;
    }
  }, [fail, localForAccount]);

  reconcileRef.current = reconcile;

  const solveSaved = useCallback(
    (solve: Solve) => {
      const client = supabase;
      const id = userIdRef.current;
      if (!client || !id) return;
      void client
        .from("solves")
        .upsert(toSolveRow(solve, id), { onConflict: "id" })
        .then(({ error: upsertError }) => {
          if (upsertError) fail(upsertError.message);
        });
    },
    [fail],
  );

  /** One call covers a single delete and a bulk one, so a selection is one request. */
  const solveDeleted = useCallback(
    (solveIds: string[]) => {
      const ids = [...new Set(solveIds)].filter((solveId) => solveId.length > 0);
      if (ids.length === 0) return;

      // Record them first: if the request fails the deletions still reach the cloud later.
      const at = Date.now();
      writeDeletions([...readDeletions(), ...ids.map((solveId) => ({ id: solveId, at }))]);
      const client = supabase;
      const id = userIdRef.current;
      if (!client || !id) return;
      void (async () => {
        for (const batch of chunk(ids, BATCH)) {
          const { error: deleteError } = await client
            .from("solves")
            .update({ deleted_at: new Date(at).toISOString() })
            .eq("user_id", id)
            .in("id", batch);
          if (deleteError) {
            fail(deleteError.message);
            return;
          }
          const removed = new Set(batch);
          writeDeletions(readDeletions().filter((entry) => !removed.has(entry.id)));
        }
      })();
    },
    [fail],
  );

  /**
   * Puts deleted solves back. The pending tombstones are dropped first: a
   * reconcile would otherwise re-delete what the undo just restored, and the
   * upload clears `deleted_at` on the rows that already reached the cloud.
   */
  const solveRestored = useCallback(
    (restored: Solve[]) => {
      if (restored.length === 0) return;
      const ids = new Set(restored.map((solve) => solve.id));
      writeDeletions(readDeletions().filter((entry) => !ids.has(entry.id)));

      const client = supabase;
      const id = userIdRef.current;
      if (!client || !id) return;
      void (async () => {
        for (const batch of chunk(restored, BATCH)) {
          const { error: restoreError } = await client.from("solves").upsert(
            batch.map((solve) => toSolveRow(solve, id)),
            { onConflict: "id" },
          );
          if (restoreError) {
            fail(restoreError.message);
            return;
          }
        }
      })();
    },
    [fail],
  );

  /** Reset session: one request instead of thousands of tombstones. */
  const clearCloud = useCallback(() => {
    const client = supabase;
    const id = userIdRef.current;
    if (!client || !id) return;
    writeDeletions([]);
    void client
      .from("solves")
      .delete()
      .eq("user_id", id)
      .then(({ error: clearError }) => {
        if (clearError) fail(clearError.message);
      });
  }, [fail]);

  const syncNow = useCallback(() => {
    void reconcileRef.current();
  }, []);

  const preferencesChanged = useCallback(() => {
    markPreferencesChanged();
    const client = supabase;
    const id = userIdRef.current;
    if (!client || !id) return;
    if (prefsTimer.current !== null) window.clearTimeout(prefsTimer.current);
    prefsTimer.current = window.setTimeout(() => {
      prefsTimer.current = null;
      const stamp = Date.now();
      void client
        .from("preferences")
        .upsert(
          {
            user_id: id,
            settings: settingsRef.current,
            puzzle: puzzleRef.current,
            updated_at: new Date(stamp).toISOString(),
          },
          { onConflict: "user_id" },
        )
        .then(({ error: prefsError }) => {
          if (prefsError) fail(prefsError.message);
        });
    }, PREFS_DEBOUNCE_MS);
  }, [fail]);

  // A new account means a fresh reconciliation.
  useEffect(() => {
    if (!cloudEnabled || !userId) {
      setStatus("off");
      setSyncedAt(null);
      setError(null);
      return;
    }
    const state = readSyncState();
    setSyncedAt(state && state.userId === userId ? state.at : null);
    void reconcileRef.current();
  }, [userId]);

  // Coming back online is the moment to retry anything that failed.
  useEffect(() => {
    function onOnline() {
      if (!userIdRef.current) return;
      clearRetry();
      void reconcileRef.current();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [clearRetry]);

  useEffect(() => {
    return () => {
      clearRetry();
      if (prefsTimer.current !== null) window.clearTimeout(prefsTimer.current);
    };
  }, [clearRetry]);

  return {
    status,
    syncedAt,
    error,
    syncNow,
    solveSaved,
    solveDeleted,
    solveRestored,
    clearCloud,
    preferencesChanged,
  };
}

export type CloudSyncController = ReturnType<typeof useCloudSync>;
