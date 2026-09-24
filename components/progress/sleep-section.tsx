"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Illustration } from "@/components/ui/illustrations";
import { cn } from "@/lib/cn";
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

  if (checkins.length === 0) {
    return (
      <Section variant="panel" label="Ton état" title="Sommeil et énergie">
        <div className="flex flex-col items-center py-6 text-center">
          <span aria-hidden className="mb-5 grid h-24 w-24 place-items-center rounded-[1.75rem] bg-inset text-ink">
            <Illustration name="checkin" size={56} />
          </span>
          <p className="t-heading">Aucun check-in du soir pour l&apos;instant.</p>
          <p className="t-meta mt-2 max-w-[44ch]">Il apparaît sur l&apos;accueil à partir de 17 h : sommeil, énergie, stress — dix secondes.</p>
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── LES TROIS MOYENNES ─────────────────────────────────────── */}
      <Section
        variant="panel"
        label="Ton état"
        title="Sommeil et énergie"
        description="Ce que tu notes chaque soir dans le check-in."
        action={
          <SegmentedControl
            size="sm"
            ariaLabel="Période des moyennes"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 7 as const, label: "7 jours" },
              { value: 30 as const, label: "30 jours" },
            ]}
          />
        }
      >
        {averages.count === 0 ? (
          <Insufficient what={`Aucun check-in sur les ${period} derniers jours.`} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="well flex items-center gap-4 p-5">
              <span aria-hidden className="text-ink">
                <Illustration name="checkin" size={44} />
              </span>
              <div className="min-w-0">
                <p className="t-label text-[0.8125rem]">Sommeil moyen</p>
                <p className="t-figure-md mt-1 whitespace-nowrap">{formatSleep(averages.sleepHours ?? 0)}</p>
                <p className="t-meta mt-1 text-2xs">
                  {averages.count} soir{averages.count > 1 ? "s" : ""} sur {period}
                </p>
              </div>
            </div>
            <ScaleFigure label="Énergie" value={averages.energy ?? 0} low="à plat" high="en forme" />
            <ScaleFigure label="Stress" value={averages.stress ?? 0} low="serein" high="sous pression" />
          </div>
        )}
      </Section>

      {/* ── LE RAPPROCHEMENT ───────────────────────────────────────── */}
      <Section
        variant="panel"
        title="Tes nuits et tes journées"
        description={`Les ${CHART_DAYS} derniers jours : la nuit, puis le temps travaillé le lendemain. Survole une colonne pour ses valeurs.`}
      >
        <SleepWorkChart days={series} />

        <div className="mt-6 border-t border-line pt-5">
          {sentence ? (
            <>
              <p className="t-subhead text-ink">{sentence}</p>
              <p className="t-meta mt-2 text-[0.8125rem]">
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

        <WhyItWorks className="mt-4">
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
      </Section>
    </div>
  );
}

/**
 * UNE ÉCHELLE DE 1 À 5 — la moyenne en chiffre, et cinq points dont les
 * pleins disent la même chose d'un regard. Les deux bornes sont écrites :
 * « 3 / 5 » d'énergie et « 3 / 5 » de stress ne se lisent pas dans le même
 * sens.
 */
function ScaleFigure({ label, value, low, high }: { label: string; value: number; low: string; high: string }) {
  const filled = Math.round(value);
  return (
    <div className="well p-5">
      <p className="t-label text-[0.8125rem]">{label}</p>
      <p className="t-figure-md mt-1 whitespace-nowrap">
        {formatScale(value)}
        <span className="text-lg font-semibold text-subtle"> / 5</span>
      </p>
      <div aria-hidden className="mt-3 flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={cn("h-2 flex-1 rounded-full", index < filled ? "bg-ink" : "bg-hairline/[0.10]")} />
        ))}
      </div>
      <p aria-hidden className="t-meta mt-1.5 flex justify-between text-2xs">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}

/**
 * DEUX COLONNES PAR JOUR — le sommeil de la nuit en GRIS (échelle fixe de 0
 * à 10 h, plus pâle sous le seuil de `SLEEP_THRESHOLD_HOURS`) et le temps
 * travaillé ce jour-là à l'ACCENT (échelle relative au maximum de la
 * fenêtre). Deux échelles différentes, et c'est dit dans la légende : la
 * figure montre des RYTHMES qui se suivent ou non, pas deux grandeurs
 * comparables entre elles.
 *
 * Absence ≠ zéro : un jour sans check-in n'a pas de colonne grise, un jour
 * non observé (aujourd'hui, ou avant la première séance) pas de colonne
 * d'accent — un simple point marque sa place.
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
      <div role="img" aria-label={`Sommeil et temps travaillé sur ${CHART_DAYS} jours — ${summary}.`} className="flex h-48 items-end gap-1 border-b border-line sm:gap-2">
        {days.map((day, index) => {
          const date = new Date(`${day.date}T12:00:00`);
          const side = index < days.length / 4 ? "left-0" : index >= (days.length * 3) / 4 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] sm:gap-1">
              {day.sleepHours !== null ? (
                <span
                  aria-hidden
                  className={cn("grow-y w-full max-w-[0.875rem] rounded-t-[4px]", day.sleepHours >= SLEEP_THRESHOLD_HOURS ? "bg-zinc-500" : "bg-zinc-700")}
                  style={{ height: `${(day.sleepHours / CHECKIN_SLEEP_MAX) * 100}%`, "--i": index } as CSSProperties}
                />
              ) : (
                <span aria-hidden className="mb-1 h-1 w-1 shrink-0 rounded-full bg-line" />
              )}
              {day.minutes !== null ? (
                <span
                  aria-hidden
                  className={cn("grow-y w-full max-w-[0.875rem] rounded-t-[4px]", day.minutes > 0 ? "bg-[rgb(var(--accent-ink-rgb))]" : "bg-line")}
                  style={{ height: day.minutes > 0 ? `${Math.max(3, (day.minutes / maxMinutes) * 100)}%` : "1px", "--i": index } as CSSProperties}
                />
              ) : (
                <span aria-hidden className="mb-1 h-1 w-1 shrink-0 rounded-full bg-line" />
              )}
              <span
                aria-hidden
                className={cn(
                  "floating pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-2xs leading-tight text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                  side
                )}
              >
                <span className="font-bold capitalize">{date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</span>
                <span className="text-muted"> · nuit </span>
                <span className="font-bold tabular">{day.sleepHours === null ? "—" : formatSleep(day.sleepHours)}</span>
                <span className="text-muted"> · travail </span>
                <span className="font-bold tabular">{day.minutes === null ? "—" : formatSpan(day.minutes * 60)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-2 flex gap-1 sm:gap-2">
        {days.map((day) => (
          <span key={day.date} className="t-meta min-w-0 flex-1 truncate text-center text-2xs font-semibold">
            {DAY_LETTERS[new Date(`${day.date}T12:00:00`).getDay()]}
          </span>
        ))}
      </div>
      <figcaption className="t-meta mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-zinc-500" /> nuit, sur 10 h (pâle : moins de {SLEEP_THRESHOLD_HOURS} h)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--accent-ink-rgb))]" /> temps travaillé (max {formatSpan(maxMinutes * 60)})
        </span>
      </figcaption>
    </figure>
  );
}
