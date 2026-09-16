"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Meter } from "@/components/ui/progress";
import { LineChart } from "@/components/ui/chart";
import { Insufficient } from "@/components/progress/insufficient";
import { computeChapterMastery, computeMasteryTrend } from "@/lib/analytics/mastery";
import { computeExerciseOutcomeStats, describeSampleSize } from "@/lib/analytics/outcomes";
import { describeConfidence, withSign } from "@/lib/analytics/trend";
import { computeProgressBySubject } from "@/lib/progress";
import { subjectMeta } from "@/lib/study";
import { startOfWeek } from "@/lib/week";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * TES PROGRÈS — « est-ce que je progresse ? ».
 *
 * DEUX MESURES DISTINCTES, et les confondre serait une faute :
 *
 *   LA MAÎTRISE   où en est la banque. Elle ne peut que monter, lentement,
 *                 et se lit sur des semaines.
 *   LA RÉUSSITE   ce que donnent les tentatives récentes. Elle oscille, et
 *                 se lit sur des jours.
 *
 * L'historique de maîtrise vient des instantanés hebdomadaires déjà figés
 * par TaekdHub (lib/week-snapshot.ts), qui n'existent QUE par matière — un
 * chapitre a donc un état, jamais une courbe. C'est dit tel quel plus bas
 * plutôt que simulé.
 */
export function MasterySection({
  exercises,
  sessions,
  chapters,
  weekSnapshots,
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  chapters: Chapter[];
  weekSnapshots: WeekSnapshot[];
}) {
  const subjectsWithWork = useMemo(
    () => computeProgressBySubject(exercises).filter((entry) => entry.total > 0).map((entry) => entry.subject),
    [exercises]
  );
  const [subject, setSubject] = useState<Subject | null>(null);
  const active = subject && subjectsWithWork.includes(subject) ? subject : subjectsWithWork[0] ?? null;

  const model = useMemo(() => {
    const now = new Date();
    return {
      mastery: active ? computeMasteryTrend(active, weekSnapshots, exercises, now) : null,
      board: computeChapterMastery(exercises, chapters),
      week: computeExerciseOutcomeStats(sessions, startOfWeek(now), now),
    };
  }, [active, weekSnapshots, exercises, chapters, sessions]);

  const { mastery, board, week } = model;

  return (
    <Section label="Tes progrès" title="Maîtrise et réussite" description="Ce que la banque enregistre sur la durée, et ce que donnent tes tentatives récentes.">
      {/* ── RÉUSSITE DE LA SEMAINE ─────────────────────────────── */}
      <div className="border-y border-line py-4">
        <p className="t-label mb-2">Tentatives de la semaine</p>
        {week.evaluated === 0 ? (
          <p className="t-meta">
            {week.exercisesWorked > 0
              ? `${week.exercisesWorked} exercice${week.exercisesWorked > 1 ? "s" : ""} travaillé${week.exercisesWorked > 1 ? "s" : ""}, aucun résultat déclaré — le taux de réussite ne se calcule que sur les tentatives notées.`
              : "Aucune tentative cette semaine."}
          </p>
        ) : (
          <>
            <p className="t-body">
              <span className="t-figure-sm tabular">{week.successRate} %</span> de réussite sur{" "}
              {week.evaluated} tentative{week.evaluated > 1 ? "s" : ""} notée{week.evaluated > 1 ? "s" : ""}.
            </p>
            <p className="t-meta mt-1">
              {week.succeeded} réussie{week.succeeded > 1 ? "s" : ""} · {week.partial} à moitié · {week.failed} échouée
              {week.failed > 1 ? "s" : ""}
              {week.unevaluated > 0 && <> · {week.unevaluated} sans résultat déclaré</>}
            </p>
            {week.autonomousSuccesses !== null && week.succeeded > 0 && (
              <p className="t-meta mt-1 text-2xs">
                {week.autonomousSuccesses} réussie{week.autonomousSuccesses > 1 ? "s" : ""} sans révéler d&apos;indice.
              </p>
            )}
            {describeSampleSize(week) && <p className="t-meta mt-1 text-2xs">{describeSampleSize(week)}</p>}
          </>
        )}
      </div>

      {/* ── MAÎTRISE PAR MATIÈRE, DANS LE TEMPS ────────────────── */}
      {active && mastery && (
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            {/* « FICHES MAÎTRISÉES », et non « maîtrise ».
                Deux grandeurs DIFFÉRENTES portaient le même mot dans cette
                même section : la courbe montre la PART DES FICHES au statut
                « maîtrisé » (completionRate), les lignes de chapitre plus bas
                montrent la MOYENNE de `Exercise.mastery`. Cinq fiches à 60 %
                dont aucune terminée donnaient « 0 % » ici et « 60 % » à
                quelques centimètres. Les deux chiffres sont justes ; c'est le
                mot qui les confondait. */}
            <p className="t-label">Fiches maîtrisées · {active}</p>
            {subjectsWithWork.length > 1 && (
              /* UNE matière à la fois. Cinq courbes superposées deviennent
                 illisibles avant d'être informatives — c'est le filtre qui
                 fait le travail, pas la superposition. */
              <SegmentedControl
                size="sm"
                ariaLabel="Matière affichée"
                value={active}
                onChange={(value) => setSubject(value)}
                /* Les codes courts existent déjà dans le système (lib/study.ts) — les
                   recouper à six lettres produisait « Mathém », « Physiq ». */
                options={subjectsWithWork.map((entry) => ({ value: entry, label: subjectMeta[entry].short }))}
              />
            )}
          </div>

          {mastery.trend.direction === "insuffisant" ? (
            <Insufficient
              what={`${mastery.currentRate} % des fiches de ${active} sont maîtrisées aujourd'hui — pas encore assez de mesures pour tracer une évolution.`}
              how={
                mastery.currentRate === 0
                  ? "La courbe démarrera au premier exercice passé en « maîtrisé » : c'est ce qu'elle compte."
                  : "TaekdHub fige un point par semaine écoulée : l'évolution apparaîtra la semaine prochaine."
              }
            />
          ) : (
            <>
              <LineChart
                points={mastery.points.map((point) => ({ label: pointLabel(point.start), value: point.rate }))}
                min={0}
                max={100}
                formatValue={(value) => `${value} %`}
                ariaLabel={`Fiches maîtrisées en ${active} : ${mastery.points.map((point) => `${pointLabel(point.start)} ${point.rate} %`).join(", ")}.`}
              />
              <p className="t-body mt-4">
                {mastery.points[0].rate} % → <span className="font-medium">{mastery.currentRate} %</span>, soit{" "}
                {withSign(mastery.trend.delta ?? 0, Math.abs(mastery.trend.delta ?? 0) > 1 ? " points" : " point")} sur{" "}
                {mastery.trend.samples} mesures.
              </p>
              {describeConfidence(mastery.trend) && <p className="t-meta mt-1 text-2xs">{describeConfidence(mastery.trend)}</p>}
            </>
          )}
        </div>
      )}

      {/* ── CHAPITRES ──────────────────────────────────────────── */}
      <div className="mt-7">
        <p className="t-label mb-2.5">Chapitres</p>
        {board.fragile.length === 0 && board.solid.length === 0 ? (
          <Insufficient
            what="Aucun chapitre encore travaillé."
            how="Un chapitre n'apparaît ici qu'une fois au moins un de ses exercices tenté — avant, il n'y a rien à mesurer."
          />
        ) : (
          <div className="space-y-6">
            <ChapterList title="Les plus fragiles" rows={board.fragile} />
            <ChapterList title="Les plus solides" rows={board.solid} />
          </div>
        )}
        {board.untouched.length > 0 && (
          /* Un chapitre jamais commencé n'est PAS un chapitre faible : le
             ranger parmi les fragiles remplirait la liste de tout le
             programme de l'année dès la première ouverture. */
          <p className="t-meta mt-4 text-2xs">
            {board.untouched.length} chapitre{board.untouched.length > 1 ? "s" : ""} n&apos;
            {board.untouched.length > 1 ? "ont" : "a"} encore aucun exercice tenté — non mesuré
            {board.untouched.length > 1 ? "s" : ""}, plutôt que faible{board.untouched.length > 1 ? "s" : ""}.
          </p>
        )}
      </div>
    </Section>
  );
}

function ChapterList({ title, rows }: { title: string; rows: ReturnType<typeof computeChapterMastery>["fragile"] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="t-meta mb-2 text-2xs">{title}</p>
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <li key={row.chapter.id}>
            <Link href={`/exercises?chapter=${row.chapter.id}`} className="row-hover flex items-center gap-3 rounded-md py-2.5 max-lg:min-h-11">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{row.chapter.label}</span>
                {/* Le pourcentage est la MAÎTRISE MOYENNE déclarée des fiches
                    du chapitre ; `mastered` compte celles au statut
                    « maîtrisé ». Les deux notions sont distinctes par
                    construction dans ce modèle (voir `Exercise.mastery`), et
                    les afficher côte à côte donnait des lignes qui se
                    contredisaient à l'œil — « 0 / 6 maîtrisés · 75 % ». Le
                    compte d'exercices situe le chapitre sans créer cette
                    fausse contradiction. */}
                <span className="t-meta mt-0.5 block truncate text-2xs">
                  {row.subject} · {row.total} exercice{row.total > 1 ? "s" : ""}
                </span>
              </span>
              <Meter value={row.rate} className="w-16 shrink-0 max-sm:hidden" tone="neutral" />
              <span className="tabular w-12 shrink-0 whitespace-nowrap text-right text-sm text-ink" title="Maîtrise moyenne des exercices de ce chapitre">
                {row.rate} %
              </span>
              <ChevronRight size={15} className="shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const pointFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
function pointLabel(date: Date): string {
  return pointFormatter.format(date);
}
