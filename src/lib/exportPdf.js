import { jsPDF } from "jspdf";
import { reportFilename } from "./reportContent.js";

const MARGIN = 56;
const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GREEN = [31, 92, 52];
const SAGE = [85, 104, 74];
const GOLD = [138, 106, 31];
const INK = [20, 33, 24];
const INK_MUTED = [64, 80, 63];

function verdictColor(side) {
  if (side === "model1") return GREEN;
  if (side === "model2") return SAGE;
  return GOLD;
}

// jsPDF's built-in fonts (helvetica/times) only support WinAnsi (Latin-1)
// encoding. Real author names routinely include characters outside that set
// (e.g. Romanian "t with comma below") — left as-is, splitTextToSize's width
// math goes out of sync with what actually renders, and text silently
// overflows off the page edge instead of wrapping. Decompose + strip
// diacritics (Unicode combining marks, U+0300-U+036F) so it degrades to
// plain ASCII instead of breaking layout.
const COMBINING_MARKS = new RegExp("[̀-ͯ]", "g");

function sanitizeForPdf(text) {
  return String(text).normalize("NFD").replace(COMBINING_MARKS, "");
}

export function exportDebateAsPdf(debate) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text, size = 13, color = INK) => {
    ensureSpace(size + 10);
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(sanitizeForPdf(text), MARGIN, y);
    y += size + 8;
  };

  const paragraph = (text, { size = 10, color = INK_MUTED, font = "helvetica", style = "normal", gap = 14 } = {}) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(sanitizeForPdf(text), CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, MARGIN, y);
      y += size + 4;
    }
    y += gap - (size + 4);
    y += 4;
  };

  const rule = (color = [209, 221, 201]) => {
    ensureSpace(14);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 16;
  };

  // Title bar
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, PAGE_WIDTH, 8, "F");
  y = MARGIN;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("Clover Hunt", MARGIN, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTED);
  doc.text(
    `Evidence review report - generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
    MARGIN,
    y,
  );
  y += 24;

  heading("Question", 11, INK_MUTED);
  paragraph(debate.question, { size: 14, font: "times", style: "bold", color: INK, gap: 18 });
  rule();

  const renderSide = (label, model, critiques) => {
    heading(`${label} - ${model.side}`, 13, verdictColor(label === "Model 1" ? "model1" : "model2"));
    paragraph(model.position, { gap: 16 });

    model.arguments.forEach((arg, i) => {
      const critique = critiques.find(
        (c) => c.side === (label === "Model 1" ? "model1" : "model2") && c.argumentId === arg.id,
      );
      heading(`${i + 1}. ${arg.claim}`, 10.5, INK);
      paragraph(arg.reasoning, { gap: 10 });

      const citeLine = `${arg.citation.authors} (${arg.citation.year}) - ${arg.citation.venue}`;
      paragraph(citeLine, { size: 9.5, font: "helvetica", style: "bold", color: INK, gap: 6 });
      paragraph(`${arg.citation.studyType} - ${arg.citation.sampleSize}`, { size: 9, gap: 6 });
      paragraph(arg.citation.summary, { size: 9, gap: 6 });
      if (arg.citation.url) {
        paragraph(arg.citation.url, { size: 9, color: GREEN, gap: 10 });
      }

      if (critique) {
        const scoreLine =
          typeof critique.argumentScore === "number"
            ? `Argument quality: ${critique.argumentScore}/100 - Evidence quality: ${critique.qualityScore}/100`
            : `Evidence quality: ${critique.qualityScore}/100`;
        paragraph(scoreLine, { size: 9, style: "bold", gap: 6 });
        if (critique.reasoningFlaws?.length) {
          paragraph(`Reasoning flaws: ${critique.reasoningFlaws.join("; ")}`, { size: 9, color: [140, 47, 47], gap: 6 });
        }
        if (critique.flaws?.length) {
          paragraph(`Evidence flaws: ${critique.flaws.join("; ")}`, { size: 9, color: [140, 47, 47], gap: 6 });
        }
        if (critique.strengths?.length) {
          paragraph(`Strengths: ${critique.strengths.join("; ")}`, { size: 9, color: GREEN, gap: 6 });
        }
        if (critique.notes) {
          paragraph(critique.notes, { size: 9, style: "italic", gap: 12 });
        }
      }
      y += 4;
    });

    rule();
  };

  renderSide("Model 1", debate.model1, debate.model3.critiques);
  renderSide("Model 2", debate.model2, debate.model3.critiques);

  const { verdict } = debate.model3;
  heading("Model 3 - Verdict", 13, GOLD);
  paragraph(
    `Confidence: ${verdict.confidence}% - ${
      verdict.winningSide === "mixed"
        ? "Mixed, both sides argued well"
        : verdict.winningSide === "model1"
          ? `${debate.model1.side} - the stronger argument`
          : `${debate.model2.side} - the stronger argument`
    }`,
    { size: 10, style: "bold", color: INK, gap: 10 },
  );
  if (verdict.argumentAssessment) {
    heading("Argument assessment - who reasoned better", 10.5, GREEN);
    paragraph(verdict.argumentAssessment, { gap: 14 });
  }
  heading("Evidence summary", 10.5, INK_MUTED);
  paragraph(verdict.summary, { gap: 14 });

  if (verdict.nuances?.length) {
    heading("Important nuance", 10.5, INK_MUTED);
    verdict.nuances.forEach((n) => paragraph(`- ${n}`, { size: 9.5, gap: 8 }));
  }

  doc.save(reportFilename(debate.question, "pdf"));
}
