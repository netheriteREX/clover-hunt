import { reportFilename } from "./reportContent.js";
import { collectCitations } from "./citations.js";
import { CITATION_STYLES } from "./citationFormats.js";

// Downloads a plain-text reference list in the given style (APA/MLA/
// Chicago) — one formatted entry per line, ready to paste into a document.
export function exportDebateAsCitationText(debate, styleId) {
  const style = CITATION_STYLES.find((s) => s.id === styleId);
  if (!style) throw new Error(`Unknown citation style: ${styleId}`);

  const citations = collectCitations(debate);
  const text = citations.map((c) => style.format(c)).join("\n\n") + "\n";

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFilename(debate.question, `${styleId}.txt`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
