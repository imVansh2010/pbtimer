import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import type { AuthController } from "../../hooks/useAuth";

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  auth: AuthController;
}

type Mode = "signin" | "signup";

const fieldClass =
  "w-full rounded-lg border border-white/[0.09] bg-ink-950/60 px-3 py-2.5 text-[16px] text-chalk " +
  "placeholder:text-faint/70 transition-colors sm:py-2 sm:text-[13px] " +
  "focus:border-accent/60 focus:outline-none focus-visible:outline-none";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthDialog({ open, onClose, auth }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"password" | "google" | "magic" | null>(null);

  // A fresh dialog should never show the last attempt's message.
  useEffect(() => {
    if (open) return;
    setError(null);
    setNotice(null);
    setPending(null);
    setPassword("");
    setReveal(false);
  }, [open]);

  const busy = pending !== null || auth.busy;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email address doesn't look right.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }
    setPending("password");
    const outcome =
      mode === "signin" ? await auth.signIn(email, password) : await auth.signUp(email, password);
    setPending(null);
    if (outcome.error) setError(outcome.error);
    else if (outcome.notice) setNotice(outcome.notice);
    else if (mode === "signin") onClose();
  }

  async function magicLink() {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Add your email first, then ask for the link.");
      return;
    }
    setPending("magic");
    const outcome = await auth.sendMagicLink(email);
    setPending(null);
    if (outcome.error) setError(outcome.error);
    else if (outcome.notice) setNotice(outcome.notice);
  }

  async function google() {
    if (busy) return;
    setError(null);
    setNotice(null);
    setPending("google");
    const outcome = await auth.signInWithGoogle();
    setPending(null);
    if (outcome.error) setError(outcome.error);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "signin" ? "Sign in to sync" : "Create your account"}
      description="Your solves and settings, on every device you use."
      size="sm"
    >
      <div className="space-y-3.5">
        <Button variant="outline" size="md" className="w-full" onClick={google} disabled={busy}>
          {pending === "google" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <GoogleMark />
          )}
          Continue with Google
        </Button>

        <div className="flex items-center gap-2.5" aria-hidden="true">
          <span className="h-px flex-1 bg-white/[0.07]" />
          <span className="text-[9.5px] uppercase tracking-[0.16em] text-faint">or</span>
          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <form onSubmit={submit} className="space-y-2.5" noValidate>
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-[11px] text-muted">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-[11px] text-muted">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={reveal ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(fieldClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? "Hide password" : "Show password"}
                aria-pressed={reveal}
                className="absolute right-0 top-0 grid h-full w-10 cursor-pointer place-items-center text-faint transition-colors hover:text-chalk pointer-coarse:w-11"
              >
                {reveal ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={!canSubmit}
          >
            {pending === "password" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={magicLink}
          disabled={busy}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[11.5px] text-muted transition-colors hover:bg-white/[0.04] hover:text-chalk disabled:pointer-events-none disabled:opacity-40 pointer-coarse:py-2.5"
        >
          {pending === "magic" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="size-3.5" aria-hidden="true" />
          )}
          Email me a sign-in link
        </button>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-bad/25 bg-bad/10 px-3 py-2 text-[11.5px] leading-4 text-bad"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-good/25 bg-good/10 px-3 py-2 text-[11.5px] leading-4 text-good"
          >
            {notice}
          </p>
        ) : null}

        <p className="text-center text-[11.5px] text-faint">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="cursor-pointer font-medium text-accent transition-colors hover:text-accent-strong"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="text-center text-[10.5px] leading-4 text-faint/80">
          No account needed — everything still saves in this browser.
        </p>
      </div>
    </Modal>
  );
}
