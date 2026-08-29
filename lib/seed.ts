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
 * Version du CONTENU embarqué, et clé où l'on retient celle déjà appliquée.
 *
 * Sans ce mécanisme, l'amorçage n'avait lieu qu'UNE fois dans la vie d'un
 * navigateur : la banque d'un élève restait figée sur la version du jour où
 * il a ouvert TaekdHub pour la première fois. Concrètement, un élève arrivé
 * quand la banque comptait 176 exercices SANS AUCUN énoncé n'a jamais vu les
 * 404 énoncés, les indices, les corrections ni les 226 exercices ajoutés
 * ensuite — l'écran de séance lui affichait « aucun énoncé renseigné »,
 * indéfiniment, sans aucun moyen de rattrapage. Bug remonté par l'usage réel.
 *
 * À INCRÉMENTER à chaque évolution significative de
 * `datasets/exercices-banque-complete.json`.
 */
export const SEED_CONTENT_VERSION = 5;
export const SEED_VERSION_KEY = "prepahub:seeded:version";

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
  const imported = await import("@/datasets/exercices-banque-complete.json");
  const bank = (imported as { default: unknown }).default;
  return buildSeed(bank);
}

/**
 * Clé de rapprochement entre un exercice déjà stocké et une fiche de la banque
 * embarquée. Les identifiants sont tirés au sort localement à l'amorçage
 * (`crypto.randomUUID`) : ils ne peuvent donc PAS servir de repère d'une
 * version à l'autre. `matière + titre` est la seule paire stable dans le
 * temps ; son unicité sur la banque livrée n'est plus une vérification
 * manuelle datée mais un invariant testé (voir lib/dataset-integrity.test.ts).
 */
function bankKey(subject: string, title: string): string {
  return `${subject}::${title.trim().toLowerCase()}`;
}

/**
 * CE QUI APPARTIENT À L'ÉLÈVE et ne doit jamais être écrasé par une mise à
 * jour de contenu : son avancement, ses marquages, ses notes personnelles.
 * Tout le reste (énoncé, indices, correction, source, difficulté, tags…)
 * appartient à la banque et peut être rafraîchi.
 */
const LEARNER_OWNED = ["status", "mastery", "attempts", "last_worked_at", "favorite", "id", "created_at"] as const;

export interface SeedReconciliation {
  exercises: Exercise[];
  chapters: Chapter[];
  updatedCount: number;
  addedCount: number;
}

/**
 * Met la banque locale à jour SANS TOUCHER À LA PROGRESSION.
 *
 * - fiche connue (même matière + même titre) → le contenu est rafraîchi,
 *   l'avancement de l'élève est conservé tel quel ;
 * - fiche absente en local → ajoutée, avec un avancement vierge ;
 * - exercice local absent de la banque → laissé strictement intact. C'est
 *   soit une fiche que l'élève a créée lui-même, soit une fiche retirée de la
 *   banque : dans les deux cas, une mise à jour de contenu n'a pas à
 *   supprimer le travail de quelqu'un.
 */
export function reconcileSeedBank(
  localExercises: Exercise[],
  localChapters: Chapter[],
  seed: { exercises: Exercise[]; chapters: Chapter[] }
): SeedReconciliation {
  const seedByKey = new Map(seed.exercises.map((exercise) => [bankKey(exercise.subject, exercise.title), exercise]));
  const seedChapterById = new Map(seed.chapters.map((chapter) => [chapter.id, chapter]));

  // Les chapitres existants sont conservés (leurs identifiants sont déjà
  // référencés par les exercices de l'élève) ; seuls les chapitres réellement
  // nouveaux sont ajoutés.
  const chapters = [...localChapters];
  const chapterIdByLabel = new Map(chapters.map((chapter) => [bankKey(chapter.subject, chapter.label), chapter.id]));
  const resolveChapterId = (seedChapterId: string | null): string | null => {
    if (!seedChapterId) return null;
    const seedChapter = seedChapterById.get(seedChapterId);
    if (!seedChapter) return null;
    const key = bankKey(seedChapter.subject, seedChapter.label);
    const existing = chapterIdByLabel.get(key);
    if (existing) return existing;
    chapters.push(seedChapter);
    chapterIdByLabel.set(key, seedChapter.id);
    return seedChapter.id;
  };

  let updatedCount = 0;
  const seenKeys = new Set<string>();

  const exercises = localExercises.map((local) => {
    const key = bankKey(local.subject, local.title);
    const fresh = seedByKey.get(key);
    if (!fresh) return local;
    seenKeys.add(key);
    const merged: Exercise = { ...fresh, chapter_id: resolveChapterId(fresh.chapter_id) ?? local.chapter_id };
    for (const field of LEARNER_OWNED) {
      Object.assign(merged, { [field]: local[field] });
    }
    // `archived` suit la banque (un exercice retiré du programme actif doit le
    // rester), sauf si l'élève l'a lui-même archivé — sa décision prime.
    merged.archived = local.archived || fresh.archived;
    // La note est mixte : celle de l'élève prime, mais tant qu'il n'en a pas
    // écrit une, celle de la banque (repère de méthode, piège classique…) doit
    // arriver — la traiter comme purement personnelle effaçait ce contenu.
    merged.note = local.note ?? fresh.note;
    merged.updated_at = new Date().toISOString();
    if (JSON.stringify(merged) !== JSON.stringify({ ...local, updated_at: merged.updated_at })) updatedCount++;
    return merged;
  });

  const added = seed.exercises
    .filter((exercise) => !seenKeys.has(bankKey(exercise.subject, exercise.title)))
    .map((exercise) => ({ ...exercise, chapter_id: resolveChapterId(exercise.chapter_id) }));

  return { exercises: [...exercises, ...added], chapters, updatedCount, addedCount: added.length };
}
