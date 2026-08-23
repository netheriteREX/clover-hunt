import { motion } from "framer-motion";
import { ScanSearch, ThumbsUp, ThumbsDown, Equal, ExternalLink } from "lucide-react";
import CountUp from "./reactbits/CountUp";

const VERDICT_STYLE = {
  "well-supported": { label: "Well-supported", border: "border-success/40", bg: "bg-success/10", text: "text-success" },
  contested: { label: "Contested", border: "border-gold-border", bg: "bg-gold-soft", text: "text-gold" },
  unsupported: { label: "Unsupported", border: "border-danger/30", bg: "bg-danger-soft", text: "text-danger" },
  unclear: { label: "Unclear", border: "border-hairline-strong", bg: "bg-paper-raised", text: "text-ink-faint" },
};

const STANCE_STYLE = {
  supports: { label: "Supports", icon: ThumbsUp, text: "text-success" },
  contradicts: { label: "Contradicts", icon: ThumbsDown, text: "text-danger" },
  mixed: { label: "Mixed", icon: Equal, text: "text-gold" },
};

export default function FactCheckResult({ result }) {
  const { claim, verdict, confidence, summary, evidence } = result;
  const style = VERDICT_STYLE[verdict] || VERDICT_STYLE.unclear;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border border-hairline-strong bg-paper-raised px-5 py-3 text-center shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Claim</p>
        <p className="mt-0.5 font-serif text-[16px] font-medium leading-snug text-ink">{claim}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={`rounded-lg border-2 ${style.border} bg-paper-raised p-5 shadow-md sm:p-6`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex items-center gap-2 rounded-md ${style.bg} px-2.5 py-1.5`}>
            <ScanSearch size={15} className={style.text} />
            <span className={`text-[12px] font-bold uppercase tracking-widest ${style.text}`}>{style.label}</span>
          </div>
          {typeof confidence === "number" && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Confidence</span>
              <span className="font-serif text-[24px] font-bold leading-none text-gold">
                <CountUp to={confidence} suffix="%" duration={1} />
              </span>
            </div>
          )}
        </div>
        <p className="text-[14.5px] font-medium leading-relaxed text-ink">{summary}</p>
      </motion.div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          Evidence considered
        </p>
        <div className="space-y-2">
          {evidence.map((e, i) => {
            const stance = STANCE_STYLE[e.stance] || STANCE_STYLE.mixed;
            const Icon = stance.icon;
            return (
              <motion.div
                key={e.id ?? i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                className="rounded-md border border-hairline bg-paper px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className={stance.text} />
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${stance.text}`}>
                    {stance.label}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{e.note}</p>
                <p className="mt-2 text-[12.5px] text-ink-muted">
                  <span className="font-medium text-ink">{e.citation.authors}</span> ({e.citation.year}) —{" "}
                  <span className="italic">{e.citation.venue}</span>
                </p>
                {e.citation.url && (
                  <a
                    href={e.citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-model1 hover:underline"
                  >
                    View paper <ExternalLink size={10} />
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
