import { motion } from "framer-motion";
import { Gavel, Check } from "lucide-react";

const SIDE_STYLE = {
  model1: { accent: "#1f5c34", bg: "bg-model1-soft", border: "border-model1-border", text: "text-model1", dot: "#1f5c34" },
  model2: { accent: "#55684a", bg: "bg-model2-soft", border: "border-model2-border", text: "text-model2", dot: "#55684a" },
};

// SVG "drawing" connector: a single segment that animates its own
// pathLength on a loop so it visibly redraws itself instead of sitting
// static — the tell that something is happening. Kept as a plain vertical
// line (rather than branching toward two fixed side columns) so the same
// geometry reads correctly whether the columns below are side-by-side
// (desktop) or stacked (mobile).
function DrawingConnector({ height = 40, delay = 0 }) {
  const draw = { pathLength: [0, 1, 1], opacity: [0.25, 1, 0.25] };
  const transition = {
    duration: 1.6,
    repeat: Infinity,
    repeatDelay: 0.6,
    ease: "easeInOut",
    delay,
  };

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mx-auto w-full" style={{ height }}>
      <motion.path
        d="M50,0 L50,40"
        fill="none"
        stroke="#1f5c34"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        animate={draw}
        transition={transition}
      />
    </svg>
  );
}

function ShimmerChip({ index, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: 0.25 * index, duration: 0.35 }}
      className="relative h-7 w-full max-w-[140px] overflow-hidden rounded-full border border-hairline bg-paper-raised sm:w-[104px]"
    >
      <motion.div
        className="absolute inset-y-0 w-1/2"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}2e, transparent)`,
        }}
        animate={{ x: ["-100%", "220%"] }}
        transition={{ repeat: Infinity, duration: 1.3, ease: "linear", delay: index * 0.18 }}
      />
    </motion.div>
  );
}

// The "something real just finished" tell: a settled, solid-tinted pill
// that pops in with a spring, replacing the shimmering placeholder the
// instant that side's request actually resolves.
function SettledChip({ index, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16, delay: index * 0.07 }}
      className="flex h-7 w-full max-w-[140px] items-center justify-center gap-1 rounded-full border sm:w-[104px]"
      style={{ borderColor: color, backgroundColor: `${color}16` }}
    >
      <Check size={11} strokeWidth={3} style={{ color }} />
      <span className="text-[10px] font-semibold" style={{ color }}>
        Ready
      </span>
    </motion.div>
  );
}

function SideColumn({ sideKey, status }) {
  const style = SIDE_STYLE[sideKey];
  const working = status === "working";
  const done = status === "done";

  return (
    <div className="flex h-full flex-col items-center">
      <motion.div
        animate={
          working
            ? { borderColor: [style.accent + "55", style.accent + "aa", style.accent + "55"] }
            : done
              ? { borderColor: style.accent, scale: [1, 1.04, 1] }
              : {}
        }
        transition={working ? { repeat: Infinity, duration: 1.6 } : { duration: 0.35 }}
        className={`w-full max-w-xs rounded-lg border ${style.border} ${style.bg} px-4 py-3 text-center shadow-sm`}
      >
        <div className="flex items-center justify-center gap-2">
          {done ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="flex h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: style.accent }}
            >
              <Check size={10} strokeWidth={3} className="text-white" />
            </motion.span>
          ) : (
            <motion.span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: style.dot }}
              animate={working ? { opacity: [1, 0.35, 1] } : { opacity: 0.35 }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${style.text}`}>
            {sideKey === "model1" ? "Model 1" : "Model 2"}
          </p>
        </div>
        <p className="mt-1 text-[13px] text-ink-faint">
          {done ? "Arguments ready" : working ? "Searching & arguing…" : "Waiting…"}
        </p>
      </motion.div>

      <div className="h-6 w-px bg-hairline-strong" />

      <div className="flex flex-wrap justify-center gap-2 px-1">
        {[0, 1, 2, 3].map((i) =>
          done ? (
            <SettledChip key={i} index={i} color={style.accent} />
          ) : (
            <ShimmerChip key={i} index={i} color={style.accent} />
          ),
        )}
      </div>
    </div>
  );
}

export default function DebateLoadingTree({ question, status }) {
  const bothDone = status.model1 === "done" && status.model2 === "done";
  const judgeText = status.judge === "working" ? "Auditing the evidence…" : "Waiting for both sides";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex justify-center">
        <div className="max-w-xl rounded-lg border border-hairline-strong bg-paper-raised px-6 py-3 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            Question
          </p>
          <p className="mt-0.5 font-serif text-[16px] font-medium text-ink">{question}</p>
        </div>
      </div>

      <DrawingConnector height={36} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SideColumn sideKey="model1" status={status.model1} />
        <SideColumn sideKey="model2" status={status.model2} />
      </div>

      <DrawingConnector height={36} delay={0.5} />

      <div className="flex justify-center">
        <motion.div
          animate={
            bothDone
              ? { borderColor: ["#ddc98a55", "#ddc98aff", "#ddc98a55"] }
              : { borderColor: "#ddc98a55" }
          }
          transition={{ repeat: bothDone ? Infinity : 0, duration: bothDone ? 1 : 0 }}
          className="flex max-w-md items-center gap-3 rounded-lg border border-gold-border bg-gold-soft px-6 py-4 text-left shadow-sm"
        >
          <motion.div
            animate={{ rotate: [0, -12, 0, 12, 0] }}
            transition={{
              repeat: Infinity,
              duration: bothDone ? 0.9 : 1.8,
              ease: "easeInOut",
            }}
          >
            <Gavel size={20} className="shrink-0 text-gold" />
          </motion.div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              Model 3 · {bothDone ? "Working" : "Waiting"}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-muted">{judgeText}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
