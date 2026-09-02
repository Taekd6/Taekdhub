import { addChapter } from "@/lib/chapters";
import { createExerciseFromInput, parseExerciseImportPayload } from "@/lib/exercise-import";
import type { Chapter } from "@/lib/storage";
import type { Exercise } from "@/lib/supabase/types";

export const SEED_FLAG_KEY = "prepahub:seeded";
export const SEED_CONTENT_VERSION = 4;
export const SEED_VERSION_KEY = "prepahub:seeded:version";

function buildSeed(bank: unknown): { exercises: Exercise[]; chapters: Chapter[] } {
  const { rows } = parseExerciseImportPayload(bank, []);
  let chapters: Chapter[] = [];
  const createdIds = new Map<string, string>();
  for (const row of rows) {
    if (!row.isNewChapter || !row.chapterLabel) continue;
    const key = `${row.input.subject}::${row.chapterLabel.toLowerCase()}`;
    if (createdIds.has(key)) continue;
    const result = addChapter(chapters, row.input.subject, row.chapterLabel);
    chapters = result.chapters;
    createdIds.set(key, result.chapter.id);
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

function dedupeBank(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const value = item as { subject?: unknown; title?: unknown };
    const key = `${String(value.subject ?? "")}::${String(value.title ?? "").trim().toLowerCase()}`;
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
  return `${subject}::${title.trim().toLowerCase()}`;
}

const LEARNER_OWNED = ["status", "mastery", "attempts", "last_worked_at", "favorite", "id", "created_at"] as const;

export interface SeedReconciliation {
  exercises: Exercise[];
  chapters: Chapter[];
  updatedCount: number;
  addedCount: number;
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
  const seenKeys = new Set<string>();
  const exercises = localExercises.map((local) => {
    const key = bankKey(local.subject, local.title);
    const fresh = seedByKey.get(key);
    if (!fresh) return local;
    seenKeys.add(key);
    const merged: Exercise = { ...fresh, chapter_id: resolveChapterId(fresh.chapter_id) ?? local.chapter_id };
    for (const field of LEARNER_OWNED) Object.assign(merged, { [field]: local[field] });
    merged.archived = local.archived || fresh.archived;
    merged.note = local.note ?? fresh.note;
    merged.updated_at = new Date().toISOString();
    updatedCount++;
    return merged;
  });
  const added = seed.exercises
    .filter((exercise) => !seenKeys.has(bankKey(exercise.subject, exercise.title)))
    .map((exercise) => ({ ...exercise, chapter_id: resolveChapterId(exercise.chapter_id) }));
  return { exercises: [...exercises, ...added], chapters, updatedCount, addedCount: added.length };
}
