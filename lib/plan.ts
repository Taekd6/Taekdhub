import { diversifyByChapter, estimatedDurationMinutes, recommendExercises, type ExerciseRecommendation } from "@/lib/recommendation";
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
  taken: Set<string>,
  /** Nombre maximum d'exercices à retenir — sert au rattrapage des intentions vides, qui accorde UNE place, pas tout le reliquat (voir `computeDailyPlan`). */
  maxPicks = Number.POSITIVE_INFINITY
): { picks: ExerciseRecommendation[]; used: number } {
  const picks: ExerciseRecommendation[] = [];
  let remaining = budgetMinutes;
  for (const candidate of candidates) {
    if (picks.length >= maxPicks) break;
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
  // passent devant — puis on REDIVERSIFIE.
  //
  // Le tri par rang seul regroupait tous les exercices du chapitre n°1, puis
  // ceux du n°2, etc. : il annulait la diversification matière/chapitre que
  // `recommendExercises` venait d'appliquer. Mesuré sur la vraie banque, en
  // rejouant 14 jours pendant lesquels l'élève fait ce qu'on lui propose :
  // le jour 1 était bien réparti (maths · physique · chimie), et à partir du
  // jour 2 chaque séance ne contenait plus qu'UN seul chapitre. Pour un élève
  // qui ne maîtrise pas du premier coup, cela donnait « Nombres complexes »
  // quatorze jours d'affilée — 41 exercices de maths pour 4 de physique et 4
  // de chimie sur deux semaines, alors qu'il a des DS dans les trois matières.
  //
  // Le rang décide donc QUI MÈNE, la diversification décide de l'étalement :
  // `diversifyByChapter` est la fonction du moteur elle-même, pas une seconde
  // règle de répartition.
  const NO_PRIORITY = Number.MAX_SAFE_INTEGER;
  const byPriority = [...byIntent.get("consolider")!].sort((a, b) => {
    const rankA = a.exercise.chapter_id ? priorityRank.get(a.exercise.chapter_id) ?? NO_PRIORITY : NO_PRIORITY;
    const rankB = b.exercise.chapter_id ? priorityRank.get(b.exercise.chapter_id) ?? NO_PRIORITY : NO_PRIORITY;
    return rankA - rankB;
  });
  byIntent.set("consolider", diversifyByChapter(byPriority));

  // GARANTIE (audit moteur — mesuré sur un profil réel, pas seulement
  // théorique) : l'exercice le plus urgent du bloc de consolidation —
  // `byPriority[0]`, donc du chapitre le plus prioritaire, à score égal le
  // plus élevé — ne doit jamais disparaître du plan à cause d'une pure
  // fragmentation de budget entre intentions.
  //
  // Avant cette garantie : un élève qui venait d'échouer deux fois sur son
  // chapitre le plus faible (Nombres complexes) voyait son exercice le plus
  // urgent (score 110, 35 min — un exercice réellement plus long que la
  // moyenne) totalement absent d'un plan de 45 min, remplacé par trois
  // exercices "jamais travaillé" sans aucun rapport (Physique, Chimie,
  // Informatique TC, score ~96 chacun). Cause : la part réservée à
  // "consolider" (≈70 % de 45 min, soit 32 min) ne suffisait pas à elle
  // seule pour ces 35 min ; le reliquat qui la complète ensuite (lignes
  // plus bas) ne recevait plus, à son tour, que quelques minutes — jamais
  // les 35 d'un coup. Deux fragments trop petits pris séparément, alors que
  // le budget TOTAL du jour, lui, aurait très bien accueilli l'exercice.
  //
  // Réservé ICI, avant toute répartition par intention, avec sa propre
  // durée déduite du budget total disponible — jamais en plus.
  const mostUrgent = byPriority[0];
  const mostUrgentMinutes = mostUrgent ? estimatedDurationMinutes(mostUrgent.exercise, sessions) : 0;
  const reserveUrgent = mostUrgent !== undefined && mostUrgentMinutes > 0 && mostUrgentMinutes <= totalMinutes;

  const shares = intentSharesFor(totalMinutes);
  const taken = new Set<string>();
  if (reserveUrgent) taken.add(mostUrgent!.exercise.id);
  const blocks: PlanBlock[] = [];
  let spent = reserveUrgent ? mostUrgentMinutes : 0;

  // Premier passage : chaque intention dans la limite de sa part — la part
  // de "consolider" est réduite de la réservation ci-dessus (jamais en
  // plus, jamais négative).
  for (const intent of INTENT_ORDER) {
    const share = shares[intent];
    if (!share) continue;
    const rawBudget = Math.round(totalMinutes * share);
    const budget = intent === "consolider" && reserveUrgent ? Math.max(0, rawBudget - mostUrgentMinutes) : rawBudget;
    const { picks, used } = fillBudget(byIntent.get(intent)!, sessions, budget, taken);
    const blockPicks = intent === "consolider" && reserveUrgent ? [mostUrgent!, ...picks] : picks;
    if (blockPicks.length === 0) continue;
    const blockMinutes = intent === "consolider" && reserveUrgent ? used + mostUrgentMinutes : used;
    blocks.push({
      intent,
      label: PLAN_INTENT_META[intent].label,
      focus: describeFocus(blockPicks, chapterById),
      estimatedMinutes: blockMinutes,
      picks: blockPicks,
    });
    spent += used;
  }

  // Second passage : le temps qu'aucune intention n'a pu utiliser (candidats
  // épuisés, exercices trop longs) est redistribué — EN DEUX TEMPS, et
  // l'ordre compte.
  //
  // (a) D'abord les intentions que le mix prévoyait mais qui sont restées
  //     VIDES. Un exercice dure 15 à 30 minutes ; une part de 25 % sur 60
  //     minutes vaut 15 minutes, soit moins que le premier candidat venu.
  //     Ces intentions-là ne perdaient pas quelques minutes : elles
  //     disparaissaient entièrement, et le reliquat repartait au bloc de
  //     consolidation déjà servi. Résultat mesuré avant ce correctif : à 45
  //     comme à 60 minutes, le plan était 100 % consolidation — la structure
  //     annoncée par `INTENT_MIX` n'existait qu'à partir de 90 minutes.
  //     Quand le mix dit qu'il faut aussi réviser, une révision doit tenir
  //     dans le plan, quitte à ne pas respecter la proportion au pourcentage
  //     près : c'est la structure qui porte le sens, pas l'arrondi.
  //
  // (b) Ensuite seulement, on complète les blocs déjà servis, pour ne pas
  //     rendre 25 minutes de séance sur un budget de 60.
  let leftover = totalMinutes - spent;

  const addTo = (intent: PlanIntent, budget: number, maxPicks?: number): number => {
    const { picks, used } = fillBudget(byIntent.get(intent)!, sessions, budget, taken, maxPicks);
    if (picks.length === 0) return 0;
    const existing = blocks.find((block) => block.intent === intent);
    if (existing) {
      existing.picks.push(...picks);
      existing.estimatedMinutes += used;
      existing.focus = describeFocus(existing.picks, chapterById);
    } else {
      blocks.push({ intent, label: PLAN_INTENT_META[intent].label, focus: describeFocus(picks, chapterById), estimatedMinutes: used, picks });
    }
    return used;
  };

  for (const intent of INTENT_ORDER) {
    if (leftover <= 0) break;
    if (!shares[intent]) continue;
    if (blocks.some((block) => block.intent === intent)) continue;
    // UN exercice, pas tout le reliquat : le rattrapage sert à faire exister
    // l'intention, pas à lui donner la place que le mix accordait aux autres.
    // Sans ce plafond, une révision rattrapée sur 60 minutes emportait les 40
    // minutes restantes et repassait devant la consolidation — l'inverse
    // exact de ce que le mix annonce.
    leftover -= addTo(intent, leftover, 1);
  }

  for (const intent of [...blocks].map((block) => block.intent)) {
    if (leftover <= 0) break;
    leftover -= addTo(intent, leftover);
  }

  // Les blocs ajoutés au (a) l'ont été après coup : on rétablit l'ordre de
  // service (réparer, puis entretenir, puis pousser).
  blocks.sort((a, b) => INTENT_ORDER.indexOf(a.intent) - INTENT_ORDER.indexOf(b.intent));

  return {
    blocks,
    requestedMinutes: totalMinutes,
    totalMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    totalExercises: blocks.reduce((sum, block) => sum + block.picks.length, 0),
  };
}

/**
 * Durées proposées pour le plan du jour.
 *
 * Une valeur par PALIER de `INTENT_MIX`, sinon les paliers ne sont pas
 * atteignables : avec les anciens préréglages (30/45/60), le palier « une
 * seule intention » (≤ 29 min) et le palier « séance très longue » (> 89 min)
 * n'existaient que dans le code. 20 min répond vraiment à « je n'ai qu'un
 * quart d'heure », 90 min à une vraie plage de travail.
 */
export const PLAN_DURATION_PRESETS = [20, 45, 60, 90] as const;
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

/**
 * Reconstruit une sélection utilisable (`ExerciseRecommendation[]`) à partir
 * d'un `StoredPlan` déposé en sessionStorage — l'opération inverse de
 * `serializePlan`/`buildFreeSessionPlan`. Un exercice supprimé ou archivé
 * depuis le dépôt du plan est silencieusement ignoré, jamais une erreur : le
 * plan a pu être déposé il y a un moment, la banque a pu changer entre-temps.
 *
 * Fonction PURE, volontairement séparée de la lecture/suppression de
 * `sessionStorage` (qui reste la responsabilité de `SessionRunner`) — un même
 * `StoredPlan` redonne toujours exactement la même sélection, quel que soit
 * le nombre de fois où cette fonction est appelée. C'est précisément cette
 * propriété qui a permis de corriger, sans risque de régression, un bug
 * produit réel : une navigation client vers /session pouvait monter
 * `SessionRunner` deux fois de suite (comportement Next.js général de cette
 * app), et un retrait de la clé sessionStorage dès la première lecture
 * faisait perdre le plan avant que le second montage — celui qui s'affiche
 * réellement — ait pu le lire à son tour. La clé n'est désormais retirée
 * qu'au moment réel de consommation (clic sur "Commencer ma séance"), jamais
 * à la lecture — voir `SessionRunner`.
 */
export function resolveStoredPlan(stored: StoredPlan, exercises: Exercise[]): ExerciseRecommendation[] {
  return stored.items
    .map(({ exerciseId, reasons }) => {
      const exercise = exercises.find((item) => item.id === exerciseId && !item.archived);
      return exercise ? { exercise, score: 0, reasons } : null;
    })
    .filter((item): item is ExerciseRecommendation => item !== null);
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
