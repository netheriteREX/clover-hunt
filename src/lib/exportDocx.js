import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  AlignmentType,
} from "docx";
import { reportFilename } from "./reportContent.js";

const GREEN = "1F5C34";
const SAGE = "55684A";
const GOLD = "8A6A1F";
const DANGER = "8C2F2F";
const INK = "142118";
const INK_MUTED = "40503F";

function sideColor(sideKey) {
  return sideKey === "model1" ? GREEN : SAGE;
}

function citationParagraphs(arg, critique) {
  const paras = [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: arg.claim, bold: true, size: 22, color: INK })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: arg.reasoning, size: 20, color: INK_MUTED })],
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `${arg.citation.authors} (${arg.citation.year}) — `, bold: true, size: 19, color: INK }),
        new TextRun({ text: arg.citation.venue, italics: true, size: 19, color: INK }),
      ],
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `${arg.citation.studyType} · ${arg.citation.sampleSize}`, size: 18, color: INK_MUTED }),
      ],
    }),
    new Paragraph({
      spacing: { after: arg.citation.url ? 20 : 80 },
      children: [new TextRun({ text: arg.citation.summary, size: 18, color: INK_MUTED })],
    }),
  ];

  if (arg.citation.url) {
    paras.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new ExternalHyperlink({
            link: arg.citation.url,
            children: [
              new TextRun({ text: arg.citation.url, size: 18, color: GREEN, underline: {} }),
            ],
          }),
        ],
      }),
    );
  }

  if (critique) {
    const scoreText =
      typeof critique.argumentScore === "number"
        ? `Argument quality: ${critique.argumentScore}/100 · Evidence quality: ${critique.qualityScore}/100`
        : `Evidence quality: ${critique.qualityScore}/100`;
    paras.push(
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: scoreText, bold: true, size: 18, color: INK })],
      }),
    );
    if (critique.reasoningFlaws?.length) {
      paras.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: `Reasoning flaws: ${critique.reasoningFlaws.join("; ")}`, size: 18, color: DANGER }),
          ],
        }),
      );
    }
    if (critique.flaws?.length) {
      paras.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: `Evidence flaws: ${critique.flaws.join("; ")}`, size: 18, color: DANGER })],
        }),
      );
    }
    if (critique.strengths?.length) {
      paras.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: `Strengths: ${critique.strengths.join("; ")}`, size: 18, color: GREEN })],
        }),
      );
    }
    if (critique.notes) {
      paras.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: critique.notes, italics: true, size: 18, color: INK_MUTED })],
        }),
      );
    }
  }

  return paras;
}

function sideSection(label, sideKey, model, critiques) {
  const paras = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: `${label} — ${model.side}`, color: sideColor(sideKey) })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: model.position, size: 20, color: INK_MUTED })],
    }),
  ];

  model.arguments.forEach((arg, i) => {
    const critique = critiques.find((c) => c.side === sideKey && c.argumentId === arg.id);
    paras.push(...citationParagraphs({ ...arg, claim: `${i + 1}. ${arg.claim}` }, critique));
  });

  return paras;
}

export async function exportDebateAsDocx(debate) {
  const { verdict } = debate.model3;
  const winningLabel =
    verdict.winningSide === "mixed"
      ? "Mixed — both sides argued well"
      : verdict.winningSide === "model1"
        ? `${debate.model1.side} — the stronger argument`
        : `${debate.model2.side} — the stronger argument`;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: "Clover Hunt", color: GREEN })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Evidence review report · generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
                size: 18,
                color: INK_MUTED,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
            children: [new TextRun({ text: "Question", color: INK_MUTED })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: debate.question, bold: true, size: 26, color: INK })],
          }),

          ...sideSection("Model 1", "model1", debate.model1, debate.model3.critiques),
          ...sideSection("Model 2", "model2", debate.model2, debate.model3.critiques),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: "Model 3 — Verdict", color: GOLD })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `Confidence: ${verdict.confidence}% · ${winningLabel}`, bold: true, size: 20, color: INK }),
            ],
          }),
          ...(verdict.argumentAssessment
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { after: 80 },
                  children: [new TextRun({ text: "Argument assessment — who reasoned better", color: GREEN })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun({ text: verdict.argumentAssessment, size: 20, color: INK })],
                }),
              ]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
            children: [new TextRun({ text: "Evidence summary", color: INK_MUTED })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: verdict.summary, size: 20, color: INK_MUTED })],
          }),
          ...(verdict.nuances?.length
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { after: 80 },
                  children: [new TextRun({ text: "Important nuance", color: INK_MUTED })],
                }),
                ...verdict.nuances.map(
                  (n) =>
                    new Paragraph({
                      spacing: { after: 100 },
                      alignment: AlignmentType.LEFT,
                      children: [new TextRun({ text: `• ${n}`, size: 19, color: INK_MUTED })],
                    }),
                ),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFilename(debate.question, "docx");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
