import { countsAsAttempt, estimatedDurationMinutes, isAutonomousSuccess } from "@/lib/recommendation";
import type { StoredPlan } from "@/lib/plan";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * LE GRAIN NOTION — la couche que la banque portait déjà sans que rien ne la lise.
 *
 * Tout le produit raisonne au grain du CHAPITRE : `computeChaptersToConsolidate`
 * (lib/next-action.ts), `progressByChapter` (lib/progress.ts), la
 * diversification du moteur (`diversifyByChapter`, lib/recommendation.ts).
 * C'est le bon grain pour organiser une séance — c'est le mauvais grain pour
 * répondre à « pourquoi je bloque ».
 *
 * `Exercise.prerequisites` porte depuis toujours une information beaucoup
 * plus fine : les NOTIONS réellement nécessaires pour résoudre l'exercice
 * (« développements limités usuels », « théorème du rang », « tableau
 * d'avancement »). L'audit de la banque a montré qu'elle est renseignée sur
 * 432 des 434 fiches actives, et surtout : 73 notions traversent PLUSIEURS
 * chapitres, 14 traversent plusieurs MATIÈRES. « équation caractéristique »
 * vit à la fois en Mathématiques et en Physique ; « intégration » dans trois
 * matières. Aucun écran raisonnant par chapitre ne peut voir ça — par
 * construction, pas par oubli.
 *
 * Ce module lit cette donnée, et rien d'autre. Il n'invente aucun signal :
 * - la STRUCTURE vient de `Exercise.prerequisites` (ce que la banque déclare) ;
 * - la PREUVE vient de `WorkSession.result` et `WorkSession.hints_used` (ce
 *   que l'élève a réellement fait), exactement les deux mêmes champs que
 *   `lib/recommendation.ts` utilise déjà pour son niveau de confort.
 *
 * ## Règle d'honnêteté, non négociable
 * Une notion sans tentative qualifiée est « jamais testée » — jamais
 * « faible », jamais « à revoir ». L'absence de preuve n'est pas une preuve :
 * c'est le même principe que `comfortDifficulty`, qui renvoie `null` tant
 * qu'il n'a pas assez d'historique plutôt que d'inventer un niveau. Et
 * `hints_used === null` (séance antérieure au champ) n'est JAMAIS compté
 * comme une réussite autonome, pour la raison déjà documentée sur le champ
 * lui-même : cela créditerait rétroactivement une autonomie jamais observée.
 *
 * ## Ce que ce module ne fait pas
 * Il ne touche ni `recommendExercises`, ni `computeDailyPlan`, ni
 * `computeNextAction` : aucune règle de recommandation n'est modifiée ni
 * dupliquée. Pour proposer une séance ciblée, il réutilise `StoredPlan`
 * (lib/plan.ts) — le mécanisme de transfert déjà employé par le Plan du jour
 * et la Séance libre — et `estimatedDurationMinutes` pour la durée. Le grain
 * notion sert à COMPRENDRE et à CIBLER ; le grain chapitre continue de
 * décider de la séance ordinaire.
 */

/** Deux réussites autonomes pour déclarer une notion acquise — une seule peut être un coup de chance sur un exercice bien tombé. */
export const NOTION_SOLID_AUTONOMOUS = 2;
/** Deux échecs pour parler de difficulté réelle — un échec isolé est un accident de séance, pas un diagnostic. */
export const NOTION_STRUGGLING_FAILURES = 2;
/**
 * Une cause racine doit relier au moins deux exercices DISTINCTS échoués.
 * Une notion citée par un seul échec n'explique rien : elle partage cet échec
 * avec toutes les autres notions du même exercice, sans qu'aucune ne se
 * distingue.
 */
export const ROOT_CAUSE_MIN_FAILED_EXERCISES = 2;
/**
 * Fenêtre d'analyse des échecs, en nombre de tentatives qualifiées les plus
 * récentes — même esprit que `COMFORT_WINDOW` (lib/recommendation.ts) : on
 * diagnostique sur l'élève d'aujourd'hui, pas sur celui d'il y a six mois.
 */
export const ROOT_CAUSE_WINDOW = 12;

export type NotionState = "solide" | "fragile" | "en difficulté" | "jamais testée";

export const NOTION_STATE_META: Record<NotionState, { label: string; badge: "success" | "warning" | "danger" | "default" }> = {
  solide: { label: "Solide", badge: "success" },
  fragile: { label: "Fragile", badge: "warning" },
  "en difficulté": { label: "En difficulté", badge: "danger" },
  "jamais testée": { label: "Jamais testée", badge: "default" },
};

/** Ce que la BANQUE déclare d'une notion — indépendant de l'élève. */
export interface NotionReach {
  notion: string;
  /** Exercices actifs qui déclarent cette notion en prérequis. */
  exercises: Exercise[];
  /** Identifiants de chapitre couverts (hors exercices sans chapitre). */
  chapterIds: string[];
  subjects: Subject[];
  /** `true` dès que la notion dépasse un seul chapitre — c'est exactement ce qu'un écran par chapitre ne peut pas montrer. */
  crossesChapters: boolean;
  /** `true` quand la notion vit dans plusieurs matières (ex. « équation caractéristique » : Maths et Physique). */
  crossesSubjects: boolean;
}

/** Ce que l'ÉLÈVE a réellement démontré sur une notion — que des faits comptés. */
export interface NotionEvidence extends NotionReach {
  /** Tentatives avec résultat sur les exercices de cette notion (toutes périodes). */
  attempts: number;
  /** Réussites sans aide décisive — `hints_used` connu ET sous le seuil (voir `ASSISTED_HINTS_THRESHOLD`). */
  autonomousSuccesses: number;
  /** Réussites obtenues avec au moins `ASSISTED_HINTS_THRESHOLD` indices, ou dont l'aide est inconnue. */
  assistedSuccesses: number;
  failures: number;
  state: NotionState;
  /** Exercices distincts échoués dans la fenêtre récente — la preuve citable d'une difficulté. */
  recentlyFailedExercises: Exercise[];
}

/** Résultat d'une tentative rattachée à son exercice — brique interne partagée. */
interface QualifiedAttempt {
  session: WorkSession;
  exercise: Exercise;
}

/**
 * Tentatives réellement exploitables : une séance qui COMPTE comme tentative
 * (voir `countsAsAttempt`, la définition partagée), rattachée à un exercice
 * encore présent dans la banque, les plus récentes d'abord. Une séance libre
 * sans exercice, une séance pointant un exercice supprimé, ou une séance de
 * moins d'une minute n'apprennent rien sur une notion.
 */
function qualifiedAttempts(exercises: Exercise[], sessions: WorkSession[]): QualifiedAttempt[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return sessions
    .filter((session) => countsAsAttempt(session) && byId.has(session.exercise_id!))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .map((session) => ({ session, exercise: byId.get(session.exercise_id!)! }));
}

/** Notions déclarées par un exercice, dédoublonnées et nettoyées — une même notion citée deux fois ne compte qu'une. */
function notionsOf(exercise: Exercise): string[] {
  return [...new Set(exercise.prerequisites.map((notion) => notion.trim()).filter(Boolean))];
}

/**
 * Index notion → portée dans la banque ACTIVE. Les exercices archivés sont
 * exclus : ils ne sont proposés par aucun moteur, une notion qui n'existerait
 * que sur eux serait inatteignable et n'aurait rien à faire sur une carte
 * censée décrire le travail possible.
 *
 * Trié par nombre d'exercices décroissant, puis alphabétiquement — ordre
 * déterministe : la carte ne doit jamais se réorganiser d'un rendu à l'autre.
 */
export function buildNotionIndex(exercises: Exercise[]): NotionReach[] {
  const byNotion = new Map<string, { exercises: Exercise[]; chapterIds: Set<string>; subjects: Set<Subject> }>();

  for (const exercise of exercises) {
    if (exercise.archived) continue;
    for (const notion of notionsOf(exercise)) {
      let entry = byNotion.get(notion);
      if (!entry) {
        entry = { exercises: [], chapterIds: new Set(), subjects: new Set() };
        byNotion.set(notion, entry);
      }
      entry.exercises.push(exercise);
      if (exercise.chapter_id) entry.chapterIds.add(exercise.chapter_id);
      entry.subjects.add(exercise.subject);
    }
  }

  return [...byNotion]
    .map(([notion, entry]) => ({
      notion,
      exercises: entry.exercises,
      chapterIds: [...entry.chapterIds],
      subjects: [...entry.subjects],
      crossesChapters: entry.chapterIds.size > 1,
      crossesSubjects: entry.subjects.size > 1,
    }))
    .sort((a, b) => b.exercises.length - a.exercises.length || a.notion.localeCompare(b.notion, "fr"));
}

/**
 * Classe une notion à partir de ses seuls comptages — aucune pondération
 * cachée, la règle tient en quatre lignes et doit rester contestable par
 * l'élève qui lit les chiffres à côté.
 *
 * L'ordre compte : la difficulté prime sur l'acquis. Un élève qui a réussi
 * deux fois en autonomie PUIS échoué deux fois n'a pas une notion « solide »
 * — c'est précisément le cas que le produit doit savoir voir.
 */
function classify(counts: { attempts: number; autonomousSuccesses: number; failures: number }): NotionState {
  if (counts.attempts === 0) return "jamais testée";
  if (counts.failures >= NOTION_STRUGGLING_FAILURES) return "en difficulté";
  if (counts.autonomousSuccesses >= NOTION_SOLID_AUTONOMOUS && counts.failures === 0) return "solide";
  return "fragile";
}

/**
 * L'état réel de chaque notion, preuves comprises — le cœur de la
 * Radiographie. Un seul passage sur les tentatives, quel que soit le nombre
 * de notions : la banque en compte plus de 600, un balayage par notion serait
 * quadratique pour rien.
 */
export function computeNotionEvidence(exercises: Exercise[], sessions: WorkSession[]): NotionEvidence[] {
  const index = buildNotionIndex(exercises);
  const attempts = qualifiedAttempts(exercises, sessions);
  const recentWindow = attempts.slice(0, ROOT_CAUSE_WINDOW);

  const counts = new Map<string, { attempts: number; autonomousSuccesses: number; assistedSuccesses: number; failures: number }>();
  const recentFailuresByNotion = new Map<string, Map<string, Exercise>>();

  for (const { session, exercise } of attempts) {
    for (const notion of notionsOf(exercise)) {
      let entry = counts.get(notion);
      if (!entry) {
        entry = { attempts: 0, autonomousSuccesses: 0, assistedSuccesses: 0, failures: 0 };
        counts.set(notion, entry);
      }
      entry.attempts++;
      if (session.result === "échoué") entry.failures++;
      else if (session.result === "réussi") {
        // `hints_used === null` n'est pas « zéro indice », et une correction
        // révélée n'est pas une réussite autonome : une seule définition,
        // partagée par tous les moteurs (voir `isAutonomousSuccess`).
        if (isAutonomousSuccess(session)) entry.autonomousSuccesses++;
        else entry.assistedSuccesses++;
      }
    }
  }

  for (const { session, exercise } of recentWindow) {
    if (session.result !== "échoué") continue;
    for (const notion of notionsOf(exercise)) {
      if (!recentFailuresByNotion.has(notion)) recentFailuresByNotion.set(notion, new Map());
      // Indexé par identifiant d'exercice : deux échecs sur LE MÊME exercice
      // restent un seul exercice en difficulté, jamais deux preuves.
      recentFailuresByNotion.get(notion)!.set(exercise.id, exercise);
    }
  }

  return index.map((reach) => {
    const entry = counts.get(reach.notion) ?? { attempts: 0, autonomousSuccesses: 0, assistedSuccesses: 0, failures: 0 };
    return {
      ...reach,
      ...entry,
      state: classify(entry),
      recentlyFailedExercises: [...(recentFailuresByNotion.get(reach.notion)?.values() ?? [])],
    };
  });
}

/**
 * LA QUESTION QUE LE GRAIN CHAPITRE NE PEUT PAS POSER : parmi les échecs
 * récents, quelle NOTION revient ?
 *
 * Un élève qui rate trois exercices dans deux chapitres différents voit
 * aujourd'hui deux chapitres « à consolider » — deux verdicts séparés, aucun
 * lien. Si ces trois exercices partagent « tableau d'avancement », la vraie
 * réponse n'est ni l'un ni l'autre chapitre : c'est cette notion-là.
 *
 * Aucune inférence, aucun modèle : une intersection sur des listes de
 * prérequis déclarées par la banque, appliquée à des échecs réels. Une notion
 * n'est retenue que si elle relie au moins `ROOT_CAUSE_MIN_FAILED_EXERCISES`
 * exercices DISTINCTS — sinon elle ne se distingue pas des autres notions du
 * même exercice.
 *
 * Classement : d'abord le nombre d'exercices échoués reliés (la force de la
 * preuve), puis la portée en chapitres (une notion qui fait échouer dans
 * plusieurs chapitres est plus structurante), puis l'ordre alphabétique pour
 * rester déterministe.
 */
export function findRootCauseNotions(exercises: Exercise[], sessions: WorkSession[]): NotionEvidence[] {
  return computeNotionEvidence(exercises, sessions)
    .filter((evidence) => evidence.recentlyFailedExercises.length >= ROOT_CAUSE_MIN_FAILED_EXERCISES)
    .sort(
      (a, b) =>
        b.recentlyFailedExercises.length - a.recentlyFailedExercises.length ||
        b.chapterIds.length - a.chapterIds.length ||
        a.notion.localeCompare(b.notion, "fr")
    );
}

/** Comptage d'ensemble affiché en tête de la Radiographie — que des totaux, aucun score composite. */
export interface NotionOverview {
  total: number;
  solid: number;
  fragile: number;
  struggling: number;
  untested: number;
  /** Notions démontrées ou tentées — l'assise réelle de la carte. */
  tested: number;
  crossChapter: number;
  crossSubject: number;
}

export function computeNotionOverview(evidence: NotionEvidence[]): NotionOverview {
  const count = (state: NotionState) => evidence.filter((item) => item.state === state).length;
  const untested = count("jamais testée");
  return {
    total: evidence.length,
    solid: count("solide"),
    fragile: count("fragile"),
    struggling: count("en difficulté"),
    untested,
    tested: evidence.length - untested,
    crossChapter: evidence.filter((item) => item.crossesChapters).length,
    crossSubject: evidence.filter((item) => item.crossesSubjects).length,
  };
}

/**
 * Les chapitres qu'une notion traverse, résolus en libellés lisibles — même
 * convention que `resolveContestChapters` (lib/contests.ts) : un identifiant
 * qui ne correspond à aucun chapitre connu est ignoré, jamais affiché brut.
 */
export function resolveNotionChapters(evidence: NotionReach, chapters: Chapter[]): Chapter[] {
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return evidence.chapterIds
    .map((id) => byId.get(id))
    .filter((chapter): chapter is Chapter => chapter !== undefined)
    .sort((a, b) => a.subject.localeCompare(b.subject, "fr") || a.label.localeCompare(b.label, "fr"));
}

/**
 * SÉANCE CIBLÉE SUR UNE NOTION — l'aboutissement concret de la carte : on ne
 * se contente pas de nommer ce qui bloque, on propose de le travailler tout
 * de suite.
 *
 * Volontairement construit sur `StoredPlan`, le mécanisme de transfert déjà
 * utilisé par le Plan du jour (`serializePlan`) et la Séance libre
 * (`buildFreeSessionPlan`) : `SessionRunner` n'a aucune mécanique nouvelle à
 * apprendre, une séance de notion n'est qu'un `StoredPlan` de plus.
 *
 * L'ordre des exercices est PÉDAGOGIQUE et assumé : du plus facile au plus
 * difficile. C'est le seul endroit du produit où cet ordre a du sens — on
 * reconstruit une notion qui résiste, donc on repart d'un cran abordable
 * avant de remonter. Le moteur d'urgence n'est pas sollicité ici : il
 * répond à « quoi travailler ? », pas à « dans quel ordre reconstruire une
 * notion précise que l'élève vient de choisir lui-même ». À difficulté
 * égale, les exercices non maîtrisés passent devant.
 */
export function buildNotionSessionPlan(evidence: NotionReach, sessions: WorkSession[], limit = 4): StoredPlan {
  const picked = [...evidence.exercises]
    .sort(
      (a, b) =>
        a.difficulty - b.difficulty ||
        Number(a.status === "maîtrisé") - Number(b.status === "maîtrisé") ||
        a.title.localeCompare(b.title, "fr")
    )
    .slice(0, limit);

  return {
    items: picked.map((exercise) => ({ exerciseId: exercise.id, reasons: [`Notion ciblée : ${evidence.notion}`] })),
    requestedMinutes: picked.reduce((sum, exercise) => sum + estimatedDurationMinutes(exercise, sessions), 0),
    source: "notion",
    label: evidence.notion,
  };
}
