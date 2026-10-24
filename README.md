# 🍀 Clover Hunt

**The debating tool that finds your four-leaf clover in an argument.**

Clover Hunt is an AI-powered evidence review tool built for debaters, researchers, and policy writers. Instead of asking one model for an opinion, it puts multiple AI agents to work gathering **real, citable academic evidence** — then argues, judges, or fact-checks with it.

## What it does

Clover Hunt has two modes:

### ⚔️ Debate mode
Ask a debatable question and three AI agents get to work:
- **Two debaters** independently research and argue opposite stances, each backing every claim with a real paper it found itself (via an agentic search loop — no invented citations).
- **A judge** scores each side's evidence quality *and* argument quality separately, then delivers a verdict on which position the actual body of evidence supports.

### 🤺 Steelman Trainer
State your own argument and an AI sparring partner pushes back on it — mainly by asking pointed questions that surface edge cases, exceptions, and angles you may not have considered, rather than lecturing you. It can back a challenge with a real cited paper when one genuinely helps. End the session for a short closing summary of the strongest point raised and how your argument held up.

Every review can be exported (PDF, Word), its citations exported (APA, MLA, Chicago, BibTeX), or shared with a link that reproduces the exact same result for anyone who opens it.

## How it's built

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Express (`server/index.js`), fully stateless
- **AI**: [Claude](https://www.anthropic.com/claude) via the Anthropic API — a smaller/faster model drives the agentic evidence search, argument writing, and sparring turns, a larger model handles judging and closing summaries
- **Evidence source**: [OpenAlex](https://openalex.org) — a free, open academic search API; results are filtered to exclude retracted papers and unreviewed preprints, and ranked by topical relevance (citation count is only ever a tiebreaker)

## Getting started

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
npm install
```

Create `server/.env`:

```env
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional overrides — sensible defaults are used if omitted
# PORT=8787
# ANTHROPIC_MODEL_SMALL=claude-haiku-4-5-20251001
# ANTHROPIC_MODEL_JUDGE=claude-sonnet-5

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
