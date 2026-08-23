import { attemptsWithResult, isNeverWorked, recentFailureCount } from "@/lib/recommendation";
import type { Chapter } from "@/lib/storage";
import { minutesByExerciseMap } from "@/lib/study";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * MP Readiness (Sprint « rentrée MP ») — signaux académiques additionnels
 * pour les moteurs déjà existants (lib/recommendation.ts, lib/next-action.ts),
 * jamais un nouveau moteur de recommandation/priorité.
 *
 * ## Pourquoi ce module existe
 * TaekdHub sait déjà QUOI proposer (moteur de recommandation) et QUAND
 * (moteur de priorité, Daily Copilot, Day Flow). Il ne sait pas encore QUE
 * certaines notions sont explicitement attendues à la rentrée en MP par les
 * professeurs (document de maths, message du prof de physique/chimie) — ce
 * module traduit cette attente en un signal de plus, de la même forme que
 * `chapterDeadlines`/`subjectPlanGap` (lib/deadlines.ts, lib/weekly-plan.ts) :
 * une donnée dérivée, jamais stockée, jamais une nouvelle branche de décision.
 *
 * ## Pourquoi aucune nouvelle donnée persistante
 * `lib/chapters.ts` documente déjà le choix produit : les chapitres sont
 * créés par l'utilisateur, jamais pré-remplis (« un catalogue officiel par
 * matière risquerait d'imposer un chapitre incomplet ou erroné, en
 * particulier pour une filière comme MP »). `MP_READINESS_NOTIONS` respecte
 * ce choix : c'est un catalogue de RÉFÉRENCE en mémoire (mots-clés à
 * rechercher), jamais des `Chapter` imposés — il ne crée ni ne modifie aucun
 * chapitre, aucun exercice, aucune préférence. La correspondance avec les
 * données réelles de l'utilisateur (chapitres, tags, titres d'exercices) se
 * fait par simple recherche textuelle (voir `matchedExercisesForNotion`).
 *
 * ## Ce que ce module NE fait PAS
 * - Il ne décide jamais seul quel exercice proposer : `computeMpReadinessBonus`
 *   produit une carte exerciseId → info, consommée par `lib/recommendation.ts`
 *   exactement comme `chapterDeadlines`/`subjectPlanGap` — la sélection finale
 *   reste entièrement `recommendExercises`.
 * - Il ne gère ni le TIPE ni les œuvres au programme comme des projets : voir
 *   `MP_READINESS_REMINDERS`, deux rappels statiques, jamais wired dans le
 *   moteur de recommandation (aucune notion de maîtrise n'a de sens pour eux).
 */

/**
 * Catégorie de rentrée — vocabulaire du brief, jamais mélangé avec
 * `MpReadinessState` (l'état RÉEL de l'élève sur cette notion, calculé) :
 * `tier` est une propriété FIXE de la notion (ce que le professeur en dit),
 * `state` est calculé à partir des données de l'élève.
 * - `rentree` : notion explicitement demandée par les professeurs (les deux
 *   documents sources).
 * - `fondamental` : notion indispensable pour comprendre la suite, réservée
 *   pour un usage futur de ce catalogue (aucune entrée n'utilise cette valeur
 *   aujourd'hui : les deux documents sources listent tout comme rentrée).
 * - `complement` : utile mais non prioritaire pour les premiers jours —
 *   jamais poussée par le bonus de recommandation (voir
 *   `computeMpReadinessBonus`), seulement visible dans l'aperçu.
 */
export type MpReadinessTier = "rentree" | "fondamental" | "complement";

/** État réel de l'élève sur une notion — voir la doc de tête pour la distinction avec `tier`. Jamais "en retard" : les quatre valeurs correspondent exactement au vocabulaire du brief (Maîtriser / Renforcer / Découvrir / Approfondir). */
export type MpReadinessState = "decouvrir" | "renforcer" | "maitriser" | "approfondir";

export interface MpReadinessNotion {
  id: string;
  subject: Subject;
  /** Regroupement pédagogique (ex. "Algèbre", "Polynômes") — pour l'affichage uniquement, jamais utilisé pour le matching. */
  block: string;
  label: string;
  tier: MpReadinessTier;
  /**
   * `true` uniquement pour les idéaux — LA notion explicitement annoncée
   * comme nouvelle, étudiée dès le premier jour (voir le document de maths).
   * Force `state = "decouvrir"` quel que soit ce que la banque contient :
   * une notion jamais enseignée ne peut jamais être une "lacune" (voir la
   * doc de `assessMpReadinessNotion`).
   */
  isNewAtRentree?: boolean;
  /** Recherche insensible à la casse/aux accents dans les libellés de chapitre, titres d'exercice et tags — voir `normalizeText`. */
  keywords: string[];
  /** Matières où chercher une correspondance — par défaut `[subject]` seul (voir `matchedExercisesForNotion`). Permet à une notion physique de retrouver un chapitre de maths (ex. « complexes » utilisés en physique). */
  matchSubjects?: Subject[];
}

/**
 * Catalogue de référence — transcription directe des deux documents sources
 * (brief), jamais une liste générique inventée. Granularité alignée sur les
 * exemples concrets du brief ("groupes : faible", "idéaux : jamais étudiés",
 * "ensembles : solide" / "applications : moyen" traités comme deux notions
 * distinctes) plutôt que sur les blocs bruts du document (trop fins pour
 * correspondre à des chapitres réels : aucune banque d'exercices ne
 * distingue "contraposée" de "récurrence" au niveau du chapitre).
 */
export const MP_READINESS_NOTIONS: MpReadinessNotion[] = [
  // --- Mathématiques (document de rentrée) ---
  {
    id: "maths-logique",
    subject: "Mathématiques",
    block: "Logique et raisonnement",
    label: "Logique et raisonnement",
    tier: "rentree",
    keywords: ["logique", "raisonnement", "récurrence", "quantificateur", "contraposée", "absurde"],
  },
  {
    id: "maths-ensembles",
    subject: "Mathématiques",
    block: "Ensembles et applications",
    label: "Ensembles",
    tier: "rentree",
    // "famille" volontairement absent : trop ambigu avec "famille libre/génératrice"
    // de vecteurs (algèbre linéaire, sens totalement différent) — testé et
    // retiré après audit contre la banque de base (voir le rapport final).
    keywords: ["ensemble"],
  },
  {
    id: "maths-applications",
    subject: "Mathématiques",
    block: "Ensembles et applications",
    label: "Applications",
    tier: "rentree",
    // "application" seul volontairement absent : en français, "application"
    // désigne aussi bien la notion ensembliste que "l'application d'un
    // théorème/résultat" (ex. "Inégalité de convexité et application à une
    // suite") — bien trop ambigu, testé et retiré après audit contre la
    // banque de base (voir le rapport final).
    keywords: ["injection", "surjection", "bijection", "image directe", "image réciproque"],
  },
  {
    id: "maths-relations",
    subject: "Mathématiques",
    block: "Relations",
    label: "Relations (équivalence, ordre)",
    tier: "rentree",
    keywords: ["relation d'équivalence", "relation d'ordre", "classe d'équivalence", "relation binaire", "ensemble quotient"],
  },
  {
    id: "maths-groupes",
    subject: "Mathématiques",
    block: "Algèbre",
    label: "Groupes",
    tier: "rentree",
    // "morphisme" seul volontairement absent : matche "endomorphisme"/
    // "isomorphisme" au sens de la réduction des endomorphismes (algèbre
    // linéaire), un chapitre déjà existant et sans rapport avec les groupes —
    // testé et retiré après audit contre la banque de base (voir le rapport
    // final). "morphisme de groupe(s)" reste assez spécifique pour éviter
    // cette collision.
    keywords: ["groupe", "sous-groupe", "morphisme de groupe", "loi de composition interne", "loi interne"],
  },
  {
    id: "maths-anneaux-corps",
    subject: "Mathématiques",
    block: "Algèbre",
    label: "Anneaux et corps",
    tier: "rentree",
    keywords: ["anneau", "corps", "élément inversible"],
  },
  {
    id: "maths-ideaux",
    subject: "Mathématiques",
    block: "Algèbre",
    label: "Idéaux",
    tier: "rentree",
    isNewAtRentree: true,
    keywords: ["idéal", "idéaux"],
  },
  {
    id: "maths-polynomes",
    subject: "Mathématiques",
    block: "Polynômes",
    label: "Polynômes",
    tier: "rentree",
    // "d'alembert" seul volontairement absent : matche "critère de d'Alembert"
    // (règle de convergence des séries numériques, chapitre déjà existant et
    // sans rapport) — testé et retiré après audit contre la banque de base
    // (voir le rapport final). Le vrai nom du théorème visé ici (racines des
    // polynômes complexes) reste assez spécifique pour éviter la collision.
    keywords: ["polynôme", "k[x]", "division euclidienne", "irréductib", "racine", "polynôme scindé", "viète", "d'alembert-gauss"],
  },
  {
    id: "maths-sommations",
    subject: "Mathématiques",
    block: "Sommations",
    label: "Sommations",
    tier: "rentree",
    keywords: ["sommation", "somme finie", "réindexation", "somme par paquets"],
  },
  // --- Physique/Chimie (message du professeur) ---
  {
    id: "physique-equadiff",
    subject: "Physique",
    block: "Priorité 1",
    label: "Équations différentielles",
    tier: "rentree",
    // Chapitre "Équations différentielles" déjà présent côté Mathématiques dans la banque de base — voir l'audit (datasets/exercices-banque-complete.json).
    matchSubjects: ["Physique", "Mathématiques"],
    keywords: ["équation différentielle", "édo", "séparation des variables"],
  },
  {
    id: "physique-complexes",
    subject: "Physique",
    block: "Priorité 1",
    label: "Complexes en physique",
    tier: "rentree",
    matchSubjects: ["Physique", "Mathématiques"],
    keywords: ["complexe"],
  },
  {
    id: "physique-coordonnees",
    subject: "Physique",
    block: "Priorité 1",
    label: "Systèmes de coordonnées",
    tier: "rentree",
    keywords: ["coordonnées cartésiennes", "coordonnées cylindriques", "coordonnées sphériques", "coordonnées polaires"],
  },
  {
    id: "physique-outils-differentiels",
    subject: "Physique",
    block: "Priorité 1",
    label: "Outils différentiels (gradient, déplacement élémentaire)",
    tier: "rentree",
    matchSubjects: ["Physique", "Mathématiques"],
    keywords: ["gradient", "déplacement élémentaire", "différentielle"],
  },
  {
    id: "physique-energie",
    subject: "Physique",
    block: "Priorité 1",
    label: "Énergie mécanique et potentielle",
    tier: "rentree",
    keywords: ["énergie potentielle", "énergie mécanique", "énergie cinétique"],
  },
  {
    id: "physique-condensateur",
    subject: "Physique",
    block: "Priorité 1",
    label: "Condensateur",
    tier: "rentree",
    keywords: ["condensateur"],
  },
  {
    id: "chimie-atome-classification",
    subject: "Chimie",
    block: "Chimie fondamentale",
    label: "Atome et classification périodique",
    tier: "rentree",
    keywords: ["atome", "classification périodique"],
  },
  {
    id: "chimie-structures-ioniques-moleculaires",
    subject: "Chimie",
    block: "Chimie fondamentale",
    label: "Structures ioniques et moléculaires",
    tier: "rentree",
    keywords: ["structure ionique", "structure moléculaire", "liaison chimique"],
  },
  {
    id: "chimie-structures-cristallines",
    subject: "Chimie",
    block: "Chimie fondamentale",
    label: "Structures cristallines",
    tier: "rentree",
    keywords: ["structure cristalline", "cristal"],
  },
];

/**
 * Deux rappels de rentrée EXPLICITEMENT hors du moteur de recommandation
 * (brief : « ne pas créer un système complet de gestion de projet TIPE » /
 * « ne pas créer de gestion complète des œuvres ») — aucune notion de
 * maîtrise, aucun matching, jamais consommés par `computeMpReadinessBonus`.
 * Un simple rappel textuel, affiché tel quel par l'UI (voir
 * components/dashboard-overview.tsx).
 */
export const MP_READINESS_REMINDERS: { id: string; label: string; detail: string }[] = [
  { id: "oeuvres", label: "Œuvres au programme", detail: "Travail de rentrée à part — à lire avant la rentrée." },
  { id: "tipe", label: "Sujet de TIPE à proposer", detail: "Une proposition de sujet est attendue à la rentrée." },
];

/**
 * Normalisation l\u00e9g\u00e8re pour la correspondance texte : accents et casse
 * ignor\u00e9s, ET un simple "s" final de pluriel retir\u00e9 mot par mot (jamais un
 * vrai stemmer) \u2014 sans cela, un chapitre "\u00c9quations diff\u00e9rentielles"
 * (pluriel, tel que la banque de base le nomme r\u00e9ellement) ne matcherait
 * jamais le mot-cl\u00e9 "\u00e9quation diff\u00e9rentielle" (singulier, tel qu'\u00e9crit dans
 * le catalogue de rentr\u00e9e). Mots de 3 lettres ou moins jamais touch\u00e9s, pour
 * ne pas mutiler un sigle court (ex. "K[X]").
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

function textMatchesNotion(value: string, keywords: string[]): boolean {
  const normalized = normalizeText(value);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

/**
 * Exercices de la banque (actifs) qui correspondent à une notion, par simple
 * correspondance textuelle sur le chapitre, le titre ou les tags — jamais un
 * identifiant de chapitre imposé (voir la doc de tête). Un exercice peut
 * matcher via son chapitre OU directement via son propre titre/tags (utile
 * tant qu'aucun chapitre "Groupes"/"Idéaux" n'existe encore dans une banque
 * donnée : voir le rapport d'audit, RAPPORT-MP-READINESS.md).
 */
export function matchedExercisesForNotion(notion: MpReadinessNotion, chapters: Chapter[], exercises: Exercise[]): Exercise[] {
  const subjects = notion.matchSubjects ?? [notion.subject];
  const matchedChapterIds = new Set(
    chapters.filter((chapter) => subjects.includes(chapter.subject) && textMatchesNotion(chapter.label, notion.keywords)).map((chapter) => chapter.id)
  );
  return exercises.filter((exercise) => {
    if (exercise.archived || !subjects.includes(exercise.subject)) return false;
    if (exercise.chapter_id && matchedChapterIds.has(exercise.chapter_id)) return true;
    if (textMatchesNotion(exercise.title, notion.keywords)) return true;
    return exercise.tags.some((tag) => textMatchesNotion(tag, notion.keywords));
  });
}

export interface MpReadinessAssessment {
  notion: MpReadinessNotion;
  state: MpReadinessState;
  matchedExercises: Exercise[];
  /** Maîtrise moyenne (0-100) sur les exercices correspondants — `null` si aucune correspondance (voir la doc de `assessMpReadinessNotion`). */
  averageMastery: number | null;
  hasRecentFailure: boolean;
}

/** Seuil de maîtrise moyenne au-delà duquel une notion est considérée acquise — même seuil que "Maîtrise faible" ailleurs dans l'app (lib/recommendation.ts), pour rester cohérent avec le vocabulaire déjà utilisé. */
const MASTERED_AVERAGE_THRESHOLD = 75;

/**
 * État d'une notion pour CET élève, à partir des données déjà existantes
 * (chapitres, exercices, sessions) — jamais un nouveau calcul de maîtrise :
 * `Exercise.mastery` et `recentFailureCount` (lib/recommendation.ts) sont
 * repris tels quels.
 *
 * Distinction centrale du brief : une notion `isNewAtRentree` (idéaux) est
 * TOUJOURS "à découvrir", quelles que soient les données trouvées (il ne
 * peut structurellement pas y avoir de lacune sur un contenu pas encore
 * enseigné). Pour les autres notions, l'ABSENCE de toute correspondance dans
 * la banque retombe sur "à renforcer" — pas "à découvrir" : le document
 * précise que ce sont des rappels de MPSI, donc supposés déjà vus en classe,
 * même si l'élève n'a encore rien enregistré dessus dans TaekdHub (État A du
 * brief : "aucun travail" doit quand même pouvoir faire remonter une
 * priorité de rentrée).
 */
export function assessMpReadinessNotion(
  notion: MpReadinessNotion,
  chapters: Chapter[],
  exercises: Exercise[],
  sessions: WorkSession[]
): MpReadinessAssessment {
  const matchedExercises = matchedExercisesForNotion(notion, chapters, exercises);

  if (notion.isNewAtRentree) {
    return { notion, state: "decouvrir", matchedExercises, averageMastery: null, hasRecentFailure: false };
  }

  if (matchedExercises.length === 0) {
    return { notion, state: "renforcer", matchedExercises, averageMastery: null, hasRecentFailure: false };
  }

  const minutesByExercise = minutesByExerciseMap(sessions);
  const hasRecentFailure = matchedExercises.some(
    (exercise) => recentFailureCount(attemptsWithResult(sessions, exercise.id)) > 0
  );
  const everWorked = matchedExercises.some((exercise) => !isNeverWorked(exercise, minutesByExercise.get(exercise.id) ?? 0));
  const averageMastery = Math.round(matchedExercises.reduce((sum, exercise) => sum + exercise.mastery, 0) / matchedExercises.length);

  // Une moyenne haute sur des exercices JAMAIS travaillés n'est qu'un défaut
  // de champ (mastery à 0 par défaut, jamais un score de "solide") — sans
  // aucune tentative réelle, impossible d'affirmer une maîtrise : retombe sur
  // "à renforcer", jamais "à maîtriser" par erreur (même garde que
  // `evaluateExercise`/`neverWorked` dans lib/recommendation.ts).
  const state: MpReadinessState =
    everWorked && averageMastery >= MASTERED_AVERAGE_THRESHOLD && !hasRecentFailure
      ? notion.tier === "complement"
        ? "approfondir"
        : "maitriser"
      : "renforcer";

  return { notion, state, matchedExercises, averageMastery, hasRecentFailure };
}

/** État de toutes les notions du catalogue pour cet élève — base commune de l'aperçu ("Rentrée MP") et du bonus de recommandation. */
export function computeMpReadinessAssessments(chapters: Chapter[], exercises: Exercise[], sessions: WorkSession[]): MpReadinessAssessment[] {
  return MP_READINESS_NOTIONS.map((notion) => assessMpReadinessNotion(notion, chapters, exercises, sessions));
}

export interface MpReadinessBonusInfo {
  notion: MpReadinessNotion;
  /** Raison lisible ajoutée aux raisons déjà produites par `evaluateExercise` — même convention `reasons.join(" · ")` que le reste de l'app, jamais un texte séparé à afficher à part. */
  reason: string;
}

/**
 * Carte exerciseId → info, consommée par `lib/recommendation.ts`
 * (evaluateExercise/urgencyScore) exactement comme `chapterDeadlines`. Ne
 * retient QUE les notions "rentree" en état "renforcer" : jamais une notion
 * déjà "maîtrisée"/"à approfondir" (rien à pousser), jamais un "complement"
 * (brief : "non prioritaire pour les premiers jours"), et jamais "découvrir"
 * (une notion neuve annoncée pour la rentrée n'est pas un manque à combler
 * maintenant — voir le point idéaux du brief). Premier notion trouvée gagne
 * pour un exercice qui correspondrait à plusieurs notions à la fois (rare,
 * mais un exercice de "Polynômes" pourrait aussi taguer "racine" partagé
 * avec une autre entrée) : simple stabilité, jamais un choix arbitraire côté
 * urgence (le score, lui, reste inchangé quelle que soit la notion retenue).
 */
export function computeMpReadinessBonus(assessments: MpReadinessAssessment[]): Map<string, MpReadinessBonusInfo> {
  const bonus = new Map<string, MpReadinessBonusInfo>();
  for (const assessment of assessments) {
    if (assessment.notion.tier !== "rentree" || assessment.state !== "renforcer") continue;
    for (const exercise of assessment.matchedExercises) {
      if (!bonus.has(exercise.id)) {
        bonus.set(exercise.id, { notion: assessment.notion, reason: "Priorité de rentrée" });
      }
    }
  }
  return bonus;
}
