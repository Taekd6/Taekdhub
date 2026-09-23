"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stat, StatRow } from "@/components/ui/stat";
import { Insufficient } from "@/components/progress/insufficient";
import { WhyItWorks } from "@/components/checkin/why-it-works";
import {
  computeCheckinAverages,
  computeSleepWorkRelation,
  computeSleepWorkSeries,
  describeSleepWorkRelation,
  formatScale,
  formatSleep,
  SLEEP_RELATION_MIN_DAYS,
  SLEEP_THRESHOLD_HOURS,
  type SleepWorkDay,
} from "@/lib/checkin-insights";
import { CHECKIN_SLEEP_MAX } from "@/lib/storage";
import { formatSpan } from "@/lib/utils";
import type { DailyCheckin } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/** Jours affichés par la figure — deux semaines : assez pour voir un rythme, assez peu pour rester lisible sur un téléphone. */
const CHART_DAYS = 14;

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * SOMMEIL ET ÉNERGIE — ce que disent les check-ins du soir.
 *
 * Trois moyennes, une figure et, à partir de quatorze jours comparables,
 * UNE phrase. Aucun calcul ici : tout vient de lib/checkin-insights.ts, qui
 * lui-même tire les minutes travaillées de lib/analytics/work-time.ts.
 *
 * REGISTRE. La phrase décrit les données de l'élève (« les jours après… tu
 * as travaillé… »), jamais un mécanisme (« dormir te fait travailler »).
 * Une ligne en dessous rappelle pourquoi : ce qui remplit une journée —
 * cours, DS, week-end — pèse sur le sommeil ET sur le travail, et rien de
 * cela n'est mesuré ici.
 */
export function SleepSection({ checkins, sessions }: { checkins: DailyCheckin[]; sessions: WorkSession[] }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const model = useMemo(() => {
    const now = new Date();
    return {
      averages: computeCheckinAverages(checkins, period, now),
      series: computeSleepWorkSeries(checkins, sessions, CHART_DAYS, now),
      relation: computeSleepWorkRelation(checkins, sessions, now),
    };
  }, [checkins, sessions, period]);
  const { averages, series, relation } = model;
  const sentence = describeSleepWorkRelation(relation);

  return (
    <Section
      label="Ton état"
      title="Sommeil et énergie"
      description="Ce que tu notes chaque soir dans le check-in, rapproché du temps que tu as réellement travaillé."
      action={
        checkins.length > 0 ? (
          <SegmentedControl
            size="sm"
            ariaLabel="Période des moyennes"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 7 as const, label: "7 j" },
              { value: 30 as const, label: "30 j" },
            ]}
          />
        ) : undefined
      }
    >
      {checkins.length === 0 ? (
        <Insufficient
          what="Aucun check-in du soir pour l'instant."
          how="Il apparaît sur l'accueil à partir de 17 h : sommeil, énergie, stress — dix secondes."
        />
      ) : (
        <div className="space-y-6">
          {averages.count === 0 ? (
            <Insufficient what={`Aucun check-in sur les ${period} derniers jours.`} />
          ) : (
            <StatRow>
              <Stat size="sm" label="Sommeil moyen" value={formatSleep(averages.sleepHours ?? 0)} detail={`${averages.count} soir${averages.count > 1 ? "s" : ""} sur ${period}`} />
              <Stat size="sm" label="Énergie" value={`${formatScale(averages.energy ?? 0)} / 5`} />
              <Stat size="sm" label="Stress" value={`${formatScale(averages.stress ?? 0)} / 5`} />
            </StatRow>
          )}

          <SleepWorkChart days={series} />

          <div className="space-y-1">
            {sentence ? (
              <>
                <p className="t-body">{sentence}</p>
                <p className="t-meta text-2xs">
                  Une observation sur {relation.pairedDays} jours de tes données ({relation.longNights} après une nuit d&apos;au moins{" "}
                  {SLEEP_THRESHOLD_HOURS} h, {relation.shortNights} après une nuit plus courte), pas une relation de cause : l&apos;emploi du
                  temps, les DS ou les week-ends jouent sur les deux.
                </p>
              </>
            ) : (
              <p className="t-meta">
                {relation.pairedDays < SLEEP_RELATION_MIN_DAYS
                  ? `${relation.pairedDays} jour${relation.pairedDays > 1 ? "s" : ""} comparable${relation.pairedDays > 1 ? "s" : ""} sur ${SLEEP_RELATION_MIN_DAYS} nécessaires avant de rapprocher sommeil et temps de travail.`
                  : `Pas encore assez de nuits de part et d'autre de ${SLEEP_THRESHOLD_HOURS} h pour comparer (${relation.longNights} au-dessus, ${relation.shortNights} en dessous).`}
              </p>
            )}
          </div>

          <WhyItWorks>
            <p>
              Le sommeil participe à la consolidation en mémoire de ce qu&apos;on a appris (Walker &amp; Stickgold, 2006 ; Diekelmann &amp;
              Born, 2010). Le noter chaque soir, avec ton énergie et ton stress, relève de l&apos;auto-observation : rendre visible un
              rythme qu&apos;on ne perçoit pas au jour le jour.
            </p>
            <p>
              Le rapprochement ci-dessus compare deux groupes de jours et ne dit rien de plus : il n&apos;apparaît qu&apos;à partir de{" "}
              {SLEEP_RELATION_MIN_DAYS} jours comparables, et il décrit tes données sans prétendre expliquer pourquoi.
            </p>
          </WhyItWorks>
        </div>
      )}
    </Section>
  );
}

/**
 * DEUX BARRES PAR JOUR — le sommeil de la nuit (violet, échelle fixe de 0 à
 * 10 h) et le temps travaillé ce jour-là (accent, échelle relative au
 * maximum de la fenêtre). Deux échelles différentes, et c'est dit dans la
 * légende : la figure montre des RYTHMES qui se suivent ou non, pas deux
 * grandeurs comparables entre elles.
 *
 * Absence ≠ zéro : un jour sans check-in n'a pas de barre violette, un jour
 * non observé (aujourd'hui, ou avant la première séance) pas de barre de
 * travail — un simple point marque sa place.
 */
function SleepWorkChart({ days }: { days: SleepWorkDay[] }) {
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes ?? 0));
  const summary = days
    .map((day) => {
      const label = new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });
      const sleep = day.sleepHours === null ? "sommeil non noté" : `sommeil ${formatSleep(day.sleepHours)}`;
      const work = day.minutes === null ? "travail non mesuré" : `travail ${formatSpan(day.minutes * 60)}`;
      return `${label} : ${sleep}, ${work}`;
    })
    .join(" ; ");

  return (
    <figure>
      <div role="img" aria-label={`Sommeil et temps travaillé sur ${CHART_DAYS} jours — ${summary}.`} className="flex items-end gap-1 sm:gap-1.5">
        {days.map((day) => (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-24 w-full items-end justify-center gap-[2px]">
              {day.sleepHours !== null ? (
                <span
                  aria-hidden
                  className={day.sleepHours >= SLEEP_THRESHOLD_HOURS ? "w-2 rounded-sm bg-violet-400/80" : "w-2 rounded-sm bg-violet-400/40"}
                  style={{ height: `${(day.sleepHours / CHECKIN_SLEEP_MAX) * 100}%` }}
                />
              ) : (
                <span aria-hidden className="mb-0.5 h-1 w-1 rounded-full bg-line" />
              )}
              {day.minutes !== null ? (
                <span
                  aria-hidden
                  className={day.minutes > 0 ? "w-2 rounded-sm bg-accent/70" : "w-2 rounded-sm bg-line"}
                  style={{ height: day.minutes > 0 ? `${Math.max(4, (day.minutes / maxMinutes) * 100)}%` : "1px" }}
                />
              ) : (
                <span aria-hidden className="mb-0.5 h-1 w-1 rounded-full bg-line" />
              )}
            </div>
            <span aria-hidden className="t-meta w-full truncate text-center text-2xs">
              {DAY_LETTERS[new Date(`${day.date}T12:00:00`).getDay()]}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="t-meta mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-2 rounded-sm bg-violet-400/80" /> sommeil sur 10 h (plein : ≥ {SLEEP_THRESHOLD_HOURS} h, pâle : moins)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-2 rounded-sm bg-accent/70" /> temps travaillé (max {formatSpan(maxMinutes * 60)})
        </span>
      </figcaption>
    </figure>
  );
}
