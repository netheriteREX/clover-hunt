// Real academic paper search via the OpenAlex API — fully open, no API key
// or signup required at all: https://docs.openalex.org.
// Setting OPENALEX_MAILTO in server/.env is optional and free (just an
// email string, not a registered key) — it moves requests into OpenAlex's
// "polite pool" for faster, more reliable rate limits.
const SEARCH_URL = "https://api.openalex.org/works";

// OpenAlex returns abstracts as an "inverted index" (word -> [positions])
// instead of plain text, to keep response size down. Rebuild the sentence.
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return "";
  const positions = [];
  for (const [word, idxs] of Object.entries(invertedIndex)) {
    for (const i of idxs) positions[i] = word;
  }
  return positions.join(" ").trim();
}

export async function searchPapers(query, limit = 4) {
  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    // Only keep works that actually have an abstract — otherwise the
    // debater has nothing real to reason about.
    filter: "has_abstract:true",
  });
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);

  console.log(`[search] OpenAlex query: "${query}" -> ${SEARCH_URL}?${params}`);

  const res = await fetch(`${SEARCH_URL}?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[search] OpenAlex request failed (${res.status}) for query "${query}": ${body.slice(0, 300)}`);
    throw new Error(`OpenAlex search failed (${res.status}) for query "${query}".`);
  }

  const data = await res.json();
  console.log(`[search] "${query}" -> ${data.results?.length ?? 0} raw results (${data.meta?.count ?? "?"} total matches)`);

  const withAbstracts = (data.results || []).filter((w) => w.title);
  if (withAbstracts.length === 0 && (data.results || []).length > 0) {
    console.log(`[search] "${query}" had results but none passed the has_abstract/title filter`);
  }

  return withAbstracts
    .map((w) => ({
      id: w.id,
      title: w.title,
      authors:
        (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean).join(", ") ||
        "Unknown authors",
      year: w.publication_year ?? null,
      venue: w.primary_location?.source?.display_name || "Unknown venue",
      abstract: reconstructAbstract(w.abstract_inverted_index),
      url: w.doi || w.id,
    }));
}

// Runs several search queries and merges the results, deduping by paper id.
// One query's failure doesn't sink the rest — a debater can still work with
// a partial paper set.
export async function searchManyQueries(queries, perQuery = 4) {
  console.log(`[search] running ${queries.length} queries:`, queries);

  const results = await Promise.all(
    queries.map((q) =>
      searchPapers(q, perQuery).catch((err) => {
        console.error(`[search] query "${q}" threw:`, err.message);
        return [];
      }),
    ),
  );
  const seen = new Set();
  const merged = [];
  for (const list of results) {
    for (const paper of list) {
      const key = paper.id || paper.title;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(paper);
    }
  }
  console.log(`[search] merged total: ${merged.length} unique papers`);
  return merged;
}
