import { motion } from "framer-motion";
import * as Separator from "@radix-ui/react-separator";
import { Swords, Gavel, Sparkles } from "lucide-react";
import CountUp from "./reactbits/CountUp";

export default function FinalVerdict({ verdict }) {
  const { argumentAssessment, summary, nuances, confidence } = verdict;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mx-auto max-w-3xl rounded-lg border border-hairline-strong bg-paper-raised p-5 shadow-sm"
    >
      {typeof confidence === "number" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Confidence</span>
          <span className="font-serif text-[20px] font-semibold text-gold">
            <CountUp to={confidence} suffix="%" duration={1} />
          </span>
        </div>
      )}

      {argumentAssessment && (
        <>
          <div className="mb-2 flex items-center gap-2 text-model1">
            <Swords size={13} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">
              Argument assessment — who reasoned better
            </span>
          </div>
          <p className="font-serif text-[14px] leading-relaxed text-ink-muted">{argumentAssessment}</p>
          <Separator.Root className="my-4 h-px bg-hairline" />
        </>
      )}

      <div className="mb-2 flex items-center gap-2 text-ink-muted">
        <Gavel size={13} />
        <span className="text-[11px] font-semibold uppercase tracking-widest">Evidence summary</span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink">{summary}</p>

      {nuances?.length > 0 && (
        <div className="mt-4">
          <Separator.Root className="mb-4 h-px bg-hairline" />
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
            <Sparkles size={12} /> Important nuance
          </div>
          <ul className="space-y-2">
            {nuances.map((n, i) => (
              <li
                key={i}
                className="rounded-md border border-gold-border bg-gold-soft px-3 py-2 text-[13px] leading-snug text-ink"
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
