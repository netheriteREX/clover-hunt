import * as Dialog from "@radix-ui/react-dialog";
import { X, Trash2, History as HistoryIcon, Inbox } from "lucide-react";

const VERDICT_STYLE = {
  model1: { text: "text-model1", bg: "bg-model1-soft", border: "border-model1-border" },
  model2: { text: "text-model2", bg: "bg-model2-soft", border: "border-model2-border" },
  mixed: { text: "text-gold", bg: "bg-gold-soft", border: "border-gold-border" },
};

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPanel({ open, onOpenChange, entries, onLoad, onDelete, onClearAll }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-hairline-strong bg-paper-raised shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-ink-muted">
              <HistoryIcon size={14} /> Review history
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-ink-faint">
                <Inbox size={22} />
                <p className="text-[13px]">No saved reviews yet.</p>
                <p className="max-w-xs text-[12px]">
                  Completed reviews are saved here automatically so you can revisit them later.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {entries.map((entry) => {
                  const verdict = entry.debate?.model3?.verdict;
                  const style = VERDICT_STYLE[verdict?.winningSide] || VERDICT_STYLE.mixed;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-2 rounded-md border border-hairline bg-paper p-3 transition hover:border-hairline-strong"
                    >
                      <button
                        onClick={() => onLoad(entry)}
                        className="flex-1 text-left"
                      >
                        <p className="text-[13px] font-medium leading-snug text-ink">{entry.question}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-ink-faint">{formatDate(entry.savedAt)}</span>
                          {verdict && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.text} ${style.bg} ${style.border}`}
                            >
                              {verdict.winningSide === "mixed"
                                ? "Mixed"
                                : verdict.winningSide === "model1"
                                  ? "Model 1"
                                  : "Model 2"}{" "}
                              · {verdict.confidence}%
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => onDelete(entry.id)}
                        aria-label="Delete"
                        className="shrink-0 rounded p-2 text-ink-faint hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {entries.length > 0 && (
            <div className="border-t border-hairline px-5 py-3">
              <button
                onClick={onClearAll}
                className="text-[12px] font-medium text-danger hover:underline"
              >
                Clear all history
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
