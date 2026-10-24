import * as Dialog from "@radix-ui/react-dialog";
import { Info, ShieldAlert } from "lucide-react";

// Shown once per browser, on first load — see src/lib/disclaimer.js for the
// localStorage flag that suppresses it on return visits. This is the
// prominent, can't-miss version of the AI disclaimer; the shorter
// persistent footer note and the inline notes on verdicts/summaries in
// App.jsx and FinalVerdict.jsx/SteelmanChat.jsx repeat the same point in
// the moments it matters most, for anyone who dismissed this quickly.
export default function DisclaimerModal({ open, onAcknowledge }) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline-strong bg-paper-raised p-6 shadow-xl focus:outline-none"
        >
          <div className="flex items-center gap-2 text-gold">
            <ShieldAlert size={18} />
            <Dialog.Title className="text-[13px] font-semibold uppercase tracking-widest">
              Before you start
            </Dialog.Title>
          </div>

          <Dialog.Description className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-ink-muted">
            <p>
              Clover Hunt is powered by AI models, which can make mistakes — including in debate
              verdicts, Steelman Trainer's challenges and closing summaries, and how a real paper's
              findings are interpreted.
            </p>
            <p>
              The citations themselves are real, pulled live from OpenAlex — but the AI's reasoning
              about them isn't guaranteed to be correct. Treat every result here as a starting point
              for your own research, not a final answer.
            </p>
          </Dialog.Description>

          <button
            onClick={onAcknowledge}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md bg-model1 px-4 py-2.5 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            <Info size={14} /> I understand
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
