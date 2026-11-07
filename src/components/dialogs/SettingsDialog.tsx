import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Check, Download, FileJson, RotateCcw, Upload } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Toggle } from "../ui/Toggle";
import { Segmented } from "../ui/Segmented";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { ACCENTS, accentById } from "../../lib/accents";
import { parseImportFile } from "../../lib/import";
import type { ImportGroup } from "../../lib/sessions";
import type { Settings } from "../../lib/types";

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  /** False on touch screens, where there is no keyboard to type a time on. */
  typeInAvailable: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onExport: () => void;
  onBackup: () => void;
  onImport: (groups: ImportGroup[]) => { sessions: number; added: number; duplicates: number };
  onReset: () => void;
}

const TABS = [
  { id: "appearance", label: "Look" },
  { id: "timer", label: "Timer" },
  { id: "data", label: "Data" },
  { id: "keys", label: "Keys" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["space"], action: "Hold to arm, release to start" },
  { keys: ["any"], action: "Stop a running solve" },
  { keys: ["N"], action: "New scramble" },
  { keys: ["2"], action: "Mark last solve +2" },
  { keys: ["D"], action: "Mark last solve DNF" },
  { keys: ["del"], action: "Delete last solve" },
  { keys: ["esc"], action: "Cancel inspection / close dialog" },
];

export function SettingsDialog({
  open,
  settings,
  typeInAvailable,
  onChange,
  onClose,
  onExport,
  onBackup,
  onImport,
  onReset,
}: SettingsDialogProps) {
  const [tab, setTab] = useState<TabId>("appearance");
  const [importResult, setImportResult] = useState<{ tone: "good" | "bad"; text: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // A result from last time would be stale the next time the dialog opens.
  useEffect(() => {
    if (!open) setImportResult(null);
  }, [open]);

  async function readImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setImportResult({ tone: "bad", text: "That file is too large for a solve log." });
      return;
    }
    try {
      const parsed = parseImportFile(await file.text());
      if (parsed.groups.length === 0) {
        setImportResult({ tone: "bad", text: "No solves found in that file." });
        return;
      }
      const { sessions, added, duplicates } = onImport(parsed.groups);
      const parts =
        added === 0
          ? [`Every solve in that file is already here`]
          : [
              `${added} solve${added === 1 ? "" : "s"} imported into ${sessions} new session${
                sessions === 1 ? "" : "s"
              }`,
              ...(duplicates > 0 ? [`${duplicates} already here`] : []),
            ];
      if (parsed.rejected > 0) parts.push(`${parsed.rejected} skipped`);
      setImportResult({ tone: "good", text: `${parts.join(" · ")}.` });
    } catch (error) {
      setImportResult({
        tone: "bad",
        text: error instanceof Error ? error.message : "That file could not be read.",
      });
    }
  }
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const accent = accentById(settings.accent);

  function selectTab(index: number) {
    const next = TABS[(index + TABS.length) % TABS.length]!;
    setTab(next.id);
    tabRefs.current[TABS.findIndex((entry) => entry.id === next.id)]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(TABS.length - 1);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Timer settings and your data."
      size="md"
      titleSize="lg"
    >
      <div
        role="tablist"
        aria-label="Settings sections"
        className="mb-4 flex gap-1 rounded-xl border border-white/[0.06] bg-ink-950/60 p-1"
      >
        {TABS.map((entry, index) => {
          const selected = entry.id === tab;
          return (
            <button
              key={entry.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${entry.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${entry.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(entry.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                "flex-1 cursor-pointer rounded-[8px] px-2 py-1 text-[13px] font-medium transition-colors pointer-coarse:py-2",
                selected
                  ? "bg-white/[0.07] text-chalk shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-faint hover:bg-white/[0.035] hover:text-chalk-dim",
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
        className="min-h-[242px]"
      >
        {tab === "appearance" ? (
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-faint">
                Accent colour
              </h3>
              <span className="text-[12px] text-faint">{accent.label}</span>
            </div>
            <p className="mb-6 text-[13px] leading-[1.5] text-faint">
              Colours buttons, highlights, the timer glow and the trend line.
            </p>
            <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-4">
              {ACCENTS.map((option) => {
                const selected = option.id === accent.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => onChange({ accent: option.id })}
                    style={{ backgroundColor: option.base }}
                    className={cn(
                      "inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-2 transition-transform duration-150 hover:scale-105 pointer-coarse:size-11",
                      selected
                        ? "border-white/85 shadow-[0_0_0_3px_rgba(255,255,255,0.1)]"
                        : "border-white/15 hover:border-white/40",
                    )}
                  >
                    {selected ? (
                      <Check
                        className="size-3.5 text-ink-950"
                        strokeWidth={3.5}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "timer" ? (
          <section className="divide-y divide-white/[0.05]">
            {typeInAvailable ? (
              <Toggle
                label="Type your time in"
                description="Type a time and press Enter. Bare digits count as milliseconds."
                checked={settings.typeInTime}
                onChange={(typeInTime) => onChange({ typeInTime })}
              />
            ) : null}
            <Toggle
              label="WCA inspection"
              description="15-second countdown before each solve. Over 15s is +2, over 17s a DNF."
              checked={settings.inspection}
              onChange={(inspection) => onChange({ inspection })}
            />
            <Toggle
              label="Hide the time while solving"
              description="Digits stay blank while you solve and appear when you stop."
              checked={settings.hideRunningTime}
              onChange={(hideRunningTime) => onChange({ hideRunningTime })}
            />
            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-chalk">Hold to arm</div>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-faint">
                  How long to hold before the timer turns green.
                </p>
              </div>
              <Segmented
                label="Hold duration"
                size="sm"
                value={String(settings.holdMs)}
                onChange={(value) => onChange({ holdMs: Number(value) })}
                options={[
                  { value: "200", label: "0.2s" },
                  { value: "300", label: "0.3s" },
                  { value: "400", label: "0.4s" },
                  { value: "600", label: "0.6s" },
                ]}
              />
            </div>
          </section>
        ) : null}

        {tab === "data" ? (
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default" size="sm" onClick={onExport}>
                <Download className="size-3.5" aria-hidden="true" />
                Export log
              </Button>
              <Button variant="outline" size="sm" onClick={onBackup}>
                <FileJson className="size-3.5" aria-hidden="true" />
                Back up
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" aria-hidden="true" />
                Import
              </Button>
              <Button variant="danger" size="sm" onClick={onReset}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json,.txt,text/plain"
              className="hidden"
              onChange={readImportFile}
            />

            {importResult ? (
              <p
                role="status"
                className={cn(
                  "mt-2.5 rounded-lg border px-2.5 py-2 text-[11.5px] leading-4",
                  importResult.tone === "good"
                    ? "border-good/25 bg-good/10 text-good"
                    : "border-bad/25 bg-bad/10 text-bad",
                )}
              >
                {importResult.text}
              </p>
            ) : null}

            <p className="mt-4 text-[13px] leading-[1.6] text-faint">
              <strong className="font-medium text-chalk-dim">Export log</strong> writes a readable
              .txt grouped by session;{" "}
              <strong className="font-medium text-chalk-dim">Back up</strong> writes a .json with
              the sessions and every solve. Import takes either file and puts the solves into new
              sessions, away from the one you are timing.
            </p>
            <p className="mt-2.5 text-[13px] leading-[1.6] text-faint">
              Everything lives in this browser; nothing is uploaded. Back up regularly — clearing
              site data deletes the local copy.
            </p>
          </section>
        ) : null}

        {tab === "keys" ? (
          <section>
            <ul className="space-y-3 sm:space-y-2.5">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.action} className="flex items-center gap-3">
                  <span className="flex w-[88px] shrink-0 items-center gap-1 sm:w-[92px]">
                    {shortcut.keys.map((key) => (
                      <kbd key={key} className="kbd">
                        {key}
                      </kbd>
                    ))}
                  </span>
                  <span className="text-[13px] leading-[1.5] text-muted">{shortcut.action}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] leading-[1.5] text-faint">
              Any key stops a running solve, even when a button has focus.
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
