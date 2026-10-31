import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, RefreshCw } from "lucide-react";
import { cn } from "../lib/cn";
import { initialsFor } from "../lib/sync";
import type { AuthController } from "../hooks/useAuth";
import type { CloudSyncController } from "../hooks/useCloudSync";

interface AccountMenuProps {
  auth: AuthController;
  sync: CloudSyncController;
  onOpenAuth: () => void;
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AccountMenu({ auth, sync, onOpenAuth }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Signing out closes the menu; the local session stays on this device.
  useEffect(() => {
    if (!auth.user) setOpen(false);
  }, [auth.user]);

  if (!auth.user) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpenAuth}
        aria-label="Sign in to sync your solves"
        title="Sign in to sync"
        className={cn(
          "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.09] px-2 text-[12px] text-chalk-dim transition-colors",
          "hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-chalk",
          "pointer-coarse:h-10 pointer-coarse:px-2.5 sm:px-2.5",
        )}
      >
        <LogIn className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  const name = auth.name;
  const status =
    sync.status === "syncing"
      ? "Syncing…"
      : sync.status === "error"
        ? "Sync paused — retrying"
        : sync.syncedAt
          ? `Synced ${relativeTime(sync.syncedAt)}`
          : "Synced";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        title={name}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] pl-1 pr-1.5 transition-colors",
          "hover:border-white/[0.14] hover:bg-white/[0.06]",
          "pointer-coarse:h-10 sm:h-8",
          open && "border-white/[0.14] bg-white/[0.06]",
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent-soft text-[10px] font-semibold text-accent ring-1 ring-inset ring-white/[0.07]"
        >
          {initialsFor(name)}
        </span>
        <span
          className="hidden max-w-[11ch] truncate text-[12px] font-medium text-chalk-dim sm:inline"
          dir="auto"
        >
          {name}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3 shrink-0 text-faint transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="panel absolute right-0 top-full z-40 mt-2 w-64 animate-panel-in rounded-xl border border-white/[0.08] bg-ink-850 p-1.5"
        >
          <div className="flex items-start gap-2.5 px-2 py-2">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent-soft text-[11px] font-semibold text-accent ring-1 ring-inset ring-white/[0.07]"
            >
              {initialsFor(name)}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[12.5px] font-medium text-chalk"
                dir="auto"
                title={name}
              >
                {name}
              </div>
              <div className="truncate text-[10.5px] text-faint" dir="auto" title={auth.email}>
                {auth.email}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 pb-2 text-[10px] text-faint">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                sync.status === "error"
                  ? "bg-warn"
                  : sync.status === "syncing"
                    ? "bg-accent animate-pulse"
                    : "bg-good",
              )}
            />
            <span>{status}</span>
          </div>

          <div className="my-1 h-px bg-white/[0.06]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              sync.syncNow();
            }}
            disabled={sync.status === "syncing"}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-muted transition-colors hover:bg-white/[0.045] hover:text-chalk disabled:pointer-events-none disabled:opacity-40 pointer-coarse:py-2.5"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Sync now
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void auth.signOut();
            }}
            disabled={auth.busy}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-muted transition-colors hover:bg-white/[0.045] hover:text-chalk disabled:pointer-events-none disabled:opacity-40 pointer-coarse:py-2.5"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Sign out
          </button>

          <p className="px-2 pb-1 pt-1.5 text-[10px] leading-4 text-faint/80">
            Solves stay on this device after signing out.
          </p>
        </div>
      ) : null}
    </div>
  );
}
