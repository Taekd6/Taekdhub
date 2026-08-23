import { computeExerciseBankStats, estimatedDurationMinutes, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import { progressByChapter } from "@/lib/progress";
import { weeklyTimeBySubject } from "@/lib/week";
import { subjects } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * Plan de travail intelligent (Sprint Plan de travail) — compose deux moteurs
 * déjà existants sans les dupliquer :
 * - lib/recommendation.ts (`recommendExercises`) reste l'UNIQUE décideur de
 *   "quel exercice, dans quel ordre" — appelé une fois par matière, avec le
 *   budget que ce module lui alloue ;
 * - lib/week.ts (`weeklyTimeBySubject`) reste l'UNIQUE source du temps déjà
 *   investi cette semaine.
 *
 * Ce fichier n'ajoute qu'une seule chose de nouveau : la RÉPARTITION du temps
 * disponible entre matières, pour qu'un plan de 45 min ne devienne jamais
 * "45 min de maths" par accident (voir `subjectWeight`).
 */

interface SubjectSignal {
  subject: Subject;
  /** Nombre d'exercices actifs dans cette matière — 0 : la matière n'a tout simplement rien à proposer, jamais affichée. */
  total: number;
  /** Au moins un exercice à proposer maintenant (voir `computeExerciseBankStats`) — condition d'entrée dans le plan du jour. */
  eligible: boolean;
  averageMastery: number;
  /** Minutes investies cette semaine sur cette matière (lib/week.ts) — seule définition de "récence" utilisée ici. */
  recentMinutes: number;
  /** Échecs sur les FAILURE_WINDOW_DAYS derniers jours, toutes matières confondues sur cette seule matière. */
  recentFailures: number;
  /** Au moins un exercice actif non maîtrisé — pour distinguer "délaissée" (du travail attend) de "rien à signaler". */
  hasPending: boolean;
  /**
   * Au moins un exercice de la matière a déjà été engagé (tenté, sorti de
   * "à faire", ou travaillé en focus) — même principe que
   * `hasChapterEngagement` (lib/next-action.ts). Sans cette distinction, sur
   * une grosse banque fraîche où `averageMastery` est proche de 0 pour
   * toutes les matières par défaut, TOUTES ressortiraient "critique" dans
   * `computeSubjectPriorities` — un signal aussi peu actionnable que
   * "jamais commencée" ne doit jamais se faire passer pour "en difficulté".
   */
  hasEngagement: boolean;
}

const FAILURE_WINDOW_DAYS = 14;

function computeSubjectSignals(exercises: Exercise[], sessions: WorkSession[], now: Date): SubjectSignal[] {
  const active = exercises.filter((exercise) => !exercise.archived);
  const recentBySubject = weeklyTimeBySubject(sessions, now);
  const failureCutoff = now.getTime() - FAILURE_WINDOW_DAYS * 86400000;

  return subjects.map((subject) => {
    const subjectExercises = active.filter((exercise) => exercise.subject === subject);
    const stats = computeExerciseBankStats(subjectExercises, sessions, now);
    const recentMinutes = secondsToWholeMinutes(recentBySubject.find((entry) => entry.subject === subject)?.seconds ?? 0);
    const recentFailures = sessions.filter(
      (session) => session.subject === subject && session.result === "échoué" && new Date(session.started_at).getTime() >= failureCutoff
    ).length;

    return {
      subject,
      total: subjectExercises.length,
      eligible: subjectExercises.length > 0 && stats.toReviewCount > 0,
      averageMastery: stats.averageMastery,
      recentMinutes,
      recentFailures,
      hasPending: subjectExercises.some((exercise) => exercise.status !== "maîtrisé"),
      hasEngagement: subjectExercises.some((exercise) => exercise.attempts > 0 || exercise.status !== "à faire" || exercise.last_worked_at !== null),
    };
  });
}

/** 0-50 : plus la maîtrise moyenne est basse, plus le poids grimpe. */
const WEAKNESS_WEIGHT = 0.5;
/** 0-30 : dégressif, nul au-delà de `NEGLECT_REFERENCE_MINUTES` déjà investies cette semaine. */
const NEGLECT_CAP = 30;
const NEGLECT_REFERENCE_MINUTES = 60;
/** 0-30 : 10 points par échec récent, plafonné. */
const FAILURE_PER_UNIT = 10;
const FAILURE_CAP = 30;
/** Plancher pour toute matière éligible, même quand aucun signal ne ressort (ex. un exercice signalé seulement pour cause de priorité manuelle) — sans ça, une matière éligible pourrait recevoir un poids nul et disparaître du plan malgré tout. */
const MIN_ELIGIBLE_WEIGHT = 5;

/**
 * Poids d'urgence d'une matière pour la répartition du temps — même esprit
 * que `urgencyScore` (lib/recommendation.ts) mais à l'échelle d'une matière :
 * des termes indépendants, chacun plafonné, additionnés. Sert à la fois à
 * `allocateMinutesBySubject` (répartition du plan du jour) et à
 * `computeSubjectPriorities` (tri de "Priorités de la semaine") — un seul
 * calcul, deux lectures.
 */
function subjectWeight(signal: SubjectSignal): number {
  const weakness = (100 - signal.averageMastery) * WEAKNESS_WEIGHT;
  const neglect = Math.max(0, NEGLECT_CAP - (signal.recentMinutes / NEGLECT_REFERENCE_MINUTES) * NEGLECT_CAP);
  const failure = Math.min(FAILURE_CAP, signal.recentFailures * FAILURE_PER_UNIT);
  return weakness + neglect + failure;
}

/** En dessous de ce nombre de minutes, un bloc matière est trop court pour être utile — mieux vaut l'éliminer et redistribuer que de fragmenter le plan. */
const MIN_BLOCK_MINUTES = 10;

/**
 * Répartit `totalMinutes` entre les matières éligibles, proportionnellement à
 * `subjectWeight`. Une seule matière éligible reçoit tout le budget sans
 * partage artificiel (le brief est explicite : ne pas forcer l'équilibre si
 * une matière est clairement prioritaire). Les blocs sous `MIN_BLOCK_MINUTES`
 * sont retirés et leur part redistribuée une seule fois (pas de boucle
 * jusqu'à convergence : au plus 7 matières à départager).
 */
function allocateMinutesBySubject(signals: SubjectSignal[], totalMinutes: number): Map<Subject, number> {
  const pool = signals.filter((signal) => signal.eligible).map((signal) => ({ subject: signal.subject, weight: Math.max(MIN_ELIGIBLE_WEIGHT, subjectWeight(signal)) }));
  if (pool.length === 0 || totalMinutes <= 0) return new Map();
  if (pool.length === 1) return new Map([[pool[0].subject, totalMinutes]]);

  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let allocation = pool.map((entry) => ({ subject: entry.subject, minutes: Math.round((entry.weight / totalWeight) * totalMinutes) }));
  const kept = allocation.filter((entry) => entry.minutes >= MIN_BLOCK_MINUTES);

  if (kept.length === 0) {
    // Budget trop court pour départager plusieurs matières : tout va à la plus prioritaire plutôt que de fragmenter en blocs inutilisables.
    const top = pool.reduce((best, entry) => (entry.weight > best.weight ? entry : best));
    allocation = [{ subject: top.subject, minutes: totalMinutes }];
  } else if (kept.length < allocation.length) {
    const keptSubjects = new Set(kept.map((entry) => entry.subject));
    const keptWeight = pool.filter((entry) => keptSubjects.has(entry.subject)).reduce((sum, entry) => sum + entry.weight, 0);
    allocation = pool
      .filter((entry) => keptSubjects.has(entry.subject))
      .map((entry) => ({ subject: entry.subject, minutes: Math.round((entry.weight / keptWeight) * totalMinutes) }));
  }

  // Correction d'arrondi : la somme doit égaler exactement `totalMinutes` — l'écart est absorbé par le plus gros bloc, jamais réparti au hasard.
  const sum = allocation.reduce((total, entry) => total + entry.minutes, 0);
  const diff = totalMinutes - sum;
  if (diff !== 0) {
    const largest = allocation.reduce((best, entry) => (entry.minutes > best.minutes ? entry : best));
    largest.minutes += diff;
  }

  return new Map(allocation.map((entry) => [entry.subject, entry.minutes]));
}

export interface PlanBlock {
  subject: Subject;
  /** "Matière — Chapitre" si un chapitre domine parmi les picks retenus, sinon juste la matière. */
  label: string;
  /** Minutes allouées par `allocateMinutesBySubject`. */
  minutes: number;
  /** Durée réelle des exercices retenus (lib/recommendation.ts#estimatedDurationMinutes) — peut être < `minutes` si rien de plus ne tenait dans le budget. */
  estimatedMinutes: number;
  picks: ExerciseRecommendation[];
  /** "N exercices recommandés" / "N exercices à revoir" selon la majorité des picks. */
  pickLabel: string;
}

export interface DailyPlan {
  blocks: PlanBlock[];
  requestedMinutes: number;
  /** Somme de `estimatedMinutes` sur les blocs retenus — peut être < `requestedMinutes`. */
  totalMinutes: number;
  totalExercises: number;
}

/** Large : la vraie limite d'un bloc vient du budget de temps (`selectWithinBudget` dans lib/recommendation.ts), pas de ce nombre. */
const PICKS_PER_BLOCK_LIMIT = 6;

/**
 * "Plan du jour" — répartit `totalMinutes` entre les matières qui en ont
 * besoin (voir `allocateMinutesBySubject`), puis appelle `recommendExercises`
 * une fois par matière avec son budget alloué. Un bloc sans aucun exercice
 * retenu (budget trop serré) est simplement omis, pas affiché vide.
 */
export function computeDailyPlan(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], totalMinutes: number, now: Date = new Date()): DailyPlan {
  const signals = computeSubjectSignals(exercises, sessions, now);
  const allocation = allocateMinutesBySubject(signals, totalMinutes);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const active = exercises.filter((exercise) => !exercise.archived);

  const orderedSubjects = [...allocation.entries()].sort((a, b) => b[1] - a[1]).map(([subject]) => subject);
  const blocks: PlanBlock[] = [];

  for (const subject of orderedSubjects) {
    const minutes = allocation.get(subject)!;
    const subjectExercises = active.filter((exercise) => exercise.subject === subject);
    const picks = recommendExercises(subjectExercises, sessions, PICKS_PER_BLOCK_LIMIT, { now, availableMinutes: minutes });
    if (picks.length === 0) continue;

    const estimatedMinutes = picks.reduce((sum, { exercise }) => sum + estimatedDurationMinutes(exercise, sessions), 0);
    const topChapterId = picks[0].exercise.chapter_id;
    const chapterLabel = topChapterId ? chapterById.get(topChapterId)?.label : undefined;
    const toReviewCount = picks.filter(({ exercise }) => exercise.status === "à revoir").length;
    const pickLabel =
      toReviewCount > picks.length / 2
        ? `${picks.length} exercice${picks.length > 1 ? "s" : ""} à revoir`
        : `${picks.length} exercice${picks.length > 1 ? "s" : ""} recommandé${picks.length > 1 ? "s" : ""}`;

    blocks.push({ subject, label: chapterLabel ? `${subject} — ${chapterLabel}` : subject, minutes, estimatedMinutes, picks, pickLabel });
  }

  return {
    blocks,
    requestedMinutes: totalMinutes,
    totalMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    totalExercises: blocks.reduce((sum, block) => sum + block.picks.length, 0),
  };
}

/** Durées proposées pour le plan du jour — mêmes valeurs que l'objectif du jour (Dashboard) et les raccourcis de séance. */
export const PLAN_DURATION_PRESETS = [30, 45, 60] as const;
export const DEFAULT_PLAN_MINUTES = 45;

export type SubjectPriorityLevel = "critique" | "à surveiller" | "correct";

export interface SubjectPriority {
  subject: Subject;
  /** "Matière — Chapitre" si un chapitre plus faible ressort pour cette matière, sinon juste la matière — même convention que `PlanBlock.label`. */
  label: string;
  level: SubjectPriorityLevel;
  reason: string;
}

/** Jusqu'à combien de matières affichées dans "Priorités de la semaine" — toutes les matières actives si moins. */
const MAX_SUBJECT_PRIORITIES = 7;

/**
 * "Priorités de la semaine" — un niveau explicable par matière, réutilisant
 * exactement les mêmes signaux que `computeDailyPlan` (`subjectWeight`), pour
 * qu'un chapitre ne soit jamais mieux classé ici que par le plan du jour lui-
 * même. Contrairement au plan (qui n'inclut que les matières "éligibles",
 * i.e. avec quelque chose à proposer maintenant), toute matière ayant au
 * moins un exercice actif apparaît ici — y compris une matière entièrement
 * maîtrisée, affichée "correct" plutôt qu'absente (voir Phase 15 du sprint :
 * un état positif plutôt qu'un écran vide).
 */
export function computeSubjectPriorities(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], now: Date = new Date()): SubjectPriority[] {
  const signals = computeSubjectSignals(exercises, sessions, now).filter((signal) => signal.total > 0);
  // Chapitre le plus faible par matière (lib/progress.ts), pour le libellé "Matière — Chapitre" — même source que lib/next-action.ts#computeUpcoming, jamais un second calcul de "chapitre le plus faible".
  const weakestChapterBySubject = new Map<Subject, string>();
  const chapterCandidates = progressByChapter(exercises, chapters)
    .filter((c) => c.completionRate < 100)
    .sort((a, b) => a.averageMastery - b.averageMastery);
  for (const entry of chapterCandidates) {
    if (!weakestChapterBySubject.has(entry.chapter.subject)) weakestChapterBySubject.set(entry.chapter.subject, entry.chapter.label);
  }

  return signals
    .map((signal) => {
      const reasons: string[] = [];
      if (signal.recentFailures >= 2) reasons.push("plusieurs échecs");
      else if (signal.recentFailures === 1) reasons.push("échec récent");
      // Gardé par `hasEngagement` (comme `computeChaptersToConsolidate`,
      // lib/next-action.ts) : une matière jamais commencée a une maîtrise
      // basse par simple absence de donnée, pas parce que l'élève est en
      // difficulté dessus — ce n'est pas la même chose.
      if (signal.hasEngagement && signal.averageMastery < 50) reasons.push("maîtrise faible");
      if (signal.recentMinutes === 0 && signal.hasPending) reasons.push("peu travaillé récemment");

      let level: SubjectPriorityLevel;
      if (signal.recentFailures >= 2 || (signal.hasEngagement && signal.averageMastery < 35)) level = "critique";
      else if (reasons.length > 0) level = "à surveiller";
      else level = "correct";

      const chapterLabel = weakestChapterBySubject.get(signal.subject);
      return {
        subject: signal.subject,
        label: chapterLabel ? `${signal.subject} — ${chapterLabel}` : signal.subject,
        level,
        reason: reasons.length > 0 ? reasons.join(" + ") : "progression correcte",
        weight: subjectWeight(signal),
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_SUBJECT_PRIORITIES)
    .map(({ subject, label, level, reason }) => ({ subject, label, level, reason }));
}

/** Clé sessionStorage pour le transfert Dashboard → /session (voir components/session/session-runner.tsx) — même famille de clés que FOCUS_TIMER_PREFIX (components/exercises/focus-view.tsx), un seul usage puis retirée. */
export const PLAN_STORAGE_KEY = "prepahub:plan:pending";

export interface StoredPlanItem {
  exerciseId: string;
  reasons: string[];
}

export interface StoredPlan {
  items: StoredPlanItem[];
  requestedMinutes: number;
}

/** Sérialise un `DailyPlan` pour la traversée Dashboard → /session — voir `PLAN_STORAGE_KEY`. */
export function serializePlan(plan: DailyPlan): StoredPlan {
  return {
    items: plan.blocks.flatMap((block) => block.picks.map(({ exercise, reasons }) => ({ exerciseId: exercise.id, reasons }))),
    requestedMinutes: plan.requestedMinutes,
  };
}

/**
 * Reprise de plan interrompu (Sprint Adaptive Day) — un plan déposé par le
 * Dashboard n'est plus retiré de `sessionStorage` dès sa lecture : /session
 * le réécrit après chaque exercice travaillé, sans celui qui vient d'être
 * fait (voir components/session/session-runner.tsx). Si l'onglet est fermé
 * ou l'utilisateur quitte avant la fin, la clé garde exactement ce qu'il
 * reste — /session la retrouve telle quelle à la prochaine ouverture, sans
 * recalculer un nouveau plan ni perdre les exercices déjà traités. Fonction
 * pure, testée indépendamment de sessionStorage (voir lib/plan.test.ts).
 */
export function withPlanItemRemoved(plan: StoredPlan, exerciseId: string): StoredPlan {
  return { ...plan, items: plan.items.filter((item) => item.exerciseId !== exerciseId) };
}
