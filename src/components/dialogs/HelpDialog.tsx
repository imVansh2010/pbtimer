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
  { keys: ["space"], action: "Hold to arm, release to start" },
  { keys: ["any"], action: "Stops a running solve" },
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
      description="Timer, sessions, stats and backups."
      size="lg"
      titleSize="lg"
    >
      {/* A scroll container clips at its padding edge, and the focus ring is
          drawn outside the tab, so the strip keeps 6px of padding on every side.
          The negative margins put the row back where it was. */}
      <div
        role="tablist"
        aria-label="Help sections"
        className="-mx-1.5 -mt-1.5 mb-3.5 flex gap-1 overflow-x-auto p-1.5"
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
                Hold <kbd className="kbd">space</kbd>, or press anywhere on the timer, until the
                digits turn green, then let go to start. Any press stops it.
              </p>
              <p>
                That green delay is the{" "}
                <strong className="font-medium text-chalk-dim">hold to arm</strong> setting — it
                keeps a stray tap from starting a solve. Change it in Settings.
              </p>
            </Section>

            <Section icon={<Eye className="size-3.5" aria-hidden="true" />} title="Inspection">
              <p>
                With WCA inspection on, a 15-second countdown takes over the digits. Past 15 seconds
                the solve is <strong className="font-medium text-warn">+2</strong>; past 17 it is a{" "}
                <strong className="font-medium text-bad">DNF</strong> and the timer starts itself.
              </p>
              <p>Amber for the last three seconds, red once you are over. Esc cancels.</p>
            </Section>

            <Section
              icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
              title="Settings and the panel"
            >
              <p>Settings has four tabs: Look, Timer, Data and Keys.</p>
              <p>
                On a desktop, drag the divider at the side panel's left edge to resize it. The width
                is remembered.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "solving" ? (
          <>
            <Section
              icon={<ListOrdered className="size-3.5" aria-hidden="true" />}
              title="Solves and the cube net"
            >
              <p>
                Every solve is saved with its scramble. The 2D cube under the timer shows that
                scramble applied to a solved cube (2×2 and 3×3); the arrow in its corner hides it. A
                +2 or DNF shows above the time in amber or red.
              </p>
              <p>
                Each solve in the side panel has{" "}
                <strong className="font-medium text-chalk-dim">+2</strong>,{" "}
                <strong className="font-medium text-chalk-dim">DNF</strong> and delete buttons.
                Click +2 or DNF again to clear it; click a solve to see its scramble.
              </p>
            </Section>

            <Section
              icon={<Layers className="size-3.5" aria-hidden="true" />}
              title="Bulk delete and undo"
            >
              <p>
                <strong className="font-medium text-chalk-dim">Select</strong> turns the list into
                checkboxes: tick rows, or{" "}
                <strong className="font-medium text-chalk-dim">All</strong>, then delete them
                together.
              </p>
              <p>
                Any delete can be undone for five seconds from the panel. If the deleted solve is
                the one on the timer, its time stays, marked{" "}
                <strong className="font-medium text-bad">deleted</strong>, until the next attempt.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "sessions" ? (
          <>
            <Section icon={<Layers className="size-3.5" aria-hidden="true" />} title="Sessions">
              <p>
                Every event can have as many sessions as you like. Start one from the session button
                in the header whenever you want a clean slate; the old one stays as it was.
              </p>
              <p>
                Rename or delete one with the pencil and bin in that list, or from the Sessions tab
                in Statistics. Deleting a session takes its solves with it.
              </p>
              <p>
                The side panel always shows the open session. Statistics can show that session alone
                or every session of the event.
              </p>
            </Section>
          </>
        ) : null}

        {tab === "stats" ? (
          <Section
            icon={<ChartNoAxesColumn className="size-3.5" aria-hidden="true" />}
            title="Averages"
          >
            <p>
              Averages use WCA rules: drop the fastest and slowest, count a DNF as the slowest, and
              two DNFs make the average a DNF. Ao5 needs five solves, ao12 twelve.
            </p>
            <p>
              The chart button in the header opens the full statistics: averages, trend, spread and
              sessions. The switch at the top picks the open session or the whole event.
            </p>
            <p>
              A personal best shows in the header as a{" "}
              <strong className="font-medium text-chalk-dim">session PB</strong> or an{" "}
              <strong className="font-medium text-chalk-dim">all-time PB</strong>, for singles and
              averages alike.
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
                <strong className="font-medium text-chalk-dim">Export log</strong> in Settings →
                Data writes a plain-text log grouped by session: times, penalties, dates and
                scrambles. Download or copy it.
              </p>
              <p>
                <strong className="font-medium text-chalk-dim">Back up</strong> writes a .json with
                everything, sessions included. Import takes either file and puts what it finds into
                new sessions, skipping solves you already have.
              </p>
            </Section>

            <Section icon={<FolderSync className="size-3.5" aria-hidden="true" />} title="Saving">
              <p>
                Everything is saved in this browser as you go, so the timer works with no account
                and no connection.
              </p>
              <p>
                Nothing is uploaded. Clearing site data or hitting Reset deletes the local copy for
                good — export first if you want to keep it.
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
              Any key stops a running solve, not just space. Text fields keep their keys for typing.
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
