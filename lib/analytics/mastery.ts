import { progressByChapter, type ChapterProgress } from "@/lib/progress";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * MAÎTRISE — « est-ce que je progresse ? ».
 *
 * DEUX SOURCES, ET UNE LIMITE ASSUMÉE.
 *
 * L'ÉTAT COURANT vient de la banque : `Exercise.mastery` dit où en est
 * chaque fiche, donc chaque chapitre, à cet instant. Disponible toujours,
 * gratuit, exact.
 *
 * L'HISTORIQUE vient des `WeekSnapshot` — et il n'existe QUE par matière.
 * Chaque semaine, TaekdHub fige `bySubjectProgress[].completionRate`
 * (lib/week-snapshot.ts) ; ces instantanés s'accumulent, et forment donc une
 * vraie série pluri-hebdomadaire, jusqu'ici utilisée pour une seule
 * comparaison N/N−1. C'est elle qu'on exploite ici.
 *
 * PAS D'HISTORIQUE PAR CHAPITRE, et c'est une décision, pas un oubli. Le
 * produit compte environ 84 chapitres ; les historiser chaque semaine
 * ajouterait quelques kilo-octets par semaine à un stockage local déjà
 * occupé pour moitié par la banque d'exercices (~2,3 Mo sur 5 Mo, voir
 * lib/storage.ts#writeKey), au risque de faire échouer des écritures bien
 * plus importantes. Un chapitre a donc un ÉTAT, pas une courbe — et
 * l'interface ne doit jamais laisser croire le contraire.
 *
 * Fonctions pures.
 */

export interface MasteryPoint {
  /** Lundi de la semaine figée, ISO. */
  weekStart: string;
  start: Date;
  /** Taux de maîtrise à cette date, 0–100. */
  rate: number;
}

export interface SubjectMasteryTrend {
  subject: Subject;
  points: MasteryPoint[];
  trend: Trend;
  /** Taux actuel, calculé en direct depuis la banque — toujours plus frais que le dernier instantané. */
  currentRate: number;
}

/**
 * Évolution de la maîtrise d'une matière, instantané après instantané, PUIS
 * le taux courant.
 *
 * Le dernier point est la mesure d'aujourd'hui (calculée depuis la banque),
 * pas le dernier instantané figé : entre les deux, il y a jusqu'à une
 * semaine de travail que l'élève vient de faire, et la masquer donnerait
 * l'impression que rien n'a bougé.
 */
export function computeMasteryTrend(
  subject: Subject,
  snapshots: WeekSnapshot[],
  exercises: Exercise[],
  now: Date = new Date()
): SubjectMasteryTrend {
  const active = exercises.filter((exercise) => !exercise.archived && exercise.subject === subject);
  const mastered = active.filter((exercise) => exercise.status === "maîtrisé").length;
  const currentRate = active.length > 0 ? Math.round((mastered / active.length) * 100) : 0;

  const points: MasteryPoint[] = snapshots
    .slice()
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
    .flatMap((snapshot) => {
      const entry = snapshot.bySubjectProgress.find((row) => row.subject === subject);
      if (!entry || entry.total === 0) return [];
      return [{ weekStart: snapshot.weekStart, start: new Date(snapshot.weekStart), rate: entry.completionRate }];
    });

  const withCurrent: MasteryPoint[] = [
    ...points,
    { weekStart: now.toISOString(), start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), rate: currentRate },
  ];

  return {
    subject,
    points: withCurrent,
    // Bruit absolu d'un point de pourcentage : la maîtrise bouge par
    // paliers entiers (un exercice de plus sur une centaine), et un seuil
    // relatif de 5 % rendrait toute progression réelle « stable » en début
    // d'année, quand le taux est proche de zéro.
    trend: computeTrend(withCurrent.map((point) => point.rate), { absoluteNoise: 1 }),
    currentRate,
  };
}

export interface ChapterMasteryRow {
  chapter: ChapterProgress["chapter"];
  subject: Subject;
  /** 0–100 — maîtrise moyenne des fiches actives du chapitre. */
  rate: number;
  total: number;
  mastered: number;
  /** Fiches jamais travaillées : ce qui distingue « je rate » de « je n'ai pas commencé ». */
  untouched: number;
}

export interface ChapterMasteryBoard {
  /** Les plus faibles d'abord, parmi les chapitres RÉELLEMENT commencés. */
  fragile: ChapterMasteryRow[];
  /** Ceux qui sont acquis. */
  solid: ChapterMasteryRow[];
  /** Ceux où rien n'a encore été fait — ni faibles ni solides : non mesurés. */
  untouched: ChapterMasteryRow[];
}

/** Au-dessus de ce taux, un chapitre est tenu pour acquis. */
export const CHAPTER_SOLID_RATE = 70;

/**
 * Le tableau des chapitres, rangé par ce qu'il y a à en faire.
 *
 * TROIS GROUPES, et le troisième est le plus important : un chapitre où
 * aucun exercice n'a jamais été travaillé n'est PAS un chapitre faible,
 * c'est un chapitre non mesuré. Les confondre remplirait la liste des
 * « points faibles » de tout le programme de l'année dès la première
 * ouverture, et la rendrait inutilisable.
 */
export function computeChapterMastery(exercises: Exercise[], chapters: Chapter[], limit = 5): ChapterMasteryBoard {
  const rows: ChapterMasteryRow[] = progressByChapter(exercises, chapters).map((entry) => {
    const chapterExercises = exercises.filter((exercise) => !exercise.archived && exercise.chapter_id === entry.chapter.id);
    return {
      chapter: entry.chapter,
      subject: entry.chapter.subject,
      rate: entry.averageMastery,
      total: entry.total,
      mastered: entry.mastered,
      untouched: chapterExercises.filter((exercise) => exercise.attempts === 0 && exercise.last_worked_at === null).length,
    };
  });

  const started = rows.filter((row) => row.total > 0 && row.untouched < row.total);
  const never = rows.filter((row) => row.total > 0 && row.untouched === row.total);

  return {
    fragile: started.filter((row) => row.rate < CHAPTER_SOLID_RATE).sort((a, b) => a.rate - b.rate).slice(0, limit),
    solid: started.filter((row) => row.rate >= CHAPTER_SOLID_RATE).sort((a, b) => b.rate - a.rate).slice(0, limit),
    untouched: never.sort((a, b) => b.total - a.total).slice(0, limit),
  };
}
