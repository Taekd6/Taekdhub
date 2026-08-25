"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Flame, GraduationCap, Target, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Heatmap } from "@/components/heatmap";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeChaptersToConsolidate, type ChapterConsolidation } from "@/lib/next-action";
import { comfortDifficulty, computeWorkingLevel } from "@/lib/recommendation";
import { computeGlobalProgress, computeProgressBySubject, masteryDistribution, progressByChapter, statusDistribution } from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META, type ReadinessLevel } from "@/lib/readiness";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import { statusMeta, subjectMeta, subjects, totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatDuration } from "@/lib/utils";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/** `+8`, `-3` ou `±0` — convention unique de signe pour toutes les variations affichées dans "Évolution" (temps, exercices maîtrisés, points de progression). */
function withSign(value: number, unit = ""): string {
  if (value === 0) return `±0${unit}`;
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

function withSignMinutes(seconds: number): string {
  return withSign(Math.round(seconds / 60), " min");
}

/**
 * Section "Évolution" (Sprint 5) — présentationnelle uniquement : toute la
 * comparaison vient de `compareToPreviousWeek` (lib/week-snapshot.ts). Ne
 * montre rien tant qu'aucune semaine précédente n'a été figée, plutôt que
 * d'inventer une comparaison à partir de presque rien (même principe que
 * lib/week.ts#neglectedSubjects).
 */
function WeekEvolution({ exercises, sessions, weekSnapshots }: { exercises: Exercise[]; sessions: WorkSession[]; weekSnapshots: WeekSnapshot[] }) {
  const comparison = useMemo(() => {
    const previous = findPreviousWeekSnapshot(weekSnapshots);
    return previous ? compareToPreviousWeek(exercises, sessions, previous) : null;
  }, [exercises, sessions, weekSnapshots]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-accent" />
        <p className="eyebrow">Mémoire</p>
      </div>
      <CardTitle className="mt-2">Évolution</CardTitle>

      {!comparison ? (
        <p className="mt-4 text-sm text-zinc-500">TaekdHub commence à mesurer ta progression cette semaine.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline/[0.07] p-3.5">
              <p className="text-xs text-zinc-500">Temps travaillé</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{formatDuration(comparison.currentTotalSeconds)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSignMinutes(comparison.deltaTotalSeconds)} vs semaine précédente</p>
            </div>
            <div className="rounded-xl border border-hairline/[0.07] p-3.5">
              <p className="text-xs text-zinc-500">Exercices maîtrisés</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{comparison.currentMasteredCount}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSign(comparison.deltaMasteredCount)} vs semaine précédente</p>
            </div>
            <div className="rounded-xl border border-hairline/[0.07] p-3.5">
              <p className="text-xs text-zinc-500">Progression globale</p>
              <p className="mt-1.5 text-xl font-semibold tracking-tight">{comparison.currentCompletionRate}%</p>
              <p className="mt-0.5 text-xs text-zinc-500">{withSign(comparison.deltaCompletionRate, " pt")} vs semaine précédente</p>
            </div>
          </div>

          {(comparison.mostImprovedSubject || comparison.mostNeglectedSubject) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {comparison.mostImprovedSubject && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 text-sm">
                  <p className="text-xs text-zinc-500">A le plus progressé</p>
                  <p className="mt-1 font-medium text-emerald-200">{comparison.mostImprovedSubject.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{withSign(comparison.mostImprovedSubject.deltaCompletionRate, " pt")} de maîtrise</p>
                </div>
              )}
              {comparison.mostNeglectedSubject && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-sm">
                  <p className="text-xs text-zinc-500">La moins travaillée</p>
                  <p className="mt-1 font-medium text-amber-200">{comparison.mostNeglectedSubject.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{formatDuration(comparison.mostNeglectedSubject.currentSeconds)} cette semaine</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * « Où tu en es » — les deux faits que le moteur utilise pour décider, rendus
 * lisibles.
 *
 * Le niveau de difficulté visé (`comfortDifficulty`) et la part de réussites
 * obtenues sans aide décisive pilotaient déjà le classement des
 * recommandations, la formule d'XP et les raisons affichées — sans avoir
 * jamais été montrés nulle part. L'élève subissait donc des décisions dont il
 * ne pouvait ni voir ni contester la base ; un professeur devant l'écran ne
 * pouvait pas répondre à « à quel niveau travaille-t-il ? » ni « s'en sort-il
 * seul ? ». Aucun calcul nouveau : `computeWorkingLevel` et
 * `comfortDifficulty` lisent la même fenêtre de tentatives, dans le même
 * fichier que le moteur.
 *
 * Rien ne s'affiche tant que la fenêtre ne contient pas assez de tentatives
 * qualifiées : mieux vaut ne rien dire qu'un pourcentage sur deux séances.
 */
function WorkingLevelCard({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const level = useMemo(() => computeWorkingLevel(exercises, sessions), [exercises, sessions]);
  const comfort = useMemo(() => comfortDifficulty(exercises, sessions), [exercises, sessions]);
  if (!level || !comfort) return null;

  const autonomyPercent = level.successes > 0 ? Math.round((level.autonomousSuccesses / level.successes) * 100) : null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <GraduationCap size={14} className="text-accent" />
        <p className="eyebrow">Où tu en es</p>
      </div>
      <CardTitle className="mt-2">Ce sur quoi TaekdHub s&apos;appuie pour te proposer des exercices</CardTitle>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-hairline/[0.07] p-3.5">
          <p className="text-xs text-zinc-500">Niveau visé</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">{comfort.target.toFixed(1)}<span className="text-sm font-normal text-zinc-500"> / 5</span></p>
          <p className="mt-0.5 text-2xs text-zinc-500">
            {comfort.steppedUp
              ? `Relevé après ${comfort.successStreak} réussites autonomes d'affilée`
              : `Difficulté moyenne de tes tentatives : ${level.averageDifficulty}`}
          </p>
        </div>
        <div className="rounded-xl border border-hairline/[0.07] p-3.5">
          <p className="text-xs text-zinc-500">Réussites sans aide</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">
            {autonomyPercent === null ? "—" : `${autonomyPercent}%`}
          </p>
          <p className="mt-0.5 text-2xs text-zinc-500">
            {level.successes === 0
              ? "Aucune réussite sur la période"
              : `${level.autonomousSuccesses} sur ${level.successes} réussite${level.successes > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="rounded-xl border border-hairline/[0.07] p-3.5">
          <p className="text-xs text-zinc-500">Mesuré sur</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">{level.attempts}</p>
          <p className="mt-0.5 text-2xs text-zinc-500">dernières tentatives qualifiées</p>
        </div>
      </div>
      <p className="mt-3 text-2xs text-zinc-500">
        Une réussite obtenue en révélant deux indices ou plus n&apos;est pas comptée comme autonome — c&apos;est aussi la règle qu&apos;utilisent
        les recommandations et l&apos;XP.
      </p>
    </Card>
  );
}

/**
 * Formule la base du verdict — jamais une estimation : `attempts` et
 * `sinceDays` viennent tels quels de `computeChaptersToConsolidate`. Quand
 * aucune tentative n'a été enregistrée, on le dit plutôt que d'inventer une
 * période.
 */
function describeEvidence({ attempts, sinceDays }: ChapterConsolidation["evidence"]): string {
  if (attempts === 0) return "Aucune tentative enregistrée — établi sur ta maîtrise déclarée.";
  const plural = attempts > 1 ? "s" : "";
  if (sinceDays === null || sinceDays === 0) return `Sur tes ${attempts} dernière${plural} tentative${plural}, aujourd'hui.`;
  return `Sur tes ${attempts} dernière${plural} tentative${plural}, depuis ${sinceDays} jour${sinceDays > 1 ? "s" : ""}.`;
}

/**
 * « Tes 3 priorités » — la réponse directe à la question que l'élève se pose
 * réellement en ouvrant cette page : « qu'est-ce que je dois retravailler ? »
 *
 * La page savait déjà tout montrer (maîtrise par matière, par chapitre, par
 * statut, constance, évolution) mais ne CONCLUAIT jamais : à l'élève de
 * croiser cinq graphiques pour deviner ses points faibles. C'est
 * précisément le travail que l'application est la mieux placée pour faire.
 *
 * Aucune logique nouvelle : `computeChaptersToConsolidate` (lib/next-action.ts)
 * est la MÊME fonction qui alimente déjà "À consolider" au Dashboard, et
 * elle s'appuie sur les mêmes champs que le moteur de recommandation. Créer
 * ici un second classement des faiblesses aurait garanti que les deux écrans
 * finissent par se contredire — le pire défaut possible pour un produit qui
 * promet de savoir quoi faire travailler. On n'en montre que les trois
 * premiers : une priorité, par définition, ne se compte pas par dix.
 */
function TopWeaknesses({ exercises, sessions, chapters }: { exercises: Exercise[]; sessions: WorkSession[]; chapters: Chapter[] }) {
  const priorities = useMemo(
    () => computeChaptersToConsolidate(exercises, sessions, chapters).slice(0, 3),
    [exercises, sessions, chapters]
  );

  if (priorities.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Target size={14} className="text-accent" />
        <p className="eyebrow">Priorités</p>
      </div>
      <CardTitle className="mt-2">Ce que tu dois retravailler en premier</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">Classé par le même moteur que tes recommandations — donc cohérent avec ce que TaekdHub te propose.</p>

      <ol className="mt-5 space-y-2.5">
        {priorities.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
          <li key={chapter.id}>
            <Link
              href={href}
              className="focus-ring flex items-start gap-3 rounded-xl border border-hairline/[0.07] p-3.5 transition hover:border-hairline/[0.14] hover:bg-hairline/[0.025]"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="truncate text-sm font-medium text-zinc-100">{chapter.label}</p>
                  <span className="shrink-0 text-xs text-zinc-500">{averageMastery}% de maîtrise</span>
                </div>
                <p className="mt-0.5 text-2xs text-zinc-500">{chapter.subject}</p>
                {/* Les preuves, pas un score opaque : l'élève doit pouvoir contester le classement. */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {reasons.map((reason) => (
                    <Badge key={reason} variant="warning">
                      {reason}
                    </Badge>
                  ))}
                </div>
                {/* Sur quoi porte le verdict — « récents » depuis quand, mesurés sur combien.
                    Sans cette ligne, les badges ci-dessus étaient des affirmations sans assise. */}
                <p className="mt-2 text-2xs text-zinc-500">{describeEvidence(evidence)}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                  Travailler ce chapitre <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Style fin (bordures/fonds) propre à cette page — le libellé et la variante de badge viennent de `READINESS_META` (lib/readiness.ts), partagé avec le Dashboard. */
const READINESS_STYLE: Record<ReadinessLevel, { border: string; bg: string }> = {
  "prêt": { border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]" },
  "à consolider": { border: "border-amber-500/20", bg: "bg-amber-500/[0.06]" },
  "pas prêt": { border: "border-rose-500/20", bg: "bg-rose-500/[0.06]" },
  // Neutre, jamais rose : une matière "pas commencé" n'a encore RIEN révélé
  // sur le niveau réel de l'élève — un fond d'alarme identique à "pas prêt"
  // laisserait croire, dès la première visite, qu'il est déjà en retard sur
  // les trois matières à la fois.
  "pas commencé": { border: "border-hairline/[0.09]", bg: "bg-hairline/[0.025]" },
};

/**
 * Section "Prêt pour le DS ?" (Sprint 6) — présentationnelle uniquement :
 * tout vient de `computeReadinessBySubject` (lib/readiness.ts), qui n'est
 * lui-même qu'un regroupement par matière de `recommendExercises`
 * (lib/recommendation.ts, seule source de vérité pour "quoi travailler").
 */
function DsReadiness({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const readiness = useMemo(() => computeReadinessBySubject(exercises, sessions), [exercises, sessions]);

  if (readiness.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <GraduationCap size={14} className="text-accent" />
        <p className="eyebrow">Échéances</p>
      </div>
      <CardTitle className="mt-2">Prêt pour le DS ?</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">Par matière, à partir de ce que le moteur de recommandation signale déjà.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {readiness.map(({ subject, completionRate, flaggedCount, estimatedMinutes, level }) => {
          const meta = READINESS_META[level];
          const style = READINESS_STYLE[level];
          return (
            <div key={subject} className={`rounded-xl border ${style.border} ${style.bg} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">{subject}</p>
                <Badge variant={meta.badge}>{meta.label}</Badge>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {level === "pas commencé"
                  ? // "N exercices à retravailler" donnerait l'impression d'un retard déjà pris, alors qu'aucune séance n'a même commencé sur cette matière.
                    "Aucune séance enregistrée pour l'instant."
                  : `${completionRate}% maîtrisé${flaggedCount > 0 ? ` · ${flaggedCount} exercice${flaggedCount > 1 ? "s" : ""} à retravailler · ≈ ${estimatedMinutes} min` : ""}`}
              </p>
              {/* Sprint 3.1 : réutilise tel quel /session?subject=… (voir SessionRunner), aucun nouveau système de séance. */}
              <Link href={`/session?subject=${encodeURIComponent(subject)}`} className="mt-3 inline-block">
                <Button size="sm" variant="secondary">
                  Préparer maintenant <ArrowRight size={13} />
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Page Progression (Sprint 3B, bloc "Par chapitre" ajouté au Sprint 3D,
 * "Évolution" ajouté au Sprint 5, "Prêt pour le DS ?" ajouté au Sprint 6) —
 * toute l'agrégation vient de lib/progress.ts (et lib/gamification.ts pour
 * la constance, lib/week-snapshot.ts pour l'évolution, lib/readiness.ts
 * pour la préparation aux DS) : ce composant ne fait qu'assembler et
 * afficher, aucun calcul métier ici.
 */
export function ProgressOverview() {
  const { sessions, exercises, chapters, weekSnapshots, ready } = usePrepahubData();

  const model = useMemo(() => {
    return {
      global: computeGlobalProgress(exercises),
      bySubject: computeProgressBySubject(exercises),
      byChapter: progressByChapter(exercises, chapters),
      mastery: masteryDistribution(exercises),
      status: statusDistribution(exercises),
      totalTime: totalSeconds(sessions),
      streak: computeStreak(sessions),
      workByDay: workByDayMap(sessions),
    };
  }, [exercises, chapters, sessions]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Temps cumulé" value={formatDuration(model.totalTime)} detail="Toutes les séances" icon={Clock3} />
        <MetricCard
          label="Exercices maîtrisés"
          value={`${model.global.masteredCount} / ${model.global.activeCount}`}
          detail="Sur la banque active"
          icon={CheckCircle2}
          delay={0.05}
        />
        <MetricCard label="Progression globale" value={`${model.global.completionRate}%`} detail="Part maîtrisée" icon={BarChart3} delay={0.1} />
        <MetricCard label="Série actuelle" value={`${model.streak} j`} detail="Jours consécutifs" icon={Flame} delay={0.15} />
      </section>

      <WorkingLevelCard exercises={exercises} sessions={sessions} />
      <TopWeaknesses exercises={exercises} sessions={sessions} chapters={chapters} />

      <WeekEvolution exercises={exercises} sessions={sessions} weekSnapshots={weekSnapshots} />
      <DsReadiness exercises={exercises} sessions={sessions} />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Progression par matière</CardTitle>
          <div className="mt-6 space-y-5">
            {model.bySubject.map(({ subject, total, mastered, completionRate }) => (
              <div key={subject} id={`subject-${subjectMeta[subject].short}`} className="scroll-mt-24">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                      {subjectMeta[subject].short}
                    </span>
                    {subject}
                  </span>
                  <span className="text-zinc-500">
                    {mastered}/{total}
                  </span>
                </div>
                <ProgressBar value={completionRate} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Maîtrise de la banque</CardTitle>
          <div className="mt-6 space-y-5">
            {model.mastery.map(({ mastery, count, percentage }) => (
              <div key={mastery}>
                <div className="flex items-center justify-between text-sm">
                  <span>{mastery}%</span>
                  <span className="text-zinc-500">{count}</span>
                </div>
                <ProgressBar value={percentage} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Répartition</p>
        <h3 className="mb-4 mt-2 font-semibold tracking-tight">Par chapitre</h3>
        {model.byChapter.length ? (
          // Groupé par matière (dans l'ordre du programme, `subjects` de
          // lib/study.ts) plutôt qu'une seule grille plate de ~40 chapitres :
          // sur mobile (une colonne), un défilement ininterrompu de tuiles
          // identiques ("0/N" pour chacune, avant toute séance) donne
          // l'impression d'une liste sans fin et sans repère. Le tri PAR
          // TAILLE DE CHAPITRE à l'intérieur de chaque matière (déjà décidé
          // par `progressByChapter`, lib/progress.ts) reste inchangé — seul
          // le regroupement visuel est ajouté ici, aucun recalcul.
          subjects
            .map((subject) => ({ subject, chapters: model.byChapter.filter((entry) => entry.chapter.subject === subject) }))
            .filter((group) => group.chapters.length > 0)
            .map(({ subject, chapters: subjectChapters }) => (
              <div key={subject} className="mb-5 last:mb-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                    {subjectMeta[subject].short}
                  </span>
                  <p className="text-xs font-medium text-zinc-400">
                    {subject} <span className="text-zinc-600">· {subjectChapters.length} chapitre{subjectChapters.length > 1 ? "s" : ""}</span>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {subjectChapters.map(({ chapter, total, mastered, completionRate }) => (
                    <div key={chapter.id} className="rounded-xl border border-hairline/[0.07] p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium">{chapter.label}</p>
                        <span className="whitespace-nowrap text-xs text-zinc-500">
                          {mastered}/{total}
                        </span>
                      </div>
                      <ProgressBar value={completionRate} animated={false} barClassName="bg-accent/80" className="mt-3 h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            ))
        ) : (
          <Card className="p-8 text-center text-sm text-zinc-500">Crée des chapitres depuis un exercice pour voir leur progression ici.</Card>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <p className="eyebrow">Répartition</p>
          <CardTitle className="mt-2">Par statut</CardTitle>
          <div className="mt-6 space-y-5">
            {model.status.map(({ status, count, percentage }) => (
              <div key={status}>
                <div className="flex items-center justify-between text-sm">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusMeta[status].className}`}>{status}</span>
                  <span className="text-zinc-500">{count}</span>
                </div>
                <ProgressBar value={percentage} animated={false} className="mt-2 h-2" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="eyebrow">Constance</p>
          <CardTitle className="mt-2">84 derniers jours</CardTitle>
          <div className="mt-6">
            <Heatmap workByDay={model.workByDay} />
            <p className="mt-5 text-xs text-zinc-500">Chaque case représente une journée de travail enregistrée.</p>
          </div>
        </Card>
      </section>

      <section>
        <p className="eyebrow">Banque d&apos;exercices</p>
        <h3 className="mb-4 mt-2 font-semibold tracking-tight">Ce qui mérite ton attention</h3>
        <ExerciseBankStats exercises={exercises} sessions={sessions} />
      </section>
    </div>
  );
}
