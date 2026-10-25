"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { hasContent, summarizeChapters } from "@/lib/chapters-overview";
import { PROGRAMME_SUBJECTS } from "@/lib/programme-data";
import { CURRENT_CHAPTERS_MAX } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

const SHORT_SUBJECT: Record<string, string> = { Mathématiques: "Maths", Physique: "Physique", Chimie: "Chimie" };

/**
 * /chapitres — TOUS LES CHAPITRES, avec ce que TaekdHub en garde (cours
 * rangé, méthodes, erreurs, cartes Anki). Un tap ouvre la page du chapitre
 * (`/chapitre/<id>`). Les chapitres où il y a du contenu sont signalés ; les
 * autres restent listés : c'est la liste de ce qu'il reste à ranger.
 */
export function ChaptersList() {
  const { chapterNotes, errors, ready, preferences, savePreferences } = usePrepahubData();
  const current = preferences.currentChapterIds;
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [year, setYear] = useState<1 | 2>(2);

  const rows = useMemo(() => summarizeChapters(chapterNotes, errors, subject, year), [chapterNotes, errors, subject, year]);
  const withContent = rows.filter(hasContent).length;

  function toggleCurrent(id: string) {
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    if (next.length > CURRENT_CHAPTERS_MAX) return;
    savePreferences({ ...preferences, currentChapterIds: next });
  }

  return (
    <div className="mx-auto max-w-[56rem] space-y-8">
      <PageHero title="Mes chapitres" lede="Cours, méthodes et erreurs, chapitre par chapitre. Marque « En cours » (3 au maximum) ce que le prof traite : c'est ce qu'« Aujourd'hui » te montre." illustration={<Illustration name="notes" size={56} />} />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl ariaLabel="Matière" value={subject} onChange={setSubject} options={PROGRAMME_SUBJECTS.map((entry) => ({ value: entry, label: SHORT_SUBJECT[entry] ?? entry }))} />
        <SegmentedControl
          ariaLabel="Année"
          value={year}
          onChange={setYear}
          options={[
            { value: 2, label: "Spé" },
            { value: 1, label: "Sup" },
          ]}
        />
      </div>

      <Section variant="panel" title={`${SHORT_SUBJECT[subject] ?? subject} · ${year === 2 ? "Spé" : "Sup"}`} description={ready ? `${withContent} chapitre${withContent > 1 ? "s" : ""} sur ${rows.length} avec du contenu` : undefined}>
        {!ready ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : rows.length === 0 ? (
          <p className="t-meta py-6 text-center">Aucun chapitre pour ce choix.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const isCurrent = current.includes(row.chapter.id);
              const full = !isCurrent && current.length >= CURRENT_CHAPTERS_MAX;
              return (
                <li key={row.chapter.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`/chapitre/${row.chapter.id}`} className="row-hover flex min-h-14 min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-3 sm:px-3">
                    <span className="t-body min-w-0 flex-1 font-semibold">{row.chapter.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge on={row.hasCourse} label="Cours" icon />
                      <Badge on={row.methodes > 0} label={`Méthodes ${row.methodes}`} />
                      <Badge on={row.erreurs > 0} label={`Erreurs ${row.erreurs}`} />
                      {row.cartes > 0 && <Badge on label={`Cartes ${row.cartes}`} />}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleCurrent(row.chapter.id)}
                    disabled={full}
                    aria-pressed={isCurrent}
                    title={full ? `${CURRENT_CHAPTERS_MAX} chapitres en cours au maximum : retires-en un d'abord` : undefined}
                    className={cn("press inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-xs font-semibold disabled:opacity-40", isCurrent ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted hover:text-ink")}
                  >
                    {isCurrent ? "En cours ✓" : "En cours"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="t-meta flex items-center gap-2">
        <BookOpen size={14} aria-hidden /> Pour ajouter du contenu : envoie ton cours, tes méthodes ou tes erreurs à Claude dans la conversation, il les range ici.
      </p>
    </div>
  );
}

function Badge({ on, label, icon = false }: { on: boolean; label: string; icon?: boolean }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-2xs font-semibold", on ? "bg-emerald-400/[0.16] text-emerald-300" : "bg-inset text-subtle")}>
      {icon && on && <Check size={12} aria-hidden />}
      {label}
    </span>
  );
}
