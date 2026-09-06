"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { Heatmap } from "@/components/heatmap";
import { ExerciseBankStats } from "@/components/exercises/exercise-bank-stats";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeChaptersToConsolidate, type ChapterConsolidation } from "@/lib/next-action";
import { comfortDifficulty, computeWorkingLevel } from "@/lib/recommendation";
import {
  computeGlobalProgress,
  computeProgressBySubject,
  masteryDistribution,
  progressByChapter,
  statusDistribution,
  type ChapterProgress,
} from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META } from "@/lib/readiness";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import { subjectMeta, subjects, totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * ÉCRAN PROGRESSION.
 *
 * L'écran précédent affichait CINQUANTE tuiles encadrées de taille
 * identique — une par chapitre — sur une page de 3 400 pixels. Toutes
 * portaient le même contenu (« 0/12 » et une barre), donc aucune ne
 * ressortait, et rien là-dedans ne permettait de décider quoi que ce soit :
 * c'était un inventaire, pas un bilan.
 *
 * Trois principes ont guidé la réécriture :
 *
 *   1. CONCLURE AVANT DE MESURER. Les priorités et le niveau de travail
 *      d'abord ; les chiffres bruts ensuite, en une ligne.
 *   2. UN TABLEAU PLUTÔT QU'UNE GRILLE. Cinquante libellés alignés sur une
 *      même colonne se comparent ; cinquante tuiles ne se comparent pas.
 *      Chaque matière est repliable, et l'ordre est celui de la FAIBLESSE,
 *      pas de l'alphabet — on ouvre cette page pour trouver ce qui cloche.
 *   3. CHAQUE ÉLÉMENT DOIT PERMETTRE UNE DÉCISION. Toute ligne mène quelque
 *      part : un chapitre s'ouvre dans la banque, une matière lance une
 *      séance.
 *
 * Aucun calcul n'est fait ici : tout vient de lib/progress.ts,
 * lib/next-action.ts, lib/readiness.ts, lib/week-snapshot.ts et
 * lib/gamification.ts, exactement comme avant.
 */
export function ProgressOverview() {
  const { sessions, exercises, chapters, weekSnapshots, ready } = usePrepahubData();

  const model = useMemo(
    () => ({
      global: computeGlobalProgress(exercises),
      bySubject: computeProgressBySubject(exercises),
      byChapter: progressByChapter(exercises, chapters),
      mastery: masteryDistribution(exercises),
      status: statusDistribution(exercises),
      totalTime: totalSeconds(sessions),
      streak: computeStreak(sessions),
      workByDay: workByDayMap(sessions),
    }),
    [exercises, chapters, sessions]
  );

  if (!ready) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  /*
   * COMPOSITION — un verdict, puis un corps en deux colonnes.
   *
   * L'écran était une pile de neuf sections pleine largeur : il fallait
   * faire défiler 2 800 px pour aller du « ce que je dois retravailler » au
   * « suis-je constant ». Or ces mesures ne se lisent pas l'une APRÈS
   * l'autre : on les confronte. Le tableau par chapitre — la matière de la
   * page — occupe la colonne principale ; tout ce qui le met en perspective
   * (chiffres, évolution, régularité, niveau de travail) tient dans le rail,
   * visible en même temps.
   */
  return (
    <Split
      railLabel="Mesures"
      rail={
        <div className="space-y-8">
          <dl className="divide-y divide-line border-y border-line">
            <RailStat label="Temps cumulé" value={formatDuration(model.totalTime)} />
            <RailStat
              label="Exercices maîtrisés"
              value={`${model.global.masteredCount}`}
              detail={`sur ${model.global.activeCount} actifs`}
            />
            <RailStat label="Progression globale" value={`${model.global.completionRate} %`} />
            <RailStat label="Série actuelle" value={`${model.streak} j`} />
          </dl>

          <div>
            <p className="t-label mb-3">Constance · 84 jours</p>
            <Heatmap workByDay={model.workByDay} />
            <p className="t-meta mt-3 text-2xs">Chaque case représente une journée de travail enregistrée.</p>
          </div>

          <div>
            <p className="t-label mb-3">Par maîtrise déclarée</p>
            <Distribution
              rows={model.mastery.map((entry) => ({
                key: String(entry.mastery),
                label: `${entry.mastery} %`,
                count: entry.count,
                percentage: entry.percentage,
              }))}
            />
          </div>

          <div>
            <p className="t-label mb-3">Par statut</p>
            <Distribution
              rows={model.status.map((entry) => ({
                key: entry.status,
                label: entry.status,
                count: entry.count,
                percentage: entry.percentage,
              }))}
            />
          </div>

          <div>
            <p className="t-label mb-3">Ce qui mérite ton attention</p>
            <ExerciseBankStats exercises={exercises} sessions={sessions} layout="rail" />
          </div>
        </div>
      }
    >
      <div className="space-y-10">
        <PageBar title="Progression" lede="Observer les faits pour ajuster ton travail." />

        <TopWeaknesses exercises={exercises} sessions={sessions} chapters={chapters} />
        <ChapterTable byChapter={model.byChapter} bySubject={model.bySubject} />
        <DsReadiness exercises={exercises} sessions={sessions} />
        <WeekEvolution exercises={exercises} sessions={sessions} weekSnapshots={weekSnapshots} />
        <WorkingLevel exercises={exercises} sessions={sessions} />
      </div>
    </Split>
  );
}

/** Mesure du rail — une ligne, étiquette à gauche, valeur en serif à droite. */
function RailStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="t-label">{label}</dt>
        {detail && <dd className="t-meta mt-0.5 text-2xs">{detail}</dd>}
      </div>
      <dd className="t-figure-sm shrink-0">{value}</dd>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PRIORITÉS
   ══════════════════════════════════════════════════════════════════ */

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
 * « Ce que tu dois retravailler en premier » — la réponse directe à la
 * question qu'on se pose en ouvrant cette page.
 *
 * `computeChaptersToConsolidate` est la MÊME fonction qui alimente « À
 * consolider » sur l'accueil : créer ici un second classement des faiblesses
 * garantirait que les deux écrans finissent par se contredire.
 */
function TopWeaknesses({
  exercises,
  sessions,
  chapters,
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  chapters: Chapter[];
}) {
  const priorities = useMemo(
    () => computeChaptersToConsolidate(exercises, sessions, chapters).slice(0, 3),
    [exercises, sessions, chapters]
  );

  if (priorities.length === 0) return null;

  return (
    <Section
      variant="feature"
      label="Priorités"
      title="Ce que tu dois retravailler en premier"
      description="Classé par le même moteur que tes recommandations — donc cohérent avec ce que TaekdHub te propose."
    >
      <ol className="divide-y divide-line border-y border-line">
        {priorities.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
          <li key={chapter.id}>
            <Link href={href} className="row-hover flex items-start gap-4 rounded-md py-4 pl-1 pr-2">
              <span className="t-figure w-5 shrink-0 pt-0.5 text-right text-sm text-subtle">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="t-subhead truncate">{chapter.label}</p>
                  <span className="tabular shrink-0 text-sm text-muted">{averageMastery} % de maîtrise</span>
                </div>
                <p className="t-meta mt-0.5">{chapter.subject}</p>
                {/* Les preuves, pas un score opaque : l'élève doit pouvoir contester le classement. */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.map((reason) => (
                    <Badge key={reason} variant="warning">
                      {reason}
                    </Badge>
                  ))}
                </div>
                <p className="t-meta mt-2 text-2xs">{describeEvidence(evidence)}</p>
              </div>
              <ArrowRight size={15} className="mt-1 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TABLEAU PAR CHAPITRE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Le remplaçant du mur de tuiles.
 *
 * Chaque matière est un groupe repliable ; à l'intérieur, les chapitres sont
 * triés du PLUS FAIBLE au plus solide. C'est le seul ordre qui serve la
 * question posée — l'ordre alphabétique et l'ordre par taille supposent tous
 * deux qu'on sache déjà quel chapitre on cherche.
 *
 * Seule la première matière est ouverte au chargement : trois matières
 * dépliées, c'est de nouveau cinquante lignes d'un coup.
 */
function ChapterTable({ byChapter, bySubject }: { byChapter: ChapterProgress[]; bySubject: ReturnType<typeof computeProgressBySubject> }) {
  const groups = useMemo(
    () =>
      subjects
        .map((subject) => ({
          subject,
          summary: bySubject.find((entry) => entry.subject === subject),
          chapters: byChapter
            .filter((entry) => entry.chapter.subject === subject)
            .sort((a, b) => a.averageMastery - b.averageMastery || b.total - a.total),
        }))
        .filter((group) => group.chapters.length > 0),
    [byChapter, bySubject]
  );

  const [open, setOpen] = useState<string | null>(groups[0]?.subject ?? null);

  if (groups.length === 0) {
    return (
      <Section label="Par chapitre" title="Chapitre par chapitre">
        <p className="t-meta">Crée des chapitres depuis un exercice pour voir leur progression ici.</p>
      </Section>
    );
  }

  return (
    <Section
      label="Par chapitre"
      title="Chapitre par chapitre"
      description="Du plus fragile au plus solide, dans chaque matière. Clique une ligne pour en ouvrir les exercices."
    >
      <div className="border-t border-line">
        {groups.map(({ subject, summary, chapters: rows }) => {
          const expanded = open === subject;
          return (
            <div key={subject} className="border-b border-line">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : subject)}
                aria-expanded={expanded}
                className="row-hover flex w-full items-center gap-3 rounded-md px-1 py-3 text-left max-lg:min-h-[3.25rem]"
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[0.6875rem] font-semibold",
                    subjectMeta[subject].className
                  )}
                >
                  {subjectMeta[subject].short}
                </span>
                <span className="t-subhead min-w-0 flex-1 truncate">{subject}</span>
                <span className="t-meta tabular shrink-0">
                  {rows.length} chapitre{rows.length > 1 ? "s" : ""}
                </span>
                {summary && (
                  <span className="tabular hidden w-16 shrink-0 text-right text-sm text-muted sm:block">
                    {summary.completionRate} %
                  </span>
                )}
                <ChevronDown
                  size={15}
                  className={cn("shrink-0 text-subtle transition-transform duration-150", expanded && "rotate-180")}
                />
              </button>

              {expanded && (
                <ul className="animate-fade-in pb-2">
                  {rows.map(({ chapter, total, mastered, averageMastery, completionRate }) => (
                    <li key={chapter.id}>
                      <Link
                        href={`/exercises?chapter=${encodeURIComponent(chapter.id)}`}
                        className="row-hover flex items-center gap-3 rounded-md py-2 pl-10 pr-1 max-lg:min-h-11"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{chapter.label}</span>
                        <span className="t-meta tabular hidden w-16 shrink-0 text-right sm:block">
                          {mastered} / {total}
                        </span>
                        {/* La barre porte la MAÎTRISE MOYENNE (un continuum),
                            le chiffre le taux d'exercices achevés : deux
                            informations différentes, pas la même deux fois. */}
                        <Meter
                          value={averageMastery}
                          className="w-20 shrink-0 sm:w-28"
                          tone={averageMastery >= 70 ? "success" : averageMastery >= 35 ? "warning" : "danger"}
                        />
                        <span
                          className={cn(
                            "tabular w-10 shrink-0 text-right text-xs",
                            completionRate >= 70 ? "text-emerald-300" : completionRate > 0 ? "text-amber-300" : "text-subtle"
                          )}
                        >
                          {completionRate} %
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   RÉPARTITIONS
   ══════════════════════════════════════════════════════════════════ */

/** Une distribution = des lignes étiquette / barre / compte. Le titre est posé par l'appelant. */
function Distribution({ rows }: { rows: { key: string; label: string; count: number; percentage: number }[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2.5">
          <span className="w-14 shrink-0 text-2xs capitalize text-muted">{row.label}</span>
          <Meter value={row.percentage} className="flex-1" tone="neutral" />
          <span className="tabular w-7 shrink-0 text-right text-2xs text-muted">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ÉVOLUTION / NIVEAU / DS
   ══════════════════════════════════════════════════════════════════ */

/** `+8`, `-3` ou `±0` — convention unique de signe pour toutes les variations affichées. */
function withSign(value: number, unit = ""): string {
  if (value === 0) return `±0${unit}`;
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

function withSignMinutes(seconds: number): string {
  return withSign(Math.round(seconds / 60), " min");
}

/**
 * Comparaison à la semaine précédente — présentationnelle uniquement : tout
 * vient de `compareToPreviousWeek`. Ne montre rien tant qu'aucune semaine
 * précédente n'a été figée, plutôt que d'inventer une comparaison.
 */
function WeekEvolution({
  exercises,
  sessions,
  weekSnapshots,
}: {
  exercises: Exercise[];
  sessions: WorkSession[];
  weekSnapshots: WeekSnapshot[];
}) {
  const comparison = useMemo(() => {
    const previous = findPreviousWeekSnapshot(weekSnapshots);
    return previous ? compareToPreviousWeek(exercises, sessions, previous) : null;
  }, [exercises, sessions, weekSnapshots]);

  if (!comparison) {
    return (
      <Section label="Mémoire" title="Évolution">
        <p className="t-meta">
          TaekdHub commence à mesurer ta progression cette semaine. La comparaison apparaîtra dès qu&apos;une semaine
          complète sera enregistrée.
        </p>
      </Section>
    );
  }

  return (
    <Section label="Mémoire" title="Évolution" description="Par rapport à la semaine précédente.">
      <StatRow>
        <Stat
          label="Temps travaillé"
          value={formatDuration(comparison.currentTotalSeconds)}
          detail={withSignMinutes(comparison.deltaTotalSeconds)}
          size="sm"
          tone={comparison.deltaTotalSeconds > 0 ? "success" : comparison.deltaTotalSeconds < 0 ? "danger" : undefined}
        />
        <Stat
          label="Exercices maîtrisés"
          value={comparison.currentMasteredCount}
          detail={withSign(comparison.deltaMasteredCount)}
          size="sm"
          tone={comparison.deltaMasteredCount > 0 ? "success" : undefined}
        />
        <Stat
          label="Progression globale"
          value={`${comparison.currentCompletionRate} %`}
          detail={withSign(comparison.deltaCompletionRate, " pt")}
          size="sm"
        />
        {comparison.mostImprovedSubject && (
          <Stat
            label="A le plus progressé"
            value={comparison.mostImprovedSubject.subject}
            detail={`${withSign(comparison.mostImprovedSubject.deltaCompletionRate, " pt")} de maîtrise`}
            size="sm"
          />
        )}
        {comparison.mostNeglectedSubject && (
          <Stat
            label="La moins travaillée"
            value={comparison.mostNeglectedSubject.subject}
            detail={`${formatDuration(comparison.mostNeglectedSubject.currentSeconds)} cette semaine`}
            size="sm"
          />
        )}
      </StatRow>
    </Section>
  );
}

/**
 * « Où tu en es » — les deux faits que le moteur utilise pour décider, rendus
 * lisibles. Aucun calcul nouveau : `computeWorkingLevel` et
 * `comfortDifficulty` lisent la même fenêtre de tentatives que le moteur.
 *
 * Rien ne s'affiche tant que la fenêtre ne contient pas assez de tentatives
 * qualifiées : mieux vaut ne rien dire qu'un pourcentage sur deux séances.
 */
function WorkingLevel({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const level = useMemo(() => computeWorkingLevel(exercises, sessions), [exercises, sessions]);
  const comfort = useMemo(() => comfortDifficulty(exercises, sessions), [exercises, sessions]);
  if (!level || !comfort) return null;

  const autonomyPercent = level.successes > 0 ? Math.round((level.autonomousSuccesses / level.successes) * 100) : null;

  return (
    <Section
      label="Où tu en es"
      title="Ce sur quoi TaekdHub s'appuie pour te proposer des exercices"
      description="Une réussite obtenue en révélant deux indices ou plus n'est pas comptée comme autonome — c'est aussi la règle qu'utilisent les recommandations et l'XP."
    >
      <StatRow>
        <Stat
          label="Niveau visé"
          value={
            <>
              {comfort.target.toFixed(1)}
              <span className="font-sans text-sm font-normal text-subtle"> / 5</span>
            </>
          }
          detail={
            comfort.steppedUp
              ? `Relevé après ${comfort.successStreak} réussites autonomes d'affilée`
              : `Difficulté moyenne de tes tentatives : ${level.averageDifficulty}`
          }
          size="sm"
        />
        <Stat
          label="Réussites sans aide"
          value={autonomyPercent === null ? "—" : `${autonomyPercent} %`}
          detail={
            level.successes === 0
              ? "Aucune réussite sur la période"
              : `${level.autonomousSuccesses} sur ${level.successes} réussite${level.successes > 1 ? "s" : ""}`
          }
          size="sm"
        />
        <Stat label="Mesuré sur" value={level.attempts} detail="dernières tentatives qualifiées" size="sm" />
      </StatRow>
    </Section>
  );
}

/**
 * « Prêt pour le DS ? » — présentationnel uniquement : tout vient de
 * `computeReadinessBySubject`, qui n'est lui-même qu'un regroupement par
 * matière de `recommendExercises`.
 */
function DsReadiness({ exercises, sessions }: { exercises: Exercise[]; sessions: WorkSession[] }) {
  const readiness = useMemo(() => computeReadinessBySubject(exercises, sessions), [exercises, sessions]);

  if (readiness.length === 0) return null;

  return (
    <Section
      label="Échéances"
      title="Prêt pour le DS ?"
      description="Par matière, à partir de ce que le moteur de recommandation signale déjà."
    >
      <ul className="divide-y divide-line border-y border-line">
        {readiness.map(({ subject, completionRate, flaggedCount, estimatedMinutes, level }) => {
          const meta = READINESS_META[level];
          return (
            <li key={subject} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <span className="t-subhead min-w-0 flex-1 truncate">{subject}</span>
              <Badge variant={meta.badge}>{meta.label}</Badge>
              <span className="t-meta w-full sm:w-auto sm:min-w-[16rem]">
                {level === "pas commencé"
                  ? "Aucune séance enregistrée pour l'instant."
                  : `${completionRate} % maîtrisé${
                      flaggedCount > 0
                        ? ` · ${flaggedCount} exercice${flaggedCount > 1 ? "s" : ""} à retravailler · ≈ ${estimatedMinutes} min`
                        : ""
                    }`}
              </span>
              {/* Réutilise tel quel /session?subject=… — aucun nouveau système de séance. */}
              <Link href={`/session?subject=${encodeURIComponent(subject)}`} className="shrink-0">
                <Button size="sm" variant="secondary">
                  Préparer <ArrowRight size={13} />
                </Button>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
