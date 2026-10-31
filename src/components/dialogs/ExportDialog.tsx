import { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { copyText, downloadText, exportFilename } from "../../lib/export";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  text: string;
  solveCount: number;
}

export function ExportDialog({ open, onClose, text, solveCount }: ExportDialogProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export solves"
      description={`${solveCount} solve${solveCount === 1 ? "" : "s"} as a plain-text log.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={async () => {
              const ok = await copyText(text);
              if (ok) setCopied(true);
            }}
            disabled={solveCount === 0}
          >
            {copied ? (
              <Check className="size-3.5 text-good" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={solveCount === 0}
            onClick={() => downloadText(exportFilename(), text)}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download .txt
          </Button>
        </>
      }
    >
      <pre className="max-h-[46dvh] overflow-auto rounded-xl border border-white/[0.055] bg-ink-950/60 p-3 font-mono text-[10.5px] leading-5 text-muted">
        {text}
      </pre>
    </Modal>
  );
}
