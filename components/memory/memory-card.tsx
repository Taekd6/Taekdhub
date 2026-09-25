"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnkiLink } from "@/components/memory/anki-link";
import { chanceSentence, RatingPanel, RetentionBar } from "@/components/memory/memory-bits";
import { Button } from "@/components/ui/button";
import { SubjectAvatar } from "@/components/subject-avatar";
import { CountUp } from "@/components/ui/count-up";
import { AT_RISK_THRESHOLD, atRisk, formatChance, rateChapter } from "@/lib/chapter-memory";
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
    <section aria-labelledby="memoire-titre" className="surface reveal p-5 sm:p-7" data-memory-card>
      {/* Sur /memoire, les chapitres menacés sont annoncés par la BANNIÈRE
          des révisions (dégradé orange → rose, le compte qui monte) : c'est
          la première chose à faire sur cette page. Sur l'accueil, la
          bannière du jour est déjà juste au-dessus : un titre suffit. */}
      {onMemoryPage && risky.length > 0 ? (
        <header className="grad-card tone-review sheen -mx-1 -mt-1 flex items-center gap-3.5 p-[1.125rem]">
          <span aria-hidden className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-black tabular">
            <CountUp value={risky.length} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="memoire-titre" className="t-card-title">
              À ne pas oublier
            </h2>
            <span className="block text-[0.8125rem] font-bold opacity-85">
              {risky.length} chapitre{risky.length > 1 ? "s" : ""} sous {Math.round(AT_RISK_THRESHOLD * 100)} %, à revoir
            </span>
          </span>
        </header>
      ) : (
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
      )}

      {risky.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {risky.slice(0, onMemoryPage ? risky.length : SHOWN).map(({ chapter, retrievability }) => (
            <li key={chapter.id} className="py-4" data-chapter={chapter.title}>
              <div className="flex items-start gap-3">
                <SubjectAvatar subject={chapter.subject} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words text-[0.9375rem] font-extrabold text-ink">{chapter.title}</span>
                    <span className="tabular shrink-0 text-[0.9375rem] font-black text-ink">{formatChance(retrievability)}</span>
                  </p>
                  <p className="text-[0.8125rem] font-bold text-subtle">
                    {chapter.subject}
                    <span className="sr-only"> · {chanceSentence(retrievability)}</span>
                  </p>
                  <RetentionBar retrievability={retrievability} className="mt-2" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
                <AnkiLink deck={chapter.ankiDeck} />
                <Button variant="ghost" size="sm" onClick={() => setRating(rating === chapter.id ? null : chapter.id)} aria-expanded={rating === chapter.id}>
                  C&apos;est révisé
                </Button>
              </div>
              {rating === chapter.id && (
                <div className="pl-11">
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
