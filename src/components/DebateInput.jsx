import { useState, useId } from "react";
import * as Label from "@radix-ui/react-label";
import { ArrowRight } from "lucide-react";
import { EXAMPLE_QUESTIONS } from "../lib/mockDebate";

export default function DebateInput({ onSubmit, loading }) {
  const [value, setValue] = useState("");
  const inputId = useId();

  const submit = (question) => {
    const trimmed = (question ?? value).trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="mx-auto w-full max-w-2xl text-center">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Submit a question for review
      </h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
        Two models independently argue opposite sides, each citing real research.
        A third model audits the evidence quality and delivers a nuanced verdict.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-7 text-left"
      >
        <Label.Root
          htmlFor={inputId}
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-ink-muted"
        >
          Question
        </Label.Root>
        <div className="flex items-center gap-2 rounded-lg border border-hairline-strong bg-paper-raised p-1.5 shadow-sm focus-within:border-model1">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Does social media cause teenagers to become less social?"
            className="flex-1 bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="flex items-center gap-1.5 rounded-md bg-model1 px-4 py-2 text-sm font-medium text-white transition hover:bg-model1/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Reviewing…" : "Review"}
            {!loading && <ArrowRight size={14} />}
          </button>
        </div>
      </form>

      <div className="mt-5 text-left">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          Example questions
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setValue(q);
                submit(q);
              }}
              className="rounded-md border border-hairline bg-paper-raised px-3 py-1.5 text-[12px] text-ink-muted transition hover:border-model1-border hover:text-model1"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
