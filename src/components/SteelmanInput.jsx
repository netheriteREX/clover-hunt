import { useState, useId } from "react";
import { motion } from "framer-motion";
import * as Label from "@radix-ui/react-label";
import { ArrowRight } from "lucide-react";
import BlurText from "./reactbits/BlurText";
import BorderGlow from "./reactbits/BorderGlow";
import SpecularButton from "./reactbits/SpecularButton";

const EXAMPLE_ARGUMENTS = [
  "Remote work should be the default for all office jobs.",
  "Social media platforms should verify every user's real identity.",
  "College should be free for everyone.",
  "Zoos do more harm than good for animal welfare.",
];

export default function SteelmanInput({ onSubmit, loading }) {
  const [value, setValue] = useState("");
  const inputId = useId();

  const submit = (argument) => {
    const trimmed = (argument ?? value).trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="mx-auto w-full max-w-2xl text-center">
      <BlurText
        text="Pressure-test your argument"
        as="h1"
        animateBy="words"
        delay={70}
        className="justify-center font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl md:text-4xl"
      />
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
        State your position and an AI sparring partner will question it — surfacing edge cases and
        angles you may not have considered, not just arguing back.
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
          Your argument
        </Label.Root>
        <BorderGlow
          backgroundColor="#ffffff"
          borderRadius={12}
          glowRadius={26}
          glowColor="275 30% 50%"
          colors={["#8559a5", "#1f5c34", "#55684a"]}
        >
          <div className="flex items-center gap-2 p-1.5">
            <input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Remote work should be the default for all office jobs."
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <SpecularButton
              type="submit"
              disabled={loading || !value.trim()}
              size="sm"
              radius={8}
              tint="#8559a5"
              tintOpacity={1}
              baseColor="#8559a5"
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
                <span>{loading ? "Thinking…" : "Spar"}</span>
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
          Example arguments
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_ARGUMENTS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setValue(c);
                submit(c);
              }}
              className="max-w-full rounded-md border border-hairline bg-paper-raised px-3 py-1.5 text-left text-[12px] text-ink-muted transition hover:border-gold-border hover:text-gold"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
