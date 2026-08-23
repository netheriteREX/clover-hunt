import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleQuestion, Send, GitBranch, Loader2, Gavel } from "lucide-react";

// A lightweight clarification thread under the verdict, distinct from
// starting a whole new debate — for "why did you weigh X over Y" type
// questions that don't need fresh evidence gathering. Also offers
// "branch into a new debate" for follow-ups substantial enough to deserve
// their own full review, seeded with the evidence already gathered here.
export default function FollowUpChat({ onAsk, onBranch, branching }) {
  const [value, setValue] = useState("");
  const [thread, setThread] = useState([]);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    const q = value.trim();
    if (!q || asking) return;
    setAsking(true);
    setValue("");
    setThread((t) => [...t, { question: q, answer: null }]);
    try {
      const answer = await onAsk(q);
      setThread((t) => t.map((m, i) => (i === t.length - 1 ? { ...m, answer } : m)));
    } catch (err) {
      setThread((t) => t.map((m, i) => (i === t.length - 1 ? { ...m, answer: null, error: err.message } : m)));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2 text-ink-muted">
        <MessageCircleQuestion size={14} />
        <span className="text-[11px] font-semibold uppercase tracking-widest">Ask a follow-up</span>
      </div>

      {thread.length > 0 && (
        <div className="mb-3 space-y-3">
          <AnimatePresence initial={false}>
            {thread.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                <p className="text-[13px] font-medium text-ink">{m.question}</p>
                {m.answer ? (
                  <div className="flex items-start gap-2 rounded-md border border-gold-border bg-gold-soft px-3 py-2 text-[13px] leading-relaxed text-ink">
                    <Gavel size={13} className="mt-0.5 shrink-0 text-gold" />
                    <p>{m.answer}</p>
                  </div>
                ) : m.error ? (
                  <p className="text-[12px] text-danger">{m.error}</p>
                ) : (
                  <div className="flex items-center gap-2 text-[12px] text-ink-faint">
                    <Loader2 size={12} className="animate-spin" /> Model 3 is thinking…
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-hairline-strong bg-paper-raised p-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. Why did you weigh that study more heavily than the other side's?"
          className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          onClick={ask}
          disabled={!value.trim() || asking}
          aria-label="Ask"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-model1 px-3 py-2 text-[12px] font-medium text-white transition disabled:opacity-50"
        >
          <Send size={13} /> <span className="hidden sm:inline">Ask</span>
        </button>
        <button
          onClick={() => value.trim() && onBranch(value.trim())}
          disabled={!value.trim() || branching}
          aria-label="Branch into a new debate"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1 disabled:opacity-50"
        >
          {branching ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
          <span className="hidden sm:inline">New debate</span>
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        "Ask" gets a quick clarification from Model 3. "New debate" starts a full new review of your follow-up, building on the evidence already found here.
      </p>
    </div>
  );
}
