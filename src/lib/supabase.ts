import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/**
 * False when the deployment has no Supabase credentials, in which case the app
 * behaves exactly as it did before accounts existed. Everything that touches the
 * network checks this first.
 */
export const cloudEnabled = url.length > 0 && anonKey.length > 0;

/**
 * The public client. It carries the anon key on purpose: row level security in
 * Postgres is what separates accounts, so nothing here can read another user's
 * data. The service_role key must never be used in a browser bundle.
 */
export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE keeps the OAuth / magic-link exchange in this browser tab.
        flowType: "pkce",
      },
    })
  : null;

export interface SolveRow {
  id: string;
  user_id: string;
  puzzle: string;
  scramble: string;
  ms: number;
  penalty: string;
  solved_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PreferencesRow {
  user_id: string;
  settings: unknown;
  puzzle: string;
  updated_at: string;
}
