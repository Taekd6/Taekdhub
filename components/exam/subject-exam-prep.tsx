"use client";

import { GraduationCap } from "lucide-react";
import { Section } from "@/components/ui/section";
import { ExamPrepPanel } from "@/components/exam/exam-prep-panel";
import { upcomingExams } from "@/lib/exam-prep";
import { dayKey } from "@/lib/study";
import type { ChapterMemory, ErrorEntry, ReviewItem, WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * La prochaine épreuve de la matière (DS, concours blanc, dans les trois
 * semaines), en tête de l'aperçu du hub : c'est ce que l'élève vient
 * chercher la semaine d'un DS. Rien quand aucune épreuve n'approche — pas
 * de tuile vide.
 *
 * Les données viennent de l'appelant (un seul appel du hook par écran,
 * voir hooks/use-prepahub-data.ts).
 */
export function SubjectExamPrep({
  subject,
  workItems,
  chapterMemory,
  errors,
  reviewItems,
  sessions,
  saveWorkItems,
  saveChapterMemory,
}: {
  subject: Subject;
  workItems: WorkItem[];
  chapterMemory: ChapterMemory[];
  errors: ErrorEntry[];
  reviewItems: ReviewItem[];
  sessions: WorkSession[];
  saveWorkItems: (items: WorkItem[]) => void;
  saveChapterMemory: (chapters: ChapterMemory[]) => void;
}) {
  const [next] = upcomingExams(workItems, dayKey(new Date()), { subject });
  if (!next) return null;
  return (
    <Section
      variant="panel"
      label="Prochaine épreuve"
      title={
        <span className="inline-flex items-center gap-2">
          <GraduationCap size={22} aria-hidden className="text-accent" /> Prêt pour le {next.kind === "ds" ? "DS" : "concours blanc"} ?
        </span>
      }
    >
      <ExamPrepPanel
        item={next}
        chapterMemory={chapterMemory}
        errors={errors}
        reviewItems={reviewItems}
        sessions={sessions}
        onSaveItem={(updated) => saveWorkItems(workItems.map((item) => (item.id === updated.id ? updated : item)))}
        onSaveChapters={saveChapterMemory}
      />
    </Section>
  );
}
