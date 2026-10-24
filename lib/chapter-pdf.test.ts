import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { errorsDocument, methodsDocument, pdfFileName } from "@/lib/chapter-pdf";
import { renderPdf, wrapLines, type PdfFonts } from "@/lib/chapter-pdf-render";
import type { Methode } from "@/lib/chapter-notes";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { ErrorEntry } from "@/lib/storage";

const NOW = new Date("2026-10-24T10:00:00Z");
const CHAPTER = PROGRAMME_BY_ID.get("m2-reduction")!;
const font = (name: string) => new Uint8Array(readFileSync(path.resolve(process.cwd(), "public/fonts", name)));
const FONTS: PdfFonts = { regular: font("DejaVuSans.ttf"), bold: font("DejaVuSans-Bold.ttf") };

const methode = (index: number): Methode => ({
  id: String(index),
  titre: `Diagonaliser un endomorphisme (${index})`,
  quand: "On veut calculer uⁿ ou trouver une base où u s'écrit simplement : ⟺ π_u scindé à racines simples sur 𝕂.",
  etapes: ["Calculer χ_u = det(XId − u) et le factoriser dans 𝕂[X].", "Pour chaque λ ∈ Sp(u), déterminer E_λ(u) = Ker(u − λId).", "Conclure : diagonalisable ⟺ ∑ dim E_λ = n."],
  piege: "Vérifier que χ_u est scindé avant de conclure.",
  createdAt: NOW.toISOString(),
});

const erreur = (index: number): ErrorEntry =>
  ({
    id: String(index),
    subject: "Mathématiques",
    date: "2026-10-24",
    source: "exercice",
    type: "méthode",
    description: `A diagonalisé sans vérifier que χ_u est scindé (${index})`,
    fix: "Vérifier χ_u scindé avant de conclure.",
    chapterId: null,
    exerciseId: null,
    reviewItemId: null,
    programmeChapterId: "m2-reduction",
    createdAt: NOW.toISOString(),
  }) as ErrorEntry;

describe("pdfFileName", () => {
  it("donne toujours le même nom pour un chapitre et une sorte de PDF, sans accents ni espaces", () => {
    expect(pdfFileName(CHAPTER, "methodes")).toBe("Reduction-des-endomorphismes-methodes.pdf");
    expect(pdfFileName(CHAPTER, "erreurs")).toBe("Reduction-des-endomorphismes-erreurs.pdf");
  });
});

describe("documents", () => {
  it("décrit une méthode : quand, étapes numérotées, piège", () => {
    const [card] = methodsDocument(CHAPTER, [methode(1)], NOW).cards;
    expect(card.rows.map((row) => row.label)).toEqual(["Quand", "1.", "2.", "3.", "Piège"]);
    expect(card.rows.at(-1)?.tone).toBe("warn");
  });

  it("décrit une erreur : ce qui a raté en rouge, à retenir en vert, date et source en tête", () => {
    const [card] = errorsDocument(CHAPTER, [erreur(1)], NOW).cards;
    expect(card.meta).toBe("24 octobre 2026 · Exercice · Méthode");
    expect(card.rows.map((row) => row.tone)).toEqual(["bad", "ok"]);
  });

  it("annonce le nombre d'éléments dans le sous-titre", () => {
    expect(methodsDocument(CHAPTER, [methode(1), methode(2)], NOW).subtitle).toBe("Mathématiques · 2 méthodes");
    expect(errorsDocument(CHAPTER, [erreur(1)], NOW).subtitle).toBe("Mathématiques · 1 erreur");
  });
});

describe("wrapLines", () => {
  const measure = (value: string) => value.length * 10;

  it("coupe aux espaces et respecte les retours à la ligne", () => {
    expect(wrapLines("un deux trois quatre", 90, measure)).toEqual(["un deux", "trois", "quatre"]);
    expect(wrapLines("a\nb", 90, measure)).toEqual(["a", "b"]);
  });

  it("coupe un mot plus long que la ligne au lieu de déborder", () => {
    const lines = wrapLines("abcdefghijkl", 50, measure);
    expect(lines.every((line) => measure(line) <= 50)).toBe(true);
    expect(lines.join("")).toBe("abcdefghijkl");
  });
});

describe("renderPdf", () => {
  it("fabrique un vrai PDF lisible, titré, avec les symboles de maths", async () => {
    const bytes = await renderPdf(methodsDocument(CHAPTER, [methode(1), methode(2)], NOW), FONTS);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    expect(loaded.getTitle()).toBe("Réduction des endomorphismes — Méthodes");
  });

  it("passe à la page suivante quand il y a beaucoup de contenu", async () => {
    const bytes = await renderPdf(errorsDocument(CHAPTER, Array.from({ length: 40 }, (_, index) => erreur(index)), NOW), FONTS);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("fabrique un PDF même sans rien à mettre dedans", async () => {
    const bytes = await renderPdf(errorsDocument(CHAPTER, [], NOW), FONTS);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("ne plante pas sur un caractère que la police n'a pas", async () => {
    const odd = { ...methode(1), quand: "Un symbole rare : 🂡 et un emoji 🙂" };
    const bytes = await renderPdf(methodsDocument(CHAPTER, [odd], NOW), FONTS);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("garde une carte plus haute qu'une page sans échouer", async () => {
    const huge = { ...methode(1), etapes: Array.from({ length: 10 }, () => "Une étape très longue. ".repeat(40)) };
    const bytes = await renderPdf(methodsDocument(CHAPTER, [huge], NOW), FONTS);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
