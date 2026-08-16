import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import { X, AlertTriangle, CheckCircle2, ExternalLink, Scale, Swords } from "lucide-react";

const SIDE_LABEL = {
  model1: { label: "Model 1", color: "text-model1" },
  model2: { label: "Model 2", color: "text-model2" },
};

function qualityColor(score) {
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-gold)";
  return "var(--color-danger)";
}

function ScoreBar({ icon: Icon, label, score }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} className="shrink-0 text-ink-faint" />
      <span className="w-24 shrink-0 text-[11px] text-ink-faint">{label}</span>
      <Progress.Root
        value={score}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline"
      >
        <Progress.Indicator
          className="block h-full rounded-full transition-transform duration-500"
          style={{ transform: `translateX(-${100 - score}%)`, backgroundColor: qualityColor(score) }}
        />
      </Progress.Root>
      <span className="text-[11px] tabular-nums text-ink-faint">{score}/100</span>
    </div>
  );
}

export default function EvidenceDetail({ item, onClose }) {
  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline-strong bg-paper-raised p-6 shadow-xl focus:outline-none">
          {item && (
            <>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  className="absolute right-4 top-4 text-ink-faint hover:text-ink"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>

              <p
                className={`text-[11px] font-semibold uppercase tracking-widest ${SIDE_LABEL[item.side].color}`}
              >
                {SIDE_LABEL[item.side].label}
              </p>
              <Dialog.Title className="mt-1 text-[15px] font-medium leading-snug text-ink">
                {item.arg.claim}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                {item.arg.reasoning}
              </Dialog.Description>

              <div className="mt-4 rounded-md border border-hairline bg-paper p-3.5">
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">
                    {item.arg.citation.authors} ({item.arg.citation.year})
                  </span>{" "}
                  — <span className="italic text-ink-muted">{item.arg.citation.venue}</span>
                </p>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  {item.arg.citation.studyType} · {item.arg.citation.sampleSize}
                </p>
                <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">
                  {item.arg.citation.summary}
                </p>
                {item.arg.citation.url && (
                  <a
                    href={item.arg.citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-model1 hover:underline"
                  >
                    View paper <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {item.critique && (
                <div className="mt-4 space-y-2">
                  {typeof item.critique.argumentScore === "number" && (
                    <ScoreBar icon={Swords} label="Argument" score={item.critique.argumentScore} />
                  )}
                  <ScoreBar icon={Scale} label="Evidence" score={item.critique.qualityScore} />

                  {item.critique.reasoningFlaws?.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                        How the argument uses this evidence
                      </p>
                      {item.critique.reasoningFlaws.map((f, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[12px] text-danger">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5">
                    {item.critique.flaws?.length > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                        Evidence itself
                      </p>
                    )}
                    {item.critique.flaws?.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[12px] text-danger">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                    {item.critique.strengths?.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[12px] text-success">
                        <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  {item.critique.notes && (
                    <p className="mt-2 text-[12px] italic text-ink-faint">{item.critique.notes}</p>
                  )}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
