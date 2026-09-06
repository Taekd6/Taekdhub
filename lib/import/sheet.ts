import { getChaptersForSubject } from "@/lib/chapters";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, ExerciseType, Subject } from "@/lib/supabase/types";
import type { SheetExercise } from "@/lib/import/types";

/**
 * DE LA FEUILLE DÉTECTÉE AUX LIGNES D'IMPORT.
 *
 * Point d'articulation avec l'existant : ce module ne crée PAS d'exercices. Il
 * produit exactement le format que `parseExerciseImportPayload`
 * (lib/exercise-import.ts) valide déjà, lequel appelle `createExerciseFromInput`
 * — le même constructeur que le formulaire manuel. Un exercice importé depuis
 * un PDF est donc, jusqu'au dernier champ, un exercice comme les autres : même
 * validation, même détection de doublon, même comportement dans le lecteur.
 */

/** Ce que l'élève renseigne UNE FOIS pour toute la feuille. */
export interface SheetMetadata {
  subject: Subject;
  /** Chapitre par défaut — chaque exercice peut en changer dans l'aperçu. */
  chapterLabel: string;
  /** Nom de la feuille, tel qu'il apparaîtra dans la source. */
  sheetName: string;
  /** Établissement, professeur, recueil… — la deuxième moitié de la source. */
  origin: string;
  year: string;
  type: ExerciseType;
  tags: string[];
}

/** Réglages propres à un exercice, modifiables dans l'aperçu. */
export interface DraftOverrides {
  include: boolean;
  title: string;
  statement: string;
  chapterLabel: string;
  difficulty: Difficulty;
  /** `true` quand l'élève a explicitement demandé d'importer malgré un doublon. */
  force: boolean;
}

/**
 * SOURCE — « Feuille 4 — Lycée Jean Perrin — 2026 ».
 *
 * Une seule chaîne, parce que c'est ce que le modèle `Exercise` stocke et ce
 * que la liste affiche déjà pour les exercices d'enseignant. Les morceaux vides
 * sont omis plutôt que de laisser des tirets orphelins.
 */
export function buildSource(metadata: SheetMetadata): string {
  return [metadata.sheetName.trim(), metadata.origin.trim(), metadata.year.trim()].filter(Boolean).join(" — ");
}

/** Empreinte stable d'une feuille (FNV-1a) — deux imports du même fichier donnent les mêmes identifiants, donc un doublon détecté. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

/**
 * Identifiant externe d'un exercice importé.
 *
 * Il porte l'empreinte de la feuille et le rang de l'exercice : réimporter la
 * même feuille est reconnu comme un doublon par la validation existante, sans
 * dépendre du titre — qui, lui, peut avoir été corrigé entre-temps. Le suffixe
 * `variant` sert au cas « c'est vraiment un autre exercice, importe-le quand
 * même » : un identifiant différent, donc aucun écrasement.
 */
export function externalIdFor(sheetPrint: string, index: number, variant = 0): string {
  return `feuille:${sheetPrint}:${index + 1}${variant ? `:v${variant + 1}` : ""}`;
}

/**
 * Difficulté PROPOSÉE — jamais imposée : l'aperçu la montre et l'élève la
 * corrige. Trois signaux simples et vérifiables : le nombre de sous-questions,
 * la longueur de l'énoncé, et les verbes qui trahissent une démonstration.
 */
export function suggestDifficulty(exercise: SheetExercise): Difficulty {
  let score = 3;
  if (exercise.parts >= 4) score += 1;
  if (exercise.parts === 0 && exercise.statement.length < 160) score -= 1;
  if (/\b(montrer|d[ée]montrer|prouver|[ée]tablir)\b/i.test(exercise.statement)) score += 0;
  if (/\b(calculer|donner|[ée]noncer|rappeler)\b/i.test(exercise.statement) && exercise.parts <= 1) score -= 1;
  return Math.min(5, Math.max(1, score)) as Difficulty;
}

/** Durée PROPOSÉE, sur la même base : un quart d'heure, plus cinq minutes par sous-question. */
export function suggestMinutes(exercise: SheetExercise): number {
  return Math.min(90, 15 + exercise.parts * 5);
}

/**
 * Chapitre PROPOSÉ : celui dont le libellé apparaît dans l'énoncé. Recherche
 * volontairement littérale — proposer un chapitre à tort ferait ranger
 * l'exercice au mauvais endroit, ce qui coûte plus cher que ne rien proposer.
 */
export function suggestChapter(exercise: SheetExercise, chapters: Chapter[], subject: Subject): string {
  const haystack = normalizeWords(`${exercise.title} ${exercise.statement}`);
  let best = "";
  let bestLength = 0;
  for (const chapter of getChaptersForSubject(chapters, subject)) {
    const needle = normalizeWords(chapter.label);
    if (needle.length < 5) continue;
    if (haystack.includes(needle) && needle.length > bestLength) {
      best = chapter.label;
      bestLength = needle.length;
    }
  }
  return best;
}

function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Construit les lignes d'import — le format brut attendu par
 * `parseExerciseImportPayload`. Les exercices exclus par l'élève ne sont
 * simplement pas produits : c'est ce qui rend l'import PARTIEL possible sans
 * relancer l'analyse (18 exercices sur 20 s'importent, les 2 douteux restent
 * de côté).
 */
export function toImportRows(
  exercises: SheetExercise[],
  overrides: DraftOverrides[],
  metadata: SheetMetadata,
  sheetPrint: string
): Record<string, unknown>[] {
  const source = buildSource(metadata);
  const rows: Record<string, unknown>[] = [];
  exercises.forEach((exercise, index) => {
    const override = overrides[index];
    if (!override?.include) return;
    rows.push({
      title: override.title.trim() || exercise.title,
      statement: override.statement.trim(),
      source,
      subject: metadata.subject,
      type: metadata.type,
      difficulty: override.difficulty,
      chapter: override.chapterLabel.trim() || undefined,
      estimatedMinutes: suggestMinutes(exercise),
      tags: metadata.tags,
      // Une feuille distribuée en classe : c'est bien la provenance
      // « enseignant » du modèle existant, et c'est elle qui fait afficher la
      // source dans la liste d'exercices.
      provenance: "enseignant",
      exerciseNumber: exercise.number ?? String(index + 1),
      externalId: externalIdFor(sheetPrint, index, override.force ? 1 : 0),
      year: Number(metadata.year) || undefined,
    });
  });
  return rows;
}
