import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Gavel, BookOpen } from "lucide-react";

const SIDE_STYLE = {
  model1: {
    text: "text-model1",
    bg: "bg-model1-soft",
    border: "border-model1-border",
    dot: "var(--color-model1)",
  },
  model2: {
    text: "text-model2",
    bg: "bg-model2-soft",
    border: "border-model2-border",
    dot: "var(--color-model2)",
  },
};

function qualityColor(score) {
  if (score == null) return "var(--color-ink-faint)";
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-gold)";
  return "var(--color-danger)";
}

// A simple Y-shaped connector: one point above fanning to two points below
// (or, read upside down, two points converging to one). Reused for both.
function TreeConnector({ height = 40 }) {
  return (
    <div className="relative mx-auto w-full" style={{ height }}>
      <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-hairline-strong" />
      <div className="absolute left-1/4 right-1/4 top-1/2 h-px bg-hairline-strong" />
      <div className="absolute left-1/4 top-1/2 h-1/2 w-px -translate-x-1/2 bg-hairline-strong" />
      <div className="absolute left-3/4 top-1/2 h-1/2 w-px -translate-x-1/2 bg-hairline-strong" />
    </div>
  );
}

function EvidenceChip({ arg, critique, side, index, onSelect }) {
  // Chip color reflects argument quality (does the reasoning hold up) over
  // raw evidence quality — a flawless study argued dishonestly should read
  // worse than a modest study argued fairly. Falls back to qualityScore for
  // history entries saved before argumentScore existed.
  const color = qualityColor(critique?.argumentScore ?? critique?.qualityScore);
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * index, duration: 0.3 }}
          onClick={() => onSelect({ side, arg, critique })}
          className="group flex max-w-[220px] items-center gap-1.5 rounded-full border border-hairline bg-paper-raised py-1.5 pl-2.5 pr-3 text-left shadow-sm transition hover:border-hairline-strong hover:shadow"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-[12px] text-ink-muted group-hover:text-ink">
            {arg.citation.authors} '{String(arg.citation.year).slice(-2)}
          </span>
        </motion.button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-hairline-strong bg-ink px-3 py-2 text-[12px] leading-snug text-paper shadow-lg"
        >
          {arg.claim}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SideColumn({ sideKey, model, critiques, onSelectEvidence }) {
  const style = SIDE_STYLE[sideKey];
  const critiqueFor = (argId) =>
    critiques?.find((c) => c.side === sideKey && c.argumentId === argId);

  return (
    <div className="flex h-full flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-xs rounded-lg border ${style.border} ${style.bg} px-4 py-3 text-center shadow-sm`}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.dot }} />
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${style.text}`}>
            {sideKey === "model1" ? "Model 1" : "Model 2"}
          </p>
        </div>
        <p className="mt-1 text-[15px] font-semibold text-ink">{model.side}</p>
      </motion.div>

      <div className="h-6 w-px bg-hairline-strong" />

      <div className="flex flex-wrap justify-center gap-2 px-1">
        {model.arguments.map((arg, i) => (
          <EvidenceChip
            key={arg.id}
            arg={arg}
            critique={critiqueFor(arg.id)}
            side={sideKey}
            index={i}
            onSelect={onSelectEvidence}
          />
        ))}
      </div>
    </div>
  );
}

export default function DebateTree({ debate, onSelectEvidence }) {
  const { question, model1, model2, model3 } = debate;
  const { verdict } = model3;

  const winnerStyle =
    verdict.winningSide === "model1"
      ? { text: "text-model1", bg: "bg-model1-soft", border: "border-model1-border" }
      : verdict.winningSide === "model2"
        ? { text: "text-model2", bg: "bg-model2-soft", border: "border-model2-border" }
        : { text: "text-gold", bg: "bg-gold-soft", border: "border-gold-border" };

  return (
    <Tooltip.Provider>
      <div className="mx-auto w-full max-w-4xl">
        {/* Question node */}
        <div className="flex justify-center">
          <div className="max-w-xl rounded-lg border border-hairline-strong bg-paper-raised px-6 py-3 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              Question
            </p>
            <p className="mt-0.5 font-serif text-[16px] font-medium text-ink">{question}</p>
          </div>
        </div>

        <TreeConnector height={36} />

        {/* Two branches */}
        <div className="grid grid-cols-2 gap-4">
          <SideColumn
            sideKey="model1"
            model={model1}
            critiques={model3.critiques}
            onSelectEvidence={onSelectEvidence}
          />
          <SideColumn
            sideKey="model2"
            model={model2}
            critiques={model3.critiques}
            onSelectEvidence={onSelectEvidence}
          />
        </div>

        <TreeConnector height={36} />

        {/* Verdict node */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`flex max-w-md items-center gap-3 rounded-lg border ${winnerStyle.border} ${winnerStyle.bg} px-6 py-4 text-left shadow-sm`}
          >
            <Gavel size={20} className={`shrink-0 ${winnerStyle.text}`} />
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${winnerStyle.text}`}>
                Model 3 · Verdict · {verdict.confidence}% confidence
              </p>
              <p className="mt-0.5 text-[14px] font-medium text-ink">
                {verdict.winningSide === "mixed"
                  ? "Mixed — both sides argued well"
                  : verdict.winningSide === "model1"
                    ? `${model1.side} — the stronger argument`
                    : `${model2.side} — the stronger argument`}
              </p>
            </div>
          </motion.div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
          <BookOpen size={11} /> Click any citation to inspect the evidence and its critique
        </p>
      </div>
    </Tooltip.Provider>
  );
}
