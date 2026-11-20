import { PROGRAMME, type ProgrammeChapter } from "@/lib/programme-data";
import type { WorkItem } from "@/lib/storage";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Le chapitre le plus précis dont le titre ou un alias apparaît dans la tâche. */
export function chapterForTask(item: Pick<WorkItem, "title" | "subject"> & { note?: string | null }): ProgrammeChapter | null {
  const text = fold(`${item.title} ${item.note ?? ""}`);
  let best: { chapter: ProgrammeChapter; len: number } | null = null;
  for (const chapter of PROGRAMME) {
    if (item.subject && chapter.subject !== item.subject) continue;
    for (const name of [chapter.title, ...chapter.aliases]) {
      const key = fold(name).replace(/\s*\(.*?\)\s*/g, " ").trim();
      if (key.length >= 6 && text.includes(key) && (!best || key.length > best.len || (key.length === best.len && chapter.year === 2))) best = { chapter, len: key.length };
    }
  }
  return best?.chapter ?? null;
}

