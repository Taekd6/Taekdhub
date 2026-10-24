import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { PdfDocumentModel, Tone } from "@/lib/chapter-pdf";

/**
 * MISE EN PAGE DES PDF D'UN CHAPITRE (pdf-lib) — voir lib/chapter-pdf.ts pour
 * ce que contient un document et pourquoi la police est embarquée. Importé
 * seulement au clic sur « Télécharger le PDF » (components/chapitre/pdf-button.tsx).
 */

/* ── Mise en page ───────────────────────────────────────────────── */

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const COLORS: Record<Tone, RGB> = { normal: rgb(0.1, 0.1, 0.12), ok: rgb(0.05, 0.45, 0.2), bad: rgb(0.72, 0.08, 0.08), warn: rgb(0.62, 0.34, 0.0) };
const MUTED = rgb(0.4, 0.4, 0.44);
const CARD_FILL = rgb(0.955, 0.955, 0.965);
const BODY = 11;
const LINE = 1.45;
const LABEL_WIDTH = 66;

/** Substitutions pour les symboles que la police n'a pas, avant le « ? » de dernier recours. */
const FALLBACKS: Record<string, string> = { "𝕂": "K", "𝕜": "k", "𝔼": "E", "𝟙": "1", "⟹": "⇒", "⟸": "⇐", "−": "-", " ": " ", " ": " ", "’": "'" };

function clean(text: string, supported: Set<number>): string {
  let out = "";
  for (const char of text.replace(/\t/g, " ")) {
    const code = char.codePointAt(0)!;
    if (char === "\n" || supported.has(code)) out += char;
    else if (FALLBACKS[char] && [...FALLBACKS[char]].every((c) => supported.has(c.codePointAt(0)!))) out += FALLBACKS[char];
    else out += "?";
  }
  return out;
}

/** Coupe `text` en lignes de `width` points au plus ; un mot plus long que la ligne est coupé. Les retours à la ligne du texte sont respectés. */
export function wrapLines(text: string, width: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (measure(rest) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(rest.slice(0, cut)) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export interface PdfFonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

/** Met le document en pages A4. Renvoie les octets du PDF. */
export async function renderPdf(model: PdfDocumentModel, fonts: PdfFonts): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  // Un caractère n'est écrit tel quel que si les DEUX graisses le possèdent.
  const inBold = new Set(bold.getCharacterSet());
  const supported = new Set(regular.getCharacterSet().filter((code) => inBold.has(code)));

  pdf.setTitle(model.title);
  pdf.setAuthor("TaekdHub");
  pdf.setCreator("TaekdHub");

  const textWidth = (font: PDFFont, size: number) => (value: string) => font.widthOfTextAtSize(value, size);
  const contentWidth = PAGE.width - 2 * MARGIN;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - MARGIN;
  };
  const write = (value: string, x: number, size: number, font: PDFFont, color: RGB, baseline: number) => {
    if (value) page.drawText(value, { x, y: baseline, size, font, color });
  };

  newPage();
  const titleLines = wrapLines(clean(model.title, supported), contentWidth, textWidth(bold, 20));
  for (const line of titleLines) {
    y -= 20 * 1.2;
    write(line, MARGIN, 20, bold, COLORS.normal, y);
  }
  y -= 16;
  write(clean(model.subtitle, supported), MARGIN, 11, regular, MUTED, y);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.width - MARGIN, y }, thickness: 0.8, color: rgb(0.8, 0.8, 0.84) });
  y -= 18;

  if (model.cards.length === 0) {
    for (const line of wrapLines(clean(model.emptyNote, supported), contentWidth, textWidth(regular, BODY))) {
      y -= BODY * LINE;
      write(line, MARGIN, BODY, regular, MUTED, y);
    }
  }

  const PAD = 12;
  const textX = MARGIN + PAD + 4;
  for (const card of model.cards) {
    const titleBlock = card.title ? wrapLines(clean(card.title, supported), contentWidth - 2 * PAD - 4, textWidth(bold, 12.5)) : [];
    const metaBlock = card.meta ? wrapLines(clean(card.meta, supported), contentWidth - 2 * PAD - 4, textWidth(regular, 10)) : [];
    const rows = card.rows.map((row) => ({
      row,
      label: clean(row.label, supported),
      lines: wrapLines(clean(row.text, supported), contentWidth - 2 * PAD - 4 - LABEL_WIDTH, textWidth(row.tone && row.tone !== "normal" ? bold : regular, BODY)),
    }));

    const height = PAD * 2 + titleBlock.length * 12.5 * 1.3 + metaBlock.length * 10 * 1.4 + (titleBlock.length || metaBlock.length ? 4 : 0) + rows.reduce((sum, entry) => sum + entry.lines.length * BODY * LINE + 3, 0);
    if (y - height < MARGIN + 20 && y < PAGE.height - MARGIN - 40) newPage();

    const top = y;
    // Une carte plus haute qu'une page se coupe où elle peut : on la dessine ligne à ligne, sans fond continu.
    const fits = height <= PAGE.height - 2 * MARGIN - 20;
    if (fits) {
      page.drawRectangle({ x: MARGIN, y: top - height, width: contentWidth, height, color: CARD_FILL });
      page.drawRectangle({ x: MARGIN, y: top - height, width: 3, height, color: rgb(0.35, 0.36, 0.8) });
    }
    y -= PAD;
    const line = (value: string, x: number, size: number, font: PDFFont, color: RGB, advance: number) => {
      if (y - advance < MARGIN) newPage();
      y -= advance;
      write(value, x, size, font, color, y);
    };
    for (const value of titleBlock) line(value, textX, 12.5, bold, COLORS.normal, 12.5 * 1.3);
    for (const value of metaBlock) line(value, textX, 10, regular, MUTED, 10 * 1.4);
    if (titleBlock.length || metaBlock.length) y -= 4;
    for (const entry of rows) {
      const tone = entry.row.tone ?? "normal";
      const font = tone === "normal" ? regular : bold;
      entry.lines.forEach((value, index) => {
        if (y - BODY * LINE < MARGIN) newPage();
        y -= BODY * LINE;
        if (index === 0) write(entry.label, textX, BODY, bold, tone === "normal" ? MUTED : COLORS[tone], y);
        write(value, textX + LABEL_WIDTH, BODY, font, COLORS[tone], y);
      });
      y -= 3;
    }
    y = fits ? top - height - 12 : y - 12;
  }

  const total = pages.length;
  pages.forEach((target, index) => {
    const footer = clean(model.footer, supported);
    target.drawText(footer, { x: MARGIN, y: MARGIN - 22, size: 9, font: regular, color: MUTED });
    const label = `${index + 1} / ${total}`;
    target.drawText(label, { x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, 9), y: MARGIN - 22, size: 9, font: regular, color: MUTED });
  });

  return pdf.save();
}
