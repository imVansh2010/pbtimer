import { DEFAULT_ACCENT, isAccentId } from "./accents";
import { readStore, STORAGE_KEYS } from "./storage";
import type { Settings } from "./types";

export const HOLD_OPTIONS = [200, 300, 400, 600];

export const DEFAULT_SETTINGS: Settings = {
  inspection: true,
  holdMs: 300,
  hideRunningTime: false,
  typeInTime: false,
  accent: DEFAULT_ACCENT,
};

/**
 * Turns anything that claims to be settings into settings. Used for the stored
 * copy, for a snapshot arriving from another device, and for the cloud row.
 */
export function sanitizeSettings(value: unknown): Settings {
  const input = typeof value === "object" && value !== null ? (value as Partial<Settings>) : {};
  return {
    inspection: input.inspection !== false,
    holdMs:
      typeof input.holdMs === "number" && HOLD_OPTIONS.includes(input.holdMs)
        ? input.holdMs
        : DEFAULT_SETTINGS.holdMs,
    hideRunningTime: input.hideRunningTime === true,
    typeInTime: input.typeInTime === true,
    accent: isAccentId(input.accent) ? input.accent : DEFAULT_SETTINGS.accent,
  };
}

export function readSettings(): Settings {
  return sanitizeSettings(readStore<unknown>(STORAGE_KEYS.settings, {}));
}
