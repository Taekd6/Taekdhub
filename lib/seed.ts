import { addChapter } from "@/lib/chapters";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import type { Chapter } from "@/lib/storage";
import type { Exercise } from "@/lib/supabase/types";

export const SEED_FLAG_KEY = "prepahub:seeded";
/**
 * Version du CONTENU de la banque. Toute correction du dataset qui doit
 * atteindre une installation existante passe par une incrémentation ici :
 * c'est la seule chose que regarde hooks/use-prepahub-data.ts pour décider de
 * relancer `reconcileSeedBank`. Sans bump, la correction n'existe que pour
 * une nouvelle installation — l'élève qui utilise déjà l'app, lui, ne voit
 * rien changer.
 *
 * 6 — banque nettoyée : 37 fiches retirées (15 sans énoncé du tout, 22
 * renvoyant à une feuille papier absente de l'app), 16 énoncés de concours
 * ajoutés, libellés de chapitres de Mathématiques consolidés (60 → 20, plus
 * aucun chapitre à une seule fiche). 477 → 440 exercices.
 */
export const SEED_CONTENT_VERSION = 6;
export const SEED_VERSION_KEY = "prepahub:seeded:version";

function buildSeed(bank: unknown): { exercises: Exercise[]; chapters: Chapter[] } {
  const { rows } = parseExerciseImportPayload(bank, []);
  let chapters: Chapter[] = [];
  const createdIds = new Map<string, string>();
  for (const row of rows) {
    if (!row.isNewChapter || !row.chapterLabel) continue;
    const key = bankKey(row.input.subject, row.chapterLabel);
    if (createdIds.has(key)) continue;
    const result = addChapter(chapters, row.input.subject, row.chapterLabel);
    chapters = result.chapters;
    createdIds.set(key, result.chapter.id);
  }
  const exercises = rows.map((row) => {
    if (row.isNewChapter && row.chapterLabel) {
      const key = bankKey(row.input.subject, row.chapterLabel);
      return createExerciseFromInput({ ...row.input, chapterId: createdIds.get(key) ?? null });
    }
    return createExerciseFromInput(row.input);
  });
  return { exercises, chapters };
}

/**
 * Forme canonique d'un libellé (titre d'exercice, libellé de chapitre) pour
 * le dédoublonnage et le rapprochement banque ↔ local.
 *
 * `trim().toLowerCase()` ne suffisait pas : deux fiches rigoureusement
 * identiques passaient au travers dès que l'une écrivait l'apostrophe typo-
 * graphique U+2019 et l'autre l'apostrophe ASCII U+0027 — cas réel,
 * « Déterminant d'une matrice tridiagonale », entrée deux fois dans la banque.
 * Même effet avec une espace insécable ou une double espace. Et le problème ne
 * s'arrête pas au doublon : `reconcileSeedBank` utilise la MÊME clé pour
 * retrouver la fiche locale correspondante — une apostrophe changée d'un
 * dataset à l'autre détachait la progression de l'élève de sa fiche et
 * réinsérait la version banque à côté, à zéro tentative.
 *
 * NFKC unifie les variantes de compatibilité (dont l'espace insécable), la
 * classe explicite couvre les apostrophes/accents que NFKC laisse distincts.
 */
function canonicalLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u02BC\u00B4\u0060]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeBank(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const value = item as { subject?: unknown; title?: unknown };
    const key = `${String(value.subject ?? "")}::${canonicalLabel(String(value.title ?? ""))}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function loadSeedBank(): Promise<{ exercises: Exercise[]; chapters: Chapter[] }> {
  const [base, algebra, corrected] = await Promise.all([
    import("@/datasets/exercices-banque-complete.json"),
    import("@/datasets/exercices-algebre-lineaire-hors-reduction-septembre-2026.json"),
    import("@/datasets/exercices-algebre-lineaire-feuille-13-24-corriges.json"),
  ]);
  const baseBank = (base as { default: unknown }).default;
  const algebraBank = (algebra as { default: unknown }).default;
  const correctedBank = (corrected as { default: unknown }).default;
  const all = [
    ...(Array.isArray(correctedBank) ? correctedBank : []),
    ...(Array.isArray(algebraBank) ? algebraBank : []),
    ...(Array.isArray(baseBank) ? baseBank : []),
  ];
  return buildSeed(dedupeBank(all));
}

function bankKey(subject: string, title: string): string {
  return `${subject}::${canonicalLabel(title)}`;
}

const LEARNER_OWNED = ["status", "mastery", "attempts", "last_worked_at", "favorite", "id", "created_at"] as const;

/**
 * Une fiche que l'élève n'a JAMAIS touchée — aucune trace de travail, aucune
 * saisie, aucun jugement porté dessus. C'est la seule condition sous laquelle
 * `reconcileSeedBank` s'autorise à retirer une fiche que la banque ne contient
 * plus : dès qu'un seul de ces signaux est présent, la fiche reste, quoi qu'il
 * arrive au dataset.
 *
 * Les sept signaux couvrent tout ce que l'élève peut produire sur une fiche
 * dans l'app : une tentative chronométrée (`attempts`, `last_worked_at` — voir
 * focus-view.tsx#commitResult), une mise en favori, une note, un énoncé
 * recopié à la main, un statut ou une maîtrise déplacés, un archivage décidé.
 *
 * Limite ASSUMÉE et connue : `Exercise` ne porte aucune provenance, donc une
 * fiche que l'élève aurait créée lui-même, laissée strictement vierge et
 * jamais ouverte, est indiscernable d'une fiche de banque retirée du dataset —
 * elle serait retirée elle aussi. Le titre/la source qu'il a tapés seraient
 * perdus. Un marqueur de provenance sur `Exercise` (hors périmètre de ce
 * module) fermerait ce dernier cas.
 */
function untouchedByLearner(exercise: Exercise): boolean {
  return (
    exercise.attempts === 0 &&
    exercise.last_worked_at === null &&
    !exercise.favorite &&
    !exercise.note &&
    !exercise.statement.trim() &&
    exercise.status === "à faire" &&
    exercise.mastery === 0 &&
    !exercise.archived
  );
}

export interface SeedReconciliation {
  exercises: Exercise[];
  chapters: Chapter[];
  updatedCount: number;
  addedCount: number;
  /** Fiches retirées parce que la banque ne les contient plus ET que l'élève n'y avait jamais touché — voir `untouchedByLearner`. */
  removedCount: number;
}

export function reconcileSeedBank(
  localExercises: Exercise[],
  localChapters: Chapter[],
  seed: { exercises: Exercise[]; chapters: Chapter[] }
): SeedReconciliation {
  const seedByKey = new Map(seed.exercises.map((exercise) => [bankKey(exercise.subject, exercise.title), exercise]));
  const seedChapterById = new Map(seed.chapters.map((chapter) => [chapter.id, chapter]));
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
  let removedCount = 0;
  const seenKeys = new Set<string>();
  const exercises = localExercises.flatMap<Exercise>((local) => {
    const key = bankKey(local.subject, local.title);
    const fresh = seedByKey.get(key);
    if (!fresh) {
      // La banque ne contient plus cette fiche. Sans chemin de retrait, une
      // fiche corrigée EN LA SUPPRIMANT du dataset (les 15 sans énoncé, les
      // 22 renvoyant à une feuille papier absente de l'app) restait pour
      // toujours dans la banque d'une installation existante : la correction
      // ne bénéficiait qu'aux nouveaux venus. On la retire donc — mais
      // uniquement si l'élève n'y a jamais rien mis (voir
      // `untouchedByLearner`) : tout ce sur quoi il a réellement travaillé
      // reste, y compris son historique de séances qui y renvoie par
      // `exercise_id`.
      if (untouchedByLearner(local)) {
        removedCount++;
        return [];
      }
      return [local];
    }
    seenKeys.add(key);
    const merged: Exercise = { ...fresh, chapter_id: resolveChapterId(fresh.chapter_id) ?? local.chapter_id };
    for (const field of LEARNER_OWNED) Object.assign(merged, { [field]: local[field] });
    // Un énoncé et une durée estimée se SAISISSENT dans l'app
    // (components/exercises/exercise-detail.tsx) : ce sont des données de
    // l'élève au même titre que la note, pas du contenu de banque. La montée
    // de version les écrasait purement et simplement — l'élève qui avait
    // recopié l'énoncé de sa feuille de TD sur une fiche livrée sans énoncé
    // (le cas EXACT que cette réconciliation existe pour rattraper) le
    // perdait à la version suivante, sans trace. La banque comble donc ce qui
    // est vide, elle n'écrase jamais ce qui a été tapé.
    if (local.statement.trim()) merged.statement = local.statement;
    if (local.estimated_minutes !== null) merged.estimated_minutes = local.estimated_minutes;
    // L'archivage décidé par l'élève l'emporte DANS LES DEUX SENS dès qu'il a
    // réellement travaillé cette fiche. `local.archived || fresh.archived`
    // ne protégeait qu'un sens : les exercices "spe"/level 4 et 6 arrivent
    // archivés par construction (lib/exercise-import.ts), donc un exercice
    // DÉSARCHIVÉ à la main — geste explicite de l'élève qui commence la Spé,
    // voir exercise-manager.tsx#restoreExercise — était ré-archivé à chaque
    // montée de version : il disparaissait de la liste et de toutes les
    // recommandations, en emportant les tentatives déjà enregistrées dessus.
    const workedOn = local.attempts > 0 || local.last_worked_at !== null;
    merged.archived = workedOn ? local.archived : local.archived || fresh.archived;
    merged.note = local.note ?? fresh.note;
    merged.updated_at = new Date().toISOString();
    updatedCount++;
    return [merged];
  });
  const added = seed.exercises
    .filter((exercise) => !seenKeys.has(bankKey(exercise.subject, exercise.title)))
    .map((exercise) => ({ ...exercise, chapter_id: resolveChapterId(exercise.chapter_id) }));
  return { exercises: [...exercises, ...added], chapters, updatedCount, addedCount: added.length, removedCount };
}
