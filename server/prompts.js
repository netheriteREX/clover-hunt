// Used to kick off the agentic evidence-gathering loop in buildSide() —
// the model drives its own search_papers tool calls from here rather than
// being asked for a fixed batch of queries upfront.
//
// `seed`, when present, describes a prior debate this question is
// branching off of (see the "branch into a new debate" follow-up flow) —
// the papers this side already cited last time are pre-loaded into the
// pool before the loop starts, so the model isn't required to re-find them
// from scratch, but it's told it can still search further.
export function agentSearchPrompt(question, stance, seed = null) {
  const seedNote = seed?.papers?.length
    ? `\n\nThis question follows up on an earlier debate. You already have ${seed.papers.length} paper(s) from your side's earlier argument pre-loaded and available to cite:\n${seed.papers.map((p, i) => `- "${p.title}" (${p.authors}, ${p.year})`).join("\n")}\nYour earlier position was: "${seed.priorPosition}"\n\nYou can still cite from those if they're relevant to this follow-up, but search for additional or more targeted evidence if the follow-up raises something they don't cover.`
    : "";

  return `You are preparing to argue the "${stance}" side of this debate question:

"${question}"${seedNote}

You have a "search_papers" tool that queries a real academic search engine (the way a researcher would type into Semantic Scholar or Google Scholar) and returns real papers with abstracts. Use the specific terminology researchers in this field would use, not generic phrasing.

Call search_papers as many times as you need — react to what each search actually returns. If a query comes back thin, off-topic, or low quality, don't settle for it: refine the wording, try different terminology, or search a different angle of the topic. Keep searching until you have 3-4 solid, on-topic, real papers you're confident can each support a distinct argument for this side.

Once you're satisfied with the evidence you've gathered, stop calling the tool and simply reply with a short confirmation that you're ready (no need for JSON here — the argument itself will be requested separately).`;
}

// Shared by debaterPrompt and factCheckJudgePrompt — an indexed listing of
// real, search-engine-retrieved papers a model is allowed to cite from,
// each with its citation count as a rough quality signal.
export function formatPaperList(papers) {
  return papers
    .map((p, i) => {
      const abstract = p.abstract ? p.abstract.slice(0, 600) : "(no abstract available)";
      const citations = typeof p.citedByCount === "number" ? `${p.citedByCount} citations` : "citation count unknown";
      return `[${i}] ${p.authors} (${p.year ?? "n.d."}). "${p.title}". ${p.venue}. (${citations})\nAbstract: ${abstract}`;
    })
    .join("\n\n");
}

export const DEBATER_SCHEMA = `{
  "side": "<a short (max 8 words) label for the position taken>",
  "position": "<one paragraph laying out the position>",
  "arguments": [
    {
      "id": "<short slug, e.g. 'a1'>",
      "claim": "<short claim this argument makes>",
      "reasoning": "<how the cited paper's actual findings support the claim>",
      "paperIndex": <the [n] index of the paper below that backs this argument>,
      "studyType": "<your best characterization of the methodology from the abstract, e.g. 'randomized controlled trial', 'longitudinal cohort study', 'meta-analysis' — say 'unclear from abstract' if it can't be determined>",
      "sampleSize": "<sample size if the abstract states one, else 'not stated in abstract'>"
    }
  ]
}`;

// `papers` is the real, search-engine-retrieved list the debater is allowed
// to cite from — the model never invents author/year/venue itself, it only
// picks an index and reasons about what the (real) abstract says.
export function debaterPrompt(question, stance, papers) {
  const paperList = formatPaperList(papers);

  return `You are an expert debater arguing the "${stance}" side of the following question:

"${question}"

Below is a list of REAL papers retrieved from an academic search engine, each with an index in brackets and its citation count. You must build your entire argument using ONLY these papers — do not cite anything not in this list, and do not claim a finding the abstract doesn't support.

PAPERS:
${paperList}

Build 3-4 distinct supporting arguments, each backed by exactly one paper from the list above (reference it by its index). Topical relevance comes first: only cite a paper whose actual finding directly bears on this question — do not stretch a tenuously related paper into an argument just because it's well-cited or convenient (e.g. don't use a general study about workplace pollution, AI adoption, or risk tolerance to argue about remote work specifically, unless its finding truly and directly supports the claim). Once you're choosing between multiple papers that are each genuinely on-topic, then prefer the stronger piece of evidence — larger, better-controlled, more rigorous studies and those with higher citation counts. A closely on-topic but modest study beats a loosely-related blockbuster one every time.

Respond with ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
${DEBATER_SCHEMA}`;
}

export const JUDGE_SCHEMA = `{
  "critiques": [
    {
      "side": "model1" | "model2",
      "argumentId": "<matches the argument's id from that side>",
      "flaws": ["<specific methodological flaw IN THE EVIDENCE ITSELF, e.g. 'no control group', 'sample size too small to generalize', 'correlational data used to imply causation', 'short follow-up period', 'self-reported data susceptible to bias', 'industry-funded with potential conflict of interest', 'failed to replicate in later studies'>"],
      "strengths": ["<optional: specific methodological strength>"],
      "qualityScore": <0-100 integer, evidentiary quality of the CITATION itself — is this a well-designed study, independent of how it's being used>,
      "reasoningFlaws": ["<specific flaw IN HOW THE ARGUMENT USES ITS EVIDENCE, e.g. 'claim overreaches what the study actually measured', 'non-sequitur — the cited finding doesn't establish this conclusion', 'cherry-picks a favorable result while ignoring the study's own stated caveats', 'conflates correlation the study reports with the causal claim being made'. Empty array if the reasoning is a fair, faithful use of the citation.>"],
      "argumentScore": <0-100 integer, how logically sound this SPECIFIC argument is — does the reasoning actually and fairly follow from its own cited evidence, regardless of how good that evidence is. A weak study used honestly and modestly can score higher here than a strong study whose finding is being overstated.>,
      "notes": "<1-2 sentence assessment covering both the evidence and how it's being argued>"
    }
  ],
  "verdict": {
    "argumentAssessment": "<2-3 sentences specifically about which side ARGUED better — sound reasoning, honest use of evidence, avoiding overreach — as distinct from which side simply had access to better sources. Explicitly call out if a side with weaker evidence nonetheless reasoned more carefully, or if a side with strong evidence undermined itself by overreaching. Note if this diverges from winningSide — a side can argue more carefully while still being on the less-supported side overall.>",
    "summary": "<2-4 sentence nuanced final verdict answering the original question — this should state which position the total body of evidence actually supports, not just which side debated better>",
    "winningSide": "model1" | "model2" | "mixed",
    "confidence": <0-100 integer>,
    "nuances": ["<important caveat or nuance, e.g. 'Model 2's argument is largely correct except it overlooks that the effect disappears after controlling for X'>"]
  }
}`;

export function judgePrompt(question, model1, model2) {
  return `You are an impartial debate adjudicator. A question was debated by two advocates, each citing real papers retrieved from an academic search engine (abstracts included below via each citation's "summary" field).

QUESTION: "${question}"

MODEL 1 (arguing "${model1.side}"):
${JSON.stringify(model1.arguments, null, 2)}

MODEL 2 (arguing "${model2.side}"):
${JSON.stringify(model2.arguments, null, 2)}

Your job has two distinct parts for EACH citation from EACH side:

1. Evidence quality: is the cited study itself well-designed? Look for missing/inadequate control groups, sample size too small to generalize, correlation presented as causation, short study duration, self-report bias, publication/funding bias, failure to replicate, unrepresentative samples — but also note genuine strengths. If the abstract doesn't give enough information to assess a flaw, say so rather than guessing.

2. Argument quality — this is the part that matters most to readers, who are here to see which side actually made the better case, not just which side happened to find better sources. For each argument, check whether the reasoning actually and fairly follows from its own cited evidence: does the claim overreach what the study measured? Is there a non-sequitur between the finding and the conclusion drawn from it? Is a favorable detail cherry-picked while the study's own caveats are ignored? A side can cite a flawless study and still argue it badly (by overstating its implications), and a side can cite a flawed or modest study and still argue it well (by being honest and measured about what it actually shows). Score and critique these separately from the evidence itself.

Then give a final verdict. Think of this in two layers, and do not collapse them:

- **What's actually true.** The winning side and confidence should primarily reflect which position the *total weight of evidence* actually supports — not just the handful of papers each debater happened to cite, but your own knowledge of how strong, consistent, and voluminous the real research literature is on this question. If one side's position is backed by an overwhelming, broad, and consistent body of evidence in reality (even if the debaters only surfaced a few papers each), the verdict should say so and lean confidently toward that side — do not flatten a lopsided, well-established question into "mixed" just because both debaters showed up with citations. Conversely, if the literature is genuinely contested or thin, say so and keep confidence low.
- **How well each side argued.** This is a separate, secondary layer — a side can win on the merits of the evidence while still having argued it clumsily (overreaching, cherry-picking), and a side can argue carefully and honestly while still being on the less-supported side of a lopsided question. Use "argumentAssessment" to call this out explicitly rather than letting rhetorical skill quietly override which side is actually more likely correct.

In short: winningSide answers "which side is more correct," weighted by the real strength of the evidence base — argument quality should refine your confidence and nuance, not substitute for it. Give exactly the amount of nuance required — if one side is almost entirely correct except for one important detail, say so explicitly. If the honest answer is "it depends" or "both are partially right," say that — but don't default to "mixed" as a way of avoiding a judgment the evidence actually supports.

Respond with ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
${JUDGE_SCHEMA}`;
}

// Used when a user flags a specific citation as wrong or misused. Re-runs
// the full judgment (same JUDGE_SCHEMA) but with the user's specific
// objection injected, so the model can genuinely reconsider that argument
// (and, if warranted, the overall verdict) rather than just rubber-stamping
// its earlier critique.
export function reflagPrompt(question, model1, model2, previousCritiques, previousVerdict, side, argumentId, reason) {
  const sideLabel = side === "model1" ? "Model 1" : "Model 2";
  const flaggedArg = (side === "model1" ? model1 : model2).arguments.find((a) => a.id === argumentId);

  return `You are an impartial debate adjudicator revisiting a judgment you already made, because a reader has flagged a specific citation as potentially wrong or misused.

QUESTION: "${question}"

MODEL 1 (arguing "${model1.side}"):
${JSON.stringify(model1.arguments, null, 2)}

MODEL 2 (arguing "${model2.side}"):
${JSON.stringify(model2.arguments, null, 2)}

YOUR PREVIOUS CRITIQUES:
${JSON.stringify(previousCritiques, null, 2)}

YOUR PREVIOUS VERDICT:
${JSON.stringify(previousVerdict, null, 2)}

A reader has flagged this specific argument as potentially wrong or misused:
- Side: ${sideLabel}
- Claim: "${flaggedArg?.claim ?? "(unknown)"}"
- Reader's objection: "${reason}"

Take the objection seriously and actually re-examine that argument's citation and reasoning against it — don't just defensively restate your previous critique. If the objection has merit, revise that argument's flaws/reasoningFlaws/scores accordingly, and update the overall verdict (winningSide, confidence, summary, nuances) if this change is significant enough to matter. If, after genuinely reconsidering, you still think your original assessment was correct, you may keep it — but say in that argument's "notes" that you considered the reader's specific objection and explain concretely why you still disagree with it, rather than ignoring it.

Re-output your full, updated assessment — every argument from both sides needs a critique entry, not just the flagged one (carry forward your previous critiques for arguments that aren't affected).

Respond with ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
${JUDGE_SCHEMA}`;
}

// A free-text (non-JSON) follow-up question about a finished debate,
// answered by the judge using the full context it already adjudicated —
// for things like "why did you weigh X over Y" rather than opening a new
// debate.
export function followUpPrompt(question, model1, model2, verdict, followUpQuestion) {
  return `You are the impartial adjudicator who judged the debate below. A reader is now asking a follow-up question about your verdict.

ORIGINAL QUESTION: "${question}"

MODEL 1 (arguing "${model1.side}"): ${model1.position}
MODEL 2 (arguing "${model2.side}"): ${model2.position}

YOUR VERDICT: ${JSON.stringify(verdict, null, 2)}

READER'S FOLLOW-UP QUESTION: "${followUpQuestion}"

Answer the follow-up directly and concretely, grounded in the debate and your verdict above — reference specific arguments or evidence where relevant. Keep it to 2-4 sentences unless the question genuinely needs more. If the follow-up asks something your verdict didn't actually consider, say so honestly rather than inventing a justification. Respond in plain text — no JSON, no markdown fences.`;
}

// Kicks off the agentic search loop for Fact-Check mode — unlike
// agentSearchPrompt, this is deliberately neutral: the model is gathering
// evidence to evaluate a claim, not to advocate for one side of it.
export function factCheckSearchPrompt(claim) {
  return `You are neutrally investigating whether the following claim is well-supported by real research:

"${claim}"

You have a "search_papers" tool that queries a real academic search engine (the way a researcher would type into Semantic Scholar or Google Scholar) and returns real papers with abstracts. Use the specific terminology researchers in this field would use, not generic phrasing.

You are NOT an advocate for or against this claim — your job is to find the real evidence on BOTH sides. Call search_papers as many times as you need: search for evidence that would support the claim, and separately search for evidence that would contradict or complicate it. React to what each search actually returns — if a query comes back thin or off-topic, refine the wording or try a different angle. Keep searching until you have a well-rounded set of real, on-topic papers covering the actual state of evidence, not just papers confirming one side.

Once you're satisfied with the evidence you've gathered, stop calling the tool and simply reply with a short confirmation that you're ready (no need for JSON here — the verdict itself will be requested separately).`;
}

export const FACTCHECK_SCHEMA = `{
  "verdict": "well-supported" | "contested" | "unsupported" | "unclear",
  "confidence": <0-100 integer>,
  "summary": "<2-4 sentence nuanced explanation of what the real evidence actually shows about this claim>",
  "evidence": [
    {
      "id": "<short slug, e.g. 'e1'>",
      "paperIndex": <the [n] index of the paper below>,
      "stance": "supports" | "contradicts" | "mixed",
      "note": "<1-2 sentences on what this specific paper's finding shows in relation to the claim>"
    }
  ]
}`;

// `papers` is the real, search-engine-retrieved list gathered by
// factCheckSearchPrompt's agent loop — same "cite from this list only,
// never invent a source" constraint as debaterPrompt.
export function factCheckJudgePrompt(claim, papers) {
  const paperList = formatPaperList(papers);

  return `You are a careful, impartial fact-checker evaluating this claim against real research:

"${claim}"

Below is a list of REAL papers retrieved from an academic search engine, each with an index in brackets and its citation count. You must cite ONLY from this list — do not cite anything not in this list, and do not claim a finding the abstract doesn't support.

PAPERS:
${paperList}

For each paper genuinely relevant to the claim, note whether its finding supports it, contradicts it, or is mixed/partial — be honest here; do not force a paper into "supports" just because it was found while investigating this claim, and do not omit real contradicting evidence to make the verdict cleaner. Not every paper in the list needs an entry — skip ones that turned out to be too tangential to actually bear on the claim.

Then give an overall verdict on the claim itself:
- "well-supported": the real evidence is strong and largely consistent in supporting the claim.
- "contested": there is genuine, real evidence on both sides — say so plainly rather than picking a side to force a cleaner answer.
- "unsupported": the real evidence weighs against the claim, or the claim significantly overstates what the evidence actually shows.
- "unclear": the available evidence is too thin, indirect, or inconclusive to say either way.

Weight your verdict by your own knowledge of how strong and consistent the broader research literature is on this claim, not just the handful of papers surfaced here — same principle as judging a debate. Give exactly the amount of nuance the evidence supports; don't default to "unclear" just to avoid a judgment the evidence actually supports, and don't force "contested" when the evidence is actually lopsided.

Respond with ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
${FACTCHECK_SCHEMA}`;
}
