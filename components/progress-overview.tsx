"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { WeekSection } from "@/components/progress/week-section";
import { ConsistencySection } from "@/components/progress/consistency-section";
import { EvolutionOverview } from "@/components/progress/evolution-overview";
import { WorkTimeSection } from "@/components/progress/work-time-section";
import { SubjectEvolution } from "@/components/progress/subject-evolution";
import { MasterySection } from "@/components/progress/mastery-section";
import { GradesSection } from "@/components/progress/grades-section";
import { WorkAndResults } from "@/components/progress/work-and-results";
import { resultCounts } from "@/lib/history";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak, workByDayMap } from "@/lib/gamification";
import { computeChaptersToConsolidate, type ChapterConsolidation } from "@/lib/next-action";
import { comfortDifficulty, computeWorkingLevel } from "@/lib/recommendation";
import { computeWeeklyReview } from "@/lib/weekly-review";
import {
  computeGlobalProgress,
  computeProgressBySubject,
  masteryDistribution,
  progressByChapter,
  statusDistribution,
} from "@/lib/progress";
import { computeReadinessBySubject, READINESS_META } from "@/lib/readiness";
import type { Chapter, Preferences, WeekSnapshot, WorkItem } from "@/lib/storage";
import { totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
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
  const { sessions, exercises, chapters, weekSnapshots, workItems, grades, dayPlans, preferences, saveGrades, ready } = usePrepahubData();

  const model = useMemo(
    () => ({
      global: computeGlobalProgress(exercises),
      // Au moins une fiche engagée ? Même critère que lib/hub.ts et que
      // `hasChapterEngagement` : c'est ce qui distingue « 0 % » de « non mesuré ».
      engaged: exercises.some(
        (exercise) => !exercise.archived && (exercise.attempts > 0 || exercise.status !== "à faire" || exercise.last_worked_at !== null)
      ),
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

  const results = useMemo(() => resultCounts(sessions), [sessions]);

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
            <RailStat label="Temps cumulé" value={formatSpan(model.totalTime)} />
            {/* « 24 sur 534 actifs » a disparu : le même fait est déjà dit
                juste en dessous, en pourcentage, sans étaler l'inventaire de
                la banque sur un écran de suivi.

                « non mesuré » plutôt que « 0 % » tant qu'AUCUNE fiche n'a été
                engagée : sur une banque fraîchement amorcée, un zéro se lit
                comme un échec alors que rien n'a été tenté. Même critère que
                les hubs (lib/hub.ts). */}
            <RailStat
              label="Progression globale"
              value={model.engaged ? `${model.global.completionRate} %` : "non mesuré"}
            />
            <RailStat label="Série actuelle" value={`${model.streak} j`} />
          </dl>

          {/* La heatmap est DESCENDUE dans le flux principal (« Ta
              régularité ») : c'est un constat qu'on lit, pas un repère qu'on
              consulte du coin de l'œil. Les deux distributions qui vivaient
              ici — « par maîtrise déclarée » et « par statut » — ont été
              retirées : elles décrivaient l'état brut de la banque, ce que la
              section « Tes progrès » dit désormais mieux, et en le
              rapportant à une évolution. Deux façons de montrer la même chose
              valent moins qu'une seule qui conclut. */}
          {/* « À revoir 510 · Jamais travaillés 452 » : deux décomptes de
              fiches, c'est-à-dire l'état de la banque, sur l'écran qui suit
              une progression. Retirés. Reste le taux de réussite, qui mesure
              ce que l'élève PRODUIT et non ce qu'il lui reste en rayon. */}
          <div>
            <p className="t-label mb-3">Ce que donnent tes tentatives</p>
            <dl className="divide-y divide-line border-y border-line">
              <RailStat
                label="Taux de réussite"
                value={results.successRate === null ? "—" : `${results.successRate} %`}
                detail={
                  results.attempted > 0
                    ? `${results.attempted} tentative${results.attempted > 1 ? "s" : ""} qualifiée${results.attempted > 1 ? "s" : ""}`
                    : "aucun résultat enregistré"
                }
              />
            </dl>
          </div>
        </div>
      }
    >
      <div className="space-y-10">
        <PageBar title="Mon évolution" lede="Comprends ton rythme de travail et ta progression." />

        {/*
          ORDRE DE LECTURE — celui d'un dimanche soir, pas celui du modèle de
          données.

            LE BILAN      ce qu'il faut retenir, et quoi faire ensuite.
            LE RYTHME     ai-je assez travaillé ?
            LA SEMAINE    ai-je fait ce que j'avais prévu ?
            LA RÉGULARITÉ est-ce que je m'y mets souvent ?
            LES MATIÈRES  où part mon temps ?
            LES PROGRÈS   est-ce que je monte ?
            LES RÉSULTATS qu'en disent mes notes ?
            À TRAVAILLER  par quoi je reprends.

          La conclusion vient d'abord, les mesures qui la fondent ensuite : un
          élève qui n'a que deux minutes doit pouvoir s'arrêter après la
          première section sans rien manquer d'actionnable.
        */}
        <WeeklyReviewSection workItems={workItems} sessions={sessions} exercises={exercises} preferences={preferences} />

        {/* VUE D'ENSEMBLE — cinq chiffres, juste sous le bilan : de quoi
            répondre à « où j'en suis » sans faire défiler. */}
        <EvolutionOverview sessions={sessions} exercises={exercises} chapters={chapters} />

        {/* LE TEMPS, la figure principale. Remplace l'ancienne « RhythmSection »,
            qui ne savait regarder qu'à la semaine : ici le pas est le jour, et
            la fenêtre se choisit (7 j / 30 j / 3 mois). L'objectif hebdomadaire
            qu'elle portait a suivi, il n'est pas perdu. */}
        <WorkTimeSection sessions={sessions} preferences={preferences} />

        {/* LES MATIÈRES. Remplace l'ancienne « SubjectsSection », qui montrait
            deux répartitions figées (cette semaine, depuis le début) sans
            jamais dire ce qui BOUGE. */}
        <SubjectEvolution sessions={sessions} exercises={exercises} chapters={chapters} snapshots={weekSnapshots} />

        <MasterySection exercises={exercises} sessions={sessions} chapters={chapters} weekSnapshots={weekSnapshots} />
        <GradesSection grades={grades} onSave={saveGrades} />
        <ConsistencySection sessions={sessions} />
        <WeekSection dayPlans={dayPlans} sessions={sessions} />
        <WorkAndResults sessions={sessions} grades={grades} />
        <WeekEvolution exercises={exercises} sessions={sessions} weekSnapshots={weekSnapshots} />

        {/* À TRAVAILLER — la sortie de la page, et elle ne recalcule rien :
            ces deux sections appellent le moteur de recommandation existant.
            Aucun second moteur n'est introduit par ce chantier. */}
        {/* `ChapterTable` a été retirée : elle dépliait TOUS les chapitres de
            toutes les matières, soit plusieurs milliers de pixels, pour dire
            ce que « Tes progrès » dit maintenant en trois listes courtes
            (fragiles, solides, non mesurés) et en le rapportant à une
            évolution. Deux inventaires du même objet sur la même page valent
            moins qu'un seul qui conclut. */}
        <TopWeaknesses exercises={exercises} sessions={sessions} chapters={chapters} />
        <DsReadiness exercises={exercises} sessions={sessions} />
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
   ÉVOLUTION / NIVEAU / DS
   ══════════════════════════════════════════════════════════════════ */

/** `+8`, `-3` ou `±0` — convention unique de signe pour toutes les variations affichées. */
function withSign(value: number, unit = ""): string {
  if (value === 0) return `±0${unit}`;
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

/**
 * Variation de TEMPS — « +2 h 15 », « −5 h », « ±0 ».
 *
 * Exprimée dans la même unité que la valeur qu'elle commente : sous un
 * « 12 h 40 », un détail « −300 min » oblige à faire la division de tête.
 * Le signe est composé avec le vrai moins typographique (U+2212), qui a la
 * chasse d'un chiffre — le trait d'union laissait la colonne bancale.
 */
function withSignMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return "±0";
  return `${minutes > 0 ? "+" : "−"}${formatMinutesSpan(Math.abs(minutes))}`;
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
    <Section
      label="Mémoire"
      title="Évolution"
      /* « À CE STADE », comme partout ailleurs. La section mettait le total
         de la semaine EN COURS face à celui de la semaine précédente
         COMPLÈTE : chaque lundi matin, l'écran annonçait en rouge la perte de
         tout le travail de la semaine passée (« 0 min · −7 h »). Le chiffre
         est juste, c'est la comparaison qui ne l'était pas — on le dit. */
      description="Par rapport à la semaine précédente, à ce stade de la semaine."
    >
      <StatRow>
        <Stat
          label="Temps travaillé"
          value={formatSpan(comparison.currentTotalSeconds)}
          detail={withSignMinutes(comparison.deltaTotalSeconds)}
          size="sm"
          /* Plus de ROUGE sur un écart négatif : une semaine en cours est
             par construction en retard sur une semaine terminée, et teinter
             ce fait en alerte transforme une mécanique de calendrier en
             reproche. Le signe suffit à le dire. */
          tone={comparison.deltaTotalSeconds > 0 ? "success" : undefined}
        />
        {/* Le nombre de fiches maîtrisées disait la même chose que la ligne
            suivante, en stock plutôt qu'en avancement. Une seule suffit. */}
        <Stat
          label="Progression globale"
          value={`${comparison.currentCompletionRate} %`}
          detail={withSign(comparison.deltaCompletionRate, " pt")}
          size="sm"
          tone={comparison.deltaCompletionRate > 0 ? "success" : undefined}
        />
        {/* « A le plus progressé » et « La moins travaillée » ont été retirées :
            « Tes matières » dit maintenant la même chose matière par matière,
            avec le temps ET l'avancement, au lieu de n'en désigner qu'une. Deux
            rendus du même fait sur la même page valent moins qu'un seul. */}
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
                  : /* Le nombre de fiches signalées cède la place au seul
                       chiffre actionnable : le temps que ça demande. */
                    `${completionRate} % maîtrisé${
                      flaggedCount > 0 ? ` · ≈ ${formatMinutesSpan(estimatedMinutes)} de révision` : ""
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

/* ══════════════════════════════════════════════════════════════════
   BILAN DE LA SEMAINE
   ══════════════════════════════════════════════════════════════════ */

/**
 * « Mesure → interprétation → action », dans cet ordre et sur trois niveaux
 * typographiques.
 *
 * Le reproche fait à cet écran était juste : il mesurait beaucoup et
 * n'interprétait presque rien. « 45 min », « 1 % », « 8 exercices » sont
 * exacts et inutilisables à sept heures du matin. Cette section ajoute la
 * couche manquante — quelques chiffres, quelques CONSTATS, et UN conseil.
 *
 * Elle n'affiche rigoureusement rien qui ne sorte d'un calcul de
 * lib/weekly-review.ts : une semaine sans rien de notable produit une liste
 * de constats vide et aucun conseil, et c'est le comportement voulu. Un
 * conseil générique ne vaut pas mieux que pas de conseil — il vaut moins,
 * parce qu'il apprend à ignorer les suivants.
 */
function WeeklyReviewSection({
  workItems,
  sessions,
  exercises,
  preferences,
}: {
  workItems: WorkItem[];
  sessions: WorkSession[];
  exercises: Exercise[];
  preferences: Preferences;
}) {
  const review = useMemo(
    () => computeWeeklyReview(workItems, sessions, exercises, preferences),
    [workItems, sessions, exercises, preferences]
  );

  if (review.totalMinutes === 0 && review.findings.length === 0) return null;

  return (
    <Section label="Cette semaine" title="Ton bilan" description="Ce que les données de la semaine permettent réellement de dire — et rien d'autre.">
      <StatRow>
        <Stat label="Travaillé" value={formatSpan(review.totalMinutes * 60)} size="sm" />
        {review.bySubject.slice(0, 2).map((entry) => (
          <Stat key={entry.subject} label={entry.subject} value={formatSpan(entry.minutes * 60)} size="sm" />
        ))}
        {review.completedCount > 0 && <Stat label="Travaux terminés" value={review.completedCount} size="sm" />}
        {review.postponedCount > 0 && <Stat label="Reports" value={review.postponedCount} size="sm" />}
      </StatRow>

      {review.findings.length > 0 && (
        <div className="mt-6">
          <p className="t-label mb-2">À retenir</p>
          {/* Des constats, pas des métriques : chacun est une phrase complète,
              et chacun cite le chiffre dont il sort. */}
          <ul className="divide-y divide-line border-y border-line">
            {review.findings.map((finding) => (
              <li key={finding.key} className="py-2.5 text-sm text-ink">
                {finding.sentence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.advice && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="t-label mb-1.5">Pour la suite</p>
          <p className="t-lede">{review.advice}</p>
        </div>
      )}
    </Section>
  );
}
