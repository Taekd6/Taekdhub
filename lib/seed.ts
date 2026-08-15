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

/** Marqueur « banque de base déjà amorcée » — empêche tout ré-amorçage (y compris si l'utilisateur vide sa banque plus tard : sa décision est respectée). */
export const SEED_FLAG_KEY = "prepahub:seeded";

/**
 * Marqueur « pack Cahier de calcul déjà amorcé » (122 calculs, voir
 * sources/cahier-de-calcul/README.md — énoncés/corrigés/réponses reconstruits
 * en LaTeX et vérifiés visuellement contre le PDF source avant intégration).
 * Séparé de `SEED_FLAG_KEY` à dessein : un pack de contenu ajouté après le
 * tout premier lancement d'un utilisateur (dont le stockage n'est donc plus
 * vide) doit quand même pouvoir s'ajouter une fois, sans jamais rejouer
 * l'amorçage de la banque de base ni se répéter à chaque montage.
 */
export const CAHIER_CALCUL_SEED_FLAG_KEY = "prepahub:seeded:cahier-de-calcul";

/**
 * Reconstruit les exercices d'une banque JSON à partir des chapitres déjà
 * existants, en dédoublonnant les chapitres exactement comme le fait le
 * bouton « Importer » (components/exercises/exercise-import.tsx#commit) : un
 * même libellé de chapitre (même matière, insensible à la casse) référencé
 * par plusieurs exercices — de cette banque ou déjà présent dans
 * `existingChapters` — ne crée qu'un seul chapitre.
 *
 * Retourne les exercices de CETTE banque uniquement (pas ceux déjà en
 * stockage) et l'ensemble complet des chapitres (`existingChapters` + les
 * nouveaux) — à l'appelant de fusionner les exercices avec l'existant.
 */
function buildSeed(bank: unknown, existingChapters: Chapter[]): { exercises: Exercise[]; chapters: Chapter[] } {
  const { rows } = parseExerciseImportPayload(bank, existingChapters);
  let chapters: Chapter[] = existingChapters;
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
  const module = await import("@/datasets/exercices-banque-complete.json");
  const bank = (module as { default: unknown }).default;
  return buildSeed(bank, []);
}

/**
 * Charge le pack Cahier de calcul (122 calculs, voir
 * sources/cahier-de-calcul/README.md) — même mécanique que `loadSeedBank`,
 * mais fusionné sur les chapitres déjà existants (`existingChapters`) plutôt
 * que repartis de zéro : les fiches dont le titre correspond à un chapitre
 * déjà présent (ex. « Suites numériques ») rejoignent ce chapitre au lieu
 * d'en créer un doublon.
 */
export async function loadCahierCalculSeed(existingChapters: Chapter[]): Promise<{ exercises: Exercise[]; chapters: Chapter[] }> {
  const module = await import("@/datasets/cahier-de-calcul-professeur.json");
  const bank = (module as { default: unknown }).default;
  return buildSeed(bank, existingChapters);
}
