"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { CountUp } from "@/components/ui/count-up";
import { Ring } from "@/components/ui/progress";
import { GradientCard } from "@/components/ui/gradient-card";
import { WeekCurve } from "@/components/home/hero";
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
import { weekDayStacks } from "@/lib/day-stack";
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
 *   1. UN HÉROS QUI RÉPOND TOUT DE SUITE (style « Revolut clair », comme
 *      l'accueil). Le temps de la semaine en TRÈS grand, qui compte jusqu'à
 *      sa valeur (`CountUp`), la courbe des minutes jour par jour qui se
 *      dessine dessous (`WeekCurve`, la même que l'accueil), puis trois
 *      tuiles : la série, la moyenne par jour, et l'objectif de la semaine
 *      en carte à dégradé avec son anneau. C'est ce qu'on vient chercher
 *      neuf fois sur dix.
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
      week: weekDayStacks(sessions, now),
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
    <div className="mx-auto max-w-[68rem] space-y-10 sm:space-y-12">
      {/* ── LE HÉROS : la semaine en énorme, sa courbe, trois tuiles ──
          Sur grand écran, le chiffre et la courbe à gauche dans une tuile,
          les trois tuiles empilées à droite. */}
      <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch lg:gap-6">
        <section aria-labelledby="progres-titre" className="min-w-0 lg:surface lg:col-span-7 lg:px-2 lg:pb-4 lg:pt-7">
          <div className="reveal text-center">
            <h1 id="progres-titre" className="text-sm font-bold text-muted">
              Mon évolution · cette semaine
            </h1>
            <p className="t-hero mt-1.5 text-ink">
              <span className="sr-only">{formatSpan(hero.weekMinutes * 60)} de travail cette semaine</span>
              <span aria-hidden>
                <CountUp value={hero.weekMinutes} duration={1500} format={(value) => <WeekFigure minutes={value} />} />
              </span>
            </p>
            <p className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="pop inline-flex items-center rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-extrabold text-muted" style={{ "--pop-delay": "1.1s" } as CSSProperties}>
                aujourd&apos;hui {formatSpan(hero.todayMinutes * 60)}
              </span>
              {goal > 0 && (
                <span className="pop inline-flex items-center rounded-full bg-accent/10 px-3 py-1.5 text-[0.8125rem] font-extrabold text-accent" style={{ "--pop-delay": "1.25s" } as CSSProperties}>
                  {goalPercent} % de l&apos;objectif
                </span>
              )}
            </p>
          </div>
          <WeekCurve week={hero.week} className="-mx-4 mt-4 sm:-mx-6 lg:mx-0" />
        </section>

        <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-1 lg:gap-4">
          <HeroTile index={3} label="Série" detail={hero.streak > 1 ? "jours d'affilée" : hero.streak === 1 ? "on continue demain" : "une séance la relance"}>
            <CountUp value={hero.streak} format={(value) => `${value} j`} />
          </HeroTile>
          <HeroTile index={4} label="Moyenne / jour" detail="7 derniers jours">
            <CountUp value={hero.dailyAverage} format={(value) => formatSpan(value * 60)} />
          </HeroTile>
          {/* L'OBJECTIF en carte à dégradé : c'est le seul chiffre de
              l'en-tête qui dit « où j'en suis » plutôt que « combien ». */}
          <GradientCard
            tone="brand"
            index={5}
            href="/settings"
            aria-label={goal > 0 ? `Objectif de la semaine : ${goalPercent} %, ${formatSpan(hero.weekMinutes * 60)} sur ${formatMinutesSpan(goal)}. Régler.` : "Aucun objectif hebdomadaire — en fixer un"}
            className="reveal col-span-2 flex items-center gap-4 p-5 lg:col-span-1 lg:flex-1"
            style={{ "--i": 5 } as CSSProperties}
          >
            <Ring value={goal > 0 ? goalPercent : 0} size={64} strokeWidth={7} variant="white">
              <span aria-hidden className="text-sm font-black tabular">
                <CountUp value={goalPercent} format={(value) => `${value}%`} />
              </span>
            </Ring>
            <span aria-hidden className="min-w-0 flex-1">
              <span className="t-card-title block">Objectif de la semaine</span>
              <span className="block truncate text-[0.8125rem] font-bold opacity-80">
                {goal > 0 ? `${formatSpan(hero.weekMinutes * 60)} sur ${formatMinutesSpan(goal)}` : "Aucun objectif fixé"}
              </span>
            </span>
          </GradientCard>
        </div>
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
 * Le chiffre du héros : « 12 h 25 », l'unité plus petite et grise, comme
 * celui de l'accueil (components/home/hero.tsx) ; « 45 min » sous l'heure.
 */
function WeekFigure({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = "text-[0.47em] font-extrabold text-subtle/70";
  if (h === 0) {
    return (
      <>
        {m}
        <span className={unit}> min</span>
      </>
    );
  }
  return (
    <>
      {h}
      <span className={unit}> h </span>
      {String(m).padStart(2, "0")}
    </>
  );
}

/**
 * UNE PETITE TUILE — blanche, qui flotte : une étiquette, le nombre qui
 * monte en 900 (`.t-stat`), une ligne de contexte. Rien d'autre.
 */
function HeroTile({ label, detail, index, children }: { label: string; detail: string; index: number; children: React.ReactNode }) {
  return (
    <div className="surface reveal lift flex min-w-0 flex-col p-4 sm:p-5" style={{ "--i": index } as CSSProperties}>
      <p className="text-[0.8125rem] font-bold text-muted">{label}</p>
      <p className="t-stat mt-1 whitespace-nowrap text-ink">{children}</p>
      <p className="mt-0.5 truncate text-xs font-bold text-subtle">{detail}</p>
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
    <Section variant="feature" label="Cette semaine" title="Ton bilan">
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
