import { motion } from "framer-motion";
import * as Separator from "@radix-ui/react-separator";
import { Swords, Gavel, Sparkles, Info } from "lucide-react";
import CountUp from "./reactbits/CountUp";

export default function FinalVerdict({ verdict }) {
  const { argumentAssessment, summary, nuances, confidence, winningSide } = verdict;

  // This card is the actual answer to the user's question — the payoff of
  // the whole flow — so it's given the strongest visual weight on the page
  // (accent border/badge, largest heading) rather than reading as just
  // another secondary card like the citations above it. Tailwind's static
  // scanner needs literal class names, so this is a lookup map (same
  // pattern DebateTree.jsx uses for its SIDE_STYLE/winnerStyle), not
  // template-interpolated class strings.
  const ACCENT_STYLE = {
    model1: { border: "border-model1-border", bg: "bg-model1-soft", text: "text-model1" },
    model2: { border: "border-model2-border", bg: "bg-model2-soft", text: "text-model2" },
    gold: { border: "border-gold-border", bg: "bg-gold-soft", text: "text-gold" },
  };
  const accent = ACCENT_STYLE[winningSide] || ACCENT_STYLE.gold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`mx-auto max-w-3xl rounded-lg border-2 ${accent.border} bg-paper-raised p-5 shadow-md sm:p-6`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className={`flex items-center gap-2 rounded-md ${accent.bg} px-2.5 py-1.5`}>
          <Gavel size={15} className={accent.text} />
          <span className={`text-[12px] font-bold uppercase tracking-widest ${accent.text}`}>Final verdict</span>
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

      {argumentAssessment && (
        <>
          <Separator.Root className="my-4 h-px bg-hairline" />
          <div className="mb-2 flex items-center gap-2 text-model1">
            <Swords size={13} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">
              Argument assessment — who reasoned better
            </span>
          </div>
          <p className="font-serif text-[14px] leading-relaxed text-ink-muted">{argumentAssessment}</p>
        </>
      )}

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

      <p className="mt-4 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
        <Info size={11} className="mt-0.5 shrink-0" />
        This verdict is AI-generated. The citations are real, but the judgment itself can be wrong — treat it as a starting point, not a final word.
      </p>
    </motion.div>
  );
}
