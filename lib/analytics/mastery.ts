import { progressByChapter, type ChapterProgress } from "@/lib/progress";
import { computeTrend, type Trend } from "@/lib/analytics/trend";
import type { Chapter, WeekSnapshot } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

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
    trend: // 0 % de fiches maîtrisées est une mesure : la matière a été observée, rien n’y est encore acquis.
    computeTrend(withCurrent.map((point) => point.rate), { absoluteNoise: 1, zeroIsMeasurement: true }),
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
  /** Le verdict partagé avec l'accueil, avec ses raisons — voir `assessChapter`. */
  assessment: ChapterAssessment;
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

/** Fenêtre de tentatives examinées à l'échelle d'un chapitre — plus large que pour un exercice isolé, puisqu'elle se répartit sur plusieurs fiches. */
export const CHAPTER_RECENT_ATTEMPTS = 5;
/** Au-delà, un chapitre encore incomplet et non retravaillé mérite d'être signalé. */
export const CHAPTER_STALE_DAYS = 7;
/** Au-delà de ce nombre d'indices, une réussite cesse d'être une preuve d'autonomie — même seuil que le moteur de recommandation. */
const ASSISTED_HINTS = 2;

export interface ChapterAssessment {
  /** Pourquoi ce chapitre mérite de l'attention — vide quand il n'y a rien à dire. */
  reasons: string[];
  /** `true` dès qu'au moins une raison existe. */
  fragile: boolean;
  /** Tentatives notées examinées, pour que le verdict soit contestable. */
  attempts: number;
  /** Ancienneté de la plus récente tentative examinée, en jours — `null` si aucune. */
  sinceDays: number | null;
}

/**
 * LE VERDICT SUR UN CHAPITRE — une seule définition, pour toute l'application.
 *
 * Il y en avait DEUX, et elles se contredisaient à l'écran :
 *
 *   — l'accueil signalait « à consolider » sur `averageMastery < 50`, les
 *     échecs récents, les réussites arrachées aux indices et l'ancienneté ;
 *   — les hubs rangeaient en « acquis » tout chapitre au-dessus de 70 %, sans
 *     rien regarder d'autre.
 *
 * Un chapitre à 75 % avec deux échecs récents était donc « à consolider » sur
 * l'accueil ET « acquis » dans le hub, le même jour. Reproduit, puis fermé
 * ici : les deux écrans lisent désormais cette fonction.
 *
 * Le seuil retenu est 70 % (`CHAPTER_SOLID_RATE`), le plus exigeant des deux —
 * on ne relâche pas une exigence pour faire converger deux calculs.
 *
 * Fonction pure.
 */
export function assessChapter(
  chapterExercises: Exercise[],
  sessions: WorkSession[],
  averageMastery: number,
  now: Date = new Date()
): ChapterAssessment {
  const reasons: string[] = [];
  if (averageMastery < CHAPTER_SOLID_RATE) reasons.push("Maîtrise encore faible");

  const ids = new Set(chapterExercises.map((exercise) => exercise.id));
  const recent = sessions
    .filter((session) => session.exercise_id && ids.has(session.exercise_id) && session.result)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, CHAPTER_RECENT_ATTEMPTS);

  const failures = recent.filter((attempt) => attempt.result === "échoué").length;
  if (failures >= 2) reasons.push(`${failures} échecs récents`);
  else if (recent[0]?.result === "échoué") reasons.push("Échec récent");

  // Un élève qui ne s'en sort qu'aidé, exercice après exercice, révèle une
  // fragilité que ni `result` (il a « réussi ») ni `mastery` (qu'il a pu
  // monter lui-même) ne montrent.
  const assisted = recent.filter(
    (attempt) => attempt.result === "réussi" && attempt.hints_used !== null && attempt.hints_used >= ASSISTED_HINTS
  ).length;
  if (assisted >= 2) reasons.push(`${assisted} réussites avec indices`);

  const partial = recent.filter((attempt) => attempt.result === "partiel").length;
  if (partial >= 2) reasons.push(`${partial} exercices à moitié traités`);

  const lastWorked = chapterExercises
    .map((exercise) => exercise.last_worked_at)
    .filter((value): value is string => value !== null)
    .map((value) => new Date(value).getTime())
    .filter((time) => !Number.isNaN(time));
  // L'ancienneté ne vaut que pour un chapitre ENCORE INCOMPLET (voir
  // `CHAPTER_STALE_DAYS`) : un chapitre entièrement maîtrisé n'a rien à
  // consolider, et le laisser reposer n'est pas une faiblesse. Avant la
  // fusion des deux verdicts, l'accueil l'excluait en amont
  // (`completionRate < 100`) ; les hubs, eux, le déclaraient « fragile »
  // sept jours après sa dernière révision.
  const incomplete = chapterExercises.some((exercise) => exercise.status !== "maîtrisé");
  if (incomplete && lastWorked.length > 0) {
    const days = Math.floor((now.getTime() - Math.max(...lastWorked)) / 86400000);
    if (days >= CHAPTER_STALE_DAYS) reasons.push(`Non travaillé depuis ${days} j`);
  }

  const oldest = recent[recent.length - 1];
  return {
    reasons,
    fragile: reasons.length > 0,
    attempts: recent.length,
    sinceDays: oldest ? Math.max(0, Math.floor((now.getTime() - new Date(oldest.started_at).getTime()) / 86400000)) : null,
  };
}

/**
 * Le tableau des chapitres, rangé par ce qu'il y a à en faire.
 *
 * TROIS GROUPES, et le troisième est le plus important : un chapitre où
 * aucun exercice n'a jamais été travaillé n'est PAS un chapitre faible,
 * c'est un chapitre non mesuré. Les confondre remplirait la liste des
 * « points faibles » de tout le programme de l'année dès la première
 * ouverture, et la rendrait inutilisable.
 */
export function computeChapterMastery(
  exercises: Exercise[],
  chapters: Chapter[],
  limit = 5,
  sessions: WorkSession[] = [],
  now: Date = new Date()
): ChapterMasteryBoard {
  const rows: ChapterMasteryRow[] = progressByChapter(exercises, chapters).map((entry) => {
    const chapterExercises = exercises.filter((exercise) => !exercise.archived && exercise.chapter_id === entry.chapter.id);
    return {
      chapter: entry.chapter,
      subject: entry.chapter.subject,
      rate: entry.averageMastery,
      total: entry.total,
      mastered: entry.mastered,
      untouched: chapterExercises.filter((exercise) => exercise.attempts === 0 && exercise.last_worked_at === null).length,
      // Le MÊME verdict que celui de l'accueil — voir `assessChapter`. Sans
      // les séances, il se réduit au seuil de maîtrise, ce qui reste
      // strictement l'ancien comportement : aucun appelant ne régresse.
      assessment: assessChapter(chapterExercises, sessions, entry.averageMastery, now),
    };
  });

  const started = rows.filter((row) => row.total > 0 && row.untouched < row.total);
  const never = rows.filter((row) => row.total > 0 && row.untouched === row.total);

  return {
    fragile: started.filter((row) => row.assessment.fragile).sort((a, b) => a.rate - b.rate).slice(0, limit),
    solid: started.filter((row) => !row.assessment.fragile).sort((a, b) => b.rate - a.rate).slice(0, limit),
    untouched: never.sort((a, b) => b.total - a.total).slice(0, limit),
  };
}
