import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import cors from "cors";
import { Mistral } from "@mistralai/mistralai";
import { queryPrompt, debaterPrompt, judgePrompt } from "./prompts.js";
import { searchManyQueries } from "./search.js";

// Load server/.env explicitly — dotenv's default (`import "dotenv/config"`)
// only looks for .env in process.cwd(), which is the repo root when this
// is launched via `npm run dev:all`, not this file's own directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, ".env") });

const PORT = process.env.PORT || 8787;
// Query-generation and debating are split off onto a smaller/faster model —
// they're simpler tasks (pick search terms; argue from a fixed paper list)
// run twice per debate. The judge keeps the large model since methodology
// critique benefits most from stronger reasoning, and it only runs once.
const MODEL_SMALL = process.env.MISTRAL_MODEL_SMALL || "mistral-small-latest";
const MODEL_LARGE = process.env.MISTRAL_MODEL_LARGE || "mistral-large-latest";

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
// each call (including the two side-endpoints running in parallel) retries
// independently, so one side hitting the limit doesn't affect the other.
async function callMistral(client, prompt, model, attempt = 1) {
  try {
    const response = await client.chat.complete({
      model,
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });
    const text = response.choices[0].message.content;
    return extractJson(text);
  } catch (err) {
    const isRateLimit = err.statusCode === 429;
    if (isRateLimit && attempt < 4) {
      const waitMs = attempt * 15000;
      console.warn(`Mistral rate limited — retrying in ${waitMs / 1000}s (attempt ${attempt})`);
      await sleep(waitMs);
      return callMistral(client, prompt, model, attempt + 1);
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

// Builds one side of the debate: ask the model what to search for, actually
// search real papers, then have the model argue using only what came back.
// Author/year/venue/url are taken directly from the search result, never
// from the model — the model only chooses which paper backs which claim.
async function buildSide(client, question, stance) {
  console.log(`[buildSide] "${stance}" — asking model for search queries...`);
  const { queries } = await callMistral(client, queryPrompt(question, stance), MODEL_SMALL);
  console.log(`[buildSide] "${stance}" — model proposed queries:`, queries);

  const papers = await searchManyQueries(queries, 4);
  console.log(`[buildSide] "${stance}" — found ${papers.length} papers total`);

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
  res.json({ ok: true, hasKey: Boolean(process.env.MISTRAL_API_KEY) });
});

// One side of the debate, callable independently so the frontend can fire
// both sides in parallel and know exactly when each one finishes (rather
// than waiting on one opaque all-or-nothing /api/debate call).
app.post("/api/debate/side", async (req, res) => {
  const { question, stance } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "A non-empty 'question' string is required." });
  }
  if (!stance || typeof stance !== "string") {
    return res.status(400).json({ error: "A 'stance' string is required." });
  }

  try {
    const client = getClient();
    const side = await buildSide(client, question, stance);
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
    const result = await callMistral(client, judgePrompt(question, model1, model2), MODEL_LARGE);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Judging failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Debate API listening on http://localhost:${PORT}`);
});
