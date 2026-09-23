"use client";

import { useMemo } from "react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { WeekSection } from "@/components/progress/week-section";
import { ConsistencySection } from "@/components/progress/consistency-section";
import { EvolutionOverview } from "@/components/progress/evolution-overview";
import { WorkTimeSection } from "@/components/progress/work-time-section";
import { SubjectTargetsSection } from "@/components/progress/subject-targets-section";
import { SubjectEvolution } from "@/components/progress/subject-evolution";
import { GradesSection } from "@/components/progress/grades-section";
import { SleepSection } from "@/components/progress/sleep-section"; // check-in du soir
import { WorkAndResults } from "@/components/progress/work-and-results";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import { computeWeeklyReview } from "@/lib/weekly-review";
import type { Preferences, WeekSnapshot, WorkItem } from "@/lib/storage";
import { totalSeconds } from "@/lib/study";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * ÉCRAN PROGRESSION.
 *
 * L'écran précédent affichait CINQUANTE tuiles encadrées de taille
 * identique — une par chapitre — sur une page de 3 400 pixels. Toutes
 * portaient le même contenu (« 0/12 » et une barre), donc aucune ne
 * ressortait, et rien là-dedans ne permettait de décider quoi que ce soit :
 * c'était un inventaire, pas un bilan.
 *
 * Deux principes ont guidé la réécriture :
 *
 *   1. CONCLURE AVANT DE MESURER. Le bilan de la semaine d'abord ; les
 *      chiffres bruts ensuite.
 *   2. CHAQUE ÉLÉMENT DOIT PERMETTRE UNE DÉCISION.
 *
 * DEPUIS LE RETRAIT DE LA BANQUE D'EXERCICES, cet écran ne mesure plus que
 * ce que l'élève consigne lui-même : son temps (volume, régularité,
 * répartition, budgets), ses notes et leur calibration, son sommeil. La
 * maîtrise par chapitre, le taux de réussite des tentatives, « Prêt pour le
 * DS ? » et le niveau de travail du moteur de recommandation reposaient tous
 * sur la banque ; ils sont partis avec elle.
 *
 * Aucun calcul n'est fait ici : tout vient de lib/tracking.ts,
 * lib/weekly-review.ts, lib/week-snapshot.ts et lib/gamification.ts.
 */
export function ProgressOverview() {
  const { sessions, weekSnapshots, workItems, grades, dayPlans, preferences, saveGrades, ready, checkins } = usePrepahubData();

  const model = useMemo(
    () => ({
      totalTime: totalSeconds(sessions),
      sessionCount: sessions.length,
      streak: computeStreak(sessions),
    }),
    [sessions]
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
   * faire défiler 2 800 px d'un bout à l'autre. Or ces mesures ne se lisent
   * pas l'une APRÈS l'autre : on les confronte. Le détail occupe la colonne
   * principale ; les trois repères cumulés tiennent dans le rail, visibles
   * en même temps.
   */
  return (
    <Split
      railLabel="Mesures"
      rail={
        <div className="space-y-8">
          <dl className="divide-y divide-line border-y border-line">
            <RailStat label="Temps cumulé" value={formatSpan(model.totalTime)} />
            <RailStat label="Séances" value={String(model.sessionCount)} />
            <RailStat label="Série actuelle" value={`${model.streak} j`} />
          </dl>
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
            LES RÉSULTATS qu'en disent mes notes ?

          La conclusion vient d'abord, les mesures qui la fondent ensuite : un
          élève qui n'a que deux minutes doit pouvoir s'arrêter après la
          première section sans rien manquer d'actionnable.
        */}
        <WeeklyReviewSection workItems={workItems} sessions={sessions} preferences={preferences} />

        {/* VUE D'ENSEMBLE — quatre chiffres, juste sous le bilan : de quoi
            répondre à « où j'en suis » sans faire défiler. */}
        <EvolutionOverview sessions={sessions} />

        {/* LE TEMPS, la figure principale. Remplace l'ancienne « RhythmSection »,
            qui ne savait regarder qu'à la semaine : ici le pas est le jour, et
            la fenêtre se choisit (7 j / 30 j / 3 mois). L'objectif hebdomadaire
            qu'elle portait a suivi, il n'est pas perdu. */}
        <WorkTimeSection sessions={sessions} preferences={preferences} />
        <SubjectTargetsSection sessions={sessions} preferences={preferences} />

        {/* LES MATIÈRES. Remplace l'ancienne « SubjectsSection », qui montrait
            deux répartitions figées (cette semaine, depuis le début) sans
            jamais dire ce qui BOUGE. */}
        <SubjectEvolution sessions={sessions} />

        <GradesSection grades={grades} onSave={saveGrades} />
        <ConsistencySection sessions={sessions} />
        {/* ── Check-in du soir : sommeil, énergie, stress — voir components/progress/sleep-section.tsx ── */}
        <SleepSection checkins={checkins} sessions={sessions} />
        <WeekSection dayPlans={dayPlans} sessions={sessions} />
        <WorkAndResults sessions={sessions} grades={grades} />
        <WeekEvolution sessions={sessions} weekSnapshots={weekSnapshots} />
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
   ÉVOLUTION
   ══════════════════════════════════════════════════════════════════ */

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
function WeekEvolution({ sessions, weekSnapshots }: { sessions: WorkSession[]; weekSnapshots: WeekSnapshot[] }) {
  const comparison = useMemo(() => {
    const previous = findPreviousWeekSnapshot(weekSnapshots);
    return previous ? compareToPreviousWeek(sessions, previous) : null;
  }, [sessions, weekSnapshots]);

  if (!comparison) {
    return (
      <Section label="Mémoire" title="Évolution">
        <p className="t-meta">
          TaekdHub commence à mesurer ton temps de travail cette semaine. La comparaison apparaîtra dès qu&apos;une semaine
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
      </StatRow>
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
 * n'interprétait presque rien. « 45 min », « 1 % », « 8 séances » sont
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
  preferences,
}: {
  workItems: WorkItem[];
  sessions: WorkSession[];
  preferences: Preferences;
}) {
  const review = useMemo(() => computeWeeklyReview(workItems, sessions, preferences), [workItems, sessions, preferences]);

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
