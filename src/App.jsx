import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  RotateCcw,
  TriangleAlert,
  Clover,
  History,
  Download,
  FileDown,
  FileText,
  BookMarked,
  ChevronDown,
  Share2,
  Check,
  Swords,
  ScanSearch,
  Loader2,
} from "lucide-react";
import DebateInput from "./components/DebateInput";
import DebateTree from "./components/DebateTree";
import DebateLoadingTree from "./components/DebateLoadingTree";
import FinalVerdict from "./components/FinalVerdict";
import FollowUpChat from "./components/FollowUpChat";
import HistoryPanel from "./components/HistoryPanel";
import CitationExportModal from "./components/CitationExportModal";
import FactCheckInput from "./components/FactCheckInput";
import FactCheckResult from "./components/FactCheckResult";
import ShinyText from "./components/reactbits/ShinyText";
import GradientWaves from "./components/reactbits/GradientWaves";
import { getHistory, saveDebateToHistory, deleteFromHistory, clearHistory } from "./lib/history";
import { exportDebateAsPdf } from "./lib/exportPdf";
import { exportDebateAsDocx } from "./lib/exportDocx";
import { encodeDebateToUrl, decodeDebateFromHash } from "./lib/shareLink";

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
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Fact-Check mode — a separate, lighter-weight flow alongside the full
  // debate above. Kept as its own state rather than overloading `debate`,
  // since the two have different shapes and can coexist independently
  // (switching modes doesn't need to clear either one).
  const [mode, setMode] = useState("debate");
  const [factCheck, setFactCheck] = useState(null);
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [factCheckError, setFactCheckError] = useState(null);

  useEffect(() => {
    setHistory(getHistory());

    // A debate can arrive packed into the URL itself (see "Share" below) —
    // load it straight into view. Not saved to history: this browser
    // didn't generate it, so it shouldn't silently populate the opener's
    // own saved reviews.
    if (window.location.hash.startsWith("#share=")) {
      decodeDebateFromHash(window.location.hash).then((decoded) => {
        if (decoded) {
          setDebate(decoded);
        } else {
          setError("This share link couldn't be loaded — it may be corrupted or incomplete.");
        }
      });
    }
  }, []);

  // `seed`, when present, comes from "branch into a new debate" — each
  // side's own citations from the debate being branched off of, so its
  // agent search doesn't have to re-find the same evidence from scratch.
  const handleSubmit = async (question, seed = null) => {
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
        fetchJson("/api/debate/side", {
          question,
          stance: "first / affirmative",
          ...(seed?.model1 ? { seedPriorPosition: seed.model1.position, seedCitations: seed.model1.citations } : {}),
        }).then((r) => {
          setStatus((s) => ({ ...s, model1: "done" }));
          return r;
        }),
        fetchJson("/api/debate/side", {
          question,
          stance: "second / opposing",
          ...(seed?.model2 ? { seedPriorPosition: seed.model2.position, seedCitations: seed.model2.citations } : {}),
        }).then((r) => {
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

  const handleBranch = (followUpQuestion) => {
    if (!debate) return;
    const seed = {
      model1: { position: debate.model1.position, citations: debate.model1.arguments.map((a) => a.citation) },
      model2: { position: debate.model2.position, citations: debate.model2.arguments.map((a) => a.citation) },
    };
    return handleSubmit(followUpQuestion, seed);
  };

  const handleFollowUpAsk = async (followUpQuestion) => {
    const data = await fetchJson("/api/debate/followup", {
      question: debate.question,
      model1: debate.model1,
      model2: debate.model2,
      verdict: debate.model3.verdict,
      followUpQuestion,
    });
    return data.answer;
  };

  // A reader flagged a citation as wrong/misused — re-run the judgment
  // with that objection injected. Updates the live debate view; not
  // persisted back into saved history (flags refine a review in progress,
  // not the saved record of it).
  const handleFlag = async (side, argumentId, reason) => {
    const data = await fetchJson("/api/debate/reflag", {
      question: debate.question,
      model1: debate.model1,
      model2: debate.model2,
      critiques: debate.model3.critiques,
      verdict: debate.model3.verdict,
      side,
      argumentId,
      reason,
    });
    setDebate((d) => ({ ...d, model3: { critiques: data.critiques, verdict: data.verdict } }));
  };

  const reset = () => {
    setDebate(null);
    setError(null);
    if (window.location.hash.startsWith("#share=")) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
  };

  const handleFactCheckSubmit = async (claim) => {
    setFactCheckLoading(true);
    setFactCheckError(null);
    setFactCheck(null);
    try {
      const data = await fetchJson("/api/factcheck", { claim });
      setFactCheck(data);
    } catch (err) {
      setFactCheckError(err.message);
    } finally {
      setFactCheckLoading(false);
    }
  };

  const resetFactCheck = () => {
    setFactCheck(null);
    setFactCheckError(null);
  };

  const handleShare = async () => {
    try {
      const url = await encodeDebateToUrl(debate);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch (err) {
      setError(err.message || "Couldn't create a share link.");
    }
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

  const showWaves = !debate && !loading && !factCheck && !factCheckLoading;
  const onBlankScreen = !debate && !loading && !factCheck && !factCheckLoading;

  return (
    <div className="relative min-h-screen bg-paper text-ink" data-theme={mode === "factcheck" ? "lavender" : undefined}>
      {/* Fixed to the viewport (not the scrolling content) so it always
          covers the full screen and never clips or scrolls away, and sits
          behind everything else via the z-10 wrapper below. */}
      {showWaves && (
        <div className="pointer-events-none fixed inset-0 z-0">
          {/* Two full-time GradientWaves layers, one per mode's color theme —
              crossfading their opacity on mode change is far more reliable
              than trying to animate the WebGL shader's own color uniforms
              through a single instance, and doubles as the actual visual
              "mode changed" cue. */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: mode === "debate" ? 1 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <GradientWaves
              horizonColor="#f6efdc"
              waveColor="#123d24"
              crestColor="#2a6b3f"
              speed={0.25}
              amplitude={2.5}
              fogDepth={26}
              detail="high"
              brightness={1.35}
              opacity={0.9}
              mouseInteraction
              parallaxStrength={0.3}
              grain={false}
            />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: mode === "factcheck" ? 1 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <GradientWaves
              horizonColor="#f0ebf4"
              waveColor="#523766"
              crestColor="#a66fce"
              speed={0.25}
              amplitude={2.5}
              fogDepth={26}
              detail="high"
              brightness={1.35}
              opacity={0.9}
              mouseInteraction
              parallaxStrength={0.3}
              grain={false}
            />
          </motion.div>
        </div>
      )}

      <div className="relative z-10">
      <div className="h-1.5 bg-model1" />

      <header className="border-b border-hairline bg-model1-soft">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-model1-border bg-paper-raised">
            <Clover size={18} className="text-model1" />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-[18px] font-semibold leading-tight text-ink">Clover Hunt</p>
            <p className="text-[10px] uppercase tracking-widest text-ink-muted sm:text-[11px]">
              Structured evidence review for policy &amp; research questions
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <AnimatePresence mode="wait">
          {onBlankScreen && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-6"
            >
              <div className="flex rounded-md border border-hairline-strong bg-paper-raised p-1">
                <button
                  onClick={() => setMode("debate")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition ${
                    mode === "debate" ? "bg-model1-soft text-model1" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Swords size={13} /> Debate
                </button>
                <button
                  onClick={() => setMode("factcheck")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition ${
                    mode === "factcheck" ? "bg-gold-soft text-gold" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <ScanSearch size={13} /> Fact Check
                </button>
              </div>

              {mode === "debate" ? (
                <>
                  <DebateInput onSubmit={handleSubmit} loading={loading} />
                  {error && (
                    <div className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-left text-[13px] text-danger">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FactCheckInput onSubmit={handleFactCheckSubmit} loading={factCheckLoading} />
                  {factCheckError && (
                    <div className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-left text-[13px] text-danger">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                      <p>{factCheckError}</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {factCheckLoading && (
            <motion.div
              key="factcheck-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-8"
            >
              <Loader2 size={28} className="animate-spin text-gold" />
              <ShinyText text="Gathering real evidence on both sides of this claim…" className="text-[11px]" speed={2.8} />
            </motion.div>
          )}

          {factCheck && !factCheckLoading && (
            <motion.div
              key="factcheck-results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="flex justify-end">
                <button
                  onClick={resetFactCheck}
                  aria-label="New claim"
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[11px] font-medium text-ink-muted transition hover:border-gold-border hover:text-gold sm:text-[12px]"
                >
                  <RotateCcw size={13} /> <span>New claim</span>
                </button>
              </div>

              <FactCheckResult result={factCheck} />
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setHistoryOpen(true)}
                  aria-label="History"
                  className="relative flex shrink-0 items-center justify-center rounded-md border border-hairline-strong bg-paper-raised p-2 text-ink-muted transition hover:border-model1-border hover:text-model1"
                >
                  <History size={16} />
                  {history.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-model1-soft px-1.5 py-0.5 text-[10px] font-semibold text-model1">
                      {history.length}
                    </span>
                  )}
                </button>
                <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={handleShare}
                  aria-label="Copy share link"
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[11px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1 sm:text-[12px]"
                >
                  {shareCopied ? (
                    <>
                      <Check size={13} className="text-success" /> <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={13} /> <span>Share</span>
                    </>
                  )}
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      aria-label="Export"
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[11px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1 sm:text-[12px]"
                    >
                      <Download size={13} /> <span>Export</span> <ChevronDown size={12} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 min-w-[160px] rounded-md border border-hairline-strong bg-paper-raised p-1 shadow-lg"
                    >
                      <DropdownMenu.Item
                        onSelect={() => exportDebateAsPdf(debate)}
                        className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[12px] text-ink-muted outline-none transition hover:bg-model1-soft hover:text-model1 data-[highlighted]:bg-model1-soft data-[highlighted]:text-model1"
                      >
                        <FileDown size={13} /> Export PDF
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => exportDebateAsDocx(debate)}
                        className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[12px] text-ink-muted outline-none transition hover:bg-model1-soft hover:text-model1 data-[highlighted]:bg-model1-soft data-[highlighted]:text-model1"
                      >
                        <FileText size={13} /> Export Word
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => setCitationModalOpen(true)}
                        className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[12px] text-ink-muted outline-none transition hover:bg-model1-soft hover:text-model1 data-[highlighted]:bg-model1-soft data-[highlighted]:text-model1"
                      >
                        <BookMarked size={13} /> Export citations
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
                <button
                  onClick={reset}
                  aria-label="New question"
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline-strong bg-paper-raised px-3 py-2 text-[11px] font-medium text-ink-muted transition hover:border-model1-border hover:text-model1 sm:text-[12px]"
                >
                  <RotateCcw size={13} /> <span className="sm:inline">New question</span>
                </button>
                </div>
              </div>

              <DebateTree debate={debate} onFlag={handleFlag} />

              <FinalVerdict verdict={debate.model3.verdict} />

              <FollowUpChat onAsk={handleFollowUpAsk} onBranch={handleBranch} branching={loading} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      <CitationExportModal open={citationModalOpen} onOpenChange={setCitationModalOpen} debate={debate} />

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
