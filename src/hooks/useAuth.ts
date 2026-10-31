import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { cloudEnabled, supabase } from "../lib/supabase";
import { accountName } from "../lib/sync";

export interface AuthOutcome {
  error?: string;
  notice?: string;
}

const NOT_CONFIGURED = "Accounts aren't set up on this deployment yet.";

/** Where Supabase should send people back to after an email or Google round trip. */
function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Supabase messages are written for developers; these read like UI copy. The
 * raw text is preserved when it is already specific enough to act on.
 */
function authMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "That email and password don't match.";
  if (text.includes("email not confirmed")) return "Confirm your email first — check your inbox.";
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (text.includes("password should be at least"))
    return "Use at least 8 characters for the password.";
  if (text.includes("unable to validate email") || text.includes("invalid email")) {
    return "That email address doesn't look right.";
  }
  if (text.includes("rate limit") || text.includes("only request this after")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (text.includes("signups not allowed")) return "New accounts are disabled for this project.";
  if (text.includes("provider is not enabled")) return "That sign-in method isn't enabled yet.";
  return message;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // A PKCE exchange leaves ?code=… in the address bar; tidy it once signed in.
  useEffect(() => {
    if (!session) return;
    const { search, hash, pathname } = window.location;
    if (!/[?&](code|error|error_description)=/.test(search) && !/access_token|code=/.test(hash))
      return;
    window.history.replaceState({}, "", pathname);
  }, [session]);

  const withBusy = useCallback(
    async (action: () => Promise<AuthOutcome>): Promise<AuthOutcome> => {
      if (busy) return {};
      setBusy(true);
      try {
        return await action();
      } catch (error) {
        return {
          error: error instanceof Error ? authMessage(error.message) : "Something went wrong.",
        };
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      withBusy(async () => {
        if (!supabase) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return error ? { error: authMessage(error.message) } : {};
      }),
    [withBusy],
  );

  const signUp = useCallback(
    (email: string, password: string) =>
      withBusy(async () => {
        if (!supabase) return { error: NOT_CONFIGURED };
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl() },
        });
        if (error) return { error: authMessage(error.message) };
        if (!data.session) {
          return { notice: "Check your inbox to confirm the address, then sign in." };
        }
        return {};
      }),
    [withBusy],
  );

  const sendMagicLink = useCallback(
    (email: string) =>
      withBusy(async () => {
        if (!supabase) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
        });
        return error
          ? { error: authMessage(error.message) }
          : { notice: "One-tap link sent. Open it on this device to finish signing in." };
      }),
    [withBusy],
  );

  const signInWithGoogle = useCallback(
    () =>
      withBusy(async () => {
        if (!supabase) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl(),
            queryParams: { prompt: "select_account" },
          },
        });
        return error ? { error: authMessage(error.message) } : {};
      }),
    [withBusy],
  );

  const signOut = useCallback(
    () =>
      withBusy(async () => {
        if (!supabase) return {};
        const { error } = await supabase.auth.signOut();
        return error ? { error: authMessage(error.message) } : {};
      }),
    [withBusy],
  );

  const user = session?.user ?? null;
  const name = useMemo(() => (user ? accountName(user) : ""), [user]);

  return {
    cloudEnabled,
    ready,
    busy,
    user,
    userId: user?.id ?? null,
    email: user?.email ?? "",
    name,
    signIn,
    signUp,
    sendMagicLink,
    signInWithGoogle,
    signOut,
  };
}

export type AuthController = ReturnType<typeof useAuth>;
