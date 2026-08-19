import { useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Gavel, X, ExternalLink, AlertTriangle, CheckCircle2, Swords, Scale } from "lucide-react";
import CountUp from "./reactbits/CountUp";
import BlurText from "./reactbits/BlurText";

const MODEL1 = "var(--color-model1)";
const MODEL2 = "var(--color-model2)";
const GOLD = "var(--color-gold)";

const SIDE_STYLE = {
  model1: { core: MODEL1, text: "text-model1", bg: "bg-model1-soft", border: "border-model1-border" },
  model2: { core: MODEL2, text: "text-model2", bg: "bg-model2-soft", border: "border-model2-border" },
};

function qualityColor(score) {
  if (score == null) return "var(--color-ink-faint)";
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return GOLD;
  return "var(--color-danger)";
}

// Spread N children evenly around a center x/y, like the fan of citation
// nodes hanging off each model in the reference sketch.
function spread(count, center) {
  const gap = count <= 3 ? 15 : 12;
  const start = -(count - 1) / 2;
  return Array.from({ length: count }, (_, i) => center + (start + i) * gap);
}

// A single straight wire between two points in the shared 0-100 x 0-100
// coordinate space (the SVG is stretched to fill the tall canvas with
// preserveAspectRatio="none"), matching the plain straight connecting
// lines in the reference diagram — draws itself in on scroll, then keeps a
// faint "signal" travelling along it.
function Wire({ x1, y1, x2, y2, color, delay = 0, flowDuration = 3 }) {
  const path = `M ${x1} ${y1} L ${x2} ${y2}`;
  return (
    <g>
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={0.22}
        opacity={0.4}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={0.4}
        strokeLinecap="round"
        strokeDasharray="2.5 8"
        initial={{ strokeDashoffset: 0, opacity: 0 }}
        whileInView={{ strokeDashoffset: -100, opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{
          strokeDashoffset: { duration: flowDuration, repeat: Infinity, ease: "linear", delay: delay + 0.5 },
          opacity: { duration: 0.3, delay: delay + 0.5 },
        }}
        style={{ filter: `drop-shadow(0 0 1px ${color})` }}
      />
    </g>
  );
}

function Node({ x, y, children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay, duration: 0.4 }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {children}
    </motion.div>
  );
}

function HubNode({ x, y, sideKey, model, delay }) {
  const style = SIDE_STYLE[sideKey];
  return (
    <Node x={x} y={y} delay={delay} className="z-10 flex flex-col items-center gap-2">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border-2 bg-paper-raised shadow-sm"
        style={{ borderColor: style.core }}
      >
        <span className="text-[16px] font-bold" style={{ color: style.core }}>
          {sideKey === "model1" ? "1" : "2"}
        </span>
      </div>
      <div className={`w-40 rounded-md border ${style.border} ${style.bg} px-3 py-1.5 text-center shadow-sm`}>
        <p className={`text-[9px] font-semibold uppercase tracking-widest ${style.text}`}>
          {sideKey === "model1" ? "Model 1" : "Model 2"}
        </p>
        <p className="text-[12px] font-semibold text-ink">{model.side}</p>
      </div>
    </Node>
  );
}

function CitationDot({ arg, critique, side, x, y, delay, onSelect }) {
  const color = qualityColor(critique?.argumentScore ?? critique?.qualityScore);
  return (
    <Node x={x} y={y} delay={delay} className="z-10">
      <Tooltip.Root delayDuration={250}>
        <Tooltip.Trigger asChild>
          <button onClick={() => onSelect({ side, arg, critique, color })} className="group flex flex-col items-center gap-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-raised shadow-sm transition group-hover:scale-110"
              style={{ border: `3px solid ${color}` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            </span>
            <span className="whitespace-nowrap text-[10px] text-ink-muted group-hover:text-ink">
              {arg.citation.authors.split(",")[0]} '{String(arg.citation.year).slice(-2)}
            </span>
          </button>
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
    </Node>
  );
}

function ScoreBar({ icon: Icon, label, score }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={11} className="shrink-0 text-ink-faint" />
      <span className="w-20 shrink-0 text-[11px] text-ink-faint">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: qualityColor(score) }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-ink-faint">{score}/100</span>
    </div>
  );
}

// Mobile fallback for CitationDot — the coordinate-canvas diagram is a
// desktop paradigm (fixed-px hub labels + percentage positions collide at
// phone widths), so below `md` we render evidence as plain flex-wrap chips
// in normal document flow instead, sharing the same onSelect -> FocusView
// interaction as the desktop diagram.
function MobileEvidenceChip({ arg, critique, side, onSelect }) {
  const color = qualityColor(critique?.argumentScore ?? critique?.qualityScore);
  return (
    <button
      onClick={() => onSelect({ side, arg, critique, color })}
      className="flex items-center gap-2 rounded-full border border-hairline bg-paper px-3 py-1.5 text-left shadow-sm active:scale-95"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[12px] text-ink-muted">
        {arg.citation.authors.split(",")[0]} '{String(arg.citation.year).slice(-2)}
      </span>
    </button>
  );
}

function MobileSideCard({ sideKey, model, critiques, onSelect }) {
  const style = SIDE_STYLE[sideKey];
  const critiqueFor = (argId) => critiques?.find((c) => c.side === sideKey && c.argumentId === argId);
  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-4 shadow-sm`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${style.text}`}>
        {sideKey === "model1" ? "Model 1" : "Model 2"}
      </p>
      <p className="mt-0.5 text-[14px] font-semibold text-ink">{model.side}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {model.arguments.map((arg) => (
          <MobileEvidenceChip key={arg.id} arg={arg} critique={critiqueFor(arg.id)} side={sideKey} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// Full focus takeover — the rest of the network is faded out entirely (see
// DebateTree below) and this is the only thing left on screen: one big
// hollow node and its write-up, nothing else competing for attention.
function FocusView({ item, onClose }) {
  const { side, arg, critique, color } = item;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
    >
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-6 py-16">
        <button
          onClick={onClose}
          aria-label="Close"
          className="fixed right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-hairline-strong bg-paper-raised text-ink-faint shadow-sm hover:text-ink"
        >
          <X size={18} />
        </button>

        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-paper-raised shadow-md"
          style={{ border: `5px solid ${color}` }}
        />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="mt-6 w-full text-center"
        >
          <p className={`text-[11px] font-semibold uppercase tracking-widest ${SIDE_STYLE[side].text}`}>
            {side === "model1" ? "Model 1" : "Model 2"}
          </p>
          <p className="mt-2 font-serif text-[20px] font-medium leading-snug text-ink">{arg.claim}</p>
          <div className="mx-auto mt-3 h-px w-12" style={{ backgroundColor: color }} />
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{arg.reasoning}</p>

          <p className="mt-6 text-[13.5px] text-ink">
            <span className="font-semibold">
              {arg.citation.authors} ({arg.citation.year})
            </span>{" "}
            — <span className="italic text-ink-muted">{arg.citation.venue}</span>
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {arg.citation.studyType} · {arg.citation.sampleSize}
          </p>
          <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{arg.citation.summary}</p>
          {arg.citation.url && (
            <a
              href={arg.citation.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-model1 hover:underline"
            >
              View paper <ExternalLink size={11} />
            </a>
          )}

          {critique && (
            <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
              <div className="mx-auto h-px w-12 bg-hairline" />
              {typeof critique.argumentScore === "number" && (
                <ScoreBar icon={Swords} label="Argument" score={critique.argumentScore} />
              )}
              <ScoreBar icon={Scale} label="Evidence" score={critique.qualityScore} />

              {critique.reasoningFlaws?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[9.5px] font-semibold uppercase tracking-widest text-ink-faint">Reasoning</p>
                  {critique.reasoningFlaws.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[12px] text-danger">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 space-y-1">
                {critique.flaws?.map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12px] text-danger">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
                {critique.strengths?.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12px] text-success">
                    <CheckCircle2 size={11} className="mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              {critique.notes && <p className="mt-2 text-[12px] italic text-ink-faint">{critique.notes}</p>}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function DebateTree({ debate }) {
  const { question, model1, model2, model3 } = debate;
  const { verdict } = model3;
  const critiqueFor = (side, argId) => model3.critiques?.find((c) => c.side === side && c.argumentId === argId);
  const [selected, setSelected] = useState(null);

  // One tall shared coordinate canvas (0-100 x 0-100) for the whole tree —
  // question at top, models below it, each model's evidence fanning out
  // below that, and every evidence node wiring into the verdict at the
  // bottom, mirroring the reference sketch. The canvas is deliberately
  // tall (220vh) so scrolling through it is a real scrollytelling beat,
  // not something that fits in one glance.
  const QUESTION = { x: 50, y: 5 };
  const HUB1 = { x: 25, y: 24 };
  const HUB2 = { x: 75, y: 24 };
  const EVIDENCE_Y = 55;
  const VERDICT = { x: 50, y: 90 };

  const cite1Xs = spread(model1.arguments.length, HUB1.x);
  const cite2Xs = spread(model2.arguments.length, HUB2.x);

  const winnerStyle =
    verdict.winningSide === "model1"
      ? { text: "text-model1", bg: "bg-model1-soft", border: "border-model1-border", core: MODEL1 }
      : verdict.winningSide === "model2"
        ? { text: "text-model2", bg: "bg-model2-soft", border: "border-model2-border", core: MODEL2 }
        : { text: "text-gold", bg: "bg-gold-soft", border: "border-gold-border", core: GOLD };

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start 0.8", "end 0.35"] });
  const spineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Tooltip.Provider>
      {/* Mobile: the coordinate-canvas diagram below relies on fixed-px
          labels sitting at absolute percentage positions, which collide by
          construction at phone widths — so below `md` we swap in a plain
          stacked flow layout instead of trying to patch the canvas. */}
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 md:hidden">
        <div className="rounded-lg border border-hairline-strong bg-paper-raised px-5 py-3 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Question</p>
          <p className="mt-0.5 font-serif text-[15px] font-medium leading-snug text-ink">{question}</p>
        </div>

        <MobileSideCard sideKey="model1" model={model1} critiques={model3.critiques} onSelect={setSelected} />
        <MobileSideCard sideKey="model2" model={model2} critiques={model3.critiques} onSelect={setSelected} />

        <div className={`flex items-center gap-3 rounded-lg border ${winnerStyle.border} ${winnerStyle.bg} px-5 py-4 text-left shadow-sm`}>
          <Gavel size={20} className={`shrink-0 ${winnerStyle.text}`} />
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${winnerStyle.text}`}>
              Model 3 · Verdict · <CountUp to={verdict.confidence} suffix="%" duration={1} /> confidence
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-ink">
              {verdict.winningSide === "mixed"
                ? "Mixed — both sides argued well"
                : verdict.winningSide === "model1"
                  ? `${model1.side} — the stronger argument`
                  : `${model2.side} — the stronger argument`}
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-faint">Tap any evidence chip to inspect it</p>
      </div>

      {/* Desktop / tablet: the full "neural network" diagram */}
      <div ref={containerRef} className="relative mx-auto hidden w-full max-w-4xl md:block" style={{ minHeight: "220vh" }}>
      <motion.div
        animate={{ opacity: selected ? 0 : 1 }}
        transition={{ duration: 0.25 }}
        style={{ pointerEvents: selected ? "none" : "auto" }}
      >
        <motion.div
          className="pointer-events-none absolute left-1/2 top-0 w-px origin-top bg-hairline-strong"
          style={{ height: "100%", scaleY: spineScale }}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Wire x1={QUESTION.x} y1={QUESTION.y} x2={HUB1.x} y2={HUB1.y} color={SIDE_STYLE.model1.core} flowDuration={2.6} />
          <Wire x1={QUESTION.x} y1={QUESTION.y} x2={HUB2.x} y2={HUB2.y} color={SIDE_STYLE.model2.core} flowDuration={3} />

          {cite1Xs.map((x, i) => (
            <Wire key={`h1-${i}`} x1={HUB1.x} y1={HUB1.y} x2={x} y2={EVIDENCE_Y} color={SIDE_STYLE.model1.core} delay={0.2 + i * 0.08} />
          ))}
          {cite2Xs.map((x, i) => (
            <Wire key={`h2-${i}`} x1={HUB2.x} y1={HUB2.y} x2={x} y2={EVIDENCE_Y} color={SIDE_STYLE.model2.core} delay={0.2 + i * 0.08} />
          ))}

          {cite1Xs.map((x, i) => (
            <Wire
              key={`v1-${i}`}
              x1={x}
              y1={EVIDENCE_Y}
              x2={VERDICT.x}
              y2={VERDICT.y}
              color={SIDE_STYLE.model1.core}
              delay={0.4 + i * 0.06}
              flowDuration={3.4}
            />
          ))}
          {cite2Xs.map((x, i) => (
            <Wire
              key={`v2-${i}`}
              x1={x}
              y1={EVIDENCE_Y}
              x2={VERDICT.x}
              y2={VERDICT.y}
              color={SIDE_STYLE.model2.core}
              delay={0.4 + i * 0.06}
              flowDuration={3.4}
            />
          ))}
        </svg>

        {/* Question banner */}
        <Node x={QUESTION.x} y={QUESTION.y} className="z-10 w-[min(85%,420px)]">
          <div className="rounded-lg border border-hairline-strong bg-paper-raised px-6 py-3 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Question</p>
            <BlurText
              text={question}
              as="p"
              animateBy="words"
              delay={30}
              stepDuration={0.3}
              className="mt-0.5 justify-center font-serif text-[15px] font-medium leading-snug text-ink"
            />
          </div>
        </Node>

        <HubNode x={HUB1.x} y={HUB1.y} sideKey="model1" model={model1} delay={0.15} />
        <HubNode x={HUB2.x} y={HUB2.y} sideKey="model2" model={model2} delay={0.2} />

        {model1.arguments.map((arg, i) => (
          <CitationDot
            key={arg.id}
            arg={arg}
            critique={critiqueFor("model1", arg.id)}
            side="model1"
            x={cite1Xs[i]}
            y={EVIDENCE_Y}
            delay={0.3 + i * 0.08}
            onSelect={setSelected}
          />
        ))}
        {model2.arguments.map((arg, i) => (
          <CitationDot
            key={arg.id}
            arg={arg}
            critique={critiqueFor("model2", arg.id)}
            side="model2"
            x={cite2Xs[i]}
            y={EVIDENCE_Y}
            delay={0.3 + i * 0.08}
            onSelect={setSelected}
          />
        ))}

        {/* Verdict banner */}
        <Node x={VERDICT.x} y={VERDICT.y} className="z-10 w-[min(85%,440px)]">
          <div className={`flex items-center gap-3 rounded-lg border ${winnerStyle.border} ${winnerStyle.bg} px-6 py-4 text-left shadow-sm`}>
            <Gavel size={20} className={`shrink-0 ${winnerStyle.text}`} />
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${winnerStyle.text}`}>
                Model 3 · Verdict · <CountUp to={verdict.confidence} suffix="%" duration={1} /> confidence
              </p>
              <p className="mt-0.5 text-[14px] font-medium text-ink">
                {verdict.winningSide === "mixed"
                  ? "Mixed — both sides argued well"
                  : verdict.winningSide === "model1"
                    ? `${model1.side} — the stronger argument`
                    : `${model2.side} — the stronger argument`}
              </p>
            </div>
          </div>
        </Node>

        <p className="absolute z-10 text-[11px] text-ink-faint" style={{ top: "97%", left: "50%", transform: "translateX(-50%)" }}>
          Click any evidence node to inspect it
        </p>
      </motion.div>
      </div>

      <AnimatePresence>
        {selected && <FocusView item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </Tooltip.Provider>
  );
}
