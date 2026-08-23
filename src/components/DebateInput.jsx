import { useState, useId } from "react";
import { motion } from "framer-motion";
import * as Label from "@radix-ui/react-label";
import { ArrowRight } from "lucide-react";
import { EXAMPLE_QUESTIONS } from "../lib/mockDebate";
import BlurText from "./reactbits/BlurText";
import BorderGlow from "./reactbits/BorderGlow";
import SpecularButton from "./reactbits/SpecularButton";

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
      <BlurText
        text="Submit a question for review"
        as="h1"
        animateBy="words"
        delay={70}
        className="justify-center font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl md:text-4xl"
      />
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
        <BorderGlow
          backgroundColor="#ffffff"
          borderRadius={12}
          glowRadius={26}
          glowColor="141 55% 45%"
          colors={["#1f5c34", "#55684a", "#8559a5"]}
        >
          <div className="flex items-center gap-2 p-1.5">
            <input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Does social media cause teenagers to become less social?"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <SpecularButton
              type="submit"
              disabled={loading || !value.trim()}
              size="sm"
              radius={8}
              tint="#1f5c34"
              tintOpacity={1}
              baseColor="#1f5c34"
              lineColor="#ffffff"
              textColor="#ffffff"
              intensity={1.3}
              shineSize={8}
              shineFade={35}
              thickness={0.6}
              speed={0.5}
              autoAnimate
            >
              <motion.span initial="rest" whileHover="hover" animate="rest" className="flex items-center">
                <span>{loading ? "Reviewing…" : "Review"}</span>
                {!loading && (
                  <motion.span
                    variants={{ rest: { width: 0, opacity: 0, marginLeft: 0 }, hover: { width: 14, opacity: 1, marginLeft: 6 } }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex overflow-hidden"
                  >
                    <ArrowRight size={14} />
                  </motion.span>
                )}
              </motion.span>
            </SpecularButton>
          </div>
        </BorderGlow>
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
              className="max-w-full rounded-md border border-hairline bg-paper-raised px-3 py-1.5 text-left text-[12px] text-ink-muted transition hover:border-model1-border hover:text-model1"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
