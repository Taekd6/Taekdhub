"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Check, Pin } from "lucide-react";
import type { CSSProperties } from "react";
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

  const totalCards = rows.reduce((sum, row) => sum + row.cartes, 0);
  const label = `${SHORT_SUBJECT[subject] ?? subject} · ${year === 2 ? "Spé" : "Sup"}`;

  return (
    <div className="mx-auto max-w-[64rem] space-y-6">
      {/* ── Bandeau (mission 25) : même ciel vivant que l'accueil et la semaine ── */}
      <header className="sky sky-chapitres reveal relative isolate overflow-hidden rounded-[var(--radius-tile)] text-white">
        <div aria-hidden className="sky-layer sky-a" />
        <div aria-hidden className="sky-layer sky-b" />
        <div aria-hidden className="sky-grain" />
        <div className="relative flex flex-col gap-5 p-5 sm:p-7">
          <div>
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-white/75">Mes chapitres</p>
            <h1 className="t-display mt-1">{label}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="sky-chip">{current.length}/{CURRENT_CHAPTERS_MAX} en cours</span>
            {ready && <span className="sky-chip">{withContent} sur {rows.length} avec du contenu</span>}
            {ready && totalCards > 0 && <span className="sky-chip">{totalCards} cartes Anki</span>}
          </div>
        </div>
      </header>

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

      {!ready ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-[1.25rem]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="t-meta py-6 text-center">Aucun chapitre pour ce choix.</p>
      ) : (
        <ul key={`${subject}-${year}`} className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, index) => {
            const isCurrent = current.includes(row.chapter.id);
            const full = !isCurrent && current.length >= CURRENT_CHAPTERS_MAX;
            const pillars = [
              { on: row.hasCourse, label: "Cours" },
              { on: row.methodes > 0, label: "Méthodes" },
              { on: row.erreurs > 0, label: "Erreurs" },
              { on: row.cartes > 0, label: "Cartes" },
            ];
            const filled = pillars.filter((pillar) => pillar.on).length;
            return (
              <li key={row.chapter.id} style={{ "--i": index } as CSSProperties} className={cn("chap-tile spot relative flex min-h-40 flex-col", isCurrent && "chap-current beam")}>
                <Link href={`/chapitre/${row.chapter.id}`} className="flex flex-1 flex-col gap-3 rounded-[inherit] p-4 sm:p-5" aria-label={`${row.chapter.title}${isCurrent ? " (en cours)" : ""}`}>
                  <span aria-hidden className="chap-num t-display">{String(index + 1).padStart(2, "0")}</span>
                  <span className="t-body pr-12 font-bold leading-snug">{row.chapter.title}</span>
                  <span className="mt-auto flex flex-col gap-1.5">
                    <span className="grid grid-cols-4 gap-1" aria-hidden>
                      {pillars.map((pillar) => (
                        <span key={pillar.label} className={cn("pill-seg", pillar.on && "pill-seg-on")} />
                      ))}
                    </span>
                    <span className="t-meta">
                      {filled === 0
                        ? "Rien de rangé pour l'instant"
                        : [row.hasCourse && "cours", row.methodes > 0 && `${row.methodes} méthode${row.methodes > 1 ? "s" : ""}`, row.erreurs > 0 && `${row.erreurs} erreur${row.erreurs > 1 ? "s" : ""}`, row.cartes > 0 && `${row.cartes} cartes`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleCurrent(row.chapter.id)}
                  disabled={full}
                  aria-pressed={isCurrent}
                  aria-label={isCurrent ? `Retirer « ${row.chapter.title} » des chapitres en cours` : `Marquer « ${row.chapter.title} » en cours`}
                  title={full ? `${CURRENT_CHAPTERS_MAX} chapitres en cours au maximum : retires-en un d'abord` : isCurrent ? "En cours" : "Marquer en cours"}
                  className={cn("press absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full transition-colors disabled:opacity-30", isCurrent ? "bg-accent/[0.18] text-accent" : "bg-inset text-subtle hover:text-ink")}
                >
                  {isCurrent ? <Check size={18} aria-hidden /> : <Pin size={16} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="t-meta flex items-center gap-2">
        <BookOpen size={14} aria-hidden /> Épingle (3 au maximum) les chapitres que le prof traite : c&apos;est ce qu&apos;« Aujourd&apos;hui » te montre. Pour ranger du contenu, envoie-le à Claude dans la conversation.
      </p>
    </div>
  );
}
