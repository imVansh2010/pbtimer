import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Timer,
  Eye,
  ListOrdered,
  Layers,
  ChartNoAxesColumn,
  SlidersHorizontal,
  Download,
  FolderSync,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { cn } from "../../lib/cn";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <section className="flex gap-2.5 sm:gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-line/50 bg-accent-soft text-accent pointer-coarse:size-8">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-chalk sm:text-[12.5px]">
          {title}
        </h3>
        <div className="mt-1 space-y-1.5 text-[12.5px] leading-[1.65] text-muted sm:text-[11.5px]">
          {children}
        </div>
      </div>
    </section>
  );
}

const TABS = [
  { id: "basics", label: "Basics" },
  { id: "solving", label: "Solving" },
  { id: "sessions", label: "Sessions" },
  { id: "stats", label: "Stats" },
  { id: "data", label: "Data" },
  { id: "keys", label: "Keys" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["space"], action: "Hold to arm, release to start — any press stops" },
  { keys: ["N"], action: "New scramble" },
  { keys: ["2"], action: "Last solve +2" },
  { keys: ["D"], action: "Last solve DNF" },
  { keys: ["del"], action: "Delete last solve" },
  { keys: ["esc"], action: "Cancel inspection or close a dialog" },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const [tab, setTab] = useState<TabId>("basics");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
      title="How pbtimer works"
      description="Everything the timer does, in one place."
      size="lg"
      titleSize="lg"
    >
      <div
        role="tablist"
        aria-label="Help sections"
        className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1"
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
              id={`help-tab-${entry.id}`}
              aria-selected={selected}
              aria-controls={`help-panel-${entry.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setTab(entry.id);
                tabRefs.current[index]?.focus();
              }}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors pointer-coarse:py-2",
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
        id={`help-panel-${tab}`}
        aria-labelledby={`help-tab-${tab}`}
        className="min-h-[258px] space-y-4 sm:space-y-5"
      >
        {tab === "basics" ? (
          <>
            <Section
              icon={<Timer className="size-3.5" aria-hidden="true" />}
              title="Starting a solve"
            >
              <p>
                Hold <kbd className="kbd">space</kbd> — or press and hold anywhere on the timer —
                until the digits turn green, then release to start. Any press stops the timer.
              </p>
              <p>
                The green delay is the{" "}
                <strong className="font-medium text-chalk-dim">hold to arm</strong> setting, so a
                stray tap can never start a solve. You can change it in Settings.
              </p>
            </Section>

            <Section icon={<Eye className="size-3.5" aria-hidden="true" />} title="Inspection">
              <p>
                With WCA inspection on, a 15-second countdown replaces the digits. At 15 seconds the
                solve is <strong className="font-medium text-warn">+2</strong>; past 17 seconds it
                is a <strong className="font-medium text-bad">DNF</strong> and the timer starts on
                its own.
              </p>
              <p>
                The countdown turns amber for the final three seconds and red once you are over. Esc
                cancels inspection.
              </p>
            </Section>

            <Section
              icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
              title="Making it yours"
            >
              <p>
                Settings is split into four sections — Look, Timer, Data and Keys — so related
                options stay together as more are added.
              </p>
              <p>
                On a desktop you can drag the divider on the left edge of the side panel to make it
                wider or narrower; the width is remembered.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "solving" ? (
          <>
            <Section
              icon={<ListOrdered className="size-3.5" aria-hidden="true" />}
              title="Solves, penalties and the cube net"
            >
              <p>
                Every attempt is saved with the scramble that produced it. The small 2D cube under
                the timer shows the scramble applied to a solved cube (2×2 and 3×3 events); the
                arrow in its bottom-left corner hides it, and clicking the arrow again pops it back
                out. A +2 or DNF also shows above the finished time, in amber or red.
              </p>
              <p>
                Every solve in the side panel carries{" "}
                <strong className="font-medium text-chalk-dim">+2</strong>,{" "}
                <strong className="font-medium text-chalk-dim">DNF</strong> and delete buttons — one
                click applies, and clicking +2 or DNF again returns it to OK. Click a solve to see
                its scramble.
              </p>
            </Section>

            <Section
              icon={<Layers className="size-3.5" aria-hidden="true" />}
              title="Bulk delete and undo"
            >
              <p>
                <strong className="font-medium text-chalk-dim">Select</strong> turns the solve list
                into checkboxes: pick as many solves as you want with the rows, or{" "}
                <strong className="font-medium text-chalk-dim">All</strong>, then delete them in one
                go.
              </p>
              <p>
                Any delete stays reversible for five seconds — an Undo button appears in the panel.
                If the deleted solve is the one on the timer, the digits stay and are marked{" "}
                <strong className="font-medium text-bad">deleted</strong> until the next attempt.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "sessions" ? (
          <>
            <Section icon={<Layers className="size-3.5" aria-hidden="true" />} title="Sessions">
              <p>
                Each event keeps as many sessions as you like. The session button in the header
                lists them for the event you are on: start a new one whenever you want a clean
                slate, and the old one stays exactly as it was.
              </p>
              <p>
                Rename a session with the pencil beside it in that list, or from the statistics
                Sessions tab, where you can also delete a session and all of its solves.
              </p>
              <p>
                The side panel always shows the open session. Statistics shows that session on its
                own or every session of the same event, and its Sessions tab lets you jump back into
                any of them.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "stats" ? (
          <Section
            icon={<ChartNoAxesColumn className="size-3.5" aria-hidden="true" />}
            title="Averages and statistics"
          >
            <p>
              Averages use WCA rules: the fastest and slowest solves are dropped, DNFs count as the
              slowest, and two or more DNFs make the average a DNF. Averages need five or twelve
              solves before they appear.
            </p>
            <p>
              Open the chart icon in the header for best, current and worst averages, a trend chart,
              a spread histogram and a session browser. The switch at the top chooses between the
              open session and every session of the current event.
            </p>
            <p>
              Personal bests announce themselves in the header and say whether they are a{" "}
              <strong className="font-medium text-chalk-dim">session PB</strong> or an{" "}
              <strong className="font-medium text-chalk-dim">all-time PB</strong> for the event —
              same for ao5, ao12, ao50 and ao100.
            </p>
          </Section>
        ) : null}

        {tab === "data" ? (
          <>
            <Section
              icon={<Download className="size-3.5" aria-hidden="true" />}
              title="Export & import"
            >
              <p>
                Settings → Data writes a plain-text log grouped by session — times, penalties, exact
                dates and every scramble — which you can download or copy to the clipboard.
              </p>
              <p>
                The .json backup next to it restores everything on another device, sessions and
                dates included. Import reads either file and adds what it finds as new sessions,
                skipping solves you already have.
              </p>
            </Section>

            <Section icon={<FolderSync className="size-3.5" aria-hidden="true" />} title="Saving">
              <p>
                Every solve, session, setting and puzzle choice is saved in this browser as you go,
                so the timer works with no account and no connection.
              </p>
              <p>
                Nothing is uploaded anywhere. Clearing site data, or Reset in the solves panel,
                deletes the local copy for good — export first if you want to keep one.
              </p>
            </Section>
          </>
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
                  <span className="text-[12.5px] leading-4 text-muted sm:text-[11.5px]">
                    {shortcut.action}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11.5px] leading-5 text-faint">
              Space always drives the timer — it stops a solve even when a button has focus, and the
              text fields in dialogs keep it for typing.
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
