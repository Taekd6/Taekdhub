"use client";

import { useEffect, useMemo, useRef } from "react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { CountUp } from "@/components/ui/count-up";
import { Meter } from "@/components/ui/progress";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
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
import { computePeriodTotals, computeTrackingOverview } from "@/lib/tracking";
import { compareToPreviousWeek, findPreviousWeekSnapshot } from "@/lib/week-snapshot";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import type { WorkSession } from "@/lib/supabase/types";

/** Les ancres des onglets — `#notes` ouvre les notes, depuis l'accueil notamment. */
const TAB_IDS = ["temps", "notes", "regularite", "sommeil", "bilan"];

/**
 * ÉCRAN PROGRESSION.
 *
 * L'écran précédent était UN SEUL DÉFILEMENT de onze sections sans cadre :
 * 6 000 pixels à parcourir pour arriver au sommeil, et aucun moyen de
 * savoir, en ouvrant la page, ce qu'elle contenait plus bas. Refonte
 * « Apple » :
 *
 *   1. UN EN-TÊTE QUI RÉPOND TOUT DE SUITE. Quatre grands chiffres qui
 *      montent quand on les voit (`CountUp`) : cette semaine, la série en
 *      cours, la moyenne par jour, l'objectif de la semaine. C'est ce qu'on
 *      vient chercher neuf fois sur dix.
 *   2. DES ONGLETS pour le reste (`Tabs`, ancrés dans l'URL : /progress#notes
 *      ouvre directement les notes). Cinq questions distinctes, cinq
 *      onglets : combien je travaille (Temps), ce que disent mes notes
 *      (Notes), est-ce que je m'y mets souvent (Régularité), comment je dors
 *      (Sommeil), et ce qu'il faut retenir de la semaine (Bilan).
 *   3. DES TUILES. Chaque mesure vit dans sa tuile (`Section variant="panel"`),
 *      qui entre au défilement ; les graphiques poussent ou se dessinent au
 *      même moment.
 *
 * DEPUIS LE RETRAIT DE LA BANQUE D'EXERCICES, cet écran ne mesure plus que
 * ce que l'élève consigne lui-même : son temps (volume, régularité,
 * répartition, budgets), ses notes et leur calibration, son sommeil.
 *
 * UN SEUL `usePrepahubData()` pour tout l'écran : chaque onglet reçoit ses
 * données en props. Aucun calcul n'est fait ici : tout vient de
 * lib/tracking.ts, lib/weekly-review.ts, lib/week-snapshot.ts et
 * lib/gamification.ts.
 */
export function ProgressOverview() {
  const { sessions, weekSnapshots, workItems, grades, dayPlans, preferences, saveGrades, ready, checkins } = usePrepahubData();
  const tabsRef = useRef<HTMLDivElement>(null);

  const hero = useMemo(() => {
    const now = new Date();
    const overview = computeTrackingOverview(sessions, now);
    const week = computePeriodTotals(sessions, "7j", now);
    return {
      weekMinutes: overview.weekMinutes,
      todayMinutes: overview.todayMinutes,
      streak: computeStreak(sessions),
      dailyAverage: week.dailyAverage,
      totalTime: totalSeconds(sessions),
      sessionCount: sessions.length,
    };
  }, [sessions]);

  /*
   * ARRIVER SUR UN ONGLET PAR SON ANCRE (/progress#notes, depuis l'accueil).
   * `Tabs` ouvre le bon onglet ; il reste à AMENER l'élève dessus : aucun
   * élément ne porte l'identifiant `notes`, donc le navigateur ne fait
   * défiler rien. Une fois les données prêtes, la rangée d'onglets vient se
   * placer sous la barre haute.
   */
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!TAB_IDS.includes(id)) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-24 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const goal = preferences.weeklyGoalMinutes;
  const goalPercent = goal > 0 ? Math.round((hero.weekMinutes / goal) * 100) : 0;

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageHero
        title="Mon évolution"
        lede="Ton temps, tes notes, ton sommeil — et ce qu'ils racontent ensemble."
        illustration={<Illustration name="chrono" size={56} />}
      />

      {/* ── LES QUATRE CHIFFRES ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <HeroFigure index={0} label="Cette semaine" detail={`aujourd'hui ${formatSpan(hero.todayMinutes * 60)}`}>
          <CountUp value={hero.weekMinutes} format={(value) => formatSpan(value * 60)} />
        </HeroFigure>
        <HeroFigure index={1} label="Série en cours" detail={hero.streak > 1 ? "jours d'affilée" : hero.streak === 1 ? "jour — on continue demain" : "une séance la relance"}>
          <CountUp value={hero.streak} format={(value) => `${value} j`} />
        </HeroFigure>
        <HeroFigure index={2} label="Moyenne par jour" detail="sur les 7 derniers jours">
          <CountUp value={hero.dailyAverage} format={(value) => formatSpan(value * 60)} />
        </HeroFigure>
        <HeroFigure
          index={3}
          label="Objectif de la semaine"
          detail={goal > 0 ? `${formatSpan(hero.weekMinutes * 60)} sur ${formatMinutesSpan(goal)}` : "aucun objectif fixé"}
          meter={goal > 0 ? goalPercent : undefined}
        >
          <CountUp value={goalPercent} format={(value) => `${value} %`} />
        </HeroFigure>
      </div>

      <div ref={tabsRef} className="scroll-mt-[calc(var(--nav-h)+1rem)]">
        <Tabs
          syncHash
          ariaLabel="Mesures de progression"
          items={[
            {
              id: "temps",
              label: "Temps",
              content: (
                <div className="space-y-5">
                  {/* LE TEMPS, la figure principale : le pas est le jour, la
                      fenêtre se choisit (7 j / 30 j / 3 mois). */}
                  <WorkTimeSection sessions={sessions} preferences={preferences} />
                  {/* OÙ il part, face à ce que l'élève s'était fixé, puis ce qui
                      BOUGE d'une période à l'autre. */}
                  <SubjectTargetsSection sessions={sessions} preferences={preferences} />
                  <SubjectEvolution sessions={sessions} />
                </div>
              ),
            },
            {
              id: "notes",
              label: "Notes",
              content: <GradesSection grades={grades} onSave={saveGrades} />,
            },
            {
              id: "regularite",
              label: "Régularité",
              content: (
                <div className="space-y-5">
                  <ConsistencySection sessions={sessions} />
                  <WeekSection dayPlans={dayPlans} sessions={sessions} />
                </div>
              ),
            },
            {
              id: "sommeil",
              label: "Sommeil",
              /* Check-in du soir : sommeil, énergie, stress — voir components/progress/sleep-section.tsx. */
              content: <SleepSection checkins={checkins} sessions={sessions} />,
            },
            {
              id: "bilan",
              label: "Bilan",
              content: (
                <div className="space-y-5">
                  {/* La conclusion d'abord, les mesures qui la fondent ensuite. */}
                  <WeeklyReviewSection workItems={workItems} sessions={sessions} preferences={preferences} />
                  <Section variant="panel" title="Vue d'ensemble" description="Où tu en es, et dans quel sens ça va.">
                    <EvolutionOverview sessions={sessions} />
                  </Section>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <WeekEvolution sessions={sessions} weekSnapshots={weekSnapshots} />
                    <Section variant="panel" title="Depuis le début" description="Tout ce que TaekdHub a enregistré.">
                      <StatRow>
                        <Stat label="Temps cumulé" value={formatSpan(hero.totalTime)} size="sm" />
                        <Stat label="Séances" value={hero.sessionCount} size="sm" />
                      </StatRow>
                    </Section>
                  </div>
                  <WorkAndResults sessions={sessions} grades={grades} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * UN GRAND CHIFFRE — une tuile, une étiquette, le nombre qui monte, une
 * ligne de contexte. `meter` (0–100) ajoute sous le chiffre la barre de
 * l'objectif, qui pousse à l'accent en même temps que le nombre monte.
 */
function HeroFigure({
  label,
  detail,
  meter,
  index,
  children,
}: {
  label: string;
  detail: string;
  meter?: number;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div className="surface reveal flex min-w-0 flex-col justify-between gap-6 p-5 sm:p-6" style={{ "--i": index } as React.CSSProperties}>
      <p className="t-label">{label}</p>
      <div className="min-w-0">
        <p className="t-figure-md whitespace-nowrap sm:text-5xl">{children}</p>
        {meter !== undefined && <Meter value={meter} index={2} className="mt-3" />}
        <p className="t-meta mt-1.5 text-[0.8125rem]">{detail}</p>
      </div>
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
      <Section variant="panel" label="Mémoire" title="Face à la semaine dernière">
        <p className="t-meta">
          TaekdHub commence à mesurer ton temps de travail cette semaine. La comparaison apparaîtra dès qu&apos;une semaine
          complète sera enregistrée.
        </p>
      </Section>
    );
  }

  return (
    <Section
      variant="panel"
      label="Mémoire"
      title="Face à la semaine dernière"
      /* « À CE STADE », comme partout ailleurs. La section mettait le total
         de la semaine EN COURS face à celui de la semaine précédente
         COMPLÈTE : chaque lundi matin, l'écran annonçait en rouge la perte de
         tout le travail de la semaine passée (« 0 min · −7 h »). Le chiffre
         est juste, c'est la comparaison qui ne l'était pas — on le dit. */
      description="À ce stade de la semaine."
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
 * n'interprétait presque rien. Cette section ajoute la couche manquante —
 * quelques chiffres, quelques CONSTATS, et UN conseil, mis en avant dans la
 * tuile phare de l'onglet (`feature`).
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

  if (review.totalMinutes === 0 && review.findings.length === 0) {
    return (
      <Section variant="feature" label="Cette semaine" title="Ton bilan">
        <p className="t-meta">Rien d&apos;enregistré cette semaine pour l&apos;instant : le bilan se construit dès la première séance.</p>
      </Section>
    );
  }

  return (
    <Section variant="feature" label="Cette semaine" title="Ton bilan" description="Ce que les données de la semaine permettent réellement de dire — et rien d'autre.">
      <StatRow>
        <Stat label="Travaillé" value={formatSpan(review.totalMinutes * 60)} size="sm" />
        {review.bySubject.slice(0, 2).map((entry) => (
          <Stat key={entry.subject} label={entry.subject} value={formatSpan(entry.minutes * 60)} size="sm" />
        ))}
        {review.completedCount > 0 && <Stat label="Travaux terminés" value={review.completedCount} size="sm" />}
        {review.postponedCount > 0 && <Stat label="Reports" value={review.postponedCount} size="sm" />}
      </StatRow>

      {review.findings.length > 0 && (
        <div className="mt-8">
          <p className="t-label mb-3">À retenir</p>
          {/* Des constats, pas des métriques : chacun est une phrase complète,
              et chacun cite le chiffre dont il sort. */}
          <ul className="space-y-3">
            {review.findings.map((finding) => (
              <li key={finding.key} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
                <span aria-hidden className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-subtle" />
                {finding.sentence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.advice && (
        <div className="well mt-8 p-5 sm:p-6">
          <p className="t-label mb-1.5 text-accent">Pour la suite</p>
          <p className="t-subhead text-ink sm:text-xl">{review.advice}</p>
        </div>
      )}
    </Section>
  );
}
