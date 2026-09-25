"use client";

import { useMemo, useState } from "react";
import { ChapterList } from "@/components/memory/chapter-list";
import { MemoryCard } from "@/components/memory/memory-card";
import { chanceSentence, formatDay, WhyMemoryWorks } from "@/components/memory/memory-bits";
import { LineChart } from "@/components/ui/chart";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/state";
import { ScoreBadge } from "@/components/ui/list-card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { AT_RISK_THRESHOLD, dueDay, forecastCurve, reminderDay, retrievabilityToday, summarizeBySubject } from "@/lib/chapter-memory";
import type { ChapterMemory } from "@/lib/storage";
import { dayKey, subjects } from "@/lib/study";

const CURVE_DAYS = 30;
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * /memoire — LA MÉMOIRE DES CHAPITRES, en entier.
 *
 *   1. À ne pas oublier — les chapitres sous 85 %, tous (la carte de
 *      l'accueil n'en montre que quatre).
 *   2. La courbe — R sur les 30 prochains jours pour le chapitre choisi, EN
 *      SUPPOSANT qu'on ne le révise pas : c'est la courbe d'oubli elle-même,
 *      et elle montre pourquoi le rappel tombe à telle date.
 *   3. Par matière — combien, R moyenne, prochain rappel.
 *   4. Tous les chapitres — saisie, notes, modification, rangement.
 *   5. Pourquoi ça marche.
 *
 * UN SEUL `usePrepahubData()` pour l'écran, passé en props.
 */
export function MemoryOverview() {
  const { chapterMemory, saveChapterMemory, ready } = usePrepahubData();
  const today = dayKey(new Date());
  const active = useMemo(() => chapterMemory.filter((chapter) => !chapter.archived), [chapterMemory]);
  const [picked, setPicked] = useState<string | null>(null);
  // Par défaut, le chapitre le plus menacé : c'est lui dont la courbe parle.
  const selected =
    active.find((chapter) => chapter.id === picked) ??
    [...active].sort((a, b) => retrievabilityToday(a, today) - retrievabilityToday(b, today))[0] ??
    null;
  const summary = useMemo(() => summarizeBySubject(chapterMemory, today, subjects), [chapterMemory, today]);

  if (!ready) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[68rem] space-y-8 sm:space-y-10">
      <PageHero
        title="Ma mémoire"
        lede="Ta chance de te souvenir de chaque chapitre, aujourd'hui."
        illustration={<Illustration name="revisions" size={56} />}
      />

      <MemoryCard chapters={chapterMemory} saveChapters={saveChapterMemory} ready={ready} onMemoryPage />

      {selected && <CurveSection chapter={selected} today={today} />}

      {summary.length > 0 && (
        <Section variant="panel" title="Par matière">
          <ul className="-mx-3 -mb-2 grid sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((entry) => (
              <li key={entry.subject} className="row-slide flex min-h-[4.25rem] items-center gap-3 rounded-[1.125rem] px-3 py-2.5">
                {/* La moyenne dans la pastille en dégradé, du même palier
                    que les barres de rétention. */}
                <ScoreBadge ratio={entry.meanRetrievability === null ? null : entry.meanRetrievability >= 0.9 ? 1 : entry.meanRetrievability >= AT_RISK_THRESHOLD ? 0.6 : 0}>
                  {entry.meanRetrievability !== null ? <span className="text-[0.8125rem]">{Math.round(entry.meanRetrievability * 100)}%</span> : "—"}
                </ScoreBadge>
                <div className="min-w-0">
                  <p className="truncate text-[0.9375rem] font-extrabold text-ink">{entry.subject}</p>
                  <p className="text-[0.8125rem] font-bold text-subtle">
                    {entry.count} chapitre{entry.count > 1 ? "s" : ""}
                    {entry.meanRetrievability !== null && <span className="sr-only"> · ≈ {Math.round(entry.meanRetrievability * 100)} % en moyenne</span>}
                  </p>
                  <p className="text-[0.8125rem] font-bold text-subtle">
                    {entry.atRisk > 0 ? (
                      <span className="text-[var(--review-a)]">
                        {entry.atRisk} à revoir maintenant
                      </span>
                    ) : entry.nextReminder ? (
                      `Prochain rappel ${formatDay(entry.nextReminder, today)}`
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section variant="panel" title="Tous les chapitres" description="Le plus menacé d'abord · touche un titre pour sa courbe.">
        <ChapterList chapters={chapterMemory} saveChapters={saveChapterMemory} selectedId={selected?.id ?? null} onSelect={setPicked} />
      </Section>

      <WhyMemoryWorks />
    </div>
  );
}

function CurveSection({ chapter, today }: { chapter: ChapterMemory; today: string }) {
  const curve = forecastCurve(chapter, today, CURVE_DAYS);
  const now = retrievabilityToday(chapter, today);
  const reminder = reminderDay(chapter);
  const due = dueDay(chapter);
  const points = curve.map((point) => {
    const [y, m, d] = point.day.split("-").map(Number);
    return { label: shortDate.format(new Date(y, m - 1, d, 12)), value: Math.round(point.retrievability * 1000) / 10 };
  });

  return (
    <Section
      variant="panel"
      title={<>Courbe d&apos;oubli · {chapter.title}</>}
      description={`Si tu ne le révises pas d'ici là. Aujourd'hui : ${chanceSentence(now)}.`}
    >
      <LineChart
        points={points}
        min={0}
        max={100}
        formatValue={(value) => `${Math.round(value)} %`}
        ariaLabel={`Probabilité estimée de se souvenir de « ${chapter.title} » sur ${CURVE_DAYS} jours : de ${Math.round(now * 100)} % aujourd'hui à ${Math.round(curve[curve.length - 1].retrievability * 100)} % dans ${CURVE_DAYS} jours.`}
      />
      <dl className="mt-5 grid gap-3 text-[0.8125rem] sm:grid-cols-3">
        <div>
          <dt className="t-meta text-2xs">Révision idéale (90 %)</dt>
          <dd className="font-semibold text-ink">{formatDay(due, today)}</dd>
        </div>
        <div>
          <dt className="t-meta text-2xs">Rappel (sous {Math.round(AT_RISK_THRESHOLD * 100)} %)</dt>
          <dd className="font-semibold text-ink">{reminder <= today ? "maintenant" : formatDay(reminder, today)}</dd>
        </div>
        <div>
          <dt className="t-meta text-2xs">Stabilité FSRS</dt>
          <dd className="font-semibold text-ink">
            <span className="tabular">{chapter.card.stability < 10 ? chapter.card.stability.toFixed(1).replace(".", ",") : Math.round(chapter.card.stability)}</span> jours
          </dd>
        </div>
      </dl>
    </Section>
  );
}
