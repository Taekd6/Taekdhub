import { addChapter } from "@/lib/chapters";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import type { Chapter } from "@/lib/storage";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Amorçage de la banque au tout premier lancement (Sprint "portabilité").
 *
 * Problème résolu : les exercices vivent dans `datasets/` (fichiers du dépôt)
 * mais n'étaient jamais injectés dans l'app — un navigateur neuf affichait
 * donc une page Exercices vide. Ce module charge la banque groupée une seule
 * fois, quand le stockage est vide, via EXACTEMENT le même pipeline que
 * l'import manuel (`parseExerciseImportPayload` + `createExerciseFromInput`) :
 * même résultat que si l'utilisateur avait cliqué « Importer » sur le fichier
 * `datasets/exercices-banque-complete.json`.
 *
 * Ne touche jamais au système de sauvegarde/export-import : `SEED_FLAG_KEY`
 * est un marqueur local de premier lancement, pas une donnée métier (il n'est
 * volontairement PAS inclus dans les sauvegardes).
 */

/** Marqueur « banque déjà amorcée » — empêche tout ré-amorçage (y compris si l'utilisateur vide sa banque plus tard : sa décision est respectée). */
export const SEED_FLAG_KEY = "prepahub:seeded";

/**
 * Reconstruit exercices + chapitres à partir de la banque groupée, en
 * dédoublonnant les chapitres exactement comme le fait le bouton « Importer »
 * (components/exercises/exercise-import.tsx#commit) : un même libellé de
 * chapitre référencé par plusieurs exercices ne crée qu'un seul chapitre.
 */
function buildSeed(bank: unknown): { exercises: Exercise[]; chapters: Chapter[] } {
  const { rows } = parseExerciseImportPayload(bank, []);
  let chapters: Chapter[] = [];
  const createdIds = new Map<string, string>();

  for (const row of rows) {
    if (row.isNewChapter && row.chapterLabel) {
      const key = `${row.input.subject}::${row.chapterLabel.toLowerCase()}`;
      if (!createdIds.has(key)) {
        const result = addChapter(chapters, row.input.subject, row.chapterLabel);
        chapters = result.chapters;
        createdIds.set(key, result.chapter.id);
      }
    }
  }

  const exercises = rows.map((row) => {
    if (row.isNewChapter && row.chapterLabel) {
      const key = `${row.input.subject}::${row.chapterLabel.toLowerCase()}`;
      return createExerciseFromInput({ ...row.input, chapterId: createdIds.get(key) ?? null });
    }
    return createExerciseFromInput(row.input);
  });

  return { exercises, chapters };
}

/**
 * Charge la banque groupée (import dynamique → chunk séparé, téléchargé
 * uniquement lors de l'amorçage, jamais dans le bundle des chargements
 * normaux). Source unique de vérité : `datasets/exercices-banque-complete.json`.
 */
export async function loadSeedBank(): Promise<{ exercises: Exercise[]; chapters: Chapter[] }> {
  const bankModule = await import("@/datasets/exercices-banque-complete.json");
  const bank = (bankModule as { default: unknown }).default;
  return buildSeed(bank);
}
