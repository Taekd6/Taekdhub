import { estimatedDurationMinutes, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
import { computeChaptersToConsolidate } from "@/lib/next-action";
import type { Chapter } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * "Plan du jour" — ce module n'apporte QU'UNE chose que personne d'autre ne
 * calcule : COMBIEN DE TEMPS accorder à chaque intention pédagogique
 * (consolider, réviser, progresser), en fonction de la durée disponible.
 *
 * Il ne décide aucune priorité :
 * - `recommendExercises` (lib/recommendation.ts) reste l'UNIQUE décideur de
 *   "quel exercice, dans quel ordre" — appelé UNE fois sur toute la banque ;
 * - `computeChaptersToConsolidate` (lib/next-action.ts) reste l'UNIQUE
 *   définition de "quels chapitres sont prioritaires" — la même qui alimente
 *   "À consolider" (Dashboard) et "Tes priorités" (/progress).
 *
 * Il n'a plus aucune notion de matière. L'ancien `subjectWeight` — un
 * troisième score maison qui pondérait les matières — a été supprimé avec son
 * dernier consommateur ("Priorités de la semaine") : deux définitions
 * concurrentes de "ce qu'il faut travailler" finissent toujours par diverger,
 * et c'est à l'élève que la contradiction coûte.
 */

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
 * via un poids par matière maison) puis appelait le moteur une fois par
 * matière. Elle
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
