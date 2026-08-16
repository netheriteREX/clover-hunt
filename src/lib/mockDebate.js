// Deterministic pseudo-random generator so the same question always
// produces the same scripted debate — stable for demos, no API needed.
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function makeRng(seedStr) {
  const gen = hashSeed(seedStr);
  return {
    int: (min, max) => Math.floor(gen() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(gen() * arr.length)],
    bool: (p = 0.5) => gen() < p,
    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

const JOURNALS = [
  "Journal of Applied Psychology",
  "Nature Human Behaviour",
  "Pew Research Center report",
  "The Lancet Public Health",
  "Journal of Social Issues",
  "PLOS ONE",
  "American Sociological Review",
  "Cyberpsychology, Behavior, and Social Networking",
  "National Bureau of Economic Research working paper",
  "Psychological Bulletin",
];

const STUDY_TYPES = [
  "randomized controlled trial",
  "longitudinal cohort study",
  "cross-sectional survey",
  "meta-analysis",
  "natural experiment",
  "observational study",
  "pre-registered replication",
];

const SURNAMES = [
  "Chen", "Alvarez", "Nakamura", "Petrov", "Okafor", "Bianchi",
  "Larsson", "Haddad", "Kowalski", "Reyes", "Fischer", "Dubois",
];

const CLAIM_OPENERS = [
  "Data shows a clear effect consistent with this position.",
  "Findings directly support this side of the argument.",
  "Researchers report results aligned with this conclusion.",
  "Analysis of a large dataset reinforces this claim.",
  "Independent replications back up this position.",
];

const REASONING_TEMPLATES = [
  (n) => `A sample of ${n.toLocaleString()} participants showed the effect holding across demographic subgroups, strengthening the case for this side.`,
  () => `The effect size was large enough to be practically meaningful, not just statistically significant.`,
  () => `Researchers controlled for the most obvious confounds, making the result harder to dismiss.`,
  () => `The finding has been cited approvingly by follow-up work in the field.`,
  (n) => `With ${n.toLocaleString()} data points, the study had enough statistical power to detect even a modest effect.`,
];

const SUMMARY_TEMPLATES = [
  () => `Found a statistically significant effect in the expected direction, though the authors urge caution generalizing beyond the sampled population.`,
  () => `Reported a moderate correlation that held after adjusting for several demographic covariates.`,
  () => `Observed the effect concentrated in a subgroup, with weaker signal elsewhere in the sample.`,
  () => `Concluded the relationship was real but smaller than earlier studies had suggested.`,
];

const FLAW_BANK = [
  "No control group — impossible to isolate the effect from other confounding factors.",
  "Sample size too small to generalize with confidence.",
  "Correlational design, but conclusions are framed as causal.",
  "Short follow-up period; long-term effects are unknown.",
  "Relies on self-reported data, which is susceptible to recall and social-desirability bias.",
  "Funded by an organization with a stake in the outcome.",
  "Has not been independently replicated.",
  "Sample skews heavily toward one demographic, limiting generalizability.",
  "Effect size shrinks substantially after correcting for multiple comparisons.",
];

const STRENGTH_BANK = [
  "Pre-registered design reduces the risk of p-hacking.",
  "Large, nationally representative sample.",
  "Randomized design supports a causal interpretation.",
  "Findings have been independently replicated at least once.",
  "Used objective behavioral measures rather than self-report.",
];

const REASONING_FLAW_BANK = [
  "The claim overreaches what the cited finding actually measured.",
  "Non-sequitur — the conclusion doesn't follow directly from this result.",
  "Cherry-picks a favorable detail while ignoring the study's own caveats.",
  "Treats a correlational finding as if it establishes the causal claim being made.",
];

function citation(rng) {
  const authors = `${rng.pick(SURNAMES)} et al.`;
  const year = rng.int(2013, 2025);
  const venue = rng.pick(JOURNALS);
  const studyType = rng.pick(STUDY_TYPES);
  const n = rng.int(80, 12000);
  const sampleSize = studyType === "meta-analysis" ? `meta-analysis of ${rng.int(8, 60)} studies` : `n=${n.toLocaleString()}`;
  return {
    authors,
    year,
    venue,
    studyType,
    sampleSize,
    summary: rng.pick(SUMMARY_TEMPLATES)(),
    _n: n,
  };
}

function buildSide(question, rng, side, label) {
  const count = rng.int(3, 4);
  const args = Array.from({ length: count }, (_, i) => {
    const cite = citation(rng);
    return {
      id: `${side}-a${i + 1}`,
      claim: rng.pick(CLAIM_OPENERS),
      reasoning: rng.pick(REASONING_TEMPLATES)(cite._n),
      citation: cite,
    };
  });
  return {
    side: label,
    position: `This side argues that the evidence, on balance, supports the "${label.toLowerCase()}" reading of "${question}" — pointing to converging findings across multiple independent studies.`,
    arguments: args,
  };
}

function critiqueArgument(rng, side, arg) {
  const flaws = rng.bool(0.75) ? rng.shuffle(FLAW_BANK).slice(0, rng.int(1, 2)) : [];
  const strengths = rng.bool(0.5) ? rng.shuffle(STRENGTH_BANK).slice(0, 1) : [];
  const qualityBase = 90 - flaws.length * 22 + strengths.length * 8;
  const qualityScore = Math.max(15, Math.min(96, qualityBase + rng.int(-6, 6)));

  // Argument quality (how fairly the reasoning uses its evidence) is
  // deliberately independent of evidence quality — a modest study argued
  // honestly can score higher here than a strong one that's overstated.
  const reasoningFlaws = rng.bool(0.35) ? rng.shuffle(REASONING_FLAW_BANK).slice(0, 1) : [];
  const argumentBase = 88 - reasoningFlaws.length * 28;
  const argumentScore = Math.max(20, Math.min(97, argumentBase + rng.int(-8, 8)));

  return {
    side,
    argumentId: arg.id,
    flaws,
    strengths,
    qualityScore,
    reasoningFlaws,
    argumentScore,
    notes:
      qualityScore >= 70
        ? "Solid methodology; one of the stronger pieces of evidence in this debate."
        : qualityScore >= 45
          ? "Usable evidence, but the flaws above meaningfully limit how much weight it should carry."
          : "Weak evidentiary value — should not be treated as decisive on its own.",
  };
}

export function generateDebate(question) {
  const rng = makeRng(question);

  const model1 = buildSide(question, rng, "model1", rng.pick(["Yes", "Supports the claim", "Largely true"]));
  const model2 = buildSide(question, rng, "model2", rng.pick(["No", "Refutes the claim", "Largely overstated"]));

  const critiques = [
    ...model1.arguments.map((a) => critiqueArgument(rng, "model1", a)),
    ...model2.arguments.map((a) => critiqueArgument(rng, "model2", a)),
  ];

  // Which side is more CORRECT drives the verdict — weighted primarily by
  // evidence quality (a stand-in here for "strength of the real literature"),
  // not by who argued more smoothly. Argument quality is a secondary signal
  // used to nudge confidence and to write a separate argumentAssessment,
  // but it should not flip the winner on its own.
  const avg = (side, field) => {
    const scores = critiques.filter((c) => c.side === side).map((c) => c[field]);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };
  const evidence1 = avg("model1", "qualityScore");
  const evidence2 = avg("model2", "qualityScore");
  const evidenceDiff = evidence1 - evidence2;

  const argument1 = avg("model1", "argumentScore");
  const argument2 = avg("model2", "argumentScore");
  const argumentDiff = argument1 - argument2;

  let winningSide = "mixed";
  if (evidenceDiff > 12) winningSide = "model1";
  else if (evidenceDiff < -12) winningSide = "model2";

  // Argument quality can modestly sharpen or soften confidence in the same
  // direction, but a big argument-quality gap in the opposite direction
  // dampens confidence rather than reversing the winner.
  const aligned = Math.sign(evidenceDiff) === Math.sign(argumentDiff);
  const confidence = Math.round(
    50 + Math.min(45, Math.abs(evidenceDiff) * 1.8 + (aligned ? Math.abs(argumentDiff) * 0.4 : -Math.abs(argumentDiff) * 0.4)),
  );

  const nuances = [];
  if (winningSide === "mixed") {
    nuances.push(
      "Both sides cite evidence of comparable quality — the honest reading is that the effect likely exists but is smaller and more context-dependent than either side's framing suggests.",
    );
  } else {
    const loser = winningSide === "model1" ? model2 : model1;
    nuances.push(
      `${loser.side}'s position is not baseless — it correctly identifies a real pattern in the data — but leans on citations with the flaws noted above, which overstates how settled the question is.`,
    );
  }
  if (rng.bool(0.7)) {
    nuances.push(
      "The effect appears to depend heavily on the population studied; results from one demographic don't clearly generalize to others.",
    );
  }

  const betterArguer = argumentDiff > 8 ? "model1" : argumentDiff < -8 ? "model2" : "mixed";
  const argumentAssessment =
    betterArguer === "mixed"
      ? "Both sides reasoned about equally carefully from the evidence they had — neither overreached significantly more than the other."
      : betterArguer === winningSide
        ? `${betterArguer === "model1" ? model1.side : model2.side} also argued more carefully — its claims track more closely with what the cited evidence actually shows, reinforcing why it has the stronger overall case.`
        : `${betterArguer === "model1" ? model1.side : model2.side} argued more carefully and avoided overreach — but that doesn't outweigh the fact that the total evidence more strongly supports the other side's position.`;

  const verdict = {
    argumentAssessment,
    summary:
      winningSide === "mixed"
        ? `The evidence on "${question}" is genuinely mixed. Both sides can point to methodologically reasonable studies, and the disagreement partly reflects real uncertainty in the literature rather than one side simply being wrong.`
        : `On balance, the evidence more strongly supports ${winningSide === "model1" ? "Model 1's" : "Model 2's"} position on "${question}", though not as decisively as either debater implied.`,
    winningSide,
    confidence,
    nuances,
  };

  return {
    question,
    model1,
    model2,
    model3: { critiques, verdict },
  };
}

export const EXAMPLE_QUESTIONS = [
  "Does social media cause teenagers to become less social?",
  "Does remote work reduce employee productivity?",
  "Do minimum wage increases lead to higher unemployment?",
  "Do video games increase aggressive behavior in children?",
  "Does intermittent fasting improve long-term metabolic health?",
];
