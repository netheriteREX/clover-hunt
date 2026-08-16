import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, TriangleAlert, Clover, History, FileDown, FileText } from "lucide-react";
import DebateInput from "./components/DebateInput";
import DebateTree from "./components/DebateTree";
import DebateLoadingTree from "./components/DebateLoadingTree";
import FinalVerdict from "./components/FinalVerdict";
import HistoryPanel from "./components/HistoryPanel";
import BlurText from "./components/reactbits/BlurText";
import ShinyText from "./components/reactbits/ShinyText";
import { getHistory, saveDebateToHistory, deleteFromHistory, clearHistory } from "./lib/history";
import { exportDebateAsPdf } from "./lib/exportPdf";
import { exportDebateAsDocx } from "./lib/exportDocx";

const IDLE_STATUS = { model1: "idle", model2: "idle", judge: "idle" };

async function fetchJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function App() {
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(IDLE_STATUS);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleSubmit = async (question) => {
    setLoading(true);
    setError(null);
    setDebate(null);
    setPendingQuestion(question);
    setStatus({ model1: "working", model2: "working", judge: "idle" });

    try {
      // Both sides run as independent requests, in parallel — each flips
      // its own status to "done" the moment *it* resolves, which is what
      // drives the loading screen's per-side completion animation.
      const [model1, model2] = await Promise.all([
        fetchJson("/api/debate/side", { question, stance: "first / affirmative" }).then((r) => {
          setStatus((s) => ({ ...s, model1: "done" }));
          return r;
        }),
        fetchJson("/api/debate/side", { question, stance: "second / opposing" }).then((r) => {
          setStatus((s) => ({ ...s, model2: "done" }));
          return r;
        }),
      ]);

      setStatus((s) => ({ ...s, judge: "working" }));
      const model3 = await fetchJson("/api/debate/judge", { question, model1, model2 });
      setStatus((s) => ({ ...s, judge: "done" }));

      const data = { question, model1, model2, model3 };
      setDebate(data);
      saveDebateToHistory(question, data);
      setHistory(getHistory());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setDebate(null);
    setError(null);
  };

  const loadFromHistory = (entry) => {
    setError(null);
    setDebate(entry.debate);
    setHistoryOpen(false);
  };

  const handleDeleteHistory = (id) => {
    deleteFromHistory(id);
    setHistory(getHistory());
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="h-1.5 bg-model1" />

      <header className="border-b border-hairline bg-model1-soft">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-model1-border bg-paper-raised">
              <Clover size={18} className="text-model1" />
            </span>
            <div>
              <BlurText
                text="Clover Hunt"
                as="p"
                animateBy="words"
                delay={45}
                stepDuration={0.3}
                className="font-serif text-[17px] font-semibold leading-tight text-ink"
              />
              <p className="text-[11px] uppercase tracking-widest text-ink-faint">
                Structured evidence review for policy &amp; research questions
              </p>
            </div>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-model1-border bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-model1 hover:text-model1"
          >
            <History size={14} /> History
            {history.length > 0 && (
              <span className="rounded-full bg-model1-soft px-1.5 py-0.5 text-[10px] font-semibold text-model1">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <AnimatePresence mode="wait">
          {!debate && !loading && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-6"
            >
              <DebateInput onSubmit={handleSubmit} loading={loading} />
              {error && (
                <div className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-left text-[13px] text-danger">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-8"
            >
              <DebateLoadingTree question={pendingQuestion} status={status} />
              <ShinyText
                text="Real research search + model reasoning — this can take a minute or two."
                className="text-[11px]"
                speed={2.8}
              />
            </motion.div>
          )}

          {debate && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => exportDebateAsPdf(debate)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1"
                >
                  <FileDown size={13} /> Export PDF
                </button>
                <button
                  onClick={() => exportDebateAsDocx(debate)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1"
                >
                  <FileText size={13} /> Export Word
                </button>
                <button
                  onClick={reset}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1"
                >
                  <RotateCcw size={13} /> New question
                </button>
              </div>

              <DebateTree debate={debate} />

              <FinalVerdict verdict={debate.model3.verdict} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entries={history}
        onLoad={loadFromHistory}
        onDelete={handleDeleteHistory}
        onClearAll={handleClearHistory}
      />
    </div>
  );
}
