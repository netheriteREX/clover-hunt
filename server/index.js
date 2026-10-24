import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import {
  agentSearchPrompt,
  debaterPrompt,
  judgePrompt,
  reflagPrompt,
  followUpPrompt,
  steelmanOpenPrompt,
  steelmanReplyPrompt,
  steelmanSummaryPrompt,
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
// felt directly as extra wait time — Sonnet keeps most of a top-tier
// model's reasoning quality for methodology critique while Haiku responds
// noticeably faster for the simpler, higher-volume tasks.
const MODEL_SMALL = process.env.ANTHROPIC_MODEL_SMALL || "claude-haiku-4-5-20251001";
const MODEL_JUDGE = process.env.ANTHROPIC_MODEL_JUDGE || "claude-sonnet-5";

// Anthropic's Messages API requires an explicit max_tokens on every call —
// sized per call site below by how verbose that task's output tends to be.
const MAX_TOKENS_SEARCH_TURN = 1024; // a tool call or a short "I'm ready" confirmation
const MAX_TOKENS_ARGUMENT = 4096; // one debate side's 3-4 arguments, JSON
const MAX_TOKENS_JUDGE = 8192; // critiques for every argument on both sides + verdict, JSON
const MAX_TOKENS_TEXT = 1024; // follow-up answers, steelman replies/summaries — plain text

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set. Add it to server/.env to enable real debates.",
    );
    err.status = 503;
    throw err;
  }
  return new Anthropic({ apiKey });
}

// Claude reliably follows a "respond with ONLY valid JSON" instruction but
// isn't guaranteed byte-perfect (it can occasionally wrap output in
// ```json fences despite instructions) — this strips fences and grabs the
// outermost {...} as a safety net.
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

// Concatenates every text block in a Messages API response — a response
// can mix text blocks with tool_use blocks, so callers that just want the
// written reply (JSON or plain text) join only the former.
function extractText(response) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry on 429 with backoff instead of failing the whole request outright —
// each call (including the two side-endpoints running in parallel, and
// each turn of the agent search loop below) retries independently, so one
// call hitting a transient rate limit doesn't sink the rest.
async function chatCompleteWithRetry(client, params, attempt = 1) {
  try {
    return await client.messages.create(params);
  } catch (err) {
    const isRateLimit = err.status === 429;
    if (isRateLimit && attempt < 4) {
      const waitMs = attempt * 15000;
      console.warn(`Claude API rate limited — retrying in ${waitMs / 1000}s (attempt ${attempt})`);
      await sleep(waitMs);
      return chatCompleteWithRetry(client, params, attempt + 1);
    }
    if (isRateLimit) {
      const friendly = new Error(
        "Claude API rate limit reached even after retrying. Wait a minute and try again, or ask Anthropic to raise your tier's rate limits.",
      );
      friendly.status = 429;
      throw friendly;
    }
    throw err;
  }
}

async function callClaude(client, prompt, model, maxTokens = MAX_TOKENS_ARGUMENT) {
  const response = await chatCompleteWithRetry(client, {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return extractJson(extractText(response));
}

// Plain free-text completion — used for the follow-up clarification chat
// and Steelman Trainer, which just need a written answer, not structured
// output.
async function callClaudeText(client, prompt, model, maxTokens = MAX_TOKENS_TEXT) {
  const response = await chatCompleteWithRetry(client, {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return extractText(response);
}

// The evidence-gathering tool the debater agent can call — backed by the
// same searchPapers() that hits OpenAlex, just exposed one query at a time
// so the model can react to each result before deciding what to search
// next, instead of committing to a fixed batch of queries upfront.
const SEARCH_TOOL = {
  name: "search_papers",
  description: "Search real academic papers (OpenAlex) for a given query and get back a list of matches with abstracts.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A concise, specific academic search-engine query, using the terminology researchers in this field would use.",
      },
    },
    required: ["query"],
  },
};

const MAX_SEARCH_TURNS = 5;
const RESULTS_PER_SEARCH = 6;
const MAX_KEPT_PAPERS = 12;

// The generic agentic search loop: given a starting prompt, lets the model
// drive its own evidence gathering via the search_papers tool, reacting to
// each batch of real results, until it's satisfied or hits the turn cap.
// Returns the deduped pool of papers it collected. Used by the debate side
// flow (agentSearch, below) — Steelman Trainer's lighter single-search
// path is steelmanTurn(), further down.
async function runSearchAgent(client, initialPrompt, logLabel, seedPapers = []) {
  const messages = [{ role: "user", content: initialPrompt }];
  const pool = new Map();
  for (const paper of seedPapers) pool.set(paper.id || paper.title, paper);

  for (let turn = 1; turn <= MAX_SEARCH_TURNS; turn++) {
    const response = await chatCompleteWithRetry(client, {
      model: MODEL_SMALL,
      max_tokens: MAX_TOKENS_SEARCH_TURN,
      messages,
      tools: [SEARCH_TOOL],
    });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((block) => block.type === "tool_use");
    if (toolUses.length === 0) {
      console.log(`[search-agent] "${logLabel}" — agent stopped searching after turn ${turn}`);
      break;
    }

    const toolResults = [];
    for (const call of toolUses) {
      const query = call.input?.query ?? "";
      console.log(`[search-agent] "${logLabel}" — turn ${turn} search_papers("${query}")`);

      const results = await searchPapers(query, RESULTS_PER_SEARCH).catch((err) => {
        console.error(`[search-agent] "${logLabel}" — search_papers("${query}") failed:`, err.message);
        return [];
      });
      for (const paper of results) pool.set(paper.id || paper.title, paper);

      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(
          results.map((p) => ({ title: p.title, authors: p.authors, year: p.year, citedByCount: p.citedByCount })),
        ),
      });
    }
    messages.push({ role: "user", content: toolResults });

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

// One conversational turn of Steelman Trainer: the model replies in plain
// text, with an optional single search_papers call if a real citation
// would sharpen its question — unlike the full agentic search loop above,
// this is capped at one optional search so sparring stays snappy rather
// than turning into a multi-turn research dig every reply.
async function steelmanTurn(client, prompt) {
  const messages = [{ role: "user", content: prompt }];
  const first = await chatCompleteWithRetry(client, {
    model: MODEL_SMALL,
    max_tokens: MAX_TOKENS_SEARCH_TURN,
    messages,
    tools: [SEARCH_TOOL],
  });

  const toolUse = first.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    return { reply: extractText(first), citation: null };
  }

  messages.push({ role: "assistant", content: first.content });
  const query = toolUse.input?.query ?? "";
  console.log(`[steelman] search_papers("${query}")`);
  const results = await searchPapers(query, RESULTS_PER_SEARCH).catch((err) => {
    console.error(`[steelman] search_papers("${query}") failed:`, err.message);
    return [];
  });
  const paper = results[0] || null;

  messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(
          results.map((p) => ({ title: p.title, authors: p.authors, year: p.year, citedByCount: p.citedByCount })),
        ),
      },
    ],
  });

  const second = await chatCompleteWithRetry(client, {
    model: MODEL_SMALL,
    max_tokens: MAX_TOKENS_TEXT,
    messages,
  });

  const citation = paper
    ? {
        title: paper.title,
        authors: paper.authors,
        year: paper.year ?? "n.d.",
        venue: paper.venue,
        summary: paper.abstract ? paper.abstract.slice(0, 400) : "(no abstract available)",
        url: paper.url,
      }
    : null;

  return { reply: extractText(second), citation };
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

  const raw = await callClaude(client, debaterPrompt(question, stance, papers), MODEL_SMALL, MAX_TOKENS_ARGUMENT);

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
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
    const result = await callClaude(client, judgePrompt(question, model1, model2), MODEL_JUDGE, MAX_TOKENS_JUDGE);
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
    const result = await callClaude(
      client,
      reflagPrompt(question, model1, model2, critiques || [], verdict || {}, side, argumentId, reason),
      MODEL_JUDGE,
      MAX_TOKENS_JUDGE,
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
    const answer = await callClaudeText(
      client,
      followUpPrompt(question, model1, model2, verdict || {}, followUpQuestion),
      MODEL_JUDGE,
      MAX_TOKENS_TEXT,
    );
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Follow-up failed." });
  }
});

// Steelman Trainer: the user states their own argument and the AI pushes
// back mainly by questioning it, turn by turn. Stateless like
// /api/debate/followup — the full transcript is sent back on every call,
// no server-side session. `action` picks which prompt/step runs.
app.post("/api/steelman", async (req, res) => {
  const { argument, turns, userReply, action } = req.body || {};
  if (!argument || typeof argument !== "string" || !argument.trim()) {
    return res.status(400).json({ error: "A non-empty 'argument' string is required." });
  }
  if (!Array.isArray(turns)) {
    return res.status(400).json({ error: "'turns' must be an array." });
  }
  if (!["open", "reply", "summarize"].includes(action)) {
    return res.status(400).json({ error: "'action' must be 'open', 'reply', or 'summarize'." });
  }
  if (action === "reply" && (!userReply || typeof userReply !== "string" || !userReply.trim())) {
    return res.status(400).json({ error: "A non-empty 'userReply' string is required for 'reply'." });
  }

  try {
    const client = getClient();

    if (action === "summarize") {
      const summary = await callClaudeText(client, steelmanSummaryPrompt(argument, turns), MODEL_JUDGE, MAX_TOKENS_TEXT);
      return res.json({ summary });
    }

    const prompt = action === "open" ? steelmanOpenPrompt(argument) : steelmanReplyPrompt(argument, turns, userReply);
    const { reply, citation } = await steelmanTurn(client, prompt);
    res.json({ reply, citation });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Steelman Trainer failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Debate API listening on http://localhost:${PORT}`);
});
