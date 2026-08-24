# 🍀 Clover Hunt

**The debating tool that finds your four-leaf clover in an argument.**

Clover Hunt is an AI-powered evidence review tool built for debaters, researchers, and policy writers. Instead of asking one model for an opinion, it puts multiple AI agents to work gathering **real, citable academic evidence** — then argues, judges, or fact-checks with it.

## What it does

Clover Hunt has two modes:

### ⚔️ Debate mode
Ask a debatable question and three AI agents get to work:
- **Two debaters** independently research and argue opposite stances, each backing every claim with a real paper it found itself (via an agentic search loop — no invented citations).
- **A judge** scores each side's evidence quality *and* argument quality separately, then delivers a verdict on which position the actual body of evidence supports.

### 🔍 Fact Check mode
Paste a single claim and one agent neutrally gathers real evidence for *and* against it, then returns a direct verdict — well-supported, contested, unsupported, or unclear — with citations tagged by which way they point. No adversarial framing, just a fast, grounded answer.

Every review can be exported (PDF, Word), its citations exported (APA, MLA, Chicago, BibTeX), or shared with a link that reproduces the exact same result for anyone who opens it.

## How it's built

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Express (`server/index.js`), fully stateless
- **AI**: [Mistral AI](https://mistral.ai) — a small model drives the agentic evidence search and argument writing, a larger model handles judging
- **Evidence source**: [OpenAlex](https://openalex.org) — a free, open academic search API; results are filtered to exclude retracted papers and unreviewed preprints, and ranked by topical relevance (citation count is only ever a tiebreaker)

## Getting started

### Prerequisites
- Node.js 18+
- A [Mistral AI API key](https://console.mistral.ai/)

### Setup

```bash
npm install
```

Create `server/.env`:

```env
MISTRAL_API_KEY=your-mistral-api-key

# Optional overrides — sensible defaults are used if omitted
# PORT=8787
# MISTRAL_MODEL_SMALL=mistral-small-latest
# MISTRAL_MODEL_JUDGE=mistral-large-latest

# Optional — moves OpenAlex requests into its faster "polite pool"
# OPENALEX_MAILTO=you@example.com
# OPENALEX_API_KEY=your-openalex-key
```

### Run it

```bash
npm run dev:all
```

This starts the Vite dev server (`http://localhost:5173`) and the API server (`http://localhost:8787`) together. Open the app and try a question.

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Frontend only |
| `npm run server` | API server only |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with Oxlint |

## Project structure

```
server/
  index.js      # Express API — debate, judge, fact-check, follow-up, reflag endpoints
  prompts.js    # All model prompts and JSON schemas
  search.js     # OpenAlex integration
src/
  components/   # UI components (debate diagram, loading states, exports, etc.)
  lib/          # History, sharing, citation formatting, export helpers
```

## License

MIT
