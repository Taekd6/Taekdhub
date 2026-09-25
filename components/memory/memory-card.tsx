"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnkiLink } from "@/components/memory/anki-link";
import { chanceSentence, RatingPanel, RetentionBar } from "@/components/memory/memory-bits";
import { Button } from "@/components/ui/button";
import { SubjectAvatar } from "@/components/subject-avatar";
import { atRisk, rateChapter } from "@/lib/chapter-memory";
import type { FsrsRating } from "@/lib/fsrs";
import type { ChapterMemory } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/** Au-delà, la carte deviendrait la page /memoire. */
const SHOWN = 4;

/**
 * « À NE PAS OUBLIER » — la carte d'accueil de la mémoire des chapitres.
 *
 * Les chapitres dont la probabilité estimée de s'en souvenir est passée
 * sous 85 % (lib/chapter-memory.ts#atRisk), le plus menacé d'abord. Pour
 * chacun, les deux gestes qui suivent la lecture : « Ouvrir Anki » (y aller
 * réviser) et « C'est révisé » (dire comment ça s'est passé — la note règle
 * le prochain rappel).
 *
 * Données en props : l'accueil a UN SEUL `usePrepahubData()`
 * (components/dashboard-overview.tsx).
 *
 * Rien à dire → rien d'affiché, sauf si l'élève a déjà des chapitres (une
 * ligne rassurante) : une carte vide sur l'accueil serait du bruit.
 */
export function MemoryCard({
  chapters,
  saveChapters,
  ready,
  onMemoryPage = false,
}: {
  chapters: ChapterMemory[];
  saveChapters: (items: ChapterMemory[]) => void;
  ready: boolean;
  /** Sur /memoire : pas de lien vers la page où l'on est déjà, pas d'invitation (la saisie est juste en dessous). */
  onMemoryPage?: boolean;
}) {
  const today = dayKey(new Date());
  const risky = useMemo(() => atRisk(chapters, today), [chapters, today]);
  const [rating, setRating] = useState<string | null>(null);
  const tracked = chapters.filter((chapter) => !chapter.archived).length;

  if (!ready) return null;

  // Pas encore de chapitre : une invitation d'une ligne, pas une carte vide.
  if (tracked === 0) {
    if (onMemoryPage) return null;
    return (
      <section aria-label="Mémoire des chapitres" className="surface reveal flex flex-wrap items-center justify-between gap-3 p-5 sm:px-8">
        <p className="t-meta max-w-[52ch]">
          <span className="font-semibold text-ink">À ne pas oublier.</span> Note les chapitres que tu as appris : TaekdHub te préviendra quand tu
          risques de les oublier, avec un lien vers Anki.
        </p>
        <Link href="/memoire" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-accent hover:underline sm:min-h-8">
          Ajouter un chapitre ›
        </Link>
      </section>
    );
  }

  function rate(id: string, value: FsrsRating) {
    saveChapters(chapters.map((chapter) => (chapter.id === id ? rateChapter(chapter, value, today) : chapter)));
    setRating(null);
  }

  return (
    <section aria-labelledby="memoire-titre" className="surface reveal p-6 sm:p-8" data-memory-card>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="memoire-titre" className="t-heading">
            À ne pas oublier
          </h2>
          <p className="t-meta mt-1">
            {risky.length > 0
              ? `${risky.length} chapitre${risky.length > 1 ? "s" : ""} que tu risques d'oublier.`
              : `Tes ${tracked} chapitre${tracked > 1 ? "s tiennent" : " tient"} pour l'instant.`}
          </p>
        </div>
        {!onMemoryPage && (
          <Link href="/memoire" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-accent hover:underline sm:min-h-8">
            Ma mémoire ›
          </Link>
        )}
      </header>

      {risky.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {risky.slice(0, onMemoryPage ? risky.length : SHOWN).map(({ chapter, retrievability }) => (
            <li key={chapter.id} className="py-4" data-chapter={chapter.title}>
              <div className="flex items-start gap-3">
                <span className="translate-y-0.5">
                  <SubjectAvatar subject={chapter.subject} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-ink">{chapter.title}</p>
                  <p className="t-meta text-2xs">
                    {chapter.subject} · <span className="tabular">{chanceSentence(retrievability)}</span>
                  </p>
                  <RetentionBar retrievability={retrievability} className="mt-2 max-w-xs" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-10">
                <AnkiLink deck={chapter.ankiDeck} />
                <Button variant="ghost" size="sm" onClick={() => setRating(rating === chapter.id ? null : chapter.id)} aria-expanded={rating === chapter.id}>
                  C&apos;est révisé
                </Button>
              </div>
              {rating === chapter.id && (
                <div className="pl-10">
                  <RatingPanel chapter={chapter} today={today} onRate={(value) => rate(chapter.id, value)} onCancel={() => setRating(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!onMemoryPage && risky.length > SHOWN && (
        <p className="t-meta mt-3 text-2xs">
          Et {risky.length - SHOWN} autre{risky.length - SHOWN > 1 ? "s" : ""} —{" "}
          <Link href="/memoire" className="text-accent hover:underline">
            tout voir
          </Link>
          .
        </p>
      )}
    </section>
  );
}
