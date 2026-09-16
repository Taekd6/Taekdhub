import { computeChapterMastery, type ChapterMasteryRow } from "@/lib/analytics/mastery";
import { computeConsistency } from "@/lib/analytics/consistency";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import { computeWorkTimeSeries, minutesBetween } from "@/lib/analytics/work-time";
import { computeWorkItemPriority, sortByPriority, type WorkItemPriority } from "@/lib/deadlines";
import { computeGradeStats, computeGradeTrend, type GradeStats, type GradeTrend } from "@/lib/grades";
import { computeProgressBySubject, type SubjectProgress } from "@/lib/progress";
import { activeWorkItems } from "@/lib/work-items";
import { subjects } from "@/lib/study";
import type { Chapter, Grade, GradeKind, Preferences, WorkItem, WorkItemKind } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * LE HUB D'UNE MATIÈRE — un tableau de bord de SUIVI, pas une banque.
 *
 * CE QUE CE MODULE NE FAIT PAS, et c'est l'essentiel : il ne calcule aucune
 * statistique nouvelle. Chaque champ ci-dessous vient d'un moteur déjà en
 * place et déjà testé — progression, maîtrise par chapitre, temps de travail,
 * régularité, échéances, notes, tendances. Ce fichier ne fait que les
 * COMPOSER pour une matière donnée. Une seconde définition de « maîtrise » ou
 * de « temps travaillé » serait exactement le défaut que l'audit précédent a
 * passé son temps à supprimer.
 *
 * CE QU'IL NE CONTIENT PAS NON PLUS : aucun exercice. Pas de liste, pas de
 * titre de fiche, pas d'identifiant. Les exercices restent une donnée de
 * l'application — c'est eux qui alimentent la maîtrise et les chapitres — mais
 * ils ne structurent plus l'écran. Ce qu'il y a « à travailler ensuite » est
 * nommé à l'échelle du CHAPITRE, parce que c'est l'échelle à laquelle on
 * pilote une prépa ; le choix de la fiche appartient au moteur de
 * recommandation, et il s'exprime chaque jour sur l'accueil.
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

export interface HubChapters {
  /** Commencés et encore faibles, les plus bas d'abord. */
  fragile: ChapterMasteryRow[];
  /** Acquis. */
  solid: ChapterMasteryRow[];
  /** Jamais travaillés — ni faibles ni solides : NON MESURÉS. */
  untouched: ChapterMasteryRow[];
}

export interface HubSubjectModel {
  subject: Subject;
  /** Avancement de la matière — repris tel quel de lib/progress.ts. */
  progress: SubjectProgress;
  workload: HubWorkload;
  chapters: HubChapters;
  /** Échéances ouvertes DE CETTE MATIÈRE, les plus prioritaires d'abord. */
  deadlines: WorkItemPriority[];
  /** Notes de la matière — `count: 0` quand il n'y en a pas, et l'interface se tait alors. */
  grades: GradeStats;
  gradeTrend: GradeTrend;
  /**
   * Ce qu'il y a à travailler ensuite, à l'échelle du CHAPITRE — `null` quand
   * rien ne le justifie. Jamais un exercice : nommer une fiche ici
   * ramènerait la banque au milieu du suivi.
   */
  nextChapter: ChapterMasteryRow | null;
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
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  workItems: WorkItem[],
  grades: Grade[],
  preferences: Preferences,
  now: Date = new Date()
): HubSubjectModel {
  const own = subjectSessions(sessions, subject);
  const subjectExercises = exercises.filter((exercise) => exercise.subject === subject);
  const subjectChapters = chapters.filter((chapter) => chapter.subject === subject);

  const progress =
    computeProgressBySubject(exercises).find((entry) => entry.subject === subject) ??
    { subject, total: 0, mastered: 0, completionRate: 0, averageMastery: 0 };

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

  // `computeChapterMastery` fait déjà le tri fragile/solide/non mesuré, et
  // c'est SON tri qui fait foi. On le borne à la matière en amont.
  const board = computeChapterMastery(subjectExercises, subjectChapters, Number.MAX_SAFE_INTEGER);

  const deadlines = sortByPriority(
    activeWorkItems(workItems)
      .filter((item) => item.subject === subject)
      .map((item) => computeWorkItemPriority(item, sessions, preferences, now))
  );

  const subjectGrades = grades.filter((grade) => grade.subject === subject);

  return {
    subject,
    progress,
    workload,
    chapters: { fragile: board.fragile, solid: board.solid, untouched: board.untouched },
    deadlines,
    grades: computeGradeStats(subjectGrades),
    gradeTrend: computeGradeTrend(grades, subject),
    // Le chapitre RÉELLEMENT commencé et le plus faible. Un chapitre jamais
    // ouvert n'est pas « à retravailler » : il est à commencer, ce qui n'est
    // pas le même conseil, et `computeChapterMastery` les sépare déjà.
    nextChapter: board.fragile[0] ?? null,
    empty: progress.total === 0 && own.length === 0,
  };
}

/** Les matières où il y a quelque chose à suivre — une matière sans fiche ni séance n'a pas de hub. */
export function hubSubjects(exercises: Exercise[], sessions: WorkSession[], all: Subject[]): Subject[] {
  return all.filter(
    (subject) =>
      exercises.some((exercise) => !exercise.archived && exercise.subject === subject) ||
      sessions.some((session) => session.subject === subject)
  );
}

/* ══════════════════════════════════════════════════════════════════
   LE HUB CONCOURS — un domaine, pas un catalogue d'annales
   ══════════════════════════════════════════════════════════════════ */

/** Natures de travail qui préparent réellement une épreuve — les autres relèvent du quotidien, pas du concours. */
const CONTEST_KINDS: WorkItemKind[] = ["ds", "concours"];
/** Natures de note qui mesurent une épreuve. */
const CONTEST_GRADE_KINDS: GradeKind[] = ["ds", "concours"];

export interface ContestSubjectLine {
  subject: Subject;
  /** Part des chapitres acquis, 0–100 — l'avancement, pas un compte de fiches. */
  completionRate: number;
  averageMastery: number;
  /** Minutes sur la fenêtre longue. */
  windowMinutes: number;
  /** Chapitres commencés et encore faibles. */
  fragileChapters: number;
}

export interface ContestHubModel {
  /** Jours restants avant l'épreuve déclarée, ou `null` si aucune date n'est renseignée. */
  daysUntil: number | null;
  /** Date déclarée, telle quelle — jamais devinée. */
  contestDate: string | null;
  subjects: ContestSubjectLine[];
  /** DS et préparations concours encore ouverts, les plus urgents d'abord. */
  deadlines: WorkItemPriority[];
  /** Résultats des ÉPREUVES uniquement (DS, concours) — pas les interros ni les DM. */
  grades: GradeStats;
  gradeTrend: GradeTrend;
  /** Total travaillé sur la fenêtre longue, toutes matières. */
  windowMinutes: number;
  /** Les chapitres les plus faibles, toutes matières confondues — ce qu'il reste à consolider avant l'épreuve. */
  toConsolidate: { subject: Subject; row: ChapterMasteryRow }[];
}

/** Nombre de chapitres à consolider présentés — au-delà, ce n'est plus une priorité, c'est une liste. */
export const CONTEST_CONSOLIDATE_LIMIT = 6;

/**
 * « Où j'en suis pour le concours ? »
 *
 * Même discipline que `buildSubjectHub` : composition de moteurs existants,
 * aucune statistique nouvelle, et AUCUN EXERCICE. L'écran qu'il remplace
 * comptait des annales fiche par fiche (« 534 exercices, 312 travaillés,
 * couverture 58 % ») — ce qui répond à « que contient ma bibliothèque ? »,
 * pas à « suis-je prêt ? ».
 */
export function buildContestHub(
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  workItems: WorkItem[],
  grades: Grade[],
  preferences: Preferences,
  now: Date = new Date()
): ContestHubModel {
  const contestDate = preferences.contestDate || null;
  const daysUntil = contestDate
    ? Math.max(0, Math.ceil((new Date(`${contestDate}T00:00:00`).getTime() - now.getTime()) / 86400000))
    : null;

  const present = hubSubjects(exercises, sessions, subjects);
  const progress = computeProgressBySubject(exercises);

  const lines: ContestSubjectLine[] = present.map((subject) => {
    const own = subjectSessions(sessions, subject);
    const entry = progress.find((row) => row.subject === subject);
    const board = computeChapterMastery(
      exercises.filter((exercise) => exercise.subject === subject),
      chapters.filter((chapter) => chapter.subject === subject),
      Number.MAX_SAFE_INTEGER
    );
    return {
      subject,
      completionRate: entry?.completionRate ?? 0,
      averageMastery: entry?.averageMastery ?? 0,
      windowMinutes: minutesBetween(own, daysAgo(now, HUB_WINDOW_DAYS), now),
      fragileChapters: board.fragile.length,
    };
  });

  const deadlines = sortByPriority(
    activeWorkItems(workItems)
      .filter((item) => CONTEST_KINDS.includes(item.kind))
      .map((item) => computeWorkItemPriority(item, sessions, preferences, now))
  );

  // Seules les ÉPREUVES comptent ici. Mélanger les interros et les DM dans
  // une « moyenne de concours » dirait quelque chose que la donnée ne porte pas.
  const contestGrades = grades.filter((grade) => CONTEST_GRADE_KINDS.includes(grade.kind));

  const toConsolidate = present
    .flatMap((subject) =>
      computeChapterMastery(
        exercises.filter((exercise) => exercise.subject === subject),
        chapters.filter((chapter) => chapter.subject === subject),
        Number.MAX_SAFE_INTEGER
      ).fragile.map((row) => ({ subject, row }))
    )
    .sort((a, b) => a.row.rate - b.row.rate)
    .slice(0, CONTEST_CONSOLIDATE_LIMIT);

  return {
    daysUntil,
    contestDate,
    subjects: lines,
    deadlines,
    grades: computeGradeStats(contestGrades),
    gradeTrend: computeGradeTrend(contestGrades),
    windowMinutes: minutesBetween(sessions, daysAgo(now, HUB_WINDOW_DAYS), now),
    toConsolidate,
  };
}
