// Collects every real citation from both sides of a debate into a single
// deduped list — shared by the citation export modal and every export
// format (BibTeX, plain-text reference lists) so they all agree on what
// counts as "the citations" for a debate.
export function collectCitations(debate) {
  const seen = new Set();
  const citations = [];
  for (const side of [debate.model1, debate.model2]) {
    for (const arg of side.arguments) {
      const c = arg.citation;
      const key = c.url || `${c.authors}|${c.year}|${c.venue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push(c);
    }
  }
  return citations;
}
