"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChapterList } from "@/components/memory/chapter-list";
import { WhyMemoryWorks } from "@/components/memory/memory-bits";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import type { ChapterMemory } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * « CHAPITRES » dans le hub d'une matière — la mémoire des chapitres
 * (FSRS) de CETTE matière : saisie, barre de rétention par chapitre,
 * prochain rappel, note, modification, rangement. La vue d'ensemble, avec
 * la courbe, vit sur /memoire.
 *
 * Données en props : components/hub/subject-hub.tsx tient le seul
 * `usePrepahubData()` de l'écran.
 */
export function SubjectChapters({
  subject,
  chapters,
  saveChapters,
}: {
  subject: Subject;
  chapters: ChapterMemory[];
  saveChapters: (items: ChapterMemory[]) => void;
}) {
  return (
    <div className="space-y-5">
      <Section
        variant="panel"
        title="Chapitres"
        description="Ce que tu as appris, et combien de chances tu as de t'en souvenir aujourd'hui (estimation FSRS)."
        action={
          <Link href="/memoire" className={buttonVariants({ variant: "link", size: "sm" })}>
            Ma mémoire <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        <ChapterList chapters={chapters} saveChapters={saveChapters} subject={subject} />
      </Section>
      <WhyMemoryWorks />
    </div>
  );
}
