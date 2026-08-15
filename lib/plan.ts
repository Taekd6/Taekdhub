import { computeExerciseBankStats, estimatedDurationMinutes, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import { progressByChapter } from "@/lib/progress";
import { startOfWeek, weekBounds, weeklyTimeBySubject } from "@/lib/week";
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
 *
 * ## Échéance du concours (Sprint priorisation + sync + XP)
 * `preferences.contestDate` influence désormais `subjectWeight` — UNIQUEMENT
 * ici, jamais `lib/recommendation.ts#urgencyScore` (le score par exercice) :
 * `subjectWeight` alimente à la fois `allocateMinutesBySubject` (Plan du
 * jour) ET `computeSubjectPriorities` ("Priorités de la semaine"), donc un
 * seul point de branchement suffit à faire refléter l'échéance sur les deux
 * écrans. Ajouter le MÊME signal dans `urgencyScore` compterait deux fois la
 * même urgence (une fois sur "combien de temps pour cette matière", une
 * seconde fois sur "quel exercice dans cette matière") — voir
 * `contestUrgencyBonus` plus bas pour le détail du calcul.
 *
 * ## Échéance par matière (Sprint planification hebdomadaire adaptative)
 * `preferences.subjectDeadlines` (DS, colle, DM…) généralise `contestDate` à
 * l'échelle d'une matière — voir `subjectDeadlineDays`, qui réutilise
 * `daysUntilContest`/`contestUrgencyBonus` tels quels (même formule,
 * paramétrée par la date pertinente) : jamais une seconde échelle d'urgence.
 * Priorité explicite : une échéance spécifique à la matière REMPLACE
 * l'échéance globale POUR CETTE MATIÈRE (jamais les deux additionnées — ce
 * serait compter deux fois le même phénomène) ; les autres matières
 * continuent d'utiliser `contestDate`. Une matière sans aucune échéance
 * (ni spécifique, ni concours global) reste pleinement représentée par les
 * autres signaux (faiblesse, délaissement, échecs) — l'échéance n'est
 * jamais qu'un signal parmi d'autres, jamais le seul.
 *
 * ## Projection hebdomadaire (Sprint planification hebdomadaire adaptative)
 * `computeWeeklyProjection` répond à "sur les minutes qu'il me reste cette
 * semaine, combien pour chaque matière ?" — en réutilisant EXACTEMENT le
 * même allocateur que le Plan du jour (`allocateMinutesBySubject`), avec un
 * budget différent (le reste de `weeklyGoalMinutes`, pas une seule session).
 * Aucun deuxième moteur de pondération, aucun créneau horaire ni répartition
 * par jour — seulement un total par matière pour ce qu'il reste de la
 * semaine (voir sa doc pour le détail).
 *
 * ## Trajectoire par matière (Sprint trajectoire par matière)
 * `computeSubjectTrajectory` n'AJOUTE aucune décision : `subjectWeight`
 * décide déjà "combien de temps pour cette matière", ce nouveau signal se
 * contente d'EXPLIQUER cette décision (voir `recommendation.decide` /
 * `trajectory.explique` dans la doc du sprint). Généralise le principe déjà
 * utilisé par `lib/week.ts#computeWeeklyPace` (réalisé vs attendu
 * proportionnellement au temps écoulé dans la semaine) à l'échelle d'une
 * matière — sauf que la référence n'est jamais `weeklyGoalMinutes / 7
 * matières` (une division uniforme arbitraire), mais la "part équitable
 * actuelle" de cette matière telle que `subjectWeight` la voit déjà :
 * minutes déjà travaillées + minutes restantes allouées (voir
 * `WeeklyProjectionSubject.workedMinutes`, ajouté pour ce sprint). Comme
 * `computeWeeklyPace`, ce jugement est recalculé en entier à chaque appel à
 * partir de l'état ACTUEL — jamais une dette figée depuis lundi (voir la
 * doc de `computeSubjectTrajectory`).
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
 * Jours entiers avant `contestDate`, ou `null` si aucune date n'est
 * configurée (`""`, valeur par défaut de `Preferences.contestDate`) ou
 * invalide — dans les deux cas, comportement identique à "pas de concours".
 * Une date déjà passée ou aujourd'hui vaut 0, JAMAIS négatif : voir
 * `contestUrgencyBonus`, qui traite 0 comme l'urgence maximale plutôt que de
 * laisser une différence négative produire un bonus qui grandirait sans fin.
 */
export function daysUntilContest(contestDate: string, now: Date = new Date()): number | null {
  if (!contestDate) return null;
  const target = new Date(contestDate);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

/** 0-30 : même ordre de grandeur que `NEGLECT_CAP`/`FAILURE_CAP` — l'échéance ne doit jamais, à elle seule, écraser les autres signaux. */
const CONTEST_URGENCY_CAP = 30;
/**
 * Au-delà de cet horizon, l'échéance est trop lointaine pour changer quoi que
 * ce soit d'actionnable aujourd'hui (impact quasi nul) — même ordre de
 * grandeur que `MASTERY_STALE_DAYS` (lib/recommendation.ts), qui définit déjà
 * "à partir de quand un délai devient concret" ailleurs dans le produit.
 */
/** Exporté (Sprint planification hebdomadaire adaptative) pour que le Dashboard puisse n'afficher une annotation d'échéance ("← DS dans 3 j") que dans la même fenêtre où elle contribue réellement au poids — jamais un second seuil dupliqué côté UI. */
export const CONTEST_URGENCY_HORIZON_DAYS = 21;

/**
 * Bonus d'urgence lié au concours — délibérément proportionnel à la FAIBLESSE
 * de la matière (`averageMastery`), jamais un simple ajout uniforme : un
 * facteur uniforme appliqué à toutes les matières n'aurait aucun effet sur
 * `allocateMinutesBySubject` (qui répartit au PRORATA des poids — un facteur
 * commun s'annule dans le ratio). Ce n'est qu'en amplifiant davantage les
 * matières déjà faibles, à mesure que l'échéance approche, que le plan change
 * réellement de forme — cohérent avec l'intuition "moins de temps avant le
 * concours = corriger les points faibles en priorité", pas "travailler plus
 * partout à l'identique".
 *
 * Progressif (linéaire dans l'horizon, jamais un saut), borné (plafonné à
 * `CONTEST_URGENCY_CAP`), nul sans date configurée ou hors horizon — voir
 * `daysUntilContest` pour la gestion d'une date absente/invalide/passée.
 */
export function contestUrgencyBonus(averageMastery: number, contestDays: number | null): number {
  if (contestDays === null) return 0;
  const urgencyFactor = Math.max(0, Math.min(1, 1 - contestDays / CONTEST_URGENCY_HORIZON_DAYS));
  const weaknessFraction = Math.max(0, 100 - averageMastery) / 100;
  return urgencyFactor * weaknessFraction * CONTEST_URGENCY_CAP;
}

/**
 * Jours avant l'échéance PERTINENTE pour une matière donnée (Sprint
 * planification hebdomadaire adaptative) — l'échéance spécifique à la
 * matière (`subjectDeadlines`) si elle existe et est valide, sinon
 * l'échéance globale du concours (`contestDate`). Jamais les deux à la fois :
 * un seul nombre de jours résolu ICI, avant tout appel à
 * `contestUrgencyBonus`/`subjectWeight` — c'est ce qui garantit qu'aucun
 * double comptage n'est possible plus loin (il n'existe qu'un seul
 * `contestDays` à additionner, jamais deux termes séparés).
 *
 * Une échéance spécifique invalide (date corrompue) est traitée comme
 * absente pour CETTE matière — retombe alors sur `contestDate`, exactement
 * comme une matière qui n'a jamais eu d'échéance spécifique. Réutilise
 * `daysUntilContest` tel quel : même échelle, même gestion d'une date
 * absente/invalide/passée, jamais une seconde fonction de parsing de date.
 */
export function subjectDeadlineDays(subject: Subject, subjectDeadlines: Partial<Record<Subject, string>>, contestDate: string, now: Date): number | null {
  const specific = subjectDeadlines[subject];
  if (specific) {
    const specificDays = daysUntilContest(specific, now);
    if (specificDays !== null) return specificDays;
  }
  return daysUntilContest(contestDate, now);
}

/** Vrai si l'échéance effective d'une matière vient de `subjectDeadlines` (et non d'un repli sur `contestDate`) — sert uniquement à choisir le libellé le plus précis dans `computeSubjectPriorities` ("échéance proche" vs "concours proche"), jamais à changer un calcul. */
function hasSpecificSubjectDeadline(subject: Subject, subjectDeadlines: Partial<Record<Subject, string>>, now: Date): boolean {
  const specific = subjectDeadlines[subject];
  return Boolean(specific) && daysUntilContest(specific!, now) !== null;
}

/**
 * Poids d'urgence d'une matière pour la répartition du temps — même esprit
 * que `urgencyScore` (lib/recommendation.ts) mais à l'échelle d'une matière :
 * des termes indépendants, chacun plafonné, additionnés. Sert à la fois à
 * `allocateMinutesBySubject` (répartition du plan du jour) et à
 * `computeSubjectPriorities` (tri de "Priorités de la semaine") — un seul
 * calcul, deux lectures. `contestDays` (voir `daysUntilContest`) est un
 * paramètre séparé plutôt qu'un champ de `SubjectSignal` : ce n'est pas un
 * signal PROPRE à la matière (contrairement à `recentFailures`/`recentMinutes`),
 * juste un modulateur global appliqué à chaque matière selon sa propre
 * faiblesse — voir `contestUrgencyBonus`.
 */
export function subjectWeight(signal: SubjectSignal, contestDays: number | null = null): number {
  const weakness = (100 - signal.averageMastery) * WEAKNESS_WEIGHT;
  const neglect = Math.max(0, NEGLECT_CAP - (signal.recentMinutes / NEGLECT_REFERENCE_MINUTES) * NEGLECT_CAP);
  const failure = Math.min(FAILURE_CAP, signal.recentFailures * FAILURE_PER_UNIT);
  const contestUrgency = contestUrgencyBonus(signal.averageMastery, contestDays);
  return weakness + neglect + failure + contestUrgency;
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
 *
 * `contestDate`/`subjectDeadlines` (Sprint planification hebdomadaire
 * adaptative) : chaque matière résout SA PROPRE échéance effective via
 * `subjectDeadlineDays` avant d'appeler `subjectWeight` — jamais un seul
 * `contestDays` global appliqué à toutes (voir la doc en tête de fichier).
 * Réutilisée telle quelle par `computeDailyPlan` ET `computeWeeklyProjection`
 * (même allocateur, budget différent) — aucun deuxième moteur de pondération.
 */
function allocateMinutesBySubject(
  signals: SubjectSignal[],
  totalMinutes: number,
  contestDate: string,
  subjectDeadlines: Partial<Record<Subject, string>>,
  now: Date
): Map<Subject, number> {
  const pool = signals
    .filter((signal) => signal.eligible)
    .map((signal) => ({
      subject: signal.subject,
      weight: Math.max(MIN_ELIGIBLE_WEIGHT, subjectWeight(signal, subjectDeadlineDays(signal.subject, subjectDeadlines, contestDate, now))),
    }));
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
 *
 * `contestDate` (optionnel, `""` par défaut — comportement strictement
 * inchangé sans échéance configurée) influence UNIQUEMENT la répartition du
 * temps entre matières via `subjectWeight` — voir la note en tête de fichier.
 * `subjectDeadlines` (optionnel, `{}` par défaut — même garantie de
 * comportement inchangé) : échéance par matière, prioritaire sur `contestDate`
 * pour la matière concernée (voir `subjectDeadlineDays`).
 */
export function computeDailyPlan(
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  totalMinutes: number,
  now: Date = new Date(),
  contestDate: string = "",
  subjectDeadlines: Partial<Record<Subject, string>> = {}
): DailyPlan {
  const signals = computeSubjectSignals(exercises, sessions, now);
  const allocation = allocateMinutesBySubject(signals, totalMinutes, contestDate, subjectDeadlines, now);
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

/**
 * Phrase d'objectif d'un plan ("Consolider tes points faibles", etc.) —
 * dérivée des raisons déjà produites par `recommendExercises`
 * (lib/recommendation.ts), jamais une nouvelle catégorisation. Priorité aux
 * signaux les plus actionnables : un échec récent l'emporte toujours sur une
 * simple absence de travail, qui l'emporte elle-même sur du contenu jamais
 * abordé — dans cet ordre, du plus urgent au plus neutre.
 */
export function summarizePlanObjective(blocks: PlanBlock[]): string {
  const allReasons = blocks.flatMap((block) => block.picks.flatMap(({ reasons }) => reasons));
  if (allReasons.some((reason) => reason.includes("échec") || reason === "Échec récent")) return "Consolider tes points faibles";
  if (allReasons.some((reason) => reason.startsWith("Non retravaillé") || reason === "Maîtrisé, jamais retravaillé")) {
    return "Retravailler ce qui commence à s'effacer";
  }
  if (allReasons.some((reason) => reason === "Maîtrise faible")) return "Renforcer tes points faibles";
  if (allReasons.some((reason) => reason === "Jamais travaillé")) return "Avancer sur du nouveau contenu";
  return "Progresser sur tes priorités du moment";
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
export function computeSubjectPriorities(
  exercises: Exercise[],
  sessions: WorkSession[],
  chapters: Chapter[],
  now: Date = new Date(),
  contestDate: string = "",
  subjectDeadlines: Partial<Record<Subject, string>> = {}
): SubjectPriority[] {
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
      // Échéance effective de CETTE matière (spécifique si elle existe et est
      // valide, sinon le concours global) — voir `subjectDeadlineDays`.
      // N'affiche une raison que si l'échéance contribue RÉELLEMENT au poids
      // (voir `contestUrgencyBonus`) — jamais une mention générique
      // déconnectée de ce qui a effectivement changé le classement, une
      // matière déjà maîtrisée à 100% n'a rien à en tirer. Libellé distinct
      // ("échéance proche" vs "concours proche") selon la source réelle, pour
      // ne jamais laisser croire à un concours national quand c'est un DS.
      const deadlineDays = subjectDeadlineDays(signal.subject, subjectDeadlines, contestDate, now);
      if (contestUrgencyBonus(signal.averageMastery, deadlineDays) > 0) {
        reasons.push(hasSpecificSubjectDeadline(signal.subject, subjectDeadlines, now) ? "échéance proche" : "concours proche");
      }

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
        weight: subjectWeight(signal, deadlineDays),
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

export interface WeeklyProjectionSubject {
  subject: Subject;
  /** Minutes allouées sur le reste de la semaine pour cette matière — même allocateur que le Plan du jour (`allocateMinutesBySubject`), jamais un second calcul. */
  minutes: number;
  /** Minutes déjà travaillées cette semaine POUR CETTE MATIÈRE (voir `SubjectSignal.recentMinutes`) — ajouté (Sprint trajectoire par matière) pour que `computeSubjectTrajectory` puisse reconstituer la "part équitable actuelle" (`workedMinutes + minutes`) sans jamais relire `exercises`/`sessions` une seconde fois. */
  workedMinutes: number;
  /** Jours avant l'échéance ayant influencé ce poids (spécifique à la matière, sinon concours global) — voir `subjectDeadlineDays`. `null` si aucune échéance pertinente pour cette matière. */
  deadlineDays: number | null;
}

export interface WeeklyProjection {
  weeklyGoalMinutes: number;
  /** Minutes déjà travaillées cette semaine, toutes matières — même calcul que lib/week.ts#computeWeeklySummary (jamais une seconde définition de "temps travaillé cette semaine"). */
  workedMinutes: number;
  /** Toujours ≥ 0 — jamais négatif même si l'objectif est dépassé (voir Étape 10 du sprint). */
  remainingMinutes: number;
  /** Vrai dès que `workedMinutes` atteint ou dépasse `weeklyGoalMinutes` — à distinguer de `remainingMinutes === 0` uniquement pour la lisibilité de l'appelant (les deux sont équivalents ici). */
  met: boolean;
  /**
   * Jours restants dans la semaine, aujourd'hui inclus — PURE information de
   * contexte ("lundi ≠ vendredi", voir Étape 11 du sprint), n'influence
   * JAMAIS l'allocation elle-même : ce sprint ne construit pas de répartition
   * quotidienne, seulement un total par matière sur ce qu'il reste de la
   * semaine.
   */
  daysRemainingInWeek: number;
  /** Uniquement les matières qui reçoivent effectivement une allocation — une matière sans rien à proposer n'apparaît pas (même convention que `DailyPlan.blocks`), triées par minutes décroissantes. */
  bySubject: WeeklyProjectionSubject[];
}

/**
 * Projection hebdomadaire (Sprint planification hebdomadaire adaptative) —
 * répond à "sur les minutes qu'il me reste cette semaine, combien pour
 * chaque matière ?". Formule : `weeklyGoalMinutes` moins ce qui a déjà été
 * travaillé cette semaine (même calcul que `computeWeeklySummary`, pour ne
 * jamais diverger de la carte "Cette semaine" déjà affichée) donne les
 * minutes restantes, qui sont ensuite réparties par `allocateMinutesBySubject`
 * — EXACTEMENT le même allocateur que `computeDailyPlan`, avec un budget
 * différent. Aucun deuxième moteur de pondération : faiblesse, délaissement,
 * échecs et échéances restent les mêmes signaux, au même endroit.
 *
 * Ne produit AUCUN créneau horaire ni répartition par jour — seulement un
 * total par matière pour le reste de la semaine (voir `daysRemainingInWeek`,
 * purement informatif, jamais utilisé pour subdiviser l'allocation).
 */
export function computeWeeklyProjection(
  exercises: Exercise[],
  sessions: WorkSession[],
  weeklyGoalMinutes: number,
  now: Date = new Date(),
  contestDate: string = "",
  subjectDeadlines: Partial<Record<Subject, string>> = {}
): WeeklyProjection {
  // Même calcul que lib/week.ts#computeWeeklySummary (toutes matières, somme
  // en secondes avant conversion en minutes) — pour ne jamais diverger, même
  // de quelques minutes par arrondi, de ce qu'affiche déjà "Cette semaine".
  const workedSeconds = weeklyTimeBySubject(sessions, now).reduce((sum, entry) => sum + entry.seconds, 0);
  const workedMinutes = secondsToWholeMinutes(workedSeconds);
  const remainingMinutes = Math.max(0, weeklyGoalMinutes - workedMinutes);
  const met = weeklyGoalMinutes > 0 && remainingMinutes === 0;

  const signals = computeSubjectSignals(exercises, sessions, now);
  const allocation = allocateMinutesBySubject(signals, remainingMinutes, contestDate, subjectDeadlines, now);
  const bySubject = [...allocation.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => ({
      subject,
      minutes,
      workedMinutes: signals.find((signal) => signal.subject === subject)?.recentMinutes ?? 0,
      deadlineDays: subjectDeadlineDays(subject, subjectDeadlines, contestDate, now),
    }));

  const weekEnd = weekBounds(startOfWeek(now)).end;
  const daysRemainingInWeek = Math.max(1, Math.ceil((weekEnd.getTime() - now.getTime()) / 86400000));

  return { weeklyGoalMinutes, workedMinutes, remainingMinutes, met, daysRemainingInWeek, bySubject };
}

export type SubjectTrajectoryStatus = "dans le rythme" | "à renforcer" | "prioritaire";

export interface SubjectTrajectory {
  subject: Subject;
  status: SubjectTrajectoryStatus;
  /** Jours avant l'échéance effective de cette matière (même valeur que `WeeklyProjectionSubject.deadlineDays`, jamais recalculée) — `null` si aucune échéance pertinente. Un composant d'affichage peut choisir de la montrer ou non ; ce champ ne décide jamais lui-même du statut au-delà du seuil d'escalade déjà appliqué ci-dessous. */
  deadlineDays: number | null;
}

/** Même seuil que `computeWeeklyPace` (lib/week.ts) — ±15 points, volontairement large pour ne jamais signaler un simple décalage d'un jour comme un retard. Une seule définition de "retard significatif" dans tout le produit. */
const TRAJECTORY_PACE_THRESHOLD = 15;
/**
 * Au-delà de ce nombre de jours, une échéance ne fait plus passer un retard
 * de "à renforcer" à "prioritaire" — distinct de `CONTEST_URGENCY_HORIZON_DAYS`
 * (qui détermine si une échéance contribue encore au POIDS d'une matière,
 * jusqu'à 21 jours) : ici, on détermine seulement si elle est assez proche
 * pour justifier le niveau d'alerte le plus fort. Une échéance à 15 jours
 * peut légitimement augmenter le poids d'une matière (elle est dans
 * l'horizon des 21 jours) sans pour autant justifier "prioritaire" — voir
 * Cas A de la doc du sprint ("pas d'alarme forte").
 */
const TRAJECTORY_URGENT_DEADLINE_DAYS = 7;

/**
 * Trajectoire par matière (Sprint trajectoire par matière) — généralise
 * `lib/week.ts#computeWeeklyPace` (réalisé vs attendu proportionnellement au
 * temps écoulé dans la semaine) à l'échelle d'une matière. Consomme
 * UNIQUEMENT `WeeklyProjection.bySubject` (déjà calculé par
 * `computeWeeklyProjection`) : aucun second calcul de poids, aucune relecture
 * de `exercises`/`sessions`.
 *
 * La référence n'est jamais une division uniforme de `weeklyGoalMinutes` —
 * c'est la "part équitable actuelle" de la matière telle que `subjectWeight`
 * la voit déjà : minutes déjà travaillées + minutes restantes allouées
 * (`workedMinutes + minutes`). Comparer le pourcentage déjà réalisé de cette
 * part au pourcentage attendu pour le jour de la semaine actuel (même
 * formule que `computeWeeklyPace`) donne un jugement de trajectoire cohérent
 * avec les priorités déjà calculées, jamais une formule arbitraire
 * indépendante.
 *
 * Aucune dette historique : recalculé en entier à chaque appel à partir de
 * l'état ACTUEL (comme `computeWeeklyPace`) — il n'existe et ne doit jamais
 * exister de notion de "ce qui était prévu lundi". `[]` avant mercredi (< 2
 * jours écoulés depuis lundi) — même garde que `computeWeeklyPace`, trop tôt
 * dans la semaine pour qu'un écart signifie quoi que ce soit.
 *
 * Trois états, jamais un score visible : "dans le rythme" (y compris en
 * avance — jamais signalé différemment, ce n'est jamais un problème),
 * "à renforcer" (retard significatif), "prioritaire" (retard significatif
 * ET échéance proche — voir `TRAJECTORY_URGENT_DEADLINE_DAYS`). Une échéance
 * proche SANS retard ne fait jamais monter le statut : `deadlineDays` reste
 * disponible pour l'affichage ("Dans le rythme · échéance dans 3 j"), mais
 * n'escalade jamais un statut à lui seul (voir Cas C de la doc du sprint).
 */
export function computeSubjectTrajectory(bySubject: WeeklyProjectionSubject[], now: Date = new Date()): SubjectTrajectory[] {
  const daysElapsed = Math.floor((now.getTime() - startOfWeek(now).getTime()) / 86400000);
  if (daysElapsed < 2) return [];

  const expectedPercent = Math.min(100, Math.round((Math.min(daysElapsed, 7) / 7) * 100));

  return bySubject.map(({ subject, minutes, workedMinutes, deadlineDays }) => {
    const fairShare = workedMinutes + minutes;
    const subjectPercent = fairShare > 0 ? Math.min(100, Math.round((workedMinutes / fairShare) * 100)) : 100;
    const delta = subjectPercent - expectedPercent;
    const isBehind = delta <= -TRAJECTORY_PACE_THRESHOLD;
    const isUrgentDeadline = deadlineDays !== null && deadlineDays <= TRAJECTORY_URGENT_DEADLINE_DAYS;

    const status: SubjectTrajectoryStatus = isBehind ? (isUrgentDeadline ? "prioritaire" : "à renforcer") : "dans le rythme";

    return { subject, status, deadlineDays };
  });
}
