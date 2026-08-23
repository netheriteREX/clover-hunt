import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, BookMarked, FileDown } from "lucide-react";
import { collectCitations } from "../lib/citations";
import { CITATION_STYLES } from "../lib/citationFormats";
import { exportDebateAsCitationText } from "../lib/exportCitationText";
import { exportDebateAsBibtex } from "../lib/exportBibtex";

const FORMATS = [...CITATION_STYLES, { id: "bibtex", label: "BibTeX" }];

export default function CitationExportModal({ open, onOpenChange, debate }) {
  const [styleId, setStyleId] = useState("apa");

  if (!debate) return null;

  const citations = collectCitations(debate);
  const style = CITATION_STYLES.find((s) => s.id === styleId);

  const download = () => {
    if (styleId === "bibtex") {
      exportDebateAsBibtex(debate);
    } else {
      exportDebateAsCitationText(debate, styleId);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-hairline-strong bg-paper-raised shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-ink-muted">
              <BookMarked size={14} /> Export citations
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex gap-1 border-b border-hairline px-5 pt-3">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStyleId(f.id)}
                className={`rounded-t-md px-3 py-1.5 text-[12px] font-medium transition ${
                  styleId === f.id
                    ? "border border-b-0 border-hairline-strong bg-paper text-model1"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-[12px] text-ink-muted">
              {citations.length} real citation{citations.length === 1 ? "" : "s"} from both sides of this debate.
            </p>
            <ul className="space-y-2">
              {citations.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-hairline bg-paper px-3 py-2 text-[12px] leading-snug text-ink-muted"
                >
                  {styleId === "bibtex" ? (
                    <>
                      <span className="font-medium text-ink">{c.authors}</span> ({c.year}) —{" "}
                      <span className="italic">{c.venue}</span>
                    </>
                  ) : (
                    style.format(c)
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-hairline px-5 py-3">
            <button
              onClick={download}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-model1-border bg-model1-soft px-3 py-2 text-[12px] font-medium text-model1 transition hover:bg-model1/10"
            >
              <FileDown size={14} />
              {styleId === "bibtex" ? "Download as BibTeX (.bib)" : `Download as ${style.label} (.txt)`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
