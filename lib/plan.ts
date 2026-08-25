import { computeExerciseBankStats, estimatedDurationMinutes, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import { computeChaptersToConsolidate } from "@/lib/next-action";
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
 * Ce fichier n'ajoute qu'une seule chose que personne d'autre ne calcule :
 * COMBIEN DE TEMPS accorder à chaque intention pédagogique — consolider,
 * réviser, progresser (voir `computeDailyPlan`). Les priorités elles-mêmes
 * viennent de `computeChaptersToConsolidate` (lib/next-action.ts) et le choix
 * des exercices de `recommendExercises` : ce module n'en redéfinit aucun.
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

/**
 * INTENTION PÉDAGOGIQUE d'une partie du plan — pourquoi ce bloc existe.
 *
 * Ces trois intentions ne sont PAS un nouveau système de scoring : elles se
 * lisent directement dans les raisons que le moteur attache déjà à chaque
 * recommandation (voir `evaluateExercise`, lib/recommendation.ts). Le plan
 * ne décide donc rien par lui-même — il classe ce que le moteur a déjà
 * décidé, puis le projette sur le temps disponible.
 */
export type PlanIntent = "consolider" | "réviser" | "progresser";

export const PLAN_INTENT_META: Record<PlanIntent, { label: string; description: string }> = {
  consolider: { label: "Consolider", description: "Ce qui résiste encore" },
  réviser: { label: "Réviser", description: "Pour ne pas l'oublier" },
  progresser: { label: "Progresser", description: "Un cran au-dessus" },
};

/**
 * Classe une recommandation par intention, à partir de ses seules raisons.
 *
 * Ordre volontaire : une montée de palier prime (c'est le fait nouveau), puis
 * la révision d'un acquis qui s'effrite, et tout le reste — échecs, maîtrise
 * faible, réussites arrachées aux indices, jamais travaillé — relève de la
 * consolidation. C'est le cas par défaut, et c'est voulu : quand rien
 * d'autre ne se distingue, il faut réparer avant d'avancer.
 */
export function planIntent(reasons: string[]): PlanIntent {
  if (reasons.some((reason) => reason.startsWith("Palier suivant"))) return "progresser";
  if (reasons.some((reason) => reason.startsWith("Non retravaillé depuis") || reason === "Maîtrisé, jamais retravaillé")) return "réviser";
  return "consolider";
}

export interface PlanBlock {
  intent: PlanIntent;
  /** "Consolider" / "Réviser" / "Progresser" — voir `PLAN_INTENT_META`. */
  label: string;
  /** Ce que ce bloc fait travailler concrètement : les chapitres (ou matières, à défaut) réellement présents dans `picks`. */
  focus: string;
  /** Durée réelle des exercices retenus (lib/recommendation.ts#estimatedDurationMinutes). */
  estimatedMinutes: number;
  picks: ExerciseRecommendation[];
}

export interface DailyPlan {
  blocks: PlanBlock[];
  requestedMinutes: number;
  /** Somme de `estimatedMinutes` sur les blocs retenus — peut être < `requestedMinutes`. */
  totalMinutes: number;
  totalExercises: number;
}

/**
 * RÉPARTITION DU TEMPS PAR INTENTION — la structure d'une séance change avec
 * sa durée, elle ne fait pas que s'allonger.
 *
 * Vingt minutes ne sont pas « une séance de 90 min en plus court » : il n'y a
 * de place que pour réparer ce qui bloque. C'est en montant que la séance
 * peut s'offrir de l'entretien, puis de la progression. Les parts sont donc
 * données par PALIER de durée, pas par une règle proportionnelle unique.
 *
 * Une intention sans candidat ne gèle jamais son budget : le reliquat est
 * redistribué (voir `computeDailyPlan`), pour ne jamais rendre 20 minutes
 * de séance sur un budget de 60.
 */
const INTENT_MIX: { upTo: number; shares: Partial<Record<PlanIntent, number>> }[] = [
  // Séance courte : une seule intention. Diluer 20 min en trois blocs ne
  // produirait que des fragments trop courts pour être utiles.
  { upTo: 29, shares: { consolider: 1 } },
  // Séance moyenne : réparer, puis entretenir.
  { upTo: 59, shares: { consolider: 0.7, réviser: 0.3 } },
  // Séance longue : les trois intentions ont chacune la place d'exister.
  { upTo: 89, shares: { consolider: 0.55, réviser: 0.25, progresser: 0.2 } },
  // Séance très longue : plus de marge pour pousser vraiment le niveau.
  { upTo: Number.POSITIVE_INFINITY, shares: { consolider: 0.45, réviser: 0.25, progresser: 0.3 } },
];

function intentSharesFor(totalMinutes: number): Partial<Record<PlanIntent, number>> {
  return INTENT_MIX.find((entry) => totalMinutes <= entry.upTo)!.shares;
}

/** Ordre d'affichage ET de service : on répare avant d'entretenir, on entretient avant de pousser. */
const INTENT_ORDER: PlanIntent[] = ["consolider", "réviser", "progresser"];

/** Remplit un budget en piochant dans `candidates` (déjà ordonnés) sans jamais le dépasser — même règle gloutonne que `selectWithinBudget` (lib/recommendation.ts) : un exercice trop long est sauté, pas forcé. */
function fillBudget(
  candidates: ExerciseRecommendation[],
  sessions: WorkSession[],
  budgetMinutes: number,
  taken: Set<string>
): { picks: ExerciseRecommendation[]; used: number } {
  const picks: ExerciseRecommendation[] = [];
  let remaining = budgetMinutes;
  for (const candidate of candidates) {
    if (taken.has(candidate.exercise.id)) continue;
    const duration = estimatedDurationMinutes(candidate.exercise, sessions);
    if (duration > remaining) continue;
    picks.push(candidate);
    taken.add(candidate.exercise.id);
    remaining -= duration;
  }
  return { picks, used: budgetMinutes - remaining };
}

/** Les chapitres réellement travaillés par un bloc, dans l'ordre d'apparition — à défaut de chapitre assigné, la matière. Sert à dire ce que le bloc fait travailler, sans jamais l'inventer. */
function describeFocus(picks: ExerciseRecommendation[], chapterById: Map<string, Chapter>): string {
  const labels: string[] = [];
  for (const { exercise } of picks) {
    const label = (exercise.chapter_id && chapterById.get(exercise.chapter_id)?.label) || exercise.subject;
    if (!labels.includes(label)) labels.push(label);
  }
  // Au-delà de deux, on nomme les deux premiers et on compte le reste : une
  // énumération de cinq chapitres n'est plus lisible d'un coup d'œil.
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}`;
}

/**
 * "Plan du jour" — PROJECTION TEMPORELLE des priorités pédagogiques, et non
 * plus une répartition du temps entre matières.
 *
 * ## Ce qui a changé, et pourquoi
 * L'ancienne version allouait le budget par MATIÈRE (`allocateMinutesBySubject`,
 * via `subjectWeight`) puis appelait le moteur une fois par matière. Elle
 * constituait donc une seconde définition de « ce qu'il faut travailler »,
 * concurrente de celle qu'utilisaient déjà le Dashboard et la Progression
 * (`computeChaptersToConsolidate`) — deux réponses possibles à la même
 * question, avec la garantie qu'elles finiraient par diverger. Elle ignorait
 * surtout tout ce que le moteur avait appris depuis : difficulté adaptée,
 * indices, réussites assistées, échecs par chapitre.
 *
 * ## La source de vérité
 * `recommendExercises` reste l'UNIQUE décideur de « quel exercice ». Il est
 * appelé UNE fois, sur toute la banque active : la sélection hérite donc
 * telle quelle de la difficulté visée, du signal d'indices et de la
 * diversification matière/chapitre déjà éprouvées.
 *
 * `computeChaptersToConsolidate` (lib/next-action.ts) — la même fonction qui
 * alimente « À consolider » au Dashboard et « Tes priorités » sur
 * /progress — ne sert qu'à ORDONNER le bloc de consolidation : un exercice
 * appartenant au chapitre n°1 de l'élève passe avant les autres. C'est ce
 * qui rend le plan cohérent avec les deux autres écrans par construction,
 * sans dupliquer une ligne de leur logique.
 *
 * Le plan n'invente donc aucune priorité : il décide seulement COMBIEN DE
 * TEMPS accorder à chaque intention, ce qu'aucun autre module ne fait.
 */
export function computeDailyPlan(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], totalMinutes: number, now: Date = new Date()): DailyPlan {
  const active = exercises.filter((exercise) => !exercise.archived);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const empty: DailyPlan = { blocks: [], requestedMinutes: totalMinutes, totalMinutes: 0, totalExercises: 0 };
  if (totalMinutes <= 0 || active.length === 0) return empty;

  // UN SEUL appel au moteur, sur toute la banque : même ordre, même
  // diversification, même arbitrage de difficulté que partout ailleurs.
  const all = recommendExercises(active, sessions, active.length, { now });
  if (all.length === 0) return empty;

  // Rang du chapitre dans les priorités de l'élève — exactement celles
  // affichées par le Dashboard et /progress.
  const priorityRank = new Map<string, number>();
  computeChaptersToConsolidate(exercises, sessions, chapters, now).forEach((entry, index) => {
    priorityRank.set(entry.chapter.id, index);
  });

  const byIntent = new Map<PlanIntent, ExerciseRecommendation[]>(INTENT_ORDER.map((intent) => [intent, []]));
  for (const recommendation of all) {
    byIntent.get(planIntent(recommendation.reasons))!.push(recommendation);
  }

  // Dans le bloc de consolidation SEULEMENT, les chapitres prioritaires
  // passent devant. Tri stable : à rang égal, l'ordre du moteur (score +
  // diversification) est conservé tel quel.
  const NO_PRIORITY = Number.MAX_SAFE_INTEGER;
  byIntent.get("consolider")!.sort((a, b) => {
    const rankA = a.exercise.chapter_id ? priorityRank.get(a.exercise.chapter_id) ?? NO_PRIORITY : NO_PRIORITY;
    const rankB = b.exercise.chapter_id ? priorityRank.get(b.exercise.chapter_id) ?? NO_PRIORITY : NO_PRIORITY;
    return rankA - rankB;
  });

  const shares = intentSharesFor(totalMinutes);
  const taken = new Set<string>();
  const blocks: PlanBlock[] = [];
  let spent = 0;

  // Premier passage : chaque intention dans la limite de sa part.
  for (const intent of INTENT_ORDER) {
    const share = shares[intent];
    if (!share) continue;
    const { picks, used } = fillBudget(byIntent.get(intent)!, sessions, Math.round(totalMinutes * share), taken);
    if (picks.length === 0) continue;
    blocks.push({
      intent,
      label: PLAN_INTENT_META[intent].label,
      focus: describeFocus(picks, chapterById),
      estimatedMinutes: used,
      picks,
    });
    spent += used;
  }

  // Second passage : le temps qu'aucune intention n'a pu utiliser (candidats
  // épuisés, exercices trop longs) est rendu aux intentions déjà présentes,
  // en repartant de la plus prioritaire. Sans lui, un élève demandant 60 min
  // pouvait repartir avec 25 min de travail parce qu'une intention n'avait
  // rien à proposer.
  let leftover = totalMinutes - spent;
  if (leftover > 0) {
    for (const block of blocks) {
      if (leftover <= 0) break;
      const { picks, used } = fillBudget(byIntent.get(block.intent)!, sessions, leftover, taken);
      if (picks.length === 0) continue;
      block.picks.push(...picks);
      block.estimatedMinutes += used;
      block.focus = describeFocus(block.picks, chapterById);
      leftover -= used;
    }
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
 * `subjectWeight` — une vue par matière, complémentaire des priorités par
 * chapitre (`computeChaptersToConsolidate`) qui pilotent le plan. Contrairement au plan (qui n'inclut que les matières "éligibles",
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
  /**
   * D'où vient cette sélection déposée dans `PLAN_STORAGE_KEY` — deux origines
   * partagent aujourd'hui ce même mécanisme de transfert : le "Plan du jour"
   * du Dashboard (`computeDailyPlan`/`serializePlan`) et la "Séance libre"
   * depuis les filtres de la banque (`buildFreeSessionPlan`). SessionRunner
   * en a besoin uniquement pour adapter le texte de l'écran d'aperçu (titre,
   * description) — la mécanique de lecture/lancement de la séance est
   * strictement identique dans les deux cas. Optionnel et par défaut
   * `"plan-du-jour"` pour rester compatible avec d'éventuelles entrées
   * sessionStorage écrites avant l'introduction de ce champ.
   */
  source?: "plan-du-jour" | "libre";
}

/** Sérialise un `DailyPlan` pour la traversée Dashboard → /session — voir `PLAN_STORAGE_KEY`. */
export function serializePlan(plan: DailyPlan): StoredPlan {
  return {
    items: plan.blocks.flatMap((block) => block.picks.map(({ exercise, reasons }) => ({ exerciseId: exercise.id, reasons }))),
    requestedMinutes: plan.requestedMinutes,
    source: "plan-du-jour",
  };
}

/**
 * "Séance libre" (Phase 7 pédagogie) — l'élève a déjà choisi précisément quoi
 * travailler via les filtres de la banque (matière, chapitre, sous-thème,
 * difficulté…) ; cette fonction ne fait que transporter SA sélection, déjà
 * ordonnée, vers /session via le même mécanisme que `serializePlan`
 * (`PLAN_STORAGE_KEY`) — aucune recommandation recalculée, aucune règle de
 * `lib/recommendation.ts` dupliquée ou contournée. C'est délibérément la
 * fonction la plus simple possible : elle limite juste la sélection aux `limit`
 * premiers exercices (déjà dans l'ordre choisi par l'élève, ex. via le tri de
 * la banque) et fournit `requestedMinutes` pour que l'écran de reprise
 * affiche une durée cohérente avec cette sélection.
 */
export function buildFreeSessionPlan(exercises: Exercise[], sessions: WorkSession[], limit: number): StoredPlan {
  const picked = exercises.slice(0, limit);
  return {
    items: picked.map((exercise) => ({ exerciseId: exercise.id, reasons: ["Séance libre"] })),
    requestedMinutes: picked.reduce((sum, exercise) => sum + estimatedDurationMinutes(exercise, sessions), 0),
    source: "libre",
  };
}
