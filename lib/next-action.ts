import { resultCounts, type ResultCounts } from "@/lib/history";
import { progressByChapter, type ChapterProgress } from "@/lib/progress";
import { ASSISTED_HINTS_THRESHOLD, computeExerciseBankStats, explainReasons, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import type { Chapter } from "@/lib/storage";
import { todaySeconds } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import { neglectedSubjects } from "@/lib/week";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * Centre de pilotage (Sprint 7) — "quoi faire maintenant", à partir des
 * données réelles déjà produites par les moteurs existants
 * (lib/recommendation.ts, lib/progress.ts, lib/week.ts, lib/history.ts).
 *
 * Ce module n'introduit AUCUNE nouvelle règle de sélection d'exercice : il
 * compose des fonctions déjà éprouvées et les met en forme pour une seule
 * décision affichable. `recommendExercises` reste l'unique source de vérité
 * pour "quel exercice proposer" — ici on l'appelle avec un budget dérivé de
 * l'objectif du jour, exactement comme le fait déjà `/session` (voir
 * components/session/session-runner.tsx#startSession).
 */

export interface DailyObjective {
  goalMinutes: number;
  workedMinutes: number;
  /** Toujours ≥ 0 — jamais négatif même si l'objectif est dépassé. */
  remainingMinutes: number;
  /** 0-100, plafonné. */
  percent: number;
  met: boolean;
}

/** Progression de l'objectif du jour — seule source pour le Dashboard ET le budget par défaut d'une nouvelle séance (voir `computeNextAction`). */
export function computeDailyObjective(sessions: WorkSession[], goalMinutes: number, now: Date = new Date()): DailyObjective {
  const workedMinutes = secondsToWholeMinutes(todaySeconds(sessions, now));
  const remainingMinutes = Math.max(0, goalMinutes - workedMinutes);
  return {
    goalMinutes,
    workedMinutes,
    remainingMinutes,
    percent: goalMinutes > 0 ? Math.min(100, Math.round((workedMinutes / goalMinutes) * 100)) : 0,
    met: goalMinutes > 0 && remainingMinutes === 0,
  };
}

export type NextActionKind = "empty-bank" | "up-to-date" | "start-session";

export interface NextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  /** Budget (minutes) associé au CTA — 0 si non pertinent (`empty-bank`/`up-to-date`). */
  minutes: number;
  /** Jusqu'à 3 exercices concrets à montrer sous le CTA principal — `[]` si non pertinent. */
  picks: ExerciseRecommendation[];
}

/** Bloc de travail par défaut une fois l'objectif du jour déjà atteint — reprend la même estimation que `lib/recommendation.ts#DEFAULT_ESTIMATE_MINUTES`, pour proposer un budget cohérent plutôt que 0 minute. */
const CONTINUE_SESSION_MINUTES = 25;
/** Nombre d'exercices concrets montrés sous le CTA principal — assez pour donner un aperçu réel, assez peu pour rester lisible. */
const NEXT_ACTION_PICKS = 3;

/**
 * Décision centrale "à faire maintenant" — un seul appel, consommé tel quel
 * par le Dashboard. Trois états possibles, mutuellement exclusifs :
 * - `empty-bank` : aucun exercice actif, rien à recommander (pas encore de données).
 * - `up-to-date` : la banque ne signale rien (voir `computeExerciseBankStats`).
 * - `start-session` : au moins un exercice signalé — `picks` en donne un aperçu concret,
 *   dimensionné sur le temps restant de l'objectif du jour (ou un bloc par défaut si l'objectif est déjà atteint).
 */
export function computeNextAction(exercises: Exercise[], sessions: WorkSession[], dailyGoalMinutes: number, now: Date = new Date()): NextAction {
  const active = exercises.filter((exercise) => !exercise.archived);

  if (active.length === 0) {
    return {
      kind: "empty-bank",
      title: "Ajoute tes premiers exercices",
      description: "La banque est vide pour l'instant — ajoute ou importe des exercices pour que TaekdHub puisse te proposer quoi travailler.",
      ctaLabel: "Voir les exercices",
      href: "/exercises",
      minutes: 0,
      picks: [],
    };
  }

  const stats = computeExerciseBankStats(active, sessions, now);
  if (stats.toReviewCount === 0) {
    return {
      kind: "up-to-date",
      title: "Banque à jour",
      description: "Rien n'est signalé pour l'instant. Bon moment pour avancer librement, ou renforcer un exercice déjà maîtrisé.",
      ctaLabel: "Explorer les exercices",
      href: "/exercises",
      minutes: 0,
      picks: [],
    };
  }

  const objective = computeDailyObjective(sessions, dailyGoalMinutes, now);
  const minutes = objective.remainingMinutes > 0 ? objective.remainingMinutes : CONTINUE_SESSION_MINUTES;
  const bounded = recommendExercises(active, sessions, NEXT_ACTION_PICKS, { now, availableMinutes: minutes });
  // Un budget serré peut ne rien retenir (voir `selectWithinBudget`) sans que
  // ça signifie "rien à proposer" — dans ce cas, on montre quand même
  // l'aperçu non borné : la contrainte de temps réelle reste appliquée par
  // `/session` lui-même au moment de démarrer.
  const picks = bounded.length > 0 ? bounded : recommendExercises(active, sessions, NEXT_ACTION_PICKS, { now });
  const top = picks[0];

  // Une phrase de contexte lisible ("pourquoi CET exercice ?"), pas les
  // raisons brutes concaténées (voir lib/recommendation.ts#explainReasons) —
  // c'est le tout premier endroit où l'élève doit comprendre le choix.
  const description = top ? (explainReasons(top.reasons) ?? "Une sélection prête à l'emploi t'attend.") : "Une sélection prête à l'emploi t'attend.";

  return {
    kind: "start-session",
    title: top ? top.exercise.title : "Commencer une séance",
    description,
    ctaLabel: objective.remainingMinutes > 0 ? `Commencer une séance de ${minutes} min` : `Continuer avec une séance de ${minutes} min`,
    href: "/session",
    minutes,
    picks,
  };
}

export interface UpcomingItem {
  key: "chapter" | "subject" | "review";
  label: string;
  detail: string;
  href: string;
}

/** Nombre d'entrées "Prochainement" affichées — une par catégorie (chapitre / matière / révision), jamais plus. */
const MAX_UPCOMING_ITEMS = 3;

/**
 * "Prochainement" — jusqu'à trois signaux distincts, chacun réutilisant un
 * module existant sans le dupliquer : le chapitre le plus faible
 * (lib/progress.ts), la matière délaissée cette semaine (lib/week.ts), et
 * une révision due (lib/recommendation.ts, raisons "Non retravaillé…" /
 * "Maîtrisé, jamais retravaillé"). Une catégorie sans signal n'apparaît pas
 * — jamais de case vide forcée à trois entrées.
 */
export function computeUpcoming(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], now: Date = new Date()): UpcomingItem[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  const items: UpcomingItem[] = [];

  const weakestChapter = progressByChapter(exercises, chapters)
    .filter((entry) => entry.mastered < entry.total)
    .sort((a, b) => a.averageMastery - b.averageMastery)[0];
  if (weakestChapter) {
    const candidate = active.find((exercise) => exercise.chapter_id === weakestChapter.chapter.id && exercise.status !== "maîtrisé");
    const remaining = weakestChapter.total - weakestChapter.mastered;
    items.push({
      key: "chapter",
      label: weakestChapter.chapter.label,
      detail: `${weakestChapter.averageMastery}% de maîtrise · ${remaining} exercice${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}`,
      href: candidate ? `/exercises?focus=${candidate.id}` : "/exercises",
    });
  }

  const neglected = neglectedSubjects(exercises, sessions, now)[0];
  if (neglected) {
    items.push({
      key: "subject",
      label: neglected.subject,
      detail: `${neglected.pendingCount} exercice${neglected.pendingCount > 1 ? "s" : ""} en attente, rien cette semaine`,
      href: `/session?subject=${encodeURIComponent(neglected.subject)}`,
    });
  }

  const stale = recommendExercises(active, sessions, active.length, { now }).find((recommendation) =>
    recommendation.reasons.some((reason) => reason.startsWith("Non retravaillé") || reason === "Maîtrisé, jamais retravaillé")
  );
  if (stale) {
    items.push({
      key: "review",
      label: stale.exercise.title,
      detail: stale.reasons.join(" · "),
      href: `/exercises?focus=${stale.exercise.id}`,
    });
  }

  return items.slice(0, MAX_UPCOMING_ITEMS);
}

export interface CommandCenterProgress {
  /** Maîtrise moyenne sur les exercices actifs (0-100) — même calcul que `computeExerciseBankStats`. */
  averageMastery: number;
  /** Résultats des tentatives (réussi/partiel/échoué) sur TOUTES les séances — voir lib/history.ts#resultCounts. */
  results: ResultCounts;
  sessionCount: number;
  totalSeconds: number;
}

/** "Ta progression" — quatre chiffres, tous dérivés de modules existants (lib/recommendation.ts pour la maîtrise moyenne, lib/history.ts pour la réussite). Aucun nouveau calcul de stat ici. */
export function computeCommandCenterProgress(exercises: Exercise[], sessions: WorkSession[], now: Date = new Date()): CommandCenterProgress {
  const active = exercises.filter((exercise) => !exercise.archived);
  return {
    averageMastery: computeExerciseBankStats(active, sessions, now).averageMastery,
    results: resultCounts(sessions),
    sessionCount: sessions.length,
    totalSeconds: sessions.reduce((sum, session) => sum + session.duration_seconds, 0),
  };
}

export interface ChapterConsolidation {
  chapter: ChapterProgress["chapter"];
  averageMastery: number;
  /** Toujours ≥ 1 — un chapitre sans raison n'apparaît jamais dans le résultat. */
  reasons: string[];
  /** Un exercice concret du chapitre (le premier non maîtrisé), pour ouvrir directement dessus — même convention que `computeUpcoming`. */
  href: string;
  /**
   * Sur quoi le verdict porte, en clair : combien de tentatives ont été
   * examinées et sur quelle période. Le classement montrait déjà SES RAISONS
   * ("2 échecs récents") mais pas leur assise — « récents » depuis quand,
   * mesurés sur combien ? Un élève (ou un professeur devant l'écran) doit
   * pouvoir contester le verdict, donc voir la preuve datée. `sinceDays` vaut
   * `null` quand aucune tentative avec résultat n'existe : la faiblesse est
   * alors établie sur la seule maîtrise déclarée, et il faut le dire.
   */
  evidence: { attempts: number; sinceDays: number | null };
}

/** Nombre maximum de chapitres montrés dans "À consolider" — voir Sprint Study OS. */
const CHAPTERS_TO_CONSOLIDATE_LIMIT = 5;
/** Seuil (jours) au-delà duquel un chapitre non retravaillé mérite d'être signalé — plus court que `MASTERY_STALE_DAYS` (qui concerne un exercice individuel déjà maîtrisé) : ici on regarde tout un chapitre encore incomplet, un oubli s'y voit plus vite. */
const CHAPTER_STALE_DAYS = 7;
/** Fenêtre d'analyse pour les échecs récents à l'échelle d'un chapitre — même principe que `RECENT_ATTEMPTS_WINDOW` dans lib/recommendation.ts, élargie car répartie sur plusieurs exercices. */
const CHAPTER_RECENT_ATTEMPTS_WINDOW = 5;

/**
 * Un chapitre où au moins un exercice a déjà été engagé — tenté (`attempts > 0`),
 * sorti de "à faire", ou déjà travaillé en focus (`last_worked_at`). "À
 * consolider" signifie renforcer quelque chose déjà abordé, pas signaler un
 * chapitre simplement pas encore commencé (ça, c'est le rôle de `computeNextAction`
 * / de la recommandation générale) — sans cette condition, sur une grosse
 * banque fraîchement amorcée où tout est à 0% par défaut, la quasi-totalité
 * des chapitres qualifierait pour une raison aussi peu actionnable que
 * "jamais travaillé", rendant la section inutile.
 */
function hasChapterEngagement(chapterExercises: Exercise[]): boolean {
  return chapterExercises.some((exercise) => exercise.attempts > 0 || exercise.status !== "à faire" || exercise.last_worked_at !== null);
}

/**
 * "À consolider" — jusqu'à 5 chapitres déjà engagés qui méritent le plus
 * d'attention, chacun avec au moins une raison lisible ("Pourquoi ce
 * chapitre ?"). Réutilise `progressByChapter` (lib/progress.ts) pour la
 * maîtrise moyenne ; les échecs récents et l'ancienneté viennent des mêmes
 * champs que lib/recommendation.ts (`WorkSession.result`,
 * `Exercise.last_worked_at`), jamais d'un nouveau critère de maîtrise. Un
 * chapitre déjà à 100% de complétion n'a rien à consolider et n'apparaît
 * jamais ; un chapitre jamais engagé non plus (voir `hasChapterEngagement`).
 */
export function computeChaptersToConsolidate(
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  now: Date = new Date()
): ChapterConsolidation[] {
  const active = exercises.filter((exercise) => !exercise.archived);

  return progressByChapter(exercises, chapters)
    .filter((entry) => entry.completionRate < 100)
    .map((entry) => {
      const chapterExercises = active.filter((exercise) => exercise.chapter_id === entry.chapter.id);
      if (!hasChapterEngagement(chapterExercises)) return null;

      const reasons: string[] = [];
      if (entry.averageMastery < 50) reasons.push("Maîtrise faible");

      const exerciseIds = new Set(chapterExercises.map((exercise) => exercise.id));
      const recentAttempts = sessions
        .filter((session) => session.exercise_id && exerciseIds.has(session.exercise_id) && session.result)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, CHAPTER_RECENT_ATTEMPTS_WINDOW);
      const failureCount = recentAttempts.filter((attempt) => attempt.result === "échoué").length;
      if (failureCount >= 2) reasons.push(`${failureCount} échecs récents`);
      else if (recentAttempts[0]?.result === "échoué") reasons.push("Échec récent");

      // Recours répété aux indices SUR L'ENSEMBLE du chapitre : un élève qui
      // ne s'en sort qu'aidé, exercice après exercice, révèle une fragilité
      // que ni `result` (il a « réussi ») ni `mastery` (qu'il a pu monter
      // lui-même) ne montrent. C'est le seul endroit où ce signal se lit à
      // l'échelle d'un chapitre — au niveau d'un exercice isolé, il est trop
      // ponctuel pour conclure.
      const assistedCount = recentAttempts.filter(
        (attempt) => attempt.result === "réussi" && attempt.hints_used !== null && attempt.hints_used >= ASSISTED_HINTS_THRESHOLD
      ).length;
      if (assistedCount >= 2) reasons.push(`${assistedCount} réussites avec indices`);

      const lastWorkedTimestamps = chapterExercises
        .map((exercise) => exercise.last_worked_at)
        .filter((value): value is string => value !== null)
        .map((value) => new Date(value).getTime());
      if (lastWorkedTimestamps.length > 0) {
        const days = Math.floor((now.getTime() - Math.max(...lastWorkedTimestamps)) / 86400000);
        if (days >= CHAPTER_STALE_DAYS) reasons.push(`Non travaillé depuis ${days} j`);
      }

      const candidate = chapterExercises.find((exercise) => exercise.status !== "maîtrisé") ?? chapterExercises[0];
      const oldestAttempt = recentAttempts[recentAttempts.length - 1];

      return {
        chapter: entry.chapter,
        averageMastery: entry.averageMastery,
        reasons,
        href: candidate ? `/exercises?focus=${candidate.id}` : "/exercises",
        evidence: {
          attempts: recentAttempts.length,
          sinceDays: oldestAttempt ? Math.floor((now.getTime() - new Date(oldestAttempt.started_at).getTime()) / 86400000) : null,
        },
      };
    })
    .filter((entry): entry is ChapterConsolidation => entry !== null && entry.reasons.length > 0)
    .sort((a, b) => {
      const masteryDiff = a.averageMastery - b.averageMastery;
      if (masteryDiff !== 0) return masteryDiff;
      // À maîtrise égale (fréquent sur une grosse banque encore peu
      // travaillée, où beaucoup de chapitres sont à 0%), un chapitre où
      // l'élève échoue réellement doit passer avant un chapitre simplement
      // pas encore commencé — un échec récent est un signal plus fort qu'une
      // absence de donnée.
      return Number(hasFailureSignal(b.reasons)) - Number(hasFailureSignal(a.reasons));
    })
    .slice(0, CHAPTERS_TO_CONSOLIDATE_LIMIT);
}

/** Un chapitre dont au moins une raison mentionne un échec récent — voir le tri de `computeChaptersToConsolidate`. */
function hasFailureSignal(reasons: string[]): boolean {
  return reasons.some((reason) => reason.includes("échec") || reason === "Échec récent");
}

/**
 * Phrase d'état unique du Dashboard ("où j'en suis", en une phrase) — dérivée
 * de `computeDailyObjective` et `computeNextAction`, jamais recalculée
 * séparément. Ordre des cas volontaire : banque vide d'abord (rien d'autre
 * n'a de sens tant qu'il n'y a aucun exercice), puis objectif atteint, puis
 * les deux variantes "rien travaillé aujourd'hui".
 */
export function computeStatusLine(objective: DailyObjective, nextAction: NextAction): string {
  if (nextAction.kind === "empty-bank") return "Ta banque est vide pour l'instant — ajoute tes premiers exercices.";
  if (objective.met) return "Objectif du jour atteint. Belle séance.";
  if (objective.workedMinutes === 0) {
    return nextAction.kind === "up-to-date"
      ? "Rien n'est signalé aujourd'hui — bon moment pour avancer librement."
      : "Tu n'as encore rien travaillé aujourd'hui.";
  }
  return `${objective.workedMinutes} min travaillées aujourd'hui · encore ${objective.remainingMinutes} min pour ton objectif.`;
}
