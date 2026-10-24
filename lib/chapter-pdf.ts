import { foldText } from "@/lib/annales";
import type { Methode } from "@/lib/chapter-notes";
import type { ProgrammeChapter } from "@/lib/programme-data";
import { ERROR_SOURCE_META, ERROR_TYPE_META } from "@/lib/error-log";
import type { ErrorEntry } from "@/lib/storage";

/**
 * LES PDF D'UN CHAPITRE — « Méthodes » et « Erreurs », deux fichiers au nom
 * FIXE (`Reduction-des-endomorphismes-methodes.pdf`), refaits à neuf depuis
 * les données à chaque téléchargement : ils sont donc toujours à jour, et
 * l'élève sait toujours où les prendre (la page du chapitre).
 *
 * Fabriqués DANS LE NAVIGATEUR (pdf-lib) : aucun serveur, aucun stockage de
 * fichiers, et le PDF s'enregistre tel quel dans Fichiers sur l'iPad.
 *
 * POLICE. Les 14 polices standard d'un PDF ne connaissent ni « ⟺ », ni
 * « ∑ », ni « χ » : DejaVu Sans (public/fonts, licence libre) est donc
 * embarquée — seuls les glyphes utilisés (sous-ensemble). Un caractère
 * qu'elle ne possède pas est remplacé par « ? » plutôt que de faire échouer
 * le PDF.
 *
 * Deux étages : ICI, `methodsDocument` / `errorsDocument` (purs, légers)
 * décrivent le document en cartes ; `renderPdf`
 * (lib/chapter-pdf-render.ts, qui embarque pdf-lib) le met en page. La
 * séparation garde pdf-lib hors de la page du chapitre jusqu'au clic.
 */

export type Tone = "normal" | "ok" | "bad" | "warn";

export interface PdfRow {
  /** Court : « Quand », « Piège », « À retenir », « 1. ». */
  label: string;
  text: string;
  tone?: Tone;
}

export interface PdfCard {
  /** Ligne de tête, en gras. */
  title?: string;
  /** Ligne grise sous le titre (date, source…). */
  meta?: string;
  rows: PdfRow[];
}

export interface PdfDocumentModel {
  title: string;
  subtitle: string;
  /** Pied de page, à gauche de la numérotation. */
  footer: string;
  /** Dit quand il n'y a rien à mettre. */
  emptyNote: string;
  cards: PdfCard[];
}

const dayLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

const generated = (now: Date) => `Généré le ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}`;

export function methodsDocument(chapter: ProgrammeChapter, methodes: Methode[], now: Date): PdfDocumentModel {
  return {
    title: `${chapter.title} — Méthodes`,
    subtitle: `${chapter.subject} · ${methodes.length} méthode${methodes.length > 1 ? "s" : ""}`,
    footer: `TaekdHub · ${generated(now)}`,
    emptyNote: "Aucune méthode rangée pour ce chapitre. Demande-les à Claude : il les range ici.",
    cards: methodes.map((methode) => ({
      title: methode.titre,
      rows: [
        { label: "Quand", text: methode.quand },
        ...methode.etapes.map((etape, index) => ({ label: `${index + 1}.`, text: etape })),
        ...(methode.piege ? [{ label: "Piège", text: methode.piege, tone: "warn" as const }] : []),
      ],
    })),
  };
}

export function errorsDocument(chapter: ProgrammeChapter, errors: ErrorEntry[], now: Date): PdfDocumentModel {
  return {
    title: `${chapter.title} — Erreurs`,
    subtitle: `${chapter.subject} · ${errors.length} erreur${errors.length > 1 ? "s" : ""}`,
    footer: `TaekdHub · ${generated(now)}`,
    emptyNote: "Aucune erreur notée sur ce chapitre pour l'instant.",
    cards: errors.map((entry) => ({
      meta: `${dayLabel(entry.date)} · ${ERROR_SOURCE_META[entry.source].label} · ${ERROR_TYPE_META[entry.type].label}`,
      rows: [{ label: "Erreur", text: entry.description, tone: "bad" as const }, ...(entry.fix ? [{ label: "À retenir", text: entry.fix, tone: "ok" as const }] : [])],
    })),
  };
}

/** `Reduction-des-endomorphismes-methodes.pdf` : le même nom à chaque fois pour un chapitre et une sorte de PDF. */
export function pdfFileName(chapter: Pick<ProgrammeChapter, "title">, kind: "methodes" | "erreurs"): string {
  const slug = foldText(chapter.title)
    .split(" ")
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join("-");
  return `${slug}-${kind}.pdf`;
}
