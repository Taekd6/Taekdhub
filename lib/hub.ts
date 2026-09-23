import { computeConsistency } from "@/lib/analytics/consistency";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import { computeWorkTimeSeries, minutesBetween } from "@/lib/analytics/work-time";
import { computeWorkItemPriority, sortByPriority, type WorkItemPriority } from "@/lib/deadlines";
import { computeGradeStats, computeGradeTrend, type GradeStats, type GradeTrend } from "@/lib/grades";
import { computeSubjectTargets, type SubjectTargetProgress } from "@/lib/subject-targets";
import { activeWorkItems } from "@/lib/work-items";
import { GRADE_KINDS } from "@/lib/storage";
import type { Grade, GradeKind, Preferences, WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * LE HUB D'UNE MATIÈRE — un tableau de bord de SUIVI.
 *
 * CE QUE CE MODULE NE FAIT PAS, et c'est l'essentiel : il ne calcule aucune
 * statistique nouvelle. Chaque champ ci-dessous vient d'un moteur déjà en
 * place et déjà testé — temps de travail, régularité, budget de la semaine,
 * échéances, notes, tendances. Ce fichier ne fait que les COMPOSER pour une
 * matière donnée. Une seconde définition de « temps travaillé » serait
 * exactement le défaut que les audits précédents ont passé leur temps à
 * supprimer.
 *
 * AUCUN EXERCICE. L'élève travaille sur ses propres feuilles et déclare son
 * temps lui-même : l'ancienne banque intégrée — et la « maîtrise par
 * chapitre » qu'elle alimentait — a été retirée. Le hub ne parle donc que de
 * ce que l'élève enregistre réellement : ses séances, ses échéances, ses
 * notes (et, côté écran, ses carnets).
 *
 * Fonctions pures.
 */

/** Fenêtre courte — « ces sept jours », ce que l'élève vérifie le plus souvent. */
export const HUB_RECENT_DAYS = 7;
/** Fenêtre longue — un mois, assez pour absorber une semaine creuse. */
export const HUB_WINDOW_DAYS = 30;
/** Semaines observées pour les tendances du hub — même horizon que l'écran Progression. */
export const HUB_TREND_WEEKS = 6;

export interface HubWorkload {
  /** Minutes travaillées dans cette matière sur les 7 derniers jours. */
  recentMinutes: number;
  /** Minutes sur les 30 derniers jours. */
  windowMinutes: number;
  /** Part de la matière dans le temps total des 30 derniers jours, 0–100 — `null` si aucun temps global. */
  sharePercent: number | null;
  /** Jours actifs de la semaine en cours, toutes matières confondues (la régularité est une habitude, pas une propriété de matière). */
  activeDaysThisWeek: number;
  /** Tendance du volume hebdomadaire DE CETTE MATIÈRE — voir `computeTrend`. */
  trend: Trend;
}

export interface HubSubjectModel {
  subject: Subject;
  workload: HubWorkload;
  /**
   * Budget de la semaine pour cette matière (lib/subject-targets.ts), ou
   * `null` quand l'élève ne s'en est pas fixé (budget à 0) — jamais une
   * ligne « 0 / 0 ».
   */
  target: SubjectTargetProgress | null;
  /** Échéances ouvertes DE CETTE MATIÈRE, les plus prioritaires d'abord. */
  deadlines: WorkItemPriority[];
  /**
   * Notes de la matière, VENTILÉES PAR NATURE.
   *
   * Une moyenne unique mélangeant un DM fait à la maison et un DS en trois
   * heures dit quelque chose que le modèle ne porte pas : ce ne sont pas les
   * mêmes conditions, et l'élève le sait mieux que l'application. Chaque
   * nature garde donc sa propre moyenne, et l'interface les montre séparées.
   */
  gradesByKind: { kind: GradeKind; stats: GradeStats }[];
  /** Toutes natures confondues — affiché UNIQUEMENT quand une seule nature existe, sinon il mentirait par agrégation. */
  grades: GradeStats;
  gradeTrend: GradeTrend;
  /** Vrai quand la matière n'a aucune activité mesurable — l'écran dit alors ce qui manque plutôt que d'afficher des zéros. */
  empty: boolean;
}

function subjectSessions(sessions: WorkSession[], subject: Subject): WorkSession[] {
  return sessions.filter((session) => session.subject === subject);
}

function daysAgo(now: Date, days: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export function buildSubjectHub(
  subject: Subject,
  sessions: WorkSession[],
  workItems: WorkItem[],
  grades: Grade[],
  preferences: Preferences,
  now: Date = new Date()
): HubSubjectModel {
  const own = subjectSessions(sessions, subject);

  const windowMinutes = minutesBetween(own, daysAgo(now, HUB_WINDOW_DAYS), now);
  const totalWindowMinutes = minutesBetween(sessions, daysAgo(now, HUB_WINDOW_DAYS), now);

  const workload: HubWorkload = {
    recentMinutes: minutesBetween(own, daysAgo(now, HUB_RECENT_DAYS), now),
    windowMinutes,
    // `null` et non 0 quand RIEN n'a été travaillé : « 0 % de ton temps » sur
    // une période sans aucun travail est une part qui n'existe pas.
    sharePercent: totalWindowMinutes > 0 ? Math.round((windowMinutes / totalWindowMinutes) * 100) : null,
    activeDaysThisWeek: computeConsistency(sessions, 1, now).currentActiveDays,
    // Les semaines ANTÉRIEURES au compte sont écartées (`measured`), et la
    // semaine en cours l'est aussi parce qu'elle est incomplète — mêmes deux
    // raisons que `computeWeeklyComparison`.
    trend: computeTrend(
      computeWorkTimeSeries(own, "semaine", HUB_TREND_WEEKS, now)
        .slice(0, -1)
        .filter((point) => point.measured)
        .map((point) => point.minutes)
    ),
  };

  // Le budget de la matière vient de la MÊME fonction que l'accueil et
  // Progression : les trois écrans disent donc le même « 2 h 10 / 4 h ».
  const target =
    computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday).find(
      (row) => row.subject === subject
    ) ?? null;

  const deadlines = sortByPriority(
    activeWorkItems(workItems)
      .filter((item) => item.subject === subject)
      .map((item) => computeWorkItemPriority(item, sessions, preferences, now))
  );

  const subjectGrades = grades.filter((grade) => grade.subject === subject);
  const kinds = GRADE_KINDS.filter((kind) => subjectGrades.some((grade) => grade.kind === kind));
  const gradesByKind = kinds.map((kind) => ({
    kind,
    stats: computeGradeStats(subjectGrades.filter((grade) => grade.kind === kind)),
  }));

  return {
    subject,
    workload,
    target,
    deadlines,
    gradesByKind,
    grades: computeGradeStats(subjectGrades),
    gradeTrend: computeGradeTrend(grades, subject),
    empty: own.length === 0 && subjectGrades.length === 0 && deadlines.length === 0,
  };
}

/**
 * Les matières où il y a quelque chose à suivre : une séance, une note, un
 * travail ouvert, ou un budget hebdomadaire fixé par l'élève. Une matière
 * sans rien de tout ça (« je ne suis pas la chimie », budget à 0) n'a pas
 * de hub.
 */
export function hubSubjects(
  sessions: WorkSession[],
  workItems: WorkItem[],
  grades: Grade[],
  preferences: Preferences,
  all: Subject[]
): Subject[] {
  const open = activeWorkItems(workItems);
  return all.filter(
    (subject) =>
      (preferences.weeklySubjectTargets[subject] ?? 0) > 0 ||
      sessions.some((session) => session.subject === subject) ||
      grades.some((grade) => grade.subject === subject) ||
      open.some((item) => item.subject === subject)
  );
}
