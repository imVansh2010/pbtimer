import {
  Timer,
  Eye,
  ListOrdered,
  ChartNoAxesColumn,
  SlidersHorizontal,
  Download,
  FolderSync,
} from "lucide-react";
import type { ReactNode } from "react";
import { Modal } from "../ui/Modal";

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

const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["space"], action: "Hold to arm, release to start — any press stops" },
  { keys: ["N"], action: "New scramble" },
  { keys: ["2"], action: "Last solve +2" },
  { keys: ["D"], action: "Last solve DNF" },
  { keys: ["del"], action: "Delete last solve" },
  { keys: ["esc"], action: "Cancel inspection or close a dialog" },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="How pbtimer works"
      description="Everything the timer does, in one place."
      size="lg"
    >
      <div className="space-y-4 sm:space-y-5">
        <Section icon={<Timer className="size-3.5" aria-hidden="true" />} title="Starting a solve">
          <p>
            Hold <kbd className="kbd">space</kbd> — or press and hold anywhere on the timer — until
            the digits turn green, then release to start. Any press stops the timer.
          </p>
          <p>
            The green delay is the{" "}
            <strong className="font-medium text-chalk-dim">hold to arm</strong> setting, so a stray
            tap can never start a solve. You can change it in Settings.
          </p>
        </Section>

        <Section icon={<Eye className="size-3.5" aria-hidden="true" />} title="Inspection">
          <p>
            With WCA inspection on, a 15-second countdown replaces the digits. At 15 seconds the
            solve is <strong className="font-medium text-warn">+2</strong>; past 17 seconds it is a{" "}
            <strong className="font-medium text-bad">DNF</strong> and the timer starts on its own.
          </p>
          <p>
            The countdown turns amber for the final three seconds and red once you are over. Esc
            cancels inspection.
          </p>
        </Section>

        <Section
          icon={<ListOrdered className="size-3.5" aria-hidden="true" />}
          title="Solves, penalties and the cube net"
        >
          <p>
            Every attempt is saved with the scramble that produced it. The small 2D cube under the
            timer shows the scramble applied to a solved cube (2×2 and 3×3 events); the arrow in its
            bottom-left corner hides it, and clicking the arrow again pops it back out. A +2 or DNF
            also shows above the finished time, in amber or red.
          </p>
          <p>
            Every solve in the side panel carries{" "}
            <strong className="font-medium text-chalk-dim">+2</strong>,{" "}
            <strong className="font-medium text-chalk-dim">DNF</strong> and delete buttons — one
            click applies, and clicking +2 or DNF again returns it to OK. Click a solve to see its
            scramble.
          </p>
        </Section>

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
            Open the chart icon in the header for best, current and worst averages, best and worst
            single, mean, standard deviation and DNF rate.
          </p>
        </Section>

        <Section
          icon={<SlidersHorizontal className="size-3.5" aria-hidden="true" />}
          title="Making it yours"
        >
          <p>
            Settings is split into four sections — Look, Timer, Data and Keys — so related options
            stay together as more are added.
          </p>
          <p>
            On a desktop you can drag the divider on the left edge of the side panel to make it
            wider or narrower; the width is remembered.
          </p>
        </Section>

        <Section
          icon={<Download className="size-3.5" aria-hidden="true" />}
          title="Export & import"
        >
          <p>
            Settings → Data writes a plain-text log grouped by puzzle — times, penalties, dates, and
            every scramble — which you can download or copy to the clipboard.
          </p>
          <p>
            The .json backup next to it restores everything on another device, dates included;
            Import merges one back in.
          </p>
        </Section>

        <Section icon={<FolderSync className="size-3.5" aria-hidden="true" />} title="Saving">
          <p>
            Every solve, setting and puzzle choice is saved in this browser as you go, so the timer
            works with no account and no connection.
          </p>
          <p>
            Nothing is uploaded anywhere. Clearing site data, or Reset in the solves panel, deletes
            the local copy for good — export first if you want to keep one.
          </p>
        </Section>

        <section>
          <h3 className="eyebrow mb-2">Keyboard</h3>
          <ul className="space-y-2.5 sm:space-y-1.5">
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
        </section>
      </div>
    </Modal>
  );
}
