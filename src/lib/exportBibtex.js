import { reportFilename } from "./reportContent.js";
import { collectCitations } from "./citations.js";

function escapeBibtex(value) {
  return String(value ?? "").replace(/[{}]/g, "");
}

function bibtexKey(citation, index) {
  const lastName = (citation.authors || "unknown")
    .split(",")[0]
    .trim()
    .split(" ")
    .pop()
    .replace(/[^a-zA-Z]/g, "");
  return `${lastName || "ref"}${citation.year ?? "nd"}_${index}`;
}

// Collects every real citation from both sides of a debate into a
// deduped .bib file, so the evidence can be dropped straight into a
// reference manager (Zotero, EndNote, etc.) instead of just read on-screen.
export function exportDebateAsBibtex(debate) {
  const citations = collectCitations(debate);

  const entries = citations.map((c, i) => {
    const fields = [
      `  author = {${escapeBibtex(c.authors)}}`,
      `  title = {${escapeBibtex(c.title || c.venue)}}`,
      `  journal = {${escapeBibtex(c.venue)}}`,
      `  year = {${escapeBibtex(c.year)}}`,
    ];
    if (c.url) fields.push(`  url = {${escapeBibtex(c.url)}}`);
    if (c.studyType) fields.push(`  note = {${escapeBibtex(c.studyType)}}`);
    return `@article{${bibtexKey(c, i)},\n${fields.join(",\n")}\n}`;
  });

  const blob = new Blob([entries.join("\n\n") + "\n"], { type: "application/x-bibtex" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFilename(debate.question, "bib");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
