"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { CircularProgress, ProgressBar } from "@/components/ui/progress";
import { Heatmap } from "@/components/heatmap";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeChaptersToConsolidate, type ChapterConsolidation } from "@/lib/next-action";
import { comfortDifficulty, computeWorkingLevel } from "@/lib/recommendation";
import { computeGlobalProgress, computeProgressBySubject, masteryDistribution, progressByChapter, statusDistribution } from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META, type ReadinessLevel } from "@/lib/readiness";
import type { Chapter } from "@/lib/storage";
import { statusMeta, subjectMeta, subjects, totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot, type WeekComparison } from "@/lib/week-snapshot";
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

/** Un chiffre + son delta — la même forme partout dans cette page pour comparer d'un coup d'œil. */
function DeltaFigure({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="min-w-0">
      <p className="t-meta">{label}</p>
      <p className="mt-1 t-figure">{value}</p>
      <p className="mt-0.5 text-2xs text-subtle">{delta}</p>
    </div>
  );
}

/**
 * La phrase qui ouvre la page — une histoire, pas quatre chiffres bruts côte
 * à côte. Rien de recalculé : `global` vient de `computeGlobalProgress`,
 * `comparison` de `compareToPreviousWeek` (déjà nécessaire à `WeekEvolution`,
 * remonté ici pour ne calculer la comparaison qu'une seule fois).
 */
function progressNarrative(global: { masteredCount: number; activeCount: number }, comparison: WeekComparison | null): string {
  const plural = global.masteredCount > 1 ? "s" : "";
  const base = `${global.masteredCount} exercice${plural} maîtrisé${plural} sur ${global.activeCount}.`;
  if (!comparison || comparison.deltaCompletionRate === 0) return base;
  const points = Math.abs(comparison.deltaCompletionRate);
  const direction = comparison.deltaCompletionRate > 0 ? "+" : "−";
  return `${base} ${direction}${points} point${points > 1 ? "s" : ""} de maîtrise cette semaine.`;
}

/**
 * "Évolution" (Sprint 5) — présentationnelle uniquement : toute la
 * comparaison vient de `compareToPreviousWeek` (lib/week-snapshot.ts). Ne
 * montre rien tant qu'aucune semaine précédente n'a été figée, plutôt que
 * d'inventer une comparaison à partir de presque rien (même principe que
 * lib/week.ts#neglectedSubjects). Refonte design : plus de carte bordée — un
 * titre et des chiffres alignés suffisent, la comparaison EST déjà le
 * contenu, pas besoin d'un cadre en plus pour le dire.
 */
function WeekEvolution({ comparison }: { comparison: WeekComparison | null }) {
  if (!comparison) {
    return (
      <Section rank="secondary" eyebrow="Mémoire" title="Évolution">
        <p className="mt-3 text-sm text-muted">TaekdHub commence à mesurer ta progression cette semaine.</p>
      </Section>
    );
  }

  return (
    <Section rank="secondary" eyebrow="Mémoire" title="Évolution">
      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        <DeltaFigure label="Temps travaillé" value={formatDuration(comparison.currentTotalSeconds)} delta={`${withSignMinutes(comparison.deltaTotalSeconds)} vs semaine précédente`} />
        <DeltaFigure label="Exercices maîtrisés" value={String(comparison.currentMasteredCount)} delta={`${withSign(comparison.deltaMasteredCount)} vs semaine précédente`} />
        <DeltaFigure label="Progression globale" value={`${comparison.currentCompletionRate}%`} delta={`${withSign(comparison.deltaCompletionRate, " pt")} vs semaine précédente`} />
      </div>

      {(comparison.mostImprovedSubject || comparison.mostNeglectedSubject) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {comparison.mostImprovedSubject && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 text-sm">
              <p className="t-meta">A le plus progressé</p>
              <p className="mt-1 font-medium text-emerald-200">{comparison.mostImprovedSubject.subject}</p>
              <p className="mt-0.5 text-xs text-muted">{withSign(comparison.mostImprovedSubject.deltaCompletionRate, " pt")} de maîtrise</p>
            </div>
          )}
          {comparison.mostNeglectedSubject && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-sm">
              <p className="t-meta">La moins travaillée</p>
              <p className="mt-1 font-medium text-amber-200">{comparison.mostNeglectedSubject.subject}</p>
              <p className="mt-0.5 text-xs text-muted">{formatDuration(comparison.mostNeglectedSubject.currentSeconds)} cette semaine</p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/**
 * « Où tu en es » — les deux faits que le moteur utilise pour décider, rendus
 * lisibles. Voir la documentation complète dans l'historique du fichier :
 * aucun calcul nouveau, `computeWorkingLevel`/`comfortDifficulty` lisent la
 * même fenêtre de tentatives que le moteur de recommandation. Rien ne
 * s'affiche tant que la fenêtre ne contient pas assez de tentatives
 * qualifiées : mieux vaut ne rien dire qu'un pourcentage sur deux séances.
 */
function WorkingLevelCard({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const level = useMemo(() => computeWorkingLevel(exercises, sessions), [exercises, sessions]);
  const comfort = useMemo(() => comfortDifficulty(exercises, sessions), [exercises, sessions]);
  if (!level || !comfort) return null;

  const autonomyPercent = level.successes > 0 ? Math.round((level.autonomousSuccesses / level.successes) * 100) : null;

  return (
    <Section rank="secondary" eyebrow="Où tu en es" title="Ce sur quoi TaekdHub s'appuie pour te proposer des exercices">
      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
        <DeltaFigure
          label="Niveau visé"
          value={`${comfort.target.toFixed(1)} / 5`}
          delta={comfort.steppedUp ? `Relevé après ${comfort.successStreak} réussites autonomes d'affilée` : `Difficulté moyenne de tes tentatives : ${level.averageDifficulty}`}
        />
        <DeltaFigure
          label="Réussites sans aide"
          value={autonomyPercent === null ? "—" : `${autonomyPercent}%`}
          delta={level.successes === 0 ? "Aucune réussite sur la période" : `${level.autonomousSuccesses} sur ${level.successes} réussite${level.successes > 1 ? "s" : ""}`}
        />
        <DeltaFigure label="Mesuré sur" value={String(level.attempts)} delta="dernières tentatives qualifiées" />
      </div>
      <p className="mt-4 text-2xs text-subtle">
        Une réussite obtenue en révélant deux indices ou plus n&apos;est pas comptée comme autonome — c&apos;est aussi la règle qu&apos;utilisent
        les recommandations et l&apos;XP.
      </p>
    </Section>
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
 * C'est la SEULE section encadrée de la page (rank="primary") : tout le
 * reste est du contexte qui aide à comprendre CE verdict, jamais un second
 * verdict concurrent.
 *
 * Aucune logique nouvelle : `computeChaptersToConsolidate` (lib/next-action.ts)
 * est la MÊME fonction qui alimente déjà "À consolider" au Dashboard.
 */
function TopWeaknesses({ exercises, sessions, chapters }: { exercises: Exercise[]; sessions: WorkSession[]; chapters: Chapter[] }) {
  const priorities = useMemo(
    () => computeChaptersToConsolidate(exercises, sessions, chapters).slice(0, 3),
    [exercises, sessions, chapters]
  );

  if (priorities.length === 0) return null;

  return (
    <Section
      rank="primary"
      eyebrow="Priorités"
      title="Ce que tu dois retravailler en premier"
      description="Classé par le même moteur que tes recommandations — donc cohérent avec ce que TaekdHub te propose."
    >
      <ol className="mt-2 space-y-1">
        {priorities.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
          <li key={chapter.id}>
            <Link
              href={href}
              className="focus-ring flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-inset"
            >
              <span className="mt-0.5 w-4 shrink-0 text-center text-xs tabular-nums text-subtle">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="truncate text-sm font-medium text-ink">{chapter.label}</p>
                  <span className="shrink-0 text-xs text-muted">{averageMastery}% de maîtrise</span>
                </div>
                <p className="mt-0.5 text-2xs text-muted">{chapter.subject}</p>
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
                <p className="mt-2 text-2xs text-subtle">{describeEvidence(evidence)}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                  Travailler ce chapitre <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
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
 * "Prêt pour le DS ?" (Sprint 6) — présentationnelle uniquement : tout vient
 * de `computeReadinessBySubject` (lib/readiness.ts), qui n'est lui-même
 * qu'un regroupement par matière de `recommendExercises`.
 */
function DsReadiness({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const readiness = useMemo(() => computeReadinessBySubject(exercises, sessions), [exercises, sessions]);

  if (readiness.length === 0) return null;

  return (
    <Section rank="secondary" eyebrow="Échéances" title="Prêt pour le DS ?" description="Par matière, à partir de ce que le moteur de recommandation signale déjà.">
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {readiness.map(({ subject, completionRate, flaggedCount, estimatedMinutes, level }) => {
          const meta = READINESS_META[level];
          const style = READINESS_STYLE[level];
          return (
            <div key={subject} className={`rounded-lg border ${style.border} ${style.bg} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{subject}</p>
                <Badge variant={meta.badge}>{meta.label}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">
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
    </Section>
  );
}

/**
 * Page Progression (Sprint 3B, bloc "Par chapitre" ajouté au Sprint 3D,
 * "Évolution" ajouté au Sprint 5, "Prêt pour le DS ?" ajouté au Sprint 6) —
 * toute l'agrégation vient de lib/progress.ts (et lib/gamification.ts pour
 * la constance, lib/week-snapshot.ts pour l'évolution, lib/readiness.ts
 * pour la préparation aux DS) : ce composant ne fait qu'assembler et
 * afficher, aucun calcul métier ici.
 *
 * Refonte design : la page enchaînait neuf cartes bordées de même poids —
 * exactement le "mur de dashboards SaaS" à éviter. Une seule reste encadrée
 * (les priorités, LA conclusion) ; tout le reste se sépare par un titre et
 * du rythme vertical, comme les chapitres d'un même document.
 */
export function ProgressOverview() {
  const { sessions, exercises, chapters, weekSnapshots, ready } = usePrepahubData();

  const model = useMemo(() => {
    const previousWeek = findPreviousWeekSnapshot(weekSnapshots);
    return {
      global: computeGlobalProgress(exercises),
      bySubject: computeProgressBySubject(exercises),
      byChapter: progressByChapter(exercises, chapters),
      mastery: masteryDistribution(exercises),
      status: statusDistribution(exercises),
      totalTime: totalSeconds(sessions),
      streak: computeStreak(sessions),
      workByDay: workByDayMap(sessions),
      comparison: previousWeek ? compareToPreviousWeek(exercises, sessions, previousWeek) : null,
    };
  }, [exercises, chapters, sessions, weekSnapshots]);

  if (!ready) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CE QUE LES DONNÉES SIGNIFIENT, D'ABORD.
          La page ouvrait sur quatre cartes de chiffres bruts — temps cumulé,
          exercices maîtrisés, progression, série — avant toute lecture. Or
          « 11 h 47 » ne dit pas quoi faire ; « ces trois chapitres, pour ces
          raisons datées » si. Les conclusions passent devant, les chiffres
          deviennent une ligne, et les répartitions détaillées forment la
          queue de page qu'on consulte quand on veut creuser. */}
      <TopWeaknesses exercises={exercises} sessions={sessions} chapters={chapters} />

      {/* L'HISTOIRE, PAS LE TABLEAU. Le pourcentage global devient un anneau
          (même composant que l'objectif du jour du Dashboard — un seul
          vocabulaire visuel pour "où j'en suis" dans toute l'app), la phrase
          à côté raconte l'essentiel (combien, et l'évolution cette semaine
          si elle est mesurable) au lieu de le laisser déduire de quatre
          chiffres juxtaposés. */}
      <div className="flex flex-col gap-6 px-1 lg:flex-row lg:items-center lg:gap-10">
        <CircularProgress
          value={model.global.completionRate}
          size={132}
          strokeWidth={10}
          center={<span className="text-3xl font-semibold tabular-nums text-ink">{model.global.completionRate}%</span>}
        />
        <div className="min-w-0">
          <p className="eyebrow">Ta progression</p>
          <p className="mt-2 text-2xl font-semibold leading-snug tracking-tight sm:text-[1.75rem]">{progressNarrative(model.global, model.comparison)}</p>
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
            <DeltaFigure label="Temps cumulé" value={formatDuration(model.totalTime)} delta="depuis le début" />
            <div className="min-w-0">
              <p className="t-meta">Série actuelle</p>
              <p className="mt-1 flex items-center gap-1.5 t-figure">
                <Flame size={18} className="text-accent" /> {model.streak} j
              </p>
              <p className="mt-0.5 text-2xs text-subtle">de suite</p>
            </div>
          </div>
        </div>
      </div>

      {/* Le rythme de travail dans le temps — un calendrier d'activité EST
          déjà une histoire visuelle, pas une case à retrouver en bas de
          page : il rejoint le haut de la page, juste après l'anneau. */}
      <Section rank="secondary" eyebrow="Constance" title="Ton rythme de travail">
        <div className="mt-4">
          <Heatmap workByDay={model.workByDay} />
          <p className="mt-4 text-xs text-muted">Chaque case représente une journée de travail enregistrée, sur 84 jours.</p>
        </div>
      </Section>

      <WorkingLevelCard exercises={exercises} sessions={sessions} />
      <WeekEvolution comparison={model.comparison} />
      <DsReadiness exercises={exercises} sessions={sessions} />

      <Section rank="secondary" eyebrow="Répartition" title="Progression par matière et par maîtrise">
        <div className="mt-4 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <div className="space-y-4">
            {model.bySubject.map(({ subject, total, mastered, completionRate }) => (
              <div key={subject} id={`subject-${subjectMeta[subject].short}`} className="scroll-mt-24">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                      {subjectMeta[subject].short}
                    </span>
                    {subject}
                  </span>
                  <span className="text-muted">
                    {mastered}/{total}
                  </span>
                </div>
                <ProgressBar value={completionRate} animated={false} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>

          <div className="space-y-4 sm:border-l sm:border-hairline/[0.07] sm:pl-10">
            {model.mastery.map(({ mastery, count, percentage }) => (
              <div key={mastery}>
                <div className="flex items-center justify-between text-sm">
                  <span>{mastery}%</span>
                  <span className="text-muted">{count}</span>
                </div>
                <ProgressBar value={percentage} animated={false} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section rank="secondary" eyebrow="Répartition" title="Par chapitre">
        {model.byChapter.length ? (
          // Groupé par matière (dans l'ordre du programme, `subjects` de
          // lib/study.ts) plutôt qu'une seule grille plate de ~40 chapitres :
          // sur mobile (une colonne), un défilement ininterrompu de tuiles
          // identiques ("0/N" pour chacune, avant toute séance) donne
          // l'impression d'une liste sans fin et sans repère. Le tri PAR
          // TAILLE DE CHAPITRE à l'intérieur de chaque matière (déjà décidé
          // par `progressByChapter`, lib/progress.ts) reste inchangé — seul
          // le regroupement visuel est ajouté ici, aucun recalcul.
          <div className="mt-4 space-y-5">
            {subjects
              .map((subject) => ({ subject, chapters: model.byChapter.filter((entry) => entry.chapter.subject === subject) }))
              .filter((group) => group.chapters.length > 0)
              .map(({ subject, chapters: subjectChapters }) => (
                <div key={subject}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded text-[9px] font-bold ${subjectMeta[subject].className}`}>
                      {subjectMeta[subject].short}
                    </span>
                    <p className="text-xs font-medium text-muted">
                      {subject} <span className="text-subtle">· {subjectChapters.length} chapitre{subjectChapters.length > 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {subjectChapters.map(({ chapter, total, mastered, completionRate }) => (
                      <div key={chapter.id} className="rounded-lg border border-hairline/[0.07] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-medium text-ink">{chapter.label}</p>
                          <span className="whitespace-nowrap text-xs text-muted">
                            {mastered}/{total}
                          </span>
                        </div>
                        <ProgressBar value={completionRate} animated={false} barClassName="bg-accent/80" className="mt-3 h-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <Card className="mt-4 p-8 text-center text-sm text-muted">Crée des chapitres depuis un exercice pour voir leur progression ici.</Card>
        )}
      </Section>

      <Section rank="secondary" eyebrow="Répartition" title="Par statut">
        <div className="mt-4 max-w-sm space-y-4">
          {model.status.map(({ status, count, percentage }) => (
            <div key={status}>
              <div className="flex items-center justify-between text-sm">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${statusMeta[status].className}`}>{status}</span>
                <span className="text-muted">{count}</span>
              </div>
              <ProgressBar value={percentage} animated={false} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>
      </Section>

      <Section rank="secondary" eyebrow="Banque d'exercices" title="Ce qui mérite ton attention">
        <div className="mt-4">
          <ExerciseBankStats exercises={exercises} sessions={sessions} />
        </div>
      </Section>
    </div>
  );
}
