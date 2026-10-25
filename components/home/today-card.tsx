"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import type { AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ChapterNotes } from "@/lib/chapter-notes";
import type { ErrorEntry, WorkItem } from "@/lib/storage";
import { buildToday } from "@/lib/today-view";

/**
 * « AUJOURD'HUI » — la première chose de l'accueil : ce qu'il faut faire,
 * trois à cinq lignes, chacune avec sa raison (lib/today-view.ts). Les
 * échéances d'abord, puis les erreurs et les chapitres EN COURS (réglage de
 * /chapitres) : rien ne vient d'un chapitre que le cours a laissé derrière.
 * Anki reste une ligne à part : TaekdHub n'en touche pas le planning.
 */
export function TodayCard({
  workItems,
  errors,
  chapterNotes,
  ankiSnapshots,
  currentChapterIds,
  className,
}: {
  workItems: WorkItem[];
  errors: ErrorEntry[];
  chapterNotes: ChapterNotes[];
  ankiSnapshots: AnkiSnapshot[];
  currentChapterIds: string[];
  className?: string;
}) {
  const today = useMemo(() => buildToday({ workItems, errors, chapterNotes, ankiSnapshots, currentChapterIds, now: new Date() }), [workItems, errors, chapterNotes, ankiSnapshots, currentChapterIds]);

  return (
    <Section
      variant="panel"
      title="Aujourd'hui"
      className={className}
      action={
        <Link href="/chapitres" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Mes chapitres en cours
        </Link>
      }
    >
      {today.lines.length === 0 ? (
        <p className="t-body text-muted">
          {today.needsChapter ? "Rien de daté dans les 14 prochains jours. Choisis le chapitre que le prof traite en ce moment : TaekdHub te dira par où commencer." : "Rien de daté dans les 14 prochains jours, et rien à reprendre sur tes chapitres en cours."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {today.lines.map((line) => (
            <li key={line.id}>
              <Link href={line.href} className="row-hover flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 sm:px-3">
                <span className="min-w-0 flex-1">
                  <span className="t-body block font-semibold">{line.title}</span>
                  <span className={cn("t-meta", line.urgent && "font-semibold text-ink")}>{line.why}</span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {today.needsChapter && today.lines.length > 0 && (
        <p className="t-meta mt-3 px-2 sm:px-3">
          Aucun chapitre en cours choisi. <Link href="/chapitres" className="underline">Choisis-en un</Link> pour voir ici tes erreurs et ton cours.
        </p>
      )}

      {today.anki && (
        <p className="t-meta mt-4 border-t border-line px-2 pt-3 sm:px-3">
          <Link href="/anki" className="underline">
            Anki
          </Link>{" "}
          : {today.anki.due} carte{today.anki.due > 1 ? "s" : ""} due{today.anki.due > 1 ? "s" : ""} (relevé {today.anki.ageLabel}
          {today.anki.stale ? ", ancien : refais un import avant de t'y fier" : ""}). Anki garde son propre planning.
        </p>
      )}
    </Section>
  );
}
