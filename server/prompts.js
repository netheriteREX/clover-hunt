export const QUERY_SCHEMA = `{ "queries": ["<query 1>", "<query 2>", "<query 3>"] }`;

export function queryPrompt(question, stance) {
  return `You are preparing to argue the "${stance}" side of this debate question:

"${question}"

Propose 3 concise, specific academic search-engine queries (the way a researcher would type them into Semantic Scholar or Google Scholar) that would surface real peer-reviewed papers supporting this side. Use the specific terminology researchers in this field would use, not generic phrasing.

Respond with ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
${QUERY_SCHEMA}`;
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
  const paperList = papers
    .map((p, i) => {
      const abstract = p.abstract ? p.abstract.slice(0, 600) : "(no abstract available)";
      return `[${i}] ${p.authors} (${p.year ?? "n.d."}). "${p.title}". ${p.venue}.\nAbstract: ${abstract}`;
    })
    .join("\n\n");

  return `You are an expert debater arguing the "${stance}" side of the following question:

"${question}"

Below is a list of REAL papers retrieved from an academic search engine, each with an index in brackets. You must build your entire argument using ONLY these papers — do not cite anything not in this list, and do not claim a finding the abstract doesn't support.

PAPERS:
${paperList}

Build 3-4 distinct supporting arguments, each backed by exactly one paper from the list above (reference it by its index).

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
