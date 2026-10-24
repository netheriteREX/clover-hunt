import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageCircleQuestion, FlagOff, BookOpenCheck, Info } from "lucide-react";

// The primary view for an in-progress Steelman Trainer session: the user's
// stated argument up top, the turn-by-turn sparring transcript, and either
// an input+send row (mid-session) or the closing summary (once wrapped up).
export default function SteelmanChat({ argument, turns, onReply, onWrapUp, loading, summarizing, summary }) {
  const [value, setValue] = useState("");

  const send = () => {
    const text = value.trim();
    if (!text || loading || summary) return;
    setValue("");
    onReply(text);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 rounded-lg border border-gold-border bg-gold-soft px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Your argument</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink">{argument}</p>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  t.role === "user" ? "bg-model1-soft text-ink" : "border border-gold-border bg-paper-raised text-ink"
                }`}
              >
                {t.role === "assistant" && (
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gold">
                    <MessageCircleQuestion size={11} /> Sparring partner
                  </p>
                )}
                <p>{t.content}</p>
                {t.citation && (
                  <a
                    href={t.citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-muted underline-offset-2 hover:underline"
                  >
                    <BookOpenCheck size={12} className="mt-0.5 shrink-0" />
                    {t.citation.title} ({t.citation.authors}, {t.citation.year})
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-ink-faint">
            <Loader2 size={12} className="animate-spin" /> Sparring partner is thinking…
          </div>
        )}
      </div>

      {summary ? (
        <div className="mt-5 rounded-lg border border-gold-border bg-gold-soft px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold">
            <FlagOff size={13} /> Session summary
          </p>
          <p className="text-[13px] leading-relaxed text-ink">{summary}</p>
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
            <Info size={11} className="mt-0.5 shrink-0" />
            This sparring partner is an AI and can be wrong, including in the challenges it raised — use this as a prompt for your own thinking, not a verdict.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-hairline-strong bg-paper-raised p-1.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Respond to the question above…"
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!value.trim() || loading}
            aria-label="Reply"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-[12px] font-medium text-white transition disabled:opacity-50"
          >
            <Send size={13} /> <span className="hidden sm:inline">Reply</span>
          </button>
          <button
            onClick={onWrapUp}
            disabled={loading || summarizing || turns.length === 0}
            aria-label="Wrap up"
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-gold-border hover:text-gold disabled:opacity-50"
          >
            {summarizing ? <Loader2 size={13} className="animate-spin" /> : <FlagOff size={13} />}
            <span className="hidden sm:inline">Wrap up</span>
          </button>
        </div>
      )}
    </div>
  );
}
