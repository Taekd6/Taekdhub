"use client";

import Link from "next/link";
import { ArrowRight, Flame, PenLine, Trophy } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { QuickLog } from "@/components/work/quick-log";
import { ReviewCapture } from "@/components/review/review-capture";
import { DailyCheckinCard } from "@/components/checkin/daily-checkin"; // check-in du soir
import { ChapterHeading } from "@/components/home/tile";
import { DeadlinesTile, ReviewsTile, TodayTile } from "@/components/home/today-tiles";
import { SubjectCarousel, WeekTiles } from "@/components/home/week-and-subjects";
import { buttonVariants } from "@/components/ui/button";
import { ChapterNav } from "@/components/ui/chapter-nav";
import { CountUp } from "@/components/ui/count-up";
import { Illustration } from "@/components/ui/illustrations";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import { computeDailyObjective, computeStatusLine } from "@/lib/daily-objective";
import { formatSpan } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import { computeSubjectTargets } from "@/lib/subject-targets";
import { buildWeeklyPlan } from "@/lib/planning";
import { selectReviewItems } from "@/lib/review-items";
import { dueReviewItems, nextReviewDay } from "@/lib/spaced-repetition";
import { todayBySubject, weekDayStacks } from "@/lib/day-stack";
import { subjects as allSubjects } from "@/lib/study";
import { cn } from "@/lib/cn";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const contestDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Les raccourcis illustrés sous la phrase du jour — tout ce que l'application
 * sait faire, chacun avec son dessin (components/ui/illustrations.tsx). Ils
 * remplacent l'ancienne rangée de pastilles « Aller plus loin » du pied de
 * page : un raccourci n'est utile que là où l'œil arrive, en haut.
 */
const SHORTCUTS = [
  { href: "/timer", label: "Chrono", icon: <Illustration name="chrono" size={40} /> },
  { href: "/revoir/session", label: "Révisions", icon: <Illustration name="revisions" size={40} /> },
  { href: "/erreurs", label: "Erreurs", icon: <Illustration name="erreurs" size={40} /> },
  // Les notes vivent dans « Mon évolution » (components/progress/grades-section.tsx).
  { href: "/progress#notes", label: "Notes", icon: <Illustration name="notes" size={40} /> },
  { href: "/echeances", label: "Échéances", icon: <Illustration name="echeances" size={40} /> },
  { href: "/preparation", label: "Matières", icon: <MatieresIcon /> },
];

/**
 * ÉCRAN D'ACCUEIL — composé comme une page d'apple.com : une phrase en très
 * grand, une rangée de raccourcis illustrés, puis des chapitres qui ne se
 * ressemblent pas (un bento, une saisie en deux colonnes, deux tuiles
 * inégales, une galerie horizontale, une liste).
 *
 *   1. LA PHRASE — ce qu'il reste à faire aujourd'hui, le chiffre à l'accent
 *      qui monte jusqu'à sa valeur ; « Lancer le chrono » (le seul bouton
 *      principal de l'écran) et « Noter du temps ».
 *   2. LES RACCOURCIS — `ChapterNav`, un dessin par outil.
 *   3. LE BENTO — Ma journée (l'anneau), Mes échéances, Mes révisions du
 *      jour : les trois questions qu'on se pose en ouvrant l'app.
 *   4. NOTER DU TEMPS — la saisie rapide.
 *   5. TA SEMAINE — les colonnes (aujourd'hui à l'accent), le check-in du
 *      soir, les budgets.
 *   6. TES MATIÈRES — la galerie, une carte par matière.
 *   7. CE QU'IL FAUT REPRENDRE — la saisie du carnet, puis le rappel de
 *      sauvegarde. Rien d'autre.
 *
 * Plus d'exercices nulle part : l'élève travaille sur ses propres feuilles,
 * TaekdHub consigne et montre.
 *
 * Toutes les données viennent d'UN SEUL `usePrepahubData()`, ici, et sont
 * passées aux enfants : chaque appel du hook tient sa propre copie de
 * l'état, et une seconde copie resterait figée après une saisie.
 */
export function DashboardOverview() {
  const { sessions, workItems, reviewItems, preferences, ready, saveSessions, removeSession, saveReviewItems, checkins, saveCheckins } = usePrepahubData();

  const model = useMemo(() => {
    const now = new Date();
    const weeklySummary = computeWeeklySummary(sessions, preferences.weeklyGoalMinutes, now);
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    return {
      objective,
      statusLine: computeStatusLine(objective),
      weeklySummary,
      // Pondéré par la capacité déclarée : un plan tourné vers le week-end
      // n'est pas « en retard » le samedi matin (voir lib/subject-targets.ts).
      subjectTargets: computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday),
      streak: computeStreak(sessions),
      today: todayBySubject(sessions, now),
      week: weekDayStacks(sessions, now),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
      contestDate: preferences.contestDate ? contestDateFormatter.format(new Date(preferences.contestDate)) : null,
    };
  }, [sessions, preferences]);

  /*
   * LE PLANNING, recalculé à chaque rendu depuis les travaux, les séances et
   * la capacité déclarée — jamais stocké, donc jamais périmé (voir
   * lib/planning.ts). L'accueil n'en garde que la charge du jour et les
   * trois échéances datées les plus prioritaires (même tri que /echeances).
   */
  const workPlan = useMemo(() => buildWeeklyPlan(workItems, sessions, preferences, new Date()), [workItems, sessions, preferences]);

  const reviews = useMemo(() => {
    const now = new Date();
    return {
      open: selectReviewItems(reviewItems, { openOnly: true }),
      due: dueReviewItems(reviewItems, now),
      next: nextReviewDay(reviewItems, now),
    };
  }, [reviewItems]);

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-28 w-full max-w-3xl" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-5 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
        </div>
      </div>
    );
  }

  const { objective, statusLine, weeklySummary, subjectTargets, streak, contestDays, contestDate, today, week } = model;
  const name = preferences.displayName?.trim();
  const upcomingDeadlines = workPlan.priorities.filter((priority) => priority.item.dueDate !== null).slice(0, 3);

  const subjectCards = allSubjects.map((subject) => ({
    subject,
    seconds: weeklySummary.bySubject.find((entry) => entry.subject === subject)?.seconds ?? 0,
    targetMinutes: preferences.weeklySubjectTargets?.[subject] ?? 0,
    dueReviews: reviews.due.filter((item) => item.subject === subject).length,
  }));

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* ── 1-2. LA PHRASE ET LES RACCOURCIS ────────────────────────── */}
      <div className="space-y-10 sm:space-y-14">
        <header className="reveal max-w-4xl">
          <p className="t-meta font-semibold">
            {name ? `Bonjour ${name}` : "Bonjour"} · <span>{dateFormatter.format(new Date())}</span>
          </p>
          <h1 className="t-display mt-3">
            {objective.met ? (
              <>
                Journée faite<span className="text-accent">.</span> Le reste est du bonus.
              </>
            ) : (
              <>
                Encore{" "}
                <CountUp className="text-accent" value={objective.remainingMinutes} format={(value) => `${value} min`} /> et ta
                journée est faite.
              </>
            )}
          </h1>
          <p className="t-lede mt-4">{statusLine}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* L'ACTION PRINCIPALE — une seule par écran. Un lien STYLÉ en
                bouton, jamais un bouton dans un lien. */}
            <Link href="/timer" className={cn(buttonVariants({ size: "lg" }), "max-sm:flex-1")}>
              Lancer le chrono <ArrowRight size={17} strokeWidth={2.4} aria-hidden />
            </Link>
            <a href="#noter-du-temps" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "max-sm:flex-1")}>
              <PenLine size={17} aria-hidden /> Noter du temps
            </a>
          </div>

          {/* Deux repères qui ne méritent pas une tuile : la série et le
              concours. Le concours porte sa DATE. */}
          {(streak > 0 || contestDays !== null) && (
            <p className="t-meta mt-6 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
              {streak > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Flame size={15} className="text-accent" aria-hidden />
                  <span>
                    <span className="text-ink">{streak} jours</span> d&apos;affilée
                  </span>
                </span>
              )}
              {contestDays !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy size={15} className="text-accent" aria-hidden />
                  <span>
                    <span className="text-ink">J−{contestDays}</span> · concours le {contestDate}
                  </span>
                </span>
              )}
            </p>
          )}
        </header>

        <div className="reveal border-y border-line py-2" style={{ "--i": 1 } as CSSProperties}>
          <ChapterNav items={SHORTCUTS} ariaLabel="Raccourcis" activeHref="" />
        </div>
      </div>

      {/* ── 3. LE BENTO — les trois questions du matin ─────────────── */}
      <section aria-label="Aujourd'hui" className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        <TodayTile objective={objective} parts={today} index={0} />
        <DeadlinesTile deadlines={upcomingDeadlines} today={workPlan.days[0]} index={1} />
        <ReviewsTile due={reviews.due} next={reviews.next} index={2} />
      </section>

      {/* ── 4. NOTER DU TEMPS — la cible du bouton secondaire du haut.
          Deux colonnes : la promesse à gauche, les contrôles à droite. ── */}
      <section
        id="noter-du-temps"
        aria-labelledby="noter-titre"
        className="surface reveal grid scroll-mt-24 gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-16"
      >
        <div className="min-w-0">
          <h2 id="noter-titre" className="t-title">
            Noter du temps.
          </h2>
          <p className="t-lede mt-3 max-w-[36ch]">
            Anki, une relecture de cours, une colle… tout ce que le chrono n&apos;a pas vu. Une matière, une durée, c&apos;est noté.
          </p>
        </div>
        <div className="min-w-0">
          <QuickLog sessions={sessions} saveSessions={saveSessions} removeSession={removeSession} ready={ready} />
        </div>
      </section>

      {/* ── 5. TA SEMAINE ───────────────────────────────────────────── */}
      <section aria-labelledby="semaine-titre" className="space-y-6 sm:space-y-8">
        <ChapterHeading
          id="semaine-titre"
          title={
            <>
              Ta semaine<span className="text-accent">.</span>
            </>
          }
          lede={`${weeklySummary.progressPercent} % de ton objectif de la semaine.`}
          aside={
            <p className="t-figure-lg">
              <CountUp value={Math.round(weeklySummary.totalSeconds / 60)} format={(minutes) => formatSpan(minutes * 60)} />
            </p>
          }
        />
        <WeekTiles
          week={week}
          targets={subjectTargets}
          checkin={<DailyCheckinCard checkins={checkins} onSave={saveCheckins} ready={ready} />}
        />
      </section>

      {/* ── 6. TES MATIÈRES — la galerie ────────────────────────────── */}
      <section aria-labelledby="matieres-titre" className="space-y-6 sm:space-y-8">
        <ChapterHeading
          id="matieres-titre"
          title="Tes matières."
          lede="Le temps de la semaine, le budget, et ce qu'il reste à revoir — matière par matière."
        />
        <SubjectCarousel cards={subjectCards} />
      </section>

      {/* ── 7. CE QU'IL FAUT REPRENDRE — une SAISIE ────────────────── */}
      <section aria-labelledby="reprendre-titre" className="space-y-6 sm:space-y-8">
        <ChapterHeading
          id="reprendre-titre"
          title="Ce qu'il faut reprendre."
          lede="Une notion floue, une formule, une méthode : note-la, elle reviendra dans tes révisions."
          aside={
            <Link href="/revoir" className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-accent hover:underline">
              Ouvrir le carnet ›
            </Link>
          }
        />
        <div className="surface reveal p-6 sm:p-8">
          <ReviewCapture
            items={reviewItems}
            saveItems={saveReviewItems}
            ready={ready}
            visible={reviews.open}
            limit={REVIEW_ITEMS_ON_DASHBOARD}
            allHref="/revoir"
          />
        </div>
      </section>

      {/* Le rappel de sauvegarde est une CORVÉE, pas une décision : il reste
          visible, mais APRÈS ce qu'on est venu chercher. */}
      <BackupReminder />
    </div>
  );
}

/** Au-delà, l'accueil deviendrait le carnet — le reste vit sur /revoir. */
const REVIEW_ITEMS_ON_DASHBOARD = 6;

/**
 * « Matières » n'a pas de dessin à elle dans la famille des outils : trois
 * dessins de matière réduits et superposés en tiennent lieu — même trait,
 * même accent, et on lit « toutes les matières » d'un coup d'œil.
 */
function MatieresIcon() {
  return (
    <svg viewBox="0 0 48 48" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={7} y={7} width={15} height={15} rx={4} />
      <rect x={26} y={7} width={15} height={15} rx={4} />
      <rect x={7} y={26} width={15} height={15} rx={4} />
      <rect x={26} y={26} width={15} height={15} rx={4} stroke="rgb(var(--accent-ink-rgb))" />
      <path d="M30.5 33.5h6M33.5 30.5v6" stroke="rgb(var(--accent-ink-rgb))" />
    </svg>
  );
}
