// Best-effort reference formatting. `citation.authors` is a flat
// "First Last, First Last" string (from OpenAlex authorships), not
// separate given/family fields, so name splitting here is a heuristic —
// good enough for a quick copyable reference, not a bibliographic-grade
// citation manager.
function parseAuthors(authorsStr) {
  if (!authorsStr) return [];
  return authorsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((full) => {
      const parts = full.split(/\s+/);
      const last = parts.pop() || full;
      const first = parts.join(" ");
      return { first, last, full };
    });
}

function initials(first) {
  return first
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");
}

export function formatApa(c) {
  const authors = parseAuthors(c.authors);
  let authorPart;
  if (authors.length === 0) authorPart = "Unknown author";
  else if (authors.length === 1) authorPart = `${authors[0].last}, ${initials(authors[0].first)}`;
  else if (authors.length <= 20) {
    const names = authors.map((a) => `${a.last}, ${initials(a.first)}`);
    authorPart = `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  } else {
    authorPart = `${authors[0].last}, ${initials(authors[0].first)}, et al.`;
  }
  const title = c.title || c.venue;
  return `${authorPart} (${c.year}). ${title}. ${c.venue}.${c.url ? ` ${c.url}` : ""}`;
}

export function formatMla(c) {
  const authors = parseAuthors(c.authors);
  let authorPart;
  if (authors.length === 0) authorPart = "Unknown author";
  else if (authors.length === 1) authorPart = `${authors[0].last}, ${authors[0].first}`;
  else if (authors.length === 2) authorPart = `${authors[0].last}, ${authors[0].first}, and ${authors[1].first} ${authors[1].last}`;
  else authorPart = `${authors[0].last}, ${authors[0].first}, et al.`;
  const title = c.title || c.venue;
  return `${authorPart}. "${title}." ${c.venue}, ${c.year}.${c.url ? ` ${c.url}.` : ""}`;
}

export function formatChicago(c) {
  const authors = parseAuthors(c.authors);
  let authorPart;
  if (authors.length === 0) authorPart = "Unknown author";
  else if (authors.length === 1) authorPart = `${authors[0].last}, ${authors[0].first}`;
  else {
    const rest = authors.slice(1).map((a) => `${a.first} ${a.last}`);
    authorPart = `${authors[0].last}, ${authors[0].first}${rest.length ? `, and ${rest.join(", ")}` : ""}`;
  }
  const title = c.title || c.venue;
  return `${authorPart}. ${c.year}. "${title}." ${c.venue}.${c.url ? ` ${c.url}.` : ""}`;
}

export const CITATION_STYLES = [
  { id: "apa", label: "APA", format: formatApa },
  { id: "mla", label: "MLA", format: formatMla },
  { id: "chicago", label: "Chicago", format: formatChicago },
];
