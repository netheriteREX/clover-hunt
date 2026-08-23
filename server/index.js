import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import cors from "cors";
import { Mistral } from "@mistralai/mistralai";
import {
  agentSearchPrompt,
  debaterPrompt,
  judgePrompt,
  reflagPrompt,
  followUpPrompt,
  factCheckSearchPrompt,
  factCheckJudgePrompt,
} from "./prompts.js";
import { searchPapers } from "./search.js";

// Load server/.env explicitly — dotenv's default (`import "dotenv/config"`)
// only looks for .env in process.cwd(), which is the repo root when this
// is launched via `npm run dev:all`, not this file's own directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, ".env") });

const PORT = process.env.PORT || 8787;
// Query-generation and debating are split off onto a smaller/faster model —
// they're simpler tasks (pick search terms; argue from a fixed paper list)
// run twice per debate. The judge runs once but is the last sequential step
// in the whole pipeline (both sides must finish first), so its latency is
// felt directly as extra wait time — medium keeps most of large's reasoning
// quality for methodology critique while responding noticeably faster.
const MODEL_SMALL = process.env.MISTRAL_MODEL_SMALL || "mistral-small-latest";
const MODEL_JUDGE = process.env.MISTRAL_MODEL_JUDGE || "mistral-large-latest";

const app = express();
app.use(cors());
app.use(express.json());

// Logs every API call's request and response body as JSON, so they show up
// right in the terminal running the server (the same terminal `npm run
// dev:all` prints to). Truncated so a big paper-abstract-laden payload
// doesn't flood the console.
function logJson(label, data) {
  const text = JSON.stringify(data, null, 2);
  console.log(`${label}\n${text.length > 4000 ? text.slice(0, 4000) + "\n... (truncated)" : text}`);
}

app.use("/api", (req, res, next) => {
  if (Object.keys(req.body || {}).length > 0) {
    logJson(`[api] -> ${req.method} ${req.originalUrl}`, req.body);
  } else {
    console.log(`[api] -> ${req.method} ${req.originalUrl}`);
  }

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    logJson(`[api] <- ${res.statusCode} ${req.method} ${req.originalUrl}`, data);
    return originalJson(data);
  };

  next();
});

// One client per request keeps this stateless and simple. If this were
// hit at any real volume you'd construct it once at module load instead.
function getClient() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "MISTRAL_API_KEY is not set. Add it to server/.env to enable real debates.",
    );
    err.status = 503;
    throw err;
  }
  return new Mistral({ apiKey });
}

// Mistral's JSON mode is reliable but not guaranteed byte-perfect (models
// occasionally wrap output in ```json fences despite instructions) — this
// strips fences and grabs the outermost {...} as a safety net.
function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free-tier Mistral accounts are rate-limited to a handful of requests per
// minute. Retry on 429 with backoff instead of failing the whole request —
// each call (including the two side-endpoints running in parallel, and
// each turn of the agent search loop below) retries independently, so one
// call hitting the limit doesn't sink the rest.
async function chatCompleteWithRetry(client, params, attempt = 1) {
  try {
    return await client.chat.complete(params);
  } catch (err) {
    const isRateLimit = err.statusCode === 429;
    if (isRateLimit && attempt < 4) {
      const waitMs = attempt * 15000;
      console.warn(`Mistral rate limited — retrying in ${waitMs / 1000}s (attempt ${attempt})`);
      await sleep(waitMs);
      return chatCompleteWithRetry(client, params, attempt + 1);
    }
    if (isRateLimit) {
      const friendly = new Error(
        "Mistral rate limit reached even after retrying. Wait a minute and try again, or ask Mistral to raise your tier's requests-per-minute limit.",
      );
      friendly.status = 429;
      throw friendly;
    }
    throw err;
  }
}

async function callMistral(client, prompt, model) {
  const response = await chatCompleteWithRetry(client, {
    model,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    // Lower temperature: these are grounded, fact-bound tasks (argue from
    // a fixed paper list, adjudicate evidence) rather than creative
    // writing — less randomness means more consistent, faithful use of
    // the real citations across calls.
    temperature: 0.3,
  });
  const text = response.choices[0].message.content;
  return extractJson(text);
}

// Plain free-text completion (no JSON mode) — used for the follow-up
// clarification chat, which just needs a written answer, not structured
// output.
async function callMistralText(client, prompt, model) {
  const response = await chatCompleteWithRetry(client, {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });
  return response.choices[0].message.content;
}

// The evidence-gathering tool the debater agent can call — backed by the
// same searchPapers() that hits OpenAlex, just exposed one query at a time
// so the model can react to each result before deciding what to search
// next, instead of committing to a fixed batch of queries upfront.
const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_papers",
    description: "Search real academic papers (OpenAlex) for a given query and get back a list of matches with abstracts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A concise, specific academic search-engine query, using the terminology researchers in this field would use.",
        },
      },
      required: ["query"],
    },
  },
};

const MAX_SEARCH_TURNS = 5;
const RESULTS_PER_SEARCH = 6;
const MAX_KEPT_PAPERS = 12;

// The generic agentic search loop: given a starting prompt, lets the model
// drive its own evidence gathering via the search_papers tool, reacting to
// each batch of real results, until it's satisfied or hits the turn cap.
// Returns the deduped pool of papers it collected. Shared by both the
// debate side flow (agentSearch, below) and Fact-Check mode
// (factCheckSearch) — the only thing that differs between them is the
// prompt they start the loop with.
async function runSearchAgent(client, initialPrompt, logLabel, seedPapers = []) {
  const messages = [{ role: "user", content: initialPrompt }];
  const pool = new Map();
  for (const paper of seedPapers) pool.set(paper.id || paper.title, paper);

  for (let turn = 1; turn <= MAX_SEARCH_TURNS; turn++) {
    const response = await chatCompleteWithRetry(client, {
      model: MODEL_SMALL,
      messages,
      tools: [SEARCH_TOOL],
      toolChoice: "auto",
      temperature: 0.3,
    });
    const message = response.choices[0].message;
    messages.push(message);

    const toolCalls = message.toolCalls || [];
    if (toolCalls.length === 0) {
      console.log(`[search-agent] "${logLabel}" — agent stopped searching after turn ${turn}`);
      break;
    }

    for (const call of toolCalls) {
      let query;
      try {
        query = JSON.parse(call.function.arguments).query;
      } catch {
        query = String(call.function.arguments);
      }
      console.log(`[search-agent] "${logLabel}" — turn ${turn} search_papers("${query}")`);

      const results = await searchPapers(query, RESULTS_PER_SEARCH).catch((err) => {
        console.error(`[search-agent] "${logLabel}" — search_papers("${query}") failed:`, err.message);
        return [];
      });
      for (const paper of results) pool.set(paper.id || paper.title, paper);

      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.function.name,
        content: JSON.stringify(
          results.map((p) => ({ title: p.title, authors: p.authors, year: p.year, citedByCount: p.citedByCount })),
        ),
      });
    }

    if (turn === MAX_SEARCH_TURNS) {
      console.log(`[search-agent] "${logLabel}" — hit the ${MAX_SEARCH_TURNS}-turn search cap`);
    }
  }

  // Deliberately NOT re-sorting by citedByCount here — each paper already
  // arrived in OpenAlex's relevance order for the specific query the agent
  // chose to ask, which is a better relevance signal than raw citation
  // count. Re-sorting by citations would let one early, loosely-related
  // blockbuster paper crowd out several genuinely on-topic ones the agent
  // deliberately searched for later.
  return [...pool.values()].slice(0, MAX_KEPT_PAPERS);
}

// Runs the agentic search loop for one debate side.
//
// `seed`, when present, is { priorPosition, papers } from an earlier
// debate this question is branching off of (see the "branch into a new
// debate" follow-up flow) — those papers are pre-loaded into the pool so
// this side isn't required to re-find its own earlier evidence.
function agentSearch(client, question, stance, seed = null) {
  return runSearchAgent(client, agentSearchPrompt(question, stance, seed), stance, seed?.papers || []);
}

// Runs the agentic search loop for Fact-Check mode — same mechanics, but
// started from a neutral "investigate this claim" prompt instead of a
// debate side's advocacy prompt.
function factCheckSearch(client, claim) {
  return runSearchAgent(client, factCheckSearchPrompt(claim), claim);
}

// Builds one side of the debate: let the model drive its own evidence
// search via the search_papers tool (see agentSearch above), then have it
// argue using only what it gathered. Author/year/venue/url are taken
// directly from the search result, never from the model — the model only
// chooses which paper backs which claim.
async function buildSide(client, question, stance, seed = null) {
  console.log(`[buildSide] "${stance}" — starting agent search${seed ? " (seeded from a prior debate)" : ""}...`);
  const papers = await agentSearch(client, question, stance, seed);
  console.log(`[buildSide] "${stance}" — agent gathered ${papers.length} papers total`);

  if (papers.length === 0) {
    console.error(`[buildSide] "${stance}" — zero papers found, failing with 422`);
    const err = new Error(
      `No papers found for the "${stance}" side of this question — try rephrasing it.`,
    );
    err.status = 422;
    throw err;
  }

  const raw = await callMistral(client, debaterPrompt(question, stance, papers), MODEL_SMALL);

  const args = raw.arguments.map((a) => {
    const paper = papers[a.paperIndex];
    if (!paper) {
      throw new Error(`Model referenced an invalid paper index (${a.paperIndex}).`);
    }
    return {
      id: a.id,
      claim: a.claim,
      reasoning: a.reasoning,
      citation: {
        title: paper.title,
        authors: paper.authors,
        year: paper.year ?? "n.d.",
        venue: paper.venue,
        studyType: a.studyType || "unclear from abstract",
        sampleSize: a.sampleSize || "not stated in abstract",
        summary: paper.abstract ? paper.abstract.slice(0, 400) : "(no abstract available)",
        url: paper.url,
      },
    };
  });

  return { side: raw.side, position: raw.position, arguments: args };
}

// Fact-Check mode: a neutral agent gathers evidence on both sides of a
// single claim (factCheckSearch above), then one model call adjudicates
// it directly — no adversarial framing, no separate judge step. Citation
// fields are taken from the real search result exactly as buildSide does.
async function buildFactCheck(client, claim) {
  console.log(`[buildFactCheck] "${claim}" — starting agent search...`);
  const papers = await factCheckSearch(client, claim);
  console.log(`[buildFactCheck] "${claim}" — agent gathered ${papers.length} papers total`);

  if (papers.length === 0) {
    console.error(`[buildFactCheck] "${claim}" — zero papers found, failing with 422`);
    const err = new Error(`No papers found for this claim — try rephrasing it.`);
    err.status = 422;
    throw err;
  }

  const raw = await callMistral(client, factCheckJudgePrompt(claim, papers), MODEL_JUDGE);

  const evidence = raw.evidence.map((e) => {
    const paper = papers[e.paperIndex];
    if (!paper) {
      throw new Error(`Model referenced an invalid paper index (${e.paperIndex}).`);
    }
    return {
      id: e.id,
      stance: e.stance,
      note: e.note,
      citation: {
        title: paper.title,
        authors: paper.authors,
        year: paper.year ?? "n.d.",
        venue: paper.venue,
        summary: paper.abstract ? paper.abstract.slice(0, 400) : "(no abstract available)",
        url: paper.url,
      },
    };
  });

  return { claim, verdict: raw.verdict, confidence: raw.confidence, summary: raw.summary, evidence };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.MISTRAL_API_KEY) });
});

// One side of the debate, callable independently so the frontend can fire
// both sides in parallel and know exactly when each one finishes (rather
// than waiting on one opaque all-or-nothing /api/debate call).
app.post("/api/debate/side", async (req, res) => {
  const { question, stance, seedPriorPosition, seedCitations } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }
  if (!stance || typeof stance !== "string") {
    return res.status(400).json({ error: "A 'stance' string is required." });
  }

  // Optional: this side is branching off a prior debate (see the "branch
  // into a new debate" follow-up flow). The frontend sends back that
  // side's own earlier citations, which are reconstituted into paper-shape
  // objects and pre-loaded into the new agent search's pool.
  const seed =
    Array.isArray(seedCitations) && seedCitations.length > 0
      ? {
          priorPosition: typeof seedPriorPosition === "string" ? seedPriorPosition : "",
          papers: seedCitations.map((c) => ({
            id: c.url || `${c.authors}-${c.year}-${c.venue}`,
            title: c.title || c.venue || "Untitled",
            authors: c.authors,
            year: c.year,
            venue: c.venue,
            abstract: c.summary,
            url: c.url,
            citedByCount: 0,
          })),
        }
      : null;

  try {
    const client = getClient();
    const side = await buildSide(client, question, stance, seed);
    res.json(side);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Debate generation failed." });
  }
});

app.post("/api/debate/judge", async (req, res) => {
  const { question, model1, model2 } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }
  if (!model1?.arguments || !model2?.arguments) {
    return res.status(400).json({ error: "Both 'model1' and 'model2' sides are required." });
  }

  try {
    const client = getClient();
    const result = await callMistral(client, judgePrompt(question, model1, model2), MODEL_JUDGE);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Judging failed." });
  }
});

// Re-runs the judgment when a reader flags a specific citation as wrong or
// misused, so the model genuinely reconsiders that argument (and, if
// warranted, the overall verdict) rather than the flag just sitting there
// unactioned.
app.post("/api/debate/reflag", async (req, res) => {
  const { question, model1, model2, critiques, verdict, side, argumentId, reason } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }
  if (!model1?.arguments || !model2?.arguments) {
    return res.status(400).json({ error: "Both 'model1' and 'model2' sides are required." });
  }
  if (side !== "model1" && side !== "model2") {
    return res.status(400).json({ error: "'side' must be 'model1' or 'model2'." });
  }
  if (!argumentId || typeof argumentId !== "string") {
    return res.status(400).json({ error: "A non-empty 'argumentId' string is required." });
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "A non-empty 'reason' string is required." });
  }

  try {
    const client = getClient();
    const result = await callMistral(
      client,
      reflagPrompt(question, model1, model2, critiques || [], verdict || {}, side, argumentId, reason),
      MODEL_JUDGE,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Re-judging failed." });
  }
});

// A free-text follow-up question about a finished debate's verdict — a
// lightweight clarification chat with the judge, distinct from branching
// into a whole new debate.
app.post("/api/debate/followup", async (req, res) => {
  const { question, model1, model2, verdict, followUpQuestion } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }
  if (!model1?.position || !model2?.position) {
    return res.status(400).json({ error: "Both 'model1' and 'model2' sides are required." });
  }
  if (!followUpQuestion || typeof followUpQuestion !== "string" || !followUpQuestion.trim()) {
    return res.status(400).json({ error: "A non-empty 'followUpQuestion' string is required." });
  }

  try {
    const client = getClient();
    const answer = await callMistralText(
      client,
      followUpPrompt(question, model1, model2, verdict || {}, followUpQuestion),
      MODEL_JUDGE,
    );
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Follow-up failed." });
  }
});

// Quick Fact-Check: a single claim, evaluated neutrally against real
// evidence, without the full adversarial debate + judge pipeline.
app.post("/api/factcheck", async (req, res) => {
  const { claim } = req.body || {};
  if (!claim || typeof claim !== "string" || !claim.trim()) {
    return res.status(400).json({ error: "A non-empty 'claim' string is required." });
  }

  try {
    const client = getClient();
    const result = await buildFactCheck(client, claim.trim());
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Fact-check failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Debate API listening on http://localhost:${PORT}`);
});
