import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import { SRS_LADDER } from "@/lib/spaced-repetition";
import { DEFAULT_ACCENT, DEFAULT_THEME_MODE, LEGACY_DEFAULT_ACCENTS, THEME_MODES, hexToRgb, type ThemeMode } from "@/lib/theme";
import { DEFAULT_SUBJECT_PALETTE, isSubjectPaletteId, normalizeSubjectColorOverrides, type SubjectColorOverrides, type SubjectPaletteId } from "@/lib/subject-colors";
import type { AttemptResult, Difficulty, Exercise, ExerciseLevel, ExerciseStatus, ExerciseType, Filiere, LicenseStatus, Mastery, ProgrammeLevel, Provenance, Subject, WorkSession } from "@/lib/supabase/types";

const ATTEMPT_RESULTS: readonly AttemptResult[] = ["réussi", "partiel", "échoué"];

const sessionsKey = "prepahub:sessions";
const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";
const chaptersKey = "prepahub:chapters";
const lastBackupKey = "prepahub:last-backup";
const weekSnapshotsKey = "prepahub:week-snapshots";
const workItemsKey = "prepahub:work-items";
const gradesKey = "prepahub:grades";
const dayPlansKey = "prepahub:day-plans";
const reviewItemsKey = "prepahub:reviewItems";
/* ── Carnet d'erreurs — voir `ErrorEntry` ── */
const errorsKey = "prepahub:errors";
/* ── Check-in du soir — voir `DailyCheckin` ── */
const checkinsKey = "prepahub:checkins";

/**
 * `accent` (Sprint identité visuelle) : hex de la couleur d'accent choisie — voir lib/theme.ts.
 * `themeMode` (Sprint personnalisation) : clair/sombre/système — voir lib/theme.ts#ThemeMode, indépendant de `accent`.
 * `weeklyGoalMinutes` (Sprint Plan de travail) : objectif hebdomadaire, indépendant de `dailyGoalMinutes`
 * (voir lib/week.ts#computeWeeklySummary) — alimente le Dashboard ("Cette semaine") et les statistiques.
 * Absents d'une préférence enregistrée avant leur sprint respectif : retombent sur `defaults` via le
 * merge ci-dessous, comme tout champ ajouté après coup.
 */
export type Preferences = {
  displayName: string;
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  contestDate: string;
  accent: string;
  themeMode: ThemeMode;
  /**
   * CAPACITÉ DÉCLARÉE de travail personnel, en minutes, du lundi (index 0) au
   * dimanche (index 6). Toujours 7 entrées.
   *
   * À ne JAMAIS confondre avec `dailyGoalMinutes`, qui est un OBJECTIF — ce
   * que l'élève veut atteindre. La capacité est un PLAFOND : ce dont il
   * dispose réellement une fois les cours, les colles et les trajets
   * déduits. Les deux peuvent diverger dans les deux sens (un objectif de
   * 60 min un samedi où quatre heures sont libres ; un objectif de 60 min un
   * mardi où il n'y a qu'une demi-heure).
   *
   * Sept valeurs et non une seule parce qu'une semaine de prépa n'est pas
   * uniforme : le mercredi après-midi et le samedi n'ont rien à voir avec le
   * mardi. Une valeur unique rendait « j'ai 4 h samedi » littéralement
   * inexprimable, donc impossible à planifier.
   *
   * DÉCLARÉE, pas mesurée : c'est l'élève qui la pose. TaekdHub peut la lui
   * SUGGÉRER depuis son historique (voir lib/capacity.ts#suggestCapacityFromHistory)
   * mais ne l'écrit jamais tout seul — on n'affirme pas connaître son emploi
   * du temps.
   *
   * Absent d'une préférence enregistrée avant ce chantier : retombe sur
   * `defaults` via le merge de `normalizePreferences`, comme tout champ
   * ajouté après coup.
   */
  capacityByWeekday: number[];
  /**
   * Part de la capacité quotidienne gardée en MARGE, en pourcentage (0–50).
   *
   * Planifier 100 % d'une journée est la façon la plus sûre de produire un
   * planning que personne ne tient : un exercice dure plus longtemps que
   * prévu, un cours déborde, un trajet s'allonge, et tout le reste de la
   * journée est déjà en retard. La capacité PLANIFIABLE est donc
   * systématiquement inférieure à la capacité déclarée — voir
   * lib/capacity.ts#plannableMinutes.
   */
  planningMarginPercent: number;
  /**
   * BUDGET HEBDOMADAIRE PAR MATIÈRE, en minutes par semaine (lundi → dimanche).
   *
   * Existe parce que l'objectif hebdomadaire global (`weeklyGoalMinutes`) ne
   * dit rien de la RÉPARTITION : cinq heures de maths et zéro minute
   * d'anglais le remplissent aussi bien que l'inverse. Or c'est justement la
   * répartition que l'élève s'est fixée (« Anki 30 min par jour, français
   * 4 h, info 1 h 30 le week-end + 1 h en semaine ») et qu'aucun écran ne
   * lui permettait de vérifier.
   *
   * Toujours COMPLET après normalisation (une entrée par matière de
   * lib/study.ts#subjects) : les consommateurs n'ont jamais à se demander
   * si une clé manque. `0` veut dire « pas de budget pour cette matière » —
   * elle est alors simplement absente du suivi (voir lib/subject-targets.ts),
   * jamais affichée comme « 0 % ».
   *
   * Un OBJECTIF, pas une capacité : même distinction que `dailyGoalMinutes`
   * face à `capacityByWeekday`. Ce budget ne réserve rien dans le planning.
   */
  weeklySubjectTargets: Record<Subject, number>;
  /**
   * PALETTE DES MATIÈRES (refonte « Nuit ») — voir lib/subject-colors.ts.
   * Purement visuelle : aucune donnée ne dépend de la couleur d'une matière.
   * Absente d'une préférence antérieure : retombe sur « Néon ».
   */
  subjectPalette: SubjectPaletteId;
  /**
   * Couleur SURCHARGÉE par matière, par-dessus la palette. Seules les
   * matières réellement surchargées sont présentes ; `{}` = la palette telle
   * quelle. Validé hex par hex à la lecture (voir `normalizePreferences`).
   */
  subjectColors: SubjectColorOverrides;
};

/**
 * Capacité par défaut, du lundi au dimanche. Ce sont des VALEURS DE DÉPART
 * affichées telles quelles dans Réglages pour que l'élève les corrige, pas
 * une mesure de son emploi du temps : deux heures de travail personnel en
 * semaine, davantage le week-end. Toute phrase de l'interface qui s'appuie
 * dessus doit dire « ta capacité », jamais « d'après tes habitudes » — voir
 * lib/capacity.ts, qui distingue explicitement la capacité DÉCLARÉE de la
 * capacité SUGGÉRÉE depuis l'historique.
 */
export const DEFAULT_CAPACITY_BY_WEEKDAY: number[] = [120, 120, 120, 120, 120, 240, 180];
/** 20 % : un cinquième de la journée laissé libre. Réglable entre 0 et 50 % (voir `planningMarginPercent`). */
export const DEFAULT_PLANNING_MARGIN_PERCENT = 20;
export const MAX_PLANNING_MARGIN_PERCENT = 50;
/** Plafond par jour — 16 h. Au-delà, c'est une saisie erronée, pas une journée de travail. */
export const MAX_DAILY_CAPACITY_MINUTES = 960;
/**
 * Budgets hebdomadaires par matière, en minutes — VALEURS DE DÉPART, tirées
 * du plan que l'élève s'est fixé, et modifiables dans Réglages :
 *
 *   — Informatique : 1 h 30 le week-end + 1 h en semaine = 2 h 30, partagées
 *     à parts égales entre le tronc commun et la spécialité (75 + 75). Deux
 *     matières distinctes dans lib/study.ts, donc deux budgets : un seul
 *     budget « informatique » masquerait qu'une des deux est à l'abandon.
 *   — Anglais : 30 à 40 min par jour (Anki dans les transports) ≈ 4 h.
 *   — Français : environ 4 h.
 *   — Maths 8 h, physique 6 h : cours en semaine, exercices le week-end. Le
 *     plan ne donnait pas de chiffre ; ce sont des ordres de grandeur à
 *     corriger, pas une prescription.
 *   — Chimie : 0, donc pas suivie tant que l'élève ne le décide pas.
 */
export const DEFAULT_WEEKLY_SUBJECT_TARGETS: Record<Subject, number> = {
  Mathématiques: 480,
  Physique: 360,
  Chimie: 0,
  "Informatique TC": 75,
  "Informatique Spé": 75,
  Français: 240,
  Anglais: 240,
};
/** Plafond par matière — 50 h par semaine. Au-delà, c'est une faute de frappe (un zéro de trop), pas un budget. */
export const MAX_WEEKLY_SUBJECT_TARGET_MINUTES = 3000;
// `dailyGoalMinutes: 60` correspond exactement au plus haut des trois préréglages du
// Dashboard/Réglages (PLAN_DURATION_PRESETS = [30, 45, 60], lib/plan.ts) : un premier
// objectif ambitieux mais tenable, jamais un chiffre hors de tout préréglage cliquable
// (l'ancien défaut de 240 min produisait un "Commencer une séance de 240 min" absurde
// dès la toute première visite, avant tout réglage par l'élève). `weeklyGoalMinutes: 300`
// reste cohérent avec ce nouveau quotidien (5 × 60 min ≈ une semaine de cours).
const defaults: Preferences = {
  displayName: "",
  dailyGoalMinutes: 60,
  weeklyGoalMinutes: 300,
  contestDate: "",
  accent: DEFAULT_ACCENT,
  themeMode: DEFAULT_THEME_MODE,
  capacityByWeekday: DEFAULT_CAPACITY_BY_WEEKDAY,
  planningMarginPercent: DEFAULT_PLANNING_MARGIN_PERCENT,
  weeklySubjectTargets: DEFAULT_WEEKLY_SUBJECT_TARGETS,
  subjectPalette: DEFAULT_SUBJECT_PALETTE,
  subjectColors: {},
};

/**
 * Chapitre/thème (Sprint 3D) — créé et géré par l'utilisateur, jamais
 * pré-rempli (voir lib/chapters.ts). Pas de miroir Supabase : comme
 * `Preferences`, ce concept n'existe qu'en local pour l'instant.
 */
export type Chapter = { id: string; subject: Subject; label: string };

/** Temps investi durant la semaine figée, pour une matière — voir `WeekSnapshot`. */
export interface WeekSnapshotSubjectTime {
  subject: Subject;
  seconds: number;
}

/** Progression d'une matière au moment où la semaine a été figée — mêmes champs que `SubjectProgress` (lib/progress.ts), dupliqués ici en valeur (pas en référence) pour que le snapshot reste correct même si les règles de calcul évoluent plus tard. */
export interface WeekSnapshotSubjectProgress {
  subject: Subject;
  total: number;
  mastered: number;
  completionRate: number;
}

/**
 * Instantané figé d'une semaine ÉCOULÉE (Sprint 5) — la mémoire hebdomadaire
 * de la progression. Créé une seule fois par semaine, jamais modifié ni
 * dupliqué ensuite (voir lib/week-snapshot.ts#findMissingSnapshotWeekStart).
 *
 * `weekStart` (lundi 00:00 ISO, voir lib/week.ts#startOfWeek) sert
 * d'identifiant unique — c'est la clé de dédoublonnage.
 *
 * Approximation assumée : `activeCount`/`masteredCount`/`completionRate`/
 * `bySubjectProgress` reflètent l'état de la banque au moment de la capture
 * (`capturedAt`), pas exactement à minuit le dimanche soir — la maîtrise
 * n'étant pas elle-même historisée, c'est la meilleure donnée honnête
 * disponible sans l'inventer.
 */
export interface WeekSnapshot {
  weekStart: string;
  /** Horodatage ISO de la capture réelle — peut être postérieur de quelques jours à la fin de la semaine si l'app n'a pas été ouverte au bon moment. */
  capturedAt: string;
  totalSeconds: number;
  bySubject: WeekSnapshotSubjectTime[];
  activeCount: number;
  masteredCount: number;
  completionRate: number;
  bySubjectProgress: WeekSnapshotSubjectProgress[];
}

/* ══════════════════════════════════════════════════════════════════
   RÉSULTATS SCOLAIRES — la seule mesure qui ne vient pas de TaekdHub
   ══════════════════════════════════════════════════════════════════

   Tout le reste de ce fichier décrit ce que l'élève fait DANS
   l'application. Une note de DS, elle, est rendue par un professeur : c'est
   la seule donnée qui juge le travail depuis l'extérieur, et donc la seule
   qui permette de confronter l'effort au résultat.

   Volontairement minimal : une note, sur quoi, quand, dans quelle matière.
   Ni coefficient, ni moyenne de classe, ni appréciation — rien dont on ne
   saurait quoi faire, et rien qui transformerait la saisie en corvée.
*/

/** Nature de l'épreuve — reprend le vocabulaire déjà employé par `ExerciseType` et `WorkItemKind`, sans en inventer un troisième. */
export type GradeKind = "ds" | "dm" | "interro" | "colle" | "concours" | "autre";
export const GRADE_KINDS: readonly GradeKind[] = ["ds", "dm", "interro", "colle", "concours", "autre"];

export interface Grade {
  id: string;
  subject: Subject;
  /** Ce sur quoi portait l'épreuve — « Suites et séries », « DS n°3 ». Facultatif à la saisie, jamais vide en mémoire. */
  title: string;
  kind: GradeKind;
  /** "AAAA-MM-JJ" — le jour de l'épreuve, pas celui de la saisie. */
  date: string;
  /**
   * Note obtenue. Décimales permises (11,5). Toujours ≥ 0 et ≤ `maxScore`.
   *
   * `null` = NOTE EN ATTENTE (calibration) : l'épreuve est passée, la copie
   * n'est pas rendue, et l'élève a seulement noté ce qu'il PENSE avoir. Une
   * note en attente n'entre dans AUCUNE moyenne, courbe ni tendance — voir
   * lib/grades.ts#isScored, le filtre unique que tous les agrégats appliquent.
   */
  score: number | null;
  /** Barème. 20 dans l'immense majorité des cas, mais une colle sur 10 ou un concours blanc sur 40 existent. */
  maxScore: number;
  /**
   * CALIBRATION — la note que l'élève PRÉDISAIT avant de connaître le
   * résultat, sur le même barème que `maxScore`. Facultative et absente de
   * toute note antérieure à ce champ (`undefined` ⇒ pas de prédiction).
   * Voir lib/calibration.ts.
   */
  predictedScore?: number | null;
  createdAt: string;
}

/* ══════════════════════════════════════════════════════════════════
   CARNET « À REVOIR » — ce qu'on se promet de reprendre
   ══════════════════════════════════════════════════════════════════

   En maths, l'élève dissèque les corrigés pendant la semaine pour en
   extraire des « cartouches » : non pas un résultat à réciter, mais une
   manière de penser (« montrer qu'une suite converge → monotone bornée »).
   À côté de ça, il y a tout ce qu'on se note en passant — « revoir l'IPP »,
   « refaire l'exo 12 du TD4 », « apprendre les formules de trigo ». Tout
   cela finissait sur un coin de cahier, et donc nulle part.

   Volontairement minimal, pour la même raison que `Grade` : une ligne de
   texte, une matière, une nature. Ni chapitre, ni échéance, ni priorité —
   chaque champ de plus coûte une décision à la saisie, et une saisie qui
   dépasse cinq secondes est une saisie qu'on ne fait plus.

   Le carnet n'est PAS relié à la banque d'exercices : « l'exo 12 du TD4 »
   n'y existe pas, et c'est précisément ce que l'élève a besoin de noter.
*/

/**
 * Nature d'une entrée — trois valeurs, parce que l'élève en distingue trois :
 *
 *   « à revoir »    une notion vue, pas encore solide. Se coche quand c'est fait.
 *   « à apprendre » du par-cœur (formules, définitions). Se coche quand c'est su.
 *   « méthode »     une CARTOUCHE. Ce n'est pas une tâche mais une fiche de
 *                   référence, qu'on garde toute l'année — voir `ReviewItem.doneAt`.
 */
export type ReviewKind = "à revoir" | "à apprendre" | "méthode";
export const REVIEW_KINDS: readonly ReviewKind[] = ["à revoir", "à apprendre", "méthode"];

export interface ReviewItem {
  id: string;
  subject: Subject;
  /** Ce qu'il y a à revoir, tel que l'élève l'a tapé (espaces de bord retirés). Jamais vide. */
  text: string;
  kind: ReviewKind;
  createdAt: string;
  /**
   * ISO, ou `null` tant que l'entrée est ouverte.
   *
   * Pour « à revoir » / « à apprendre », c'est le moment où c'est FAIT :
   * l'entrée quitte les listes ouvertes.
   *
   * Pour une « méthode », c'est le moment où la cartouche est MAÎTRISÉE — et
   * elle ne disparaît pas pour autant : elle reste dans la liste des
   * cartouches de sa matière, qui est un aide-mémoire, pas une liste de
   * tâches. Voir lib/review-items.ts pour le raisonnement complet.
   */
  doneAt: string | null;
  /**
   * LE VERSO — facultatif. La question est `text` (« Montrer qu'une suite
   * converge ? »), la réponse vit ici (« monotone + bornée ⇒ convergente »).
   * Avec un verso, la séance de révision peut CACHER la réponse et demander
   * de la retrouver de tête — c'est tout l'intérêt (voir
   * lib/spaced-repetition.ts). Sans verso, l'entrée se révise quand même :
   * on se demande simplement si l'on s'en souvient.
   *
   * Absent plutôt que `""` : une sauvegarde antérieure au verso n'a pas ce
   * champ, et « pas de réponse » n'a qu'une seule écriture.
   */
  answer?: string;
  /**
   * LE CALENDRIER DE RÉVISION — absent tant que l'entrée n'a jamais été
   * révisée. Une entrée sans calendrier est due le LENDEMAIN de sa création
   * (voir `effectiveSchedule` dans lib/spaced-repetition.ts) : pas besoin de
   * l'écrire à la saisie, et les entrées notées avant l'existence des
   * révisions rejoignent la file sans migration.
   */
  srs?: ReviewSchedule;
}

/**
 * L'état de révision espacée d'une entrée — un objet entier ou rien. Les six
 * champs n'ont de sens qu'ensemble (un `dueAt` sans `step` ne dit pas quel
 * intervalle viendrait ensuite) : les regrouper permet à la normalisation de
 * jeter d'un bloc un calendrier illisible et de retomber sur « jamais
 * révisée », plutôt que de recoller des morceaux.
 */
export interface ReviewSchedule {
  /** Jour CALENDAIRE local (AAAA-MM-JJ) où l'entrée redevient à réviser — jamais un instant ISO : « à réviser demain » ne doit pas dépendre du fuseau. */
  dueAt: string;
  /** Écart, en jours, entre la dernière révision et `dueAt`. ≥ 1. */
  intervalDays: number;
  /** Barreau atteint sur l'échelle 1, 3, 7, 16, 35, 90 jours (0 = le premier). Voir `SRS_LADDER`. */
  step: number;
  /** Nombre de révisions notées, toutes notes confondues. */
  reviews: number;
  /** Nombre de « À revoir » — les oublis. Informatif : ne change pas le calcul. */
  lapses: number;
  /** ISO de la dernière note, ou `null`. */
  lastReviewedAt: string | null;
}

/* ══════════════════════════════════════════════════════════════════
   CARNET D'ERREURS — ce qui s'est mal passé, et pourquoi
   ══════════════════════════════════════════════════════════════════

   Après une colle, un DS ou un exercice, l'élève note chaque erreur en une
   dizaine de secondes : où (matière, source, date), QUEL GENRE d'erreur
   (six types, voir lib/error-log.ts), ce qui s'est passé, et — s'il l'a —
   la bonne idée qui l'aurait évitée.

   Distinct du carnet « À revoir » : une entrée À revoir est une PROMESSE
   (« revoir l'IPP »), qui se coche et s'efface. Une erreur est un CONSTAT
   daté, qu'on ne coche pas — elle sert à voir, sur un mois, ce qui revient.
   La fusionner avec le carnet aurait mêlé deux usages et rendu les comptes
   par type impossibles.

   Le chapitre et l'exercice sont FACULTATIFS et ne sont que des renvois
   (identifiants) : l'erreur de colle n'a souvent aucun exercice dans la
   banque, et c'est justement le cas le plus fréquent.
*/

/** Où l'erreur a été commise — le vocabulaire des élèves, pas celui de `GradeKind`, qui ignore l'exercice fait seul. */
export type ErrorSource = "colle" | "DS" | "DM" | "exercice" | "concours blanc" | "autre";
export const ERROR_SOURCES: readonly ErrorSource[] = ["colle", "DS", "DM", "exercice", "concours blanc", "autre"];

/** Le GENRE d'erreur — six types, décrits en une ligne chacun dans lib/error-log.ts#ERROR_TYPE_META. */
export type ErrorType = "calcul" | "méthode" | "cours" | "lecture" | "rédaction" | "temps";
export const ERROR_TYPES: readonly ErrorType[] = ["calcul", "méthode", "cours", "lecture", "rédaction", "temps"];

export interface ErrorEntry {
  id: string;
  subject: Subject;
  /** "AAAA-MM-JJ" — le jour de l'épreuve ou de l'exercice, pas celui de la saisie. */
  date: string;
  source: ErrorSource;
  type: ErrorType;
  /** Ce qui s'est mal passé, en une ligne. Jamais vide. */
  description: string;
  /** « La bonne idée » : ce qu'il fallait faire. `null` quand l'élève ne l'a pas (encore) notée. */
  fix: string | null;
  /** Renvoi facultatif vers `Chapter.id` — n'est jamais une condition de validité. */
  chapterId: string | null;
  /** Renvoi facultatif vers `Exercise.id` de la banque. */
  exerciseId: string | null;
  /**
   * Identifiant de l'entrée « À revoir » créée à partir de cette erreur, ou
   * `null`. Sert uniquement à ne pas proposer deux fois « ajouter au
   * carnet » — si l'entrée a été supprimée depuis, le bouton reparaît.
   */
  reviewItemId: string | null;
  createdAt: string;
}

/* ══════════════════════════════════════════════════════════════════
   CE QUI ÉTAIT PRÉVU — la seule donnée du planning qui doit survivre
   ══════════════════════════════════════════════════════════════════

   Le planning n'est PAS persisté : il est recalculé à chaque affichage
   (voir lib/planning.ts), et c'est ce qui le garde toujours juste. Mais du
   coup, une fois la journée passée, plus rien ne dit ce qui y était prévu —
   donc « est-ce que je réalise ce que je planifie ? » est structurellement
   sans réponse.

   Un seul nombre par jour suffit à y répondre, et il est irrécupérable
   autrement. C'est la seule statistique dérivée persistée de tout le
   produit, et voici pourquoi elle l'est à ces conditions précises :

   ENREGISTRÉ LA VEILLE. Le plan d'une journée est capté le jour PRÉCÉDENT,
   jamais le jour même. Capté le matin même, il serait déjà amputé du
   travail fait dans la nuit ; capté le soir, il ne resterait presque rien à
   prévoir et la journée afficherait « 300 % réalisé ». La veille, la
   journée est intacte : le nombre mesure vraiment une INTENTION.

   JAMAIS RÉÉCRIT. Une intention ne se révise pas après coup — c'est tout
   son intérêt comme point de comparaison.

   JAMAIS RECONSTITUÉ. Un jour où l'application n'a pas été ouverte la
   veille n'a pas d'enregistrement, et reste simplement hors de la
   comparaison. On dit alors sur combien de jours elle porte plutôt que de
   combler le trou.
*/
export interface DayPlanRecord {
  /** "AAAA-MM-JJ" — le jour PLANIFIÉ. */
  date: string;
  /** Minutes que le planning réservait pour ce jour-là, au moment de la capture. */
  plannedMinutes: number;
  /** Horodatage ISO de la capture — toujours la veille du jour planifié. Conservé pour pouvoir vérifier cette promesse. */
  capturedAt: string;
}

/* ══════════════════════════════════════════════════════════════════
   TRAVAIL PLANIFIABLE — le modèle du « quand »
   ══════════════════════════════════════════════════════════════════

   TaekdHub savait répondre à « quoi travailler » (lib/recommendation.ts) et
   « combien de temps » (lib/plan.ts). Il ne savait pas répondre à « pour
   quand ». `WorkItem` est le seul concept ajouté pour ça, et il est
   volontairement AU-DESSUS de la banque, pas dedans :

     RESSOURCE            un exercice, un chapitre. Existe déjà, ne bouge pas.
     TRAVAIL PLANIFIABLE  `WorkItem` — « préparer le DS de physique »,
                          « faire le DM de maths », « réviser les intégrales ».
     ÉCHÉANCE             `WorkItem.dueDate` — le jour pour lequel c'est dû.

   Un exercice n'est donc JAMAIS une échéance : il est le contenu qu'on
   servira à l'intérieur du temps qu'un `WorkItem` réserve. C'est ce qui
   permet à « DM de maths jeudi » d'exister sans qu'aucun exercice de la
   banque ne lui corresponde.
*/

/**
 * Nature du travail. Six valeurs, en français comme tous les domaines
 * persistés du projet (`ExerciseStatus`, `AttemptResult`…), et pas une de
 * plus : ce qui se distingue ici doit se distinguer pour l'ÉLÈVE, pas pour
 * le modèle.
 *
 * `exercices` et `chapitre` sont les deux seuls types dont TaekdHub sait
 * choisir le contenu tout seul (le moteur de recommandation sait ce qu'est
 * un exercice et ce qu'est un chapitre). `dm`, `ds`, `concours` et `autre`
 * sont du travail dont l'élève seul connaît le contenu — TaekdHub en
 * réserve le temps et suit sa progression, sans prétendre savoir ce qu'il y
 * a dedans.
 */
export type WorkItemKind = "dm" | "ds" | "exercices" | "chapitre" | "concours" | "autre";
export const WORK_ITEM_KINDS: readonly WorkItemKind[] = ["dm", "ds", "exercices", "chapitre", "concours", "autre"];

/**
 * Cycle de vie. « abandonné » EST le mécanisme de suppression : voir la note
 * de `mergeStored` — la fusion par identifiant n'est correcte que parce que
 * rien, dans toute l'application, n'est jamais réellement supprimé. Retirer
 * physiquement une ligne rouvrirait exactement le scénario de perte que
 * cette fusion referme (une copie React périmée réécrivant la liste sans
 * elle… ou avec elle). Un travail abandonné est filtré partout à l'affichage
 * et ignoré par tous les moteurs : pour l'élève, il a disparu.
 */
export type WorkItemStatus = "à faire" | "en cours" | "terminé" | "abandonné";
export const WORK_ITEM_STATUSES: readonly WorkItemStatus[] = ["à faire", "en cours", "terminé", "abandonné"];

/** Un report subi par un travail — conservé pour le bilan hebdomadaire (« 2 reports cette semaine »), jamais pour recalculer quoi que ce soit. */
export interface WorkItemPostponement {
  /** ISO — quand le report a été décidé. */
  at: string;
  /** "AAAA-MM-JJ" — le jour d'où le travail a été retiré. */
  fromDate: string;
  /** "AAAA-MM-JJ" — le premier jour où il redevient planifiable. */
  toDate: string;
}

export interface WorkItem {
  id: string;
  title: string;
  kind: WorkItemKind;
  /** `null` pour un travail qui ne relève d'aucune matière (« ranger mes fiches »). */
  subject: Subject | null;
  /**
   * Durée totale estimée, en MINUTES. Toujours > 0.
   *
   * Posée par l'élève, éventuellement à partir de la suggestion de
   * lib/estimation.ts — qui reste une SUGGESTION : elle est pré-remplie dans
   * le champ, jamais imposée, et jamais réécrite après coup.
   *
   * Le temps RÉELLEMENT fait n'est pas stocké ici. Il se somme à la demande
   * depuis les `WorkSession` portant ce `work_item_id` (voir
   * lib/work-items.ts#doneMinutes) — même règle que `Exercise`, qui ne
   * stocke aucune durée cumulée depuis le Sprint 2.6, et pour la même
   * raison : deux sources de vérité pour une même durée finissent toujours
   * par diverger.
   */
  estimatedMinutes: number;
  /**
   * Jour d'échéance, "AAAA-MM-JJ" en heure LOCALE — un jour, pas un instant.
   * `null` pour un travail sans date (« réviser les intégrales, un jour ») :
   * il reste planifiable, mais après tout ce qui est daté.
   *
   * N'est JAMAIS modifiée par un report : voir `notBeforeDate`.
   */
  dueDate: string | null;
  /**
   * "HH:MM" — l'heure quand l'élève l'a précisée (« DS lundi 8 h »).
   * Purement informative : elle s'affiche, elle n'entre dans aucun calcul.
   * Un DS à 8 h et un DM à rendre le soir se préparent tous deux la veille.
   */
  dueTime: string | null;
  status: WorkItemStatus;
  /**
   * `true` quand l'élève a explicitement marqué ce travail comme important.
   *
   * C'est une DÉCLARATION, pas un score : le score de priorité, lui, est
   * recalculé à chaque affichage (lib/deadlines.ts) parce qu'il dépend de la
   * date du jour. Stocker une priorité la rendrait fausse dès le lendemain.
   */
  important: boolean;
  /**
   * « Ne pas planifier avant ce jour » ("AAAA-MM-JJ"), ou `null`.
   *
   * C'est EXACTEMENT ce qu'un report écrit, et c'est tout ce qu'il écrit.
   * L'échéance, elle, n'est jamais touchée : reporter son travail ne déplace
   * pas la date du DS. C'est la distinction que l'interface doit rendre
   * évidente — et la raison pour laquelle un report peut parfaitement rendre
   * un travail infaisable, ce que le planificateur dira au lieu de le
   * masquer (voir lib/planning.ts).
   */
  notBeforeDate: string | null;
  /**
   * Chapitres concernés — la PORTÉE du travail, pas son contenu.
   *
   * Aucun `exerciseIds` volontairement : figer une liste d'exercices à la
   * création reviendrait à décider du « quoi » des semaines à l'avance, en
   * court-circuitant le moteur de recommandation. La portée (matière +
   * chapitres) est passée au moteur au moment de travailler, et c'est lui
   * qui choisit — voir lib/planning.ts.
   */
  chapterIds: string[];
  createdAt: string;
  completedAt: string | null;
  postponements: WorkItemPostponement[];
}

/**
 * Valeurs par défaut pour les champs Sprint 2.5 — proposées, à ajuster si
 * besoin (voir rapport de sprint). Utilisées à la fois pour la migration des
 * anciennes données (ci-dessous) et pour la création d'un nouvel exercice
 * (components/exercises/exercise-manager.tsx), afin de n'avoir qu'une seule
 * source de vérité pour ces défauts.
 */
export const DEFAULT_MASTERY: Mastery = 0;
const MASTERY_VALUES: readonly Mastery[] = [0, 25, 50, 75, 100];
const PROGRAMME_LEVELS: readonly ProgrammeLevel[] = ["sup", "spe", "sup_spe"];
const EXERCISE_LEVELS: readonly ExerciseLevel[] = [1, 2, 3, 4, 5, 6];
const LICENSE_STATUSES: readonly LicenseStatus[] = ["libre", "à vérifier", "restreint"];
const FILIERES: readonly Filiere[] = ["MP", "MPI", "PC", "PSI", "PT", "TSI"];
const PROVENANCES: readonly Provenance[] = ["concours-verifie", "concours-partiel", "enseignant", "originale"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Une date ISO RÉELLEMENT exploitable, ou `null`.
 *
 * Vérifier `typeof === "string"` ne suffisait pas : une chaîne quelconque
 * ("pas-une-date", un champ tronqué par une sauvegarde interrompue, un JSON
 * édité à la main) traversait la normalisation, puis faisait lever
 * `new Date(...).toISOString()` — `RangeError: Invalid time value` — bien
 * plus loin, au moment du rendu. Comme toutes les données de TaekdHub vivent
 * dans le `localStorage` du navigateur, une seule date corrompue suffisait à
 * afficher une page BLANCHE sur toute l'application, sans aucun moyen de
 * revenir en arrière depuis l'interface (trouvé en test de destruction).
 *
 * La frontière de confiance est ici : rien d'invalide ne doit ressortir de
 * `normalize*`. Une valeur rejetée retombe sur un défaut sûr plutôt que de
 * contaminer le reste de l'app.
 */
function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : value;
}

/**
 * Un compteur RÉELLEMENT exploitable (durée, tentatives, minutes estimées),
 * ou `null`.
 *
 * `typeof === "number" && Number.isFinite(...)` ne suffisait pas : un nombre
 * NÉGATIF traversait la normalisation. Or ces trois champs n'ont aucun sens
 * en négatif, et une seule valeur négative suffit à fausser durablement tout
 * ce qui s'additionne — `totalSeconds`/`todaySeconds` (lib/study.ts),
 * l'objectif du jour, le bilan hebdomadaire, l'XP. Concrètement : une
 * sauvegarde éditée à la main (ou fusionnée depuis un autre appareil) avec
 * `duration_seconds: -3600` faisait DIMINUER le temps de travail du jour à
 * chaque lecture, sans qu'aucune erreur ne soit levée nulle part.
 *
 * Même frontière de confiance que `isoDate` : rien d'aberrant ne ressort de
 * `normalize*`, quitte à retomber sur un défaut sûr.
 */
function nonNegativeInteger(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw);
}

/** Comme `nonNegativeInteger`, mais pour ce qui ne peut pas valoir zéro sans casser un calcul en aval (un objectif sert de DÉNOMINATEUR). */
function positiveInteger(raw: unknown): number | null {
  const value = nonNegativeInteger(raw);
  return value === null || value === 0 ? null : value;
}

/**
 * Correspondances des anciennes valeurs vers le modèle actuel — appliquées
 * une seule fois, à la lecture, pour que les données locales et les
 * sauvegardes déjà exportées continuent de fonctionner sans conversion
 * manuelle. Étendre ces tables au fil des sprints plutôt que d'en créer
 * ailleurs si de nouvelles valeurs sont un jour retirées/renommées.
 */
const LEGACY_SUBJECT_MAP: Record<string, Subject> = {
  Informatique: "Informatique TC",
};
const LEGACY_STATUS_MAP: Record<string, ExerciseStatus> = {
  terminé: "maîtrisé",
};

function migrateSubject(raw: unknown): Subject {
  if (typeof raw === "string") {
    if ((subjects as string[]).includes(raw)) return raw as Subject;
    if (raw in LEGACY_SUBJECT_MAP) return LEGACY_SUBJECT_MAP[raw];
  }
  return "Mathématiques";
}

/**
 * Comme `migrateSubject`, mais pour les modèles où l'absence de matière est
 * LÉGITIME (`WorkItem.subject`) ou disqualifiante (`Grade`) — on ne veut pas
 * y retomber silencieusement sur « Mathématiques ».
 *
 * Séances, exercices, chapitres et instantanés migraient déjà une matière
 * renommée ; les notes et les travaux, arrivés après le renommage
 * « Informatique » → « Informatique TC », ne le faisaient pas. Aucune donnée
 * n'était menacée AUJOURD'HUI, mais le prochain renommage dans lib/study.ts
 * aurait détruit un trimestre de notes en silence : `normalizeGrade`
 * renvoyait `null`, `localData.grades()` filtre les `null`, et `saveGrades`
 * REMPLACE — la note disparaissait définitivement à l'écriture suivante.
 */
function migrateSubjectOrNull(raw: unknown): Subject | null {
  if (typeof raw !== "string") return null;
  if ((subjects as string[]).includes(raw)) return raw as Subject;
  return LEGACY_SUBJECT_MAP[raw] ?? null;
}

function migrateStatus(raw: unknown): ExerciseStatus {
  if (typeof raw === "string") {
    if ((exerciseStatuses as string[]).includes(raw)) return raw as ExerciseStatus;
    if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
  }
  return "à faire";
}

function migrateType(raw: unknown): ExerciseType {
  if (typeof raw === "string" && (exerciseTypes as string[]).includes(raw)) return raw as ExerciseType;
  return "Personnel";
}

function migrateDifficulty(raw: unknown): Difficulty {
  return typeof raw === "number" && raw >= 1 && raw <= 5 ? (Math.round(raw) as Difficulty) : 3;
}


function migrateMastery(raw: unknown): Mastery {
  return typeof raw === "number" && (MASTERY_VALUES as number[]).includes(raw) ? (raw as Mastery) : DEFAULT_MASTERY;
}

function stringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
}

/**
 * Ramène une session, potentiellement issue d'une ancienne sauvegarde
 * (matière, champs manquants), vers la forme actuelle de `WorkSession`.
 * Exportée (Sprint 5) pour que lib/storage.test.ts vérifie directement la
 * rétrocompatibilité et le round-trip export/import de `result`, sans avoir
 * à simuler `localStorage`.
 */
export function normalizeSession(raw: unknown): WorkSession {
  const item = isRecord(raw) ? raw : {};
  const startedAt = isoDate(item.started_at) ?? new Date().toISOString();
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    /** Absent avant le Sprint 2.5 : aucune ancienne session n'était liée à un exercice. */
    exercise_id: typeof item.exercise_id === "string" ? item.exercise_id : null,
    started_at: startedAt,
    ended_at: isoDate(item.ended_at),
    duration_seconds: nonNegativeInteger(item.duration_seconds) ?? 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: isoDate(item.created_at) ?? startedAt,
    // Absent de toute séance antérieure à ce champ (et de toute séance libre,
    // sans exercice) : null, jamais deviné — voir la doc du champ dans
    // lib/supabase/types.ts.
    result: (ATTEMPT_RESULTS as string[]).includes(item.result as string) ? (item.result as AttemptResult) : null,
    // `null` (et non 0) quand le champ est absent ou invalide : une séance
    // enregistrée avant l'introduction de ce champ n'a PAS prouvé que l'élève
    // s'est passé d'indices — voir la doc du champ dans lib/supabase/types.ts.
    hints_used:
      typeof item.hints_used === "number" && Number.isFinite(item.hints_used) && item.hints_used >= 0
        ? Math.round(item.hints_used)
        : null,
    // Absent de toute séance antérieure à ce champ : `null`, jamais rattaché
    // après coup à un travail planifié qui n'existait pas encore. Voir la doc
    // du champ dans lib/supabase/types.ts.
    work_item_id: typeof item.work_item_id === "string" ? item.work_item_id : null,
  };
}

/** Un jour "AAAA-MM-JJ" réellement exploitable, ou `null` — même frontière de confiance qu'`isoDate`, pour les champs qui portent un JOUR et non un instant. */
function calendarDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? null : value;
}

/** "HH:MM" sur 24 h, ou `null`. Purement informatif — voir `WorkItem.dueTime`. */
function clockTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
}

/**
 * Ramène un travail planifié potentiellement corrompu (édition manuelle du
 * localStorage, sauvegarde tronquée) vers une forme valide. Même contrat que
 * `normalizeSession`/`normalizeExercise` : rien d'invalide ne ressort d'ici.
 *
 * Un travail sans titre exploitable reçoit un libellé neutre plutôt que
 * d'être écarté : l'élève l'a créé, il doit pouvoir le retrouver et le
 * corriger — le faire disparaître silencieusement serait pire.
 */
export function normalizeWorkItem(raw: unknown): WorkItem {
  const item = isRecord(raw) ? raw : {};
  const createdAt = isoDate(item.created_at) ?? isoDate(item.createdAt) ?? new Date().toISOString();
  const status = (WORK_ITEM_STATUSES as string[]).includes(item.status as string)
    ? (item.status as WorkItemStatus)
    : "à faire";
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Travail sans titre",
    kind: (WORK_ITEM_KINDS as string[]).includes(item.kind as string) ? (item.kind as WorkItemKind) : "autre",
    // `migrateSubject` imposerait une matière par défaut ; ici l'absence de
    // matière est une valeur légitime, elle doit survivre à la normalisation.
    subject: migrateSubjectOrNull(item.subject),
    // Jamais 0 ni négatif : une durée nulle rendrait le travail invisible
    // pour le planificateur tout en restant affiché comme « à faire ».
    estimatedMinutes: Math.max(1, nonNegativeInteger(item.estimatedMinutes) ?? 30),
    dueDate: calendarDay(item.dueDate),
    dueTime: clockTime(item.dueTime),
    status,
    important: item.important === true,
    notBeforeDate: calendarDay(item.notBeforeDate),
    chapterIds: Array.isArray(item.chapterIds) ? item.chapterIds.filter((id): id is string => typeof id === "string") : [],
    createdAt,
    // Une date d'achèvement n'a de sens que sur un travail terminé — un
    // `completedAt` traînant sur un travail rouvert fausserait le bilan
    // hebdomadaire, qui compte les travaux terminés dans la semaine.
    completedAt: status === "terminé" ? (isoDate(item.completedAt) ?? createdAt) : null,
    postponements: Array.isArray(item.postponements)
      ? item.postponements
          .map((entry): WorkItemPostponement | null => {
            if (!isRecord(entry)) return null;
            const at = isoDate(entry.at);
            const fromDate = calendarDay(entry.fromDate);
            const toDate = calendarDay(entry.toDate);
            return at && fromDate && toDate ? { at, fromDate, toDate } : null;
          })
          .filter((entry): entry is WorkItemPostponement => entry !== null)
      : [],
  };
}

/** Ramène un exercice, potentiellement issu d'une ancienne sauvegarde (Sprint 1/2A), vers la forme actuelle de `Exercise`. */
function normalizeExercise(raw: unknown): Exercise {
  const item = isRecord(raw) ? raw : {};
  // Sprint 2.5 : `chapter` (Sprint 1/2A) devient `title` ; `chapter_id` est un
  // nouveau champ qui référencera le futur catalogue de chapitres.
  const title = typeof item.title === "string" ? item.title : typeof item.chapter === "string" ? item.chapter : "";
  // Absent de toute donnée antérieure à ce champ (import/localStorage/sauvegarde) :
  // "" par défaut, jamais deviné à partir d'un autre champ (voir la doc du
  // champ dans lib/supabase/types.ts).
  const statement = typeof item.statement === "string" ? item.statement : "";
  const createdAt = isoDate(item.created_at) ?? new Date().toISOString();
  // Sprint 2.5 : `last_opened_at` renommé `last_worked_at`.
  // Même garde que `created_at` : une date illisible ici cassait la Heatmap et le calcul de récence du moteur.
  const lastWorkedAt = isoDate(item.last_worked_at) ?? isoDate(item.last_opened_at);
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    title,
    statement,
    chapter_id: typeof item.chapter_id === "string" ? item.chapter_id : null,
    source: typeof item.source === "string" ? item.source : "",
    year: typeof item.year === "number" ? item.year : null,
    // Champs ajoutés pour l'infrastructure banque concours (sourcing/licence/
    // niveau de programme) — absents de toute donnée antérieure, normalisés à
    // `null` plutôt que devinés (voir lib/exercise-import.ts pour ce qui les
    // renseigne réellement).
    competition: typeof item.competition === "string" && item.competition.trim() ? item.competition : null,
    programme_level: (PROGRAMME_LEVELS as string[]).includes(item.programme_level as string) ? (item.programme_level as ProgrammeLevel) : null,
    license_status: (LICENSE_STATUSES as string[]).includes(item.license_status as string) ? (item.license_status as LicenseStatus) : null,
    external_id: typeof item.external_id === "string" && item.external_id.trim() ? item.external_id : null,
    // Champs de provenance (Sprint banque concours) — absents de toute donnée
    // antérieure : normalisés à null, et `provenance` DÉDUITE prudemment
    // plutôt que supposée vérifiée (voir lib/supabase/types.ts#Provenance).
    epreuve: typeof item.epreuve === "string" && item.epreuve.trim() ? item.epreuve : null,
    // Rétrocompatibilité : les fiches enregistrées avant le passage à une
    // liste portaient un `filiere` unique. On le relit tel quel plutôt que de
    // le perdre.
    filieres: Array.isArray(item.filieres)
      ? item.filieres.filter((value): value is Filiere => (FILIERES as string[]).includes(value as string))
      : (FILIERES as string[]).includes(item.filiere as string)
        ? [item.filiere as Filiere]
        : [],
    exercise_number: typeof item.exercise_number === "string" && item.exercise_number.trim() ? item.exercise_number : null,
    provenance: (PROVENANCES as string[]).includes(item.provenance as string)
      ? (item.provenance as Provenance)
      : typeof item.competition === "string" && item.competition.trim()
        ? "concours-partiel"
        : "originale",
    source_url: typeof item.source_url === "string" && item.source_url.trim() ? item.source_url : null,
    prerequisites: stringArray(item.prerequisites),
    pedagogical_goal: typeof item.pedagogical_goal === "string" && item.pedagogical_goal.trim() ? item.pedagogical_goal : null,
    level: (EXERCISE_LEVELS as number[]).includes(item.level as number) ? (item.level as ExerciseLevel) : null,
    type: migrateType(item.type),
    difficulty: migrateDifficulty(item.difficulty),
    mastery: migrateMastery(item.mastery),
    status: migrateStatus(item.status),
    // Sprint 2.6 : `duration_minutes` n'existe plus — le temps passé se
    // calcule à la demande via `minutesSpentOnExercise` (lib/study.ts). Un
    // éventuel `duration_minutes` présent dans d'anciennes données (Sprint 1
    // à 2.5) est simplement ignoré ici, pas migré.
    estimated_minutes: nonNegativeInteger(item.estimated_minutes),
    attempts: nonNegativeInteger(item.attempts) ?? 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: createdAt,
    updated_at: isoDate(item.updated_at) ?? createdAt,
    tags: stringArray(item.tags),
    favorite: Boolean(item.favorite),
    archived: Boolean(item.archived),
    hints: stringArray(item.hints),
    correction: typeof item.correction === "string" ? item.correction : null,
    last_worked_at: lastWorkedAt,
  };
}

/** Ramène un chapitre potentiellement corrompu (édition manuelle du localStorage) vers une forme valide, ou l'écarte. */
function normalizeChapter(raw: unknown): Chapter | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.id !== "string" || typeof item.label !== "string" || !item.label.trim()) return null;
  return { id: item.id, subject: migrateSubject(item.subject), label: item.label };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeWeekSnapshotSubjectTime(raw: unknown): WeekSnapshotSubjectTime | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.subject !== "string" || !isNumber(item.seconds)) return null;
  return { subject: migrateSubject(item.subject), seconds: item.seconds };
}

function normalizeWeekSnapshotSubjectProgress(raw: unknown): WeekSnapshotSubjectProgress | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.subject !== "string" || !isNumber(item.total) || !isNumber(item.mastered) || !isNumber(item.completionRate)) return null;
  return { subject: migrateSubject(item.subject), total: item.total, mastered: item.mastered, completionRate: item.completionRate };
}

/** Ramène un snapshot hebdomadaire potentiellement corrompu vers une forme valide, ou l'écarte — entièrement généré par l'app (jamais saisi ni importé), donc peu de cas réels à couvrir. */
function normalizeWeekSnapshot(raw: unknown): WeekSnapshot | null {
  const item = isRecord(raw) ? raw : {};
  if (typeof item.weekStart !== "string" || typeof item.capturedAt !== "string") return null;
  if (!isNumber(item.totalSeconds) || !isNumber(item.activeCount) || !isNumber(item.masteredCount) || !isNumber(item.completionRate)) return null;
  return {
    weekStart: item.weekStart,
    capturedAt: item.capturedAt,
    totalSeconds: item.totalSeconds,
    bySubject: Array.isArray(item.bySubject) ? item.bySubject.map(normalizeWeekSnapshotSubjectTime).filter((entry): entry is WeekSnapshotSubjectTime => entry !== null) : [],
    activeCount: item.activeCount,
    masteredCount: item.masteredCount,
    completionRate: item.completionRate,
    bySubjectProgress: Array.isArray(item.bySubjectProgress)
      ? item.bySubjectProgress.map(normalizeWeekSnapshotSubjectProgress).filter((entry): entry is WeekSnapshotSubjectProgress => entry !== null)
      : [],
  };
}

/**
 * Ramène une note potentiellement corrompue vers une forme valide, ou
 * l'écarte (`null`) quand elle ne veut plus rien dire — contrairement à un
 * travail planifié, une note sans date ni barème exploitable n'est pas
 * réparable : la garder avec des valeurs inventées fausserait une moyenne.
 */
export function normalizeGrade(raw: unknown): Grade | null {
  const item = isRecord(raw) ? raw : {};
  const date = calendarDay(item.date);
  if (!date) return null;
  const subject = migrateSubjectOrNull(item.subject);
  if (!subject) return null;

  const maxScore = typeof item.maxScore === "number" && Number.isFinite(item.maxScore) && item.maxScore > 0 ? item.maxScore : 20;
  const rawScore = typeof item.score === "number" && Number.isFinite(item.score) ? item.score : null;
  // Calibration : une prédiction lisible, bornée au barème comme la note.
  const rawPrediction =
    typeof item.predictedScore === "number" && Number.isFinite(item.predictedScore) ? Math.max(0, Math.min(maxScore, item.predictedScore)) : null;
  // Sans note NI prédiction, il ne reste rien à mesurer : écartée, comme
  // avant. Avec une prédiction seule, c'est une note EN ATTENTE, légitime.
  if (rawScore === null && rawPrediction === null) return null;

  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject,
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "",
    kind: (GRADE_KINDS as string[]).includes(item.kind as string) ? (item.kind as GradeKind) : "autre",
    date,
    // Bornée au barème : une note de 25/20 vient forcément d'une saisie ou
    // d'un fichier abîmé, et elle contaminerait toutes les moyennes.
    score: rawScore === null ? null : Math.max(0, Math.min(maxScore, rawScore)),
    maxScore,
    // Le champ n'est posé que s'il existe : une note sans prédiction garde
    // exactement la forme qu'elle avait avant la calibration.
    ...(rawPrediction !== null ? { predictedScore: rawPrediction } : {}),
    createdAt: isoDate(item.createdAt) ?? new Date().toISOString(),
  };
}

/**
 * Ramène une entrée du carnet « À revoir » potentiellement corrompue vers une
 * forme valide, ou l'écarte (`null`).
 *
 * Écartée seulement quand elle ne veut plus rien dire : sans texte, il n'y a
 * rien à revoir ; sans matière reconnaissable (même après
 * `migrateSubjectOrNull`, qui rattrape les renommages), on ne saurait pas où
 * la ranger — la déposer d'office en « Mathématiques » mentirait. Tout le
 * reste se répare : une nature inconnue retombe sur « à revoir », une date
 * illisible sur maintenant.
 *
 * Le texte n'est PAS tronqué ici, alors que la saisie le borne (voir
 * lib/review-items.ts#REVIEW_TEXT_MAX) : un fichier édité à la main avec une
 * ligne plus longue reste lisible, et couper la pensée de l'élève au milieu
 * serait une perte de donnée pour un gain purement cosmétique.
 */
export function normalizeReviewItem(raw: unknown): ReviewItem | null {
  const item = isRecord(raw) ? raw : {};
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (!text) return null;
  const subject = migrateSubjectOrNull(item.subject);
  if (!subject) return null;
  // Le verso garde ses retours à la ligne (une méthode s'écrit souvent en
  // deux temps) mais perd ses espaces de bord ; vide, il n'existe pas.
  const answer = typeof item.answer === "string" ? item.answer.trim() : "";
  const srs = normalizeReviewSchedule(item.srs);
  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    subject,
    text,
    kind: (REVIEW_KINDS as string[]).includes(item.kind as string) ? (item.kind as ReviewKind) : "à revoir",
    createdAt: isoDate(item.createdAt) ?? new Date().toISOString(),
    doneAt: isoDate(item.doneAt),
    // Ajoutés seulement s'ils existent : un aller-retour JSON d'une entrée
    // sans verso ni calendrier doit redonner EXACTEMENT la même entrée.
    ...(answer ? { answer } : {}),
    ...(srs ? { srs } : {}),
  };
}

/**
 * Un calendrier de révision lisible, ou `undefined` (= « jamais révisée »,
 * l'entrée redevient due le lendemain de sa création).
 *
 * Seul `dueAt` est indispensable : sans jour d'échéance, on ne sait plus
 * quand la montrer, et inventer une date mentirait. Le reste se répare — un
 * barreau hors échelle est ramené dans l'échelle, un intervalle illisible
 * reprend la valeur de son barreau, un compteur abîmé repart de zéro.
 */
export function normalizeReviewSchedule(raw: unknown): ReviewSchedule | undefined {
  if (!isRecord(raw)) return undefined;
  const dueAt = calendarDay(raw.dueAt);
  if (!dueAt) return undefined;
  const step = Math.min(SRS_LADDER.length - 1, nonNegativeInteger(raw.step) ?? 0);
  return {
    dueAt,
    intervalDays: positiveInteger(raw.intervalDays) ?? SRS_LADDER[step],
    step,
    reviews: nonNegativeInteger(raw.reviews) ?? 0,
    lapses: nonNegativeInteger(raw.lapses) ?? 0,
    lastReviewedAt: isoDate(raw.lastReviewedAt),
  };
}

/* ── Carnet d'erreurs ─────────────────────────────────────────────── */

function optionalText(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Ramène une erreur notée potentiellement corrompue vers une forme valide, ou
 * l'écarte (`null`).
 *
 * Écartée quand elle ne veut plus rien dire : sans description, sans matière
 * reconnaissable, ou sans TYPE reconnu. Ce dernier point est un choix : le
 * type est la seule chose que le carnet compte, et le remplacer par une
 * valeur inventée fausserait précisément les statistiques qui justifient le
 * carnet (« ton erreur n°1 : calcul » alors que l'élève n'a jamais dit
 * calcul). Une source inconnue, elle, retombe sur « autre » — c'est une
 * valeur honnête, qui existe pour ça.
 *
 * La date manquante retombe sur le jour de saisie quand il est lisible : une
 * erreur notée le soir même d'une colle, c'est le cas normal.
 */
export function normalizeErrorEntry(raw: unknown): ErrorEntry | null {
  const item = isRecord(raw) ? raw : {};
  const description = typeof item.description === "string" ? item.description.trim() : "";
  if (!description) return null;
  const subject = migrateSubjectOrNull(item.subject);
  if (!subject) return null;
  if (!(ERROR_TYPES as string[]).includes(item.type as string)) return null;
  const createdAt = isoDate(item.createdAt) ?? new Date().toISOString();
  const date = calendarDay(item.date) ?? calendarDay(createdAt.slice(0, 10));
  if (!date) return null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    subject,
    date,
    source: (ERROR_SOURCES as string[]).includes(item.source as string) ? (item.source as ErrorSource) : "autre",
    type: item.type as ErrorType,
    description,
    fix: optionalText(item.fix),
    chapterId: optionalText(item.chapterId),
    exerciseId: optionalText(item.exerciseId),
    reviewItemId: optionalText(item.reviewItemId),
    createdAt,
  };
}

/* ── fin carnet d'erreurs ─────────────────────────────────────────── */

/** Voir `DayPlanRecord` — un enregistrement sans jour valide n'a aucun sens et disparaît. */
export function normalizeDayPlanRecord(raw: unknown): DayPlanRecord | null {
  const item = isRecord(raw) ? raw : {};
  const date = calendarDay(item.date);
  if (!date) return null;
  return {
    date,
    plannedMinutes: nonNegativeInteger(item.plannedMinutes) ?? 0,
    capturedAt: isoDate(item.capturedAt) ?? `${date}T00:00:00.000Z`,
  };
}

/* ══════════════════════════════════════════════════════════════════
   CHECK-IN DU SOIR — sommeil, énergie, stress (dix secondes par jour)
   ══════════════════════════════════════════════════════════════════

   Tout le reste du fichier décrit le TRAVAIL. Le check-in décrit l'état
   dans lequel on le fait : combien on a dormi la nuit dernière, l'énergie et
   le stress ressentis dans la journée. Trois chiffres et, au besoin, une
   ligne de texte — une saisie qui dépasse dix secondes est une saisie qu'on
   cesse de faire au bout d'une semaine.

   UN CHECK-IN PAR JOUR CALENDAIRE, identifié par `date` et non par un
   identifiant : refaire le check-in le même soir CORRIGE celui du jour (voir
   lib/checkin-insights.ts#upsertCheckin), il n'en crée pas un second. Deux
   valeurs pour la même nuit n'auraient aucun sens.

   Le sommeil porte sur la nuit PRÉCÉDANT `date` : c'est la nuit qui a
   précédé la journée de travail décrite. Voir lib/checkin-insights.ts pour
   le rapprochement avec le temps travaillé.
*/

/** Bornes du sommeil saisissable, par pas d'une demi-heure — au-delà, c'est une faute de frappe, pas une nuit. */
export const CHECKIN_SLEEP_MIN = 4;
export const CHECKIN_SLEEP_MAX = 10;

export interface DailyCheckin {
  /** "AAAA-MM-JJ" — le jour décrit, clé unique de la collection. */
  date: string;
  /** Heures dormies la nuit précédente, par pas de 0,5, bornées à [4 ; 10]. */
  sleepHours: number;
  /** Énergie ressentie, de 1 (à plat) à 5 (en pleine forme). */
  energy: number;
  /** Stress ressenti, de 1 (serein) à 5 (sous pression). */
  stress: number;
  /** Une ligne facultative — `null` plutôt qu'une chaîne vide. */
  note: string | null;
  /** Dernière saisie (création ou correction). */
  updatedAt: string;
}

function scaleOneToFive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(5, Math.round(value)));
}

/**
 * Ramène un check-in corrompu vers une forme valide, ou l'écarte (`null`).
 *
 * Écarté sans jour valide (il n'y a plus de clé), ou quand l'une des trois
 * mesures est illisible : inventer « 7 h de sommeil » ou « énergie 3 »
 * fausserait précisément les moyennes et le rapprochement que la
 * collection existe pour permettre. Une valeur HORS BORNES mais lisible est
 * en revanche ramenée dans les bornes (12 h → 10 h), et arrondie à la
 * demi-heure : c'est une saisie maladroite, pas une donnée absente.
 */
export function normalizeCheckin(raw: unknown): DailyCheckin | null {
  const item = isRecord(raw) ? raw : {};
  const date = calendarDay(item.date);
  if (!date) return null;
  if (typeof item.sleepHours !== "number" || !Number.isFinite(item.sleepHours)) return null;
  const energy = scaleOneToFive(item.energy);
  const stress = scaleOneToFive(item.stress);
  if (energy === null || stress === null) return null;
  const note = typeof item.note === "string" && item.note.trim() ? item.note.trim() : null;
  return {
    date,
    sleepHours: Math.max(CHECKIN_SLEEP_MIN, Math.min(CHECKIN_SLEEP_MAX, Math.round(item.sleepHours * 2) / 2)),
    energy,
    stress,
    note,
    updatedAt: isoDate(item.updatedAt) ?? `${date}T20:00:00.000Z`,
  };
}

/**
 * Lecture dédupliquée : si un fichier (édition manuelle, fusion de deux
 * sauvegardes) porte deux check-ins pour le même jour, le plus récent gagne.
 * Triée par jour croissant — l'ordre d'une série.
 */
function dedupeCheckins(items: DailyCheckin[]): DailyCheckin[] {
  const byDay = new Map<string, DailyCheckin>();
  for (const item of items) {
    const existing = byDay.get(item.date);
    if (!existing || existing.updatedAt <= item.updatedAt) byDay.set(item.date, item);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
/* ── fin du bloc check-in du soir ── */

/**
 * Fusionne une préférence potentiellement partielle/corrompue (import, ancienne
 * sauvegarde, édition manuelle du localStorage) avec `defaults` — même principe
 * que `normalizeExercise`/`normalizeChapter` : un champ absent ou invalide
 * retombe sur sa valeur par défaut plutôt que de propager une valeur incohérente
 * (notamment `themeMode`, posé tel quel en attribut DOM par `applyThemeMode`).
 */
export function normalizePreferences(raw: unknown): Preferences {
  const item = isRecord(raw) ? raw : {};
  /*
   * LISTE BLANCHE, et non un `{ ...defaults, ...item }`.
   *
   * L'étalement recopiait `item` TEL QUEL par-dessus les défauts : seuls
   * trois champs étaient ensuite revalidés, les cinq autres passaient avec
   * n'importe quel type, et toute clé étrangère présente dans l'objet
   * entrait dans les préférences. Deux conséquences dont on ne se relève
   * pas depuis l'interface :
   *
   *   — `accent: 42` → lib/theme.ts#hexToRgb fait `hex.trim()` sur un
   *     nombre, ce qui LÈVE. `ThemeSync` étant monté dans app/layout.tsx,
   *     l'effet plante sur TOUTES les routes, /settings comprise : plus
   *     aucun moyen d'exporter ni de réparer sans la console du navigateur.
   *   — `contestDate: "pas-une-date"` → `Intl.DateTimeFormat#format` lève
   *     `RangeError: Invalid time value` sur l'accueil.
   *
   * Le vecteur n'est pas théorique : `validateBackupPayload` n'inspecte
   * `preferences` que par `isRecord`, donc un fichier de sauvegarde édité à
   * la main, tronqué ou fusionné suffit. Chaque champ est désormais validé
   * par le même helper que le reste du module, et RIEN d'autre que les
   * clés connues ne ressort d'ici.
   */
  return {
    displayName: typeof item.displayName === "string" ? item.displayName : defaults.displayName,
    // Un objectif nul ou négatif produirait des divisions par zéro (« Infinity % »)
    // dans computeDailyObjective ; `JSON.stringify(NaN)` valant `null`, le cas
    // survit à un aller-retour de sauvegarde et doit donc être fermé ici.
    dailyGoalMinutes: positiveInteger(item.dailyGoalMinutes) ?? defaults.dailyGoalMinutes,
    weeklyGoalMinutes: positiveInteger(item.weeklyGoalMinutes) ?? defaults.weeklyGoalMinutes,
    // "" = pas de concours renseigné, seule autre valeur admise qu'un jour calendaire.
    contestDate: calendarDay(item.contestDate) ?? defaults.contestDate,
    // Validé par le MÊME analyseur que celui qui l'utilisera (lib/theme.ts),
    // pour qu'une valeur acceptée ici ne puisse pas faire échouer celui-là.
    // L'ancien défaut (« Miel ») est migré vers le nouveau : voir
    // lib/theme.ts#LEGACY_DEFAULT_ACCENTS — il n'a jamais été un choix.
    accent:
      typeof item.accent === "string" && hexToRgb(item.accent) && !LEGACY_DEFAULT_ACCENTS.includes(item.accent.trim().toLowerCase())
        ? item.accent
        : defaults.accent,
    themeMode: (THEME_MODES as string[]).includes(item.themeMode as string) ? (item.themeMode as ThemeMode) : DEFAULT_THEME_MODE,
    // Un tableau de capacité de longueur ≠ 7, ou contenant autre chose que
    // des nombres, ferait lire `undefined` au planificateur pour un jour de
    // la semaine — et toute la journée deviendrait « capacité 0 », donc
    // « rien n'est casable ». Le tableau est donc reconstruit poste par
    // poste : chaque jour valide est conservé, chaque jour douteux retombe
    // sur son défaut, et la longueur est garantie.
    capacityByWeekday: normalizeCapacityByWeekday(item.capacityByWeekday),
    planningMarginPercent: normalizeMarginPercent(item.planningMarginPercent),
    weeklySubjectTargets: normalizeWeeklySubjectTargets(item.weeklySubjectTargets),
    subjectPalette: isSubjectPaletteId(item.subjectPalette) ? item.subjectPalette : defaults.subjectPalette,
    // Reconstruit matière par matière : une surcharge invalide disparaît
    // seule, les autres restent.
    subjectColors: normalizeSubjectColorOverrides(item.subjectColors),
  };
}

/*
 * Reconstruit matière par matière, sur le modèle de
 * `normalizeCapacityByWeekday` : une matière valide est conservée, une
 * matière absente ou douteuse retombe sur SON défaut, et les autres ne sont
 * pas touchées. Un seul budget corrompu ne doit pas effacer les six autres.
 *
 * ABSENT ≠ ZÉRO. Une préférence enregistrée avant ce chantier n'a pas la
 * clé : elle reçoit les défauts. Un `0` explicite, lui, est un choix
 * (« je ne suis pas la chimie ») et doit survivre à l'aller-retour — d'où
 * `nonNegativeInteger` et non `positiveInteger`, qui l'aurait remplacé par
 * le défaut. Toute clé qui n'est pas une matière connue est ignorée.
 */
function normalizeWeeklySubjectTargets(raw: unknown): Record<Subject, number> {
  const item = isRecord(raw) ? raw : {};
  const out = { ...DEFAULT_WEEKLY_SUBJECT_TARGETS };
  for (const subject of subjects) {
    const value = nonNegativeInteger(item[subject]);
    if (value !== null) out[subject] = Math.min(MAX_WEEKLY_SUBJECT_TARGET_MINUTES, value);
  }
  return out;
}

function normalizeCapacityByWeekday(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  return DEFAULT_CAPACITY_BY_WEEKDAY.map((fallback, index) => {
    const value = list[index];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
    return Math.min(MAX_DAILY_CAPACITY_MINUTES, Math.round(value));
  });
}

function normalizeMarginPercent(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return DEFAULT_PLANNING_MARGIN_PERCENT;
  return Math.min(MAX_PLANNING_MARGIN_PERCENT, Math.round(raw));
}

/**
 * Lecture BLINDÉE d'une liste stockée localement.
 *
 * Les fonctions `normalize*` sont la frontière de confiance pour le CONTENU,
 * mais rien ne protégeait l'analyse elle-même : un `localStorage` corrompu
 * (quota atteint en pleine écriture, extension de navigateur, synchronisation
 * interrompue, édition manuelle) faisait lever `JSON.parse` — erreur non
 * rattrapée, remontée telle quelle dans le rendu. Vérifié en test de
 * destruction : une seule clé illisible suffisait.
 *
 * Une valeur qui n'est pas un tableau est traitée comme absente pour la même
 * raison : `JSON.parse("42").map` lèverait tout autant.
 */
function readList(key: string): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Pendant de `readList` pour un objet unique (préférences) — voir sa documentation. */
function readRecord(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

/**
 * Dernière écriture REFUSÉE par le navigateur, ou `null` si la dernière
 * écriture de cette clé est bien passée — voir `writeKey`.
 */
let lastWriteFailure: { key: string; at: string } | null = null;

/**
 * Lecture/écriture BLINDÉES d'un drapeau brut (pas de JSON, pas de liste) —
 * pour les clés techniques hors `localData` : drapeau et version d'amorçage.
 *
 * hooks/use-prepahub-data.ts les manipulait par `localStorage` direct :
 * `getItem` hors de son `try` faisait rejeter `maybeSeedBank` quand le
 * stockage est bloqué, et un `setItem` refusé laissait la version NON
 * marquée — donc la réconciliation de toute la banque rejouée à chaque
 * montage de composant, indéfiniment, sans que `lastStorageWriteFailure`
 * n'en sache rien. Ces deux fonctions ferment les deux cas d'un coup.
 */
export function readFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Voir `readFlag`. Renvoie `false` sans lever, et enregistre l'échec comme toute autre écriture. */
export function writeFlag(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  return writeKey(key, value);
}

/** Voir `writeKey` — consommé par hooks/use-prepahub-data.ts pour que l'échec cesse d'être invisible. */
export function lastStorageWriteFailure(): { key: string; at: string } | null {
  return lastWriteFailure;
}

/**
 * Écriture BLINDÉE — pendant de `readList` côté écriture.
 *
 * `localStorage.setItem` LÈVE (`QuotaExceededError`, ou `SecurityError` quand
 * le stockage est désactivé/bloqué). Aucun appel n'était protégé : l'erreur
 * remontait telle quelle depuis un gestionnaire de clic React, ce qui
 * annulait la SUITE du gestionnaire. Concrètement, dans
 * components/exercises/focus-view.tsx#commitResult : `saveSessions(...)`
 * lève → `update(...)` (attempts/last_worked_at) et `onClose(...)` ne
 * s'exécutent jamais → l'écran « Comment s'est passé l'exercice ? » reste
 * affiché, la séance ET le résultat sont perdus, sans le moindre message.
 * Chaque nouveau clic reproduisait exactement le même échec.
 *
 * Ce n'est pas une hypothèse d'école, et les chiffres ci-dessous sont
 * MESURÉS, pas estimés : la banque amorcée sérialise à elle seule 1 471 490
 * caractères, soit 2,81 Mo en UTF-16 — l'unité que les navigateurs facturent
 * réellement — sur un quota de 5 Mo par origine. Plus de la moitié du budget
 * est consommée avant la première séance.
 *
 * Et le reste s'accumule sans jamais être élagué. Poids unitaires MESURÉS au
 * navigateur (UTF-16) : une séance 742 o, un travail 828 o, un instantané
 * 1 982 o, une note 402 o, une intention de planning 164 o. Sur une année
 * scolaire (4 séances/jour, 5 travaux/semaine sur 40 semaines, 52
 * instantanés, 365 intentions, 60 notes), cela fait 1,37 Mo/an, dont les
 * SÉANCES à elles seules représentent 1,03 Mo — les trois quarts de la
 * croissance.
 *
 * Donc : 4,19 Mo à la fin de la première année, 5,56 Mo à la fin de la
 * seconde. Le plafond n'est pas atteint en première année ; il l'est vers le
 * seizième mois d'usage, c'est-à-dire en plein deuxième année de prépa.
 * L'échec d'écriture n'est pas un cas limite, c'est une échéance — et c'est
 * la raison d'être de tout ce qui suit. Voir le README pour la stratégie
 * recommandée (ne rien élaguer : ne persister que l'écart à la banque
 * livrée, dont 60 % du poids est du contenu déjà présent dans le dataset).
 *
 * Renvoie `false` au lieu de lever : la valeur déjà stockée reste intacte
 * (setItem est atomique), l'appelant décide quoi faire, et
 * `lastStorageWriteFailure` permet de le dire à l'élève plutôt que de lui
 * laisser croire que c'est enregistré.
 */
function writeKey(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    if (lastWriteFailure?.key === key) lastWriteFailure = null;
    return true;
  } catch {
    lastWriteFailure = { key, at: new Date().toISOString() };
    return false;
  }
}

/**
 * Fusion par `id` d'une liste ENTRANTE avec celle réellement présente sur le
 * disque au moment de l'écriture — l'entrante fait foi pour les `id` qu'elle
 * contient, les autres sont conservés tels quels.
 *
 * Pourquoi c'est indispensable : chaque appel à `usePrepahubData()` crée sa
 * PROPRE copie React des données (ce n'est pas un contexte partagé — voir la
 * note dans components/theme-picker.tsx), et plusieurs composants montés en
 * même temps en ont donc chacun une. Les écritures incrémentales étant des
 * REMPLACEMENTS intégraux de la clé (`saveSessions([nouvelle, ...sessions])`),
 * il suffit qu'une copie soit périmée — ou pas encore chargée — pour effacer
 * tout le reste. Cas réel reproductible : components/timer.tsx n'attend pas
 * `ready`, donc tant que `maybeSeedBank()` n'a pas résolu (import dynamique
 * de 1,35 Mo de JSON + reconstruction de 537 exercices), `sessions` vaut
 * encore `[]` ; or `useWorkTimer` restaure un chrono persisté dès le premier
 * effet, donc le bouton « Terminer » est cliquable immédiatement. Un
 * rechargement en pleine séance suivi de « Terminer » écrivait
 * `[la séance en cours]` — TOUT l'historique effacé, sans erreur ni retour
 * en arrière possible.
 *
 * La fusion est correcte ici parce que RIEN, dans toute l'application, ne
 * supprime jamais une séance ni un exercice (archivage seulement) : une
 * entrée présente sur le disque et absente de la liste entrante ne peut donc
 * être qu'une entrée que l'appelant n'avait pas encore vue.
 *
 * Réservée aux écritures INCRÉMENTALES : la restauration d'une sauvegarde
 * (components/data-backup.tsx) doit remplacer, et continue d'utiliser
 * `saveSessions`/`saveExercises`.
 *
 * Les entrées du disque sont comparées à l'état BRUT (pas de `normalize*` sur
 * toute la liste) : `update` est appelé à chaque frappe dans le champ énoncé
 * (components/exercises/exercise-detail.tsx), et normaliser 537 exercices à
 * chaque touche coûtait trois fois le prix de l'écriture elle-même. Seules
 * les entrées réellement absentes de la liste entrante — zéro dans le cas
 * courant — sont normalisées.
 */
/**
 * Fusionne, écrit, et renvoie CE QUI EST RÉELLEMENT SUR LE DISQUE.
 *
 * Les trois `merge*` jetaient le booléen de `writeKey` et renvoyaient la
 * liste VOULUE. hooks/use-prepahub-data.ts la posait alors dans l'état React
 * sous un commentaire affirmant « la liste réellement enregistrée » — ce qui
 * était faux dès que l'écriture était refusée (quota) : l'écran montrait une
 * séance que le disque n'avait pas, et le prochain enregistrement se
 * construisait sur cet état fantôme.
 *
 * En cas de refus, on relit le disque plutôt que de renvoyer l'intention.
 * `setItem` étant atomique, la valeur précédente est intacte, donc cette
 * relecture est exacte. Elle ne coûte que sur le chemin d'échec, qui est
 * rare ; `lastStorageWriteFailure` (→ `writeFailedAt` → `<StorageAlert>`)
 * dit à l'élève ce qui vient de se passer.
 */
function mergeAndStore<T extends { id: string }>(key: string, incoming: T[], normalize: (raw: unknown) => T): T[] {
  const merged = mergeStored(key, incoming, normalize);
  if (writeKey(key, JSON.stringify(merged))) return merged;
  return readList(key).map(normalize);
}

function mergeStored<T extends { id: string }>(key: string, incoming: T[], normalize: (raw: unknown) => T): T[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  const unseen = readList(key).filter((raw) => !(isRecord(raw) && typeof raw.id === "string" && incomingIds.has(raw.id)));
  return unseen.length === 0 ? incoming : [...incoming, ...unseen.map(normalize)];
}

export const localData = {
  sessions: (): WorkSession[] => (typeof window === "undefined" ? [] : readList(sessionsKey).map(normalizeSession)),
  /** REMPLACE intégralement les séances stockées — restauration d'une sauvegarde uniquement, voir `mergeSessions` pour une écriture incrémentale. */
  saveSessions: (items: WorkSession[]): boolean => writeKey(sessionsKey, JSON.stringify(items)),
  /** Écriture incrémentale sûre : fusionne avec le disque (voir `mergeById`) et renvoie la liste réellement enregistrée. */
  mergeSessions: (items: WorkSession[]): WorkSession[] => {
    return mergeAndStore(sessionsKey, items, normalizeSession);
  },
  /**
   * SUPPRIME une séance — relue depuis le disque, jamais depuis une copie
   * React : `mergeSessions` ne sait pas retirer (une séance absente de la
   * liste passée est conservée par la fusion), c'est voulu pour les écritures
   * incrémentales et c'est pourquoi l'annulation a son propre chemin. Seul
   * appelant : l'annulation d'une saisie rapide (components/work/quick-log.tsx).
   */
  removeSession: (id: string): WorkSession[] => {
    const remaining = localData.sessions().filter((session) => session.id !== id);
    writeKey(sessionsKey, JSON.stringify(remaining));
    return remaining;
  },
  exercises: (): Exercise[] => (typeof window === "undefined" ? [] : readList(exercisesKey).map(normalizeExercise)),
  /** REMPLACE intégralement la banque stockée — amorçage/réconciliation/restauration, voir `mergeExercises` pour une écriture incrémentale. */
  saveExercises: (items: Exercise[]): boolean => writeKey(exercisesKey, JSON.stringify(items)),
  /** Écriture incrémentale sûre : fusionne avec le disque (voir `mergeById`) et renvoie la liste réellement enregistrée. */
  mergeExercises: (items: Exercise[]): Exercise[] => {
    return mergeAndStore(exercisesKey, items, normalizeExercise);
  },
  chapters: (): Chapter[] =>
    typeof window === "undefined" ? [] : readList(chaptersKey).map(normalizeChapter).filter((item): item is Chapter => item !== null),
  saveChapters: (items: Chapter[]): boolean => writeKey(chaptersKey, JSON.stringify(items)),
  preferences: (): Preferences => (typeof window === "undefined" ? defaults : normalizePreferences(readRecord(preferencesKey))),
  savePreferences: (preferences: Preferences): boolean => writeKey(preferencesKey, JSON.stringify(preferences)),
  /**
   * Horodatage ISO de la dernière sauvegarde exportée (voir `exportBackup`),
   * ou `null` si aucune n'a jamais été faite.
   *
   * BLINDÉ comme `readList`/`readRecord`, et pas par excès de prudence :
   * `localStorage.getItem` LÈVE quand le stockage est bloqué (Safari « bloquer
   * tous les cookies », certains modes privés, iframe tierce). C'était le
   * seul accès du module qui ne l'était pas — et il est appelé depuis
   * `readAll()`, donc `refresh()` levait, `setData` n'était jamais appelé et
   * `ready` ne passait JAMAIS à `true` : toutes les pages restaient figées
   * sur leurs squelettes, sans un message.
   */
  lastBackupAt: (): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(lastBackupKey);
    } catch {
      return null;
    }
  },
  saveLastBackupAt: (iso: string): boolean => writeKey(lastBackupKey, iso),
  workItems: (): WorkItem[] => (typeof window === "undefined" ? [] : readList(workItemsKey).map(normalizeWorkItem)),
  /** REMPLACE intégralement les travaux stockés — restauration d'une sauvegarde uniquement, voir `mergeWorkItems`. */
  saveWorkItems: (items: WorkItem[]): boolean => writeKey(workItemsKey, JSON.stringify(items)),
  /**
   * Écriture incrémentale sûre — même contrat que `mergeSessions`/`mergeExercises`.
   *
   * Utilisable ici pour la même raison qu'ailleurs, et à une seule condition :
   * un travail n'est JAMAIS retiré de la liste, il passe au statut
   * « abandonné » (voir `WorkItemStatus`). Supprimer physiquement une ligne
   * casserait l'invariant sur lequel `mergeStored` repose.
   */
  mergeWorkItems: (items: WorkItem[]): WorkItem[] => {
    return mergeAndStore(workItemsKey, items, normalizeWorkItem);
  },
  grades: (): Grade[] =>
    typeof window === "undefined" ? [] : readList(gradesKey).map(normalizeGrade).filter((item): item is Grade => item !== null),
  /** REMPLACE intégralement les notes — restauration d'une sauvegarde uniquement, voir `mergeGrades`. */
  saveGrades: (items: Grade[]): boolean => writeKey(gradesKey, JSON.stringify(items)),
  /**
   * Écriture incrémentale. Une note SE SUPPRIME (contrairement à une séance
   * ou un exercice) : on saisit 14 au lieu de 4, on corrige. La fusion par
   * identifiant ressusciterait la note effacée depuis une copie React
   * périmée — `saveGrades` remplace donc, comme `saveChapters`, qui a
   * exactement le même profil.
   */
  weekSnapshots: (): WeekSnapshot[] =>
    typeof window === "undefined" ? [] : readList(weekSnapshotsKey).map(normalizeWeekSnapshot).filter((item): item is WeekSnapshot => item !== null),
  saveWeekSnapshots: (items: WeekSnapshot[]): boolean => writeKey(weekSnapshotsKey, JSON.stringify(items)),
  dayPlans: (): DayPlanRecord[] =>
    typeof window === "undefined"
      ? []
      : readList(dayPlansKey).map(normalizeDayPlanRecord).filter((item): item is DayPlanRecord => item !== null),
  saveDayPlans: (items: DayPlanRecord[]): boolean => writeKey(dayPlansKey, JSON.stringify(items)),
  reviewItems: (): ReviewItem[] =>
    typeof window === "undefined"
      ? []
      : readList(reviewItemsKey).map(normalizeReviewItem).filter((item): item is ReviewItem => item !== null),
  /**
   * REMPLACE, jamais de fusion — même profil que `saveGrades` et
   * `saveChapters`. Une entrée du carnet SE SUPPRIME (faute de frappe, ligne
   * devenue inutile) : la fusion par identifiant de `mergeStored` conserve
   * toute entrée présente sur le disque et absente de la liste entrante, elle
   * ressusciterait donc à l'écriture suivante la ligne que l'élève vient
   * d'effacer.
   */
  saveReviewItems: (items: ReviewItem[]): boolean => writeKey(reviewItemsKey, JSON.stringify(items)),
  /* ── Carnet d'erreurs ── */
  errors: (): ErrorEntry[] =>
    typeof window === "undefined" ? [] : readList(errorsKey).map(normalizeErrorEntry).filter((item): item is ErrorEntry => item !== null),
  /**
   * REMPLACE, jamais de fusion — même profil que `saveGrades` et
   * `saveReviewItems` : une erreur mal saisie SE SUPPRIME, et la fusion par
   * identifiant la ressusciterait à l'écriture suivante.
   */
  saveErrors: (items: ErrorEntry[]): boolean => writeKey(errorsKey, JSON.stringify(items)),
  /* ── Check-in du soir ── */
  checkins: (): DailyCheckin[] =>
    typeof window === "undefined"
      ? []
      : dedupeCheckins(readList(checkinsKey).map(normalizeCheckin).filter((item): item is DailyCheckin => item !== null)),
  /**
   * REMPLACE — la liste entière, déjà mise à jour par
   * lib/checkin-insights.ts#upsertCheckin. Un check-in ne se supprime pas,
   * mais il se CORRIGE, et la clé est le jour : une fusion par `id` comme
   * `mergeStored` n'aurait aucune prise ici.
   */
  saveCheckins: (items: DailyCheckin[]): boolean => writeKey(checkinsKey, JSON.stringify(items)),
};

/**
 * Au-delà de ce nombre de jours sans export, la sauvegarde est périmée.
 *
 * SEPT jours, et pas quatorze comme auparavant : TaekdHub n'a pas de compte,
 * tout vit dans le stockage local du navigateur. Or Safari (iOS comme macOS)
 * efface le stockage local d'un site avec lequel l'utilisateur n'a pas
 * interagi depuis 7 jours. Le filet de sécurité se déclenchait donc APRÈS la
 * menace qu'il est censé couvrir : une semaine de vacances suffisait à tout
 * perdre sans que le rappel se soit jamais affiché.
 */
export const BACKUP_REMINDER_DAYS = 7;

/** Jours écoulés depuis la dernière sauvegarde, ou `null` si aucune n'a jamais été faite (distinct de 0, qui signifie "aujourd'hui"). */
export function daysSinceBackup(lastBackupAt: string | null, now: Date = new Date()): number | null {
  if (!lastBackupAt) return null;
  return Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86400000);
}

/**
 * Point d'export unique (finalisation V1) — réutilisé par Réglages (bouton
 * "Exporter") et par le rappel de sauvegarde du Dashboard, pour ne jamais
 * dupliquer le mécanisme de sauvegarde. Enregistre l'horodatage à chaque
 * export réussi, seule donnée nouvelle introduite par le rappel.
 */
/**
 * Résultat d'une restauration — voir `restoreBackup`.
 *
 * Existe parce qu'un booléen ne suffit pas : l'élève doit savoir CE QUI est
 * passé et ce qui ne l'est pas, sinon « échec » est aussi inexploitable que
 * l'ancien « réussi » inconditionnel.
 */
export interface RestoreOutcome {
  /** Vrai seulement si TOUTES les collections ont été écrites (onze depuis le check-in du soir). */
  ok: boolean;
  /** Collections réellement écrites, dans l'ordre de tentative. */
  restored: string[];
  /** La collection sur laquelle on s'est arrêté, `null` si tout est passé. */
  failedAt: string | null;
  /** Vrai quand l'échec est survenu AVANT toute écriture : l'appareil est exactement dans son état d'avant. */
  intact: boolean;
}

/**
 * Restaure une sauvegarde, et DIT LA VÉRITÉ sur ce qui a été écrit.
 *
 * L'ancienne version (components/data-backup.tsx) enchaînait huit écritures
 * sans lire un seul des huit booléens de `writeKey`, puis affichait
 * « Sauvegarde restaurée » quoi qu'il arrive. Sur un stockage saturé — le cas
 * NORMAL ici, puisqu'on réécrit une banque de ~2,8 Mo par-dessus une autre —
 * l'élève se retrouvait avec un mélange de deux appareils : des séances
 * important d'un fichier, des exercices restés ceux de la machine, ses notes
 * effacées et jamais remplacées, et la certitude que tout était en place.
 *
 * DEUX RÈGLES, et elles suffisent :
 *
 *  1. LA BANQUE D'ABORD. C'est de loin la plus grosse écriture, donc celle
 *     qui échoue en premier ; la tenter en tête garantit que le refus le plus
 *     probable survient quand RIEN n'a encore été touché (`intact: true`).
 *  2. ON S'ARRÊTE AU PREMIER REFUS. Poursuivre ne « sauve » rien : cela
 *     fabrique un état mi-fichier mi-appareil, avec des `exercise_id`
 *     orphelins. Mieux vaut un état cohérent d'avant qu'un état incohérent
 *     d'après.
 *
 * Les préférences passent en dernier : ce sont les plus petites, et les
 * seules dont la perte ne coûte que quelques clics.
 *
 * Fonction impure par nature (elle écrit), mais sans aucune dépendance React
 * ni DOM — c'est ce qui la rend testable, ce que le gestionnaire de clic
 * qu'elle remplace n'était pas.
 */
export function restoreBackup(payload: BackupPayload): RestoreOutcome {
  const steps: Array<[string, () => boolean]> = [
    ["les exercices", () => localData.saveExercises(payload.exercises)],
    // Juste après la banque : les exercices y renvoient par `chapter_id`, les
    // séparer d'une écriture ratée laisserait des chapitres fantômes.
    ["les chapitres", () => localData.saveChapters(payload.chapters ?? [])],
    ["les séances", () => localData.saveSessions(payload.sessions)],
    ["les échéances", () => localData.saveWorkItems(payload.workItems ?? [])],
    ["les notes", () => localData.saveGrades(payload.grades ?? [])],
    // Absent d'une sauvegarde antérieure au carnet : `[]`, comme les autres
    // collections optionnelles — l'import REMPLACE, il ne complète pas.
    ["le carnet à revoir", () => localData.saveReviewItems(payload.reviewItems ?? [])],
    // Même règle : absent d'une sauvegarde antérieure au carnet d'erreurs ⇒ `[]`.
    ["le carnet d'erreurs", () => localData.saveErrors(payload.errors ?? [])],
    // Check-in du soir : absent d'une sauvegarde antérieure ⇒ `[]`.
    ["les check-ins du soir", () => localData.saveCheckins(payload.checkins ?? [])],
    ["le planning", () => localData.saveDayPlans(payload.dayPlans ?? [])],
    ["les bilans de semaine", () => localData.saveWeekSnapshots(payload.weekSnapshots ?? [])],
    ["les réglages", () => localData.savePreferences(normalizePreferences(payload.preferences))],
  ];

  const restored: string[] = [];
  for (const [label, write] of steps) {
    if (!write()) return { ok: false, restored, failedAt: label, intact: restored.length === 0 };
    restored.push(label);
  }
  return { ok: true, restored, failedAt: null, intact: false };
}

/**
 * Le CONTENU d'une sauvegarde, lu depuis le disque — séparé de
 * `exportBackup` (qui, lui, déclenche un téléchargement) pour que le
 * round-trip export → JSON → `validateBackupPayload` → `restoreBackup` se
 * teste sans navigateur (lib/storage.test.ts). Sans cette séparation, une
 * collection oubliée à l'export ne se voyait qu'au jour du changement
 * d'ordinateur — c'est-à-dire trop tard.
 */
export function buildBackupPayload(now: Date = new Date()): BackupPayload {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    exercises: localData.exercises(),
    sessions: localData.sessions(),
    preferences: localData.preferences(),
    // `chapters` (Sprint 3D) : indispensable dans la sauvegarde — les
    // exercices y renvoient par `chapter_id`. Sans lui, un changement
    // d'ordinateur restaurerait des exercices avec des chapitres
    // fantômes (chapter_id pointant vers un catalogue vide).
    chapters: localData.chapters(),
    weekSnapshots: localData.weekSnapshots(),
    // Les échéances et les travaux planifiés sont de la saisie MANUELLE de
    // l'élève — la donnée la moins reconstituable de tout le fichier. Une
    // sauvegarde qui les oublierait perdrait exactement ce qu'aucun
    // amorçage ne peut recréer.
    workItems: localData.workItems(),
    // Les notes sont saisies à la main et ne se recalculent pas : une
    // sauvegarde qui les oublierait perdrait un trimestre de résultats.
    grades: localData.grades(),
    // Les intentions de planning passées ne sont pas reconstituables non
    // plus — voir `DayPlanRecord`.
    dayPlans: localData.dayPlans(),
    // Le carnet « À revoir » est de la saisie manuelle pure, et les
    // cartouches de méthode sont le fruit d'une année de corrigés
    // disséqués : exactement ce qu'aucun amorçage ne peut recréer.
    reviewItems: localData.reviewItems(),
    // Le carnet d'erreurs : saisie manuelle pure, irremplaçable.
    errors: localData.errors(),
    // Check-in du soir : saisie manuelle, jour après jour — irrécupérable.
    checkins: localData.checkins(),
  };
}

export function exportBackup(): void {
  const data = JSON.stringify(buildBackupPayload(), null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taekdhub-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  // L'ancre DOIT être dans le document, et l'URL objet ne doit PAS être
  // révoquée dans la foulée de `click()`. Révoquer immédiatement est une
  // course : le téléchargement n'a pas forcément commencé de lire le Blob
  // (Firefox, Safari), et l'URL révoquée le fait échouer — silencieusement,
  // puisque rien n'est levé. Le rappel de sauvegarde, lui, était quand même
  // remis à zéro juste en dessous : l'élève repartait pour SEPT jours en
  // croyant avoir une copie de son année qui n'existait pas. C'est
  // exactement le scénario que ce rappel existe pour éviter.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  localData.saveLastBackupAt(new Date().toISOString());
}

/**
 * Forme d'un fichier de sauvegarde exporté par components/data-backup.tsx.
 * `weekSnapshots` est optionnel : une sauvegarde exportée avant le Sprint
 * 2.1 n'a pas ce champ — voir `validateBackupPayload` et
 * components/data-backup.tsx#confirmImport, qui restaurent `[]` dans ce cas.
 */
export interface BackupPayload {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: WorkSession[];
  preferences: Preferences;
  /** Optionnel : une sauvegarde exportée avant l'ajout des chapitres à l'export n'a pas ce champ ; restauré à `[]` dans ce cas (voir components/data-backup.tsx#confirmImport). */
  chapters?: Chapter[];
  weekSnapshots?: WeekSnapshot[];
  /** Optionnel : une sauvegarde exportée avant ce chantier n'a pas ce champ ; restauré à `[]` dans ce cas (voir components/data-backup.tsx#confirmImport). */
  workItems?: WorkItem[];
  /** Optionnel, même raison — voir `Grade`. */
  grades?: Grade[];
  /** Optionnel, même raison — voir `DayPlanRecord`. */
  dayPlans?: DayPlanRecord[];
  /** Optionnel, même raison — voir `ReviewItem`. */
  reviewItems?: ReviewItem[];
  /** Optionnel, même raison — voir `ErrorEntry`. */
  errors?: ErrorEntry[];
  /** Optionnel, même raison — voir `DailyCheckin`. */
  checkins?: DailyCheckin[];
}

/**
 * Vérifie la forme MINIMALE d'un JSON importé (frontière de confiance du
 * fichier utilisateur — voir components/data-backup.tsx). Volontairement
 * permissif sur les valeurs de `subject`/`status` (juste `string`, pas la
 * liste exacte) et accepte aussi bien `title` (Sprint 2.5) que l'ancien
 * `chapter` (Sprint 1/2A) : une sauvegarde exportée avant ce sprint doit
 * rester importable, `normalizeExercise`/`normalizeSession` se chargent
 * ensuite de migrer ses valeurs au prochain chargement.
 */
function isValidExerciseShape(value: unknown): value is Exercise {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.subject === "string" &&
    (typeof value.title === "string" || typeof value.chapter === "string") &&
    typeof value.source === "string" &&
    typeof value.difficulty === "number" &&
    typeof value.status === "string" &&
    // `duration_minutes` n'est plus exigé (Sprint 2.6) : les sauvegardes
    // exportées désormais ne l'ont plus (valeur dérivée, jamais stockée) ;
    // celles exportées avant ce sprint l'ont encore mais il est ignoré.
    typeof value.created_at === "string"
  );
}

function isValidSessionShape(value: unknown): value is WorkSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.subject === "string" &&
    typeof value.started_at === "string" &&
    typeof value.duration_seconds === "number"
  );
}

export function validateBackupPayload(data: unknown): data is BackupPayload {
  if (!isRecord(data)) return false;
  if (!Array.isArray(data.exercises) || !data.exercises.every(isValidExerciseShape)) return false;
  if (!Array.isArray(data.sessions) || !data.sessions.every(isValidSessionShape)) return false;
  if (!isRecord(data.preferences)) return false;
  // Absent (sauvegarde d'avant le Sprint 2.1) ou tableau — jamais required :
  // c'est tout le sens de la rétrocompatibilité ici. La forme fine de chaque
  // entrée est revalidée par `normalizeWeekSnapshot` à la prochaine lecture
  // (même principe que exercises/sessions, voir plus haut).
  if (data.weekSnapshots !== undefined && !Array.isArray(data.weekSnapshots)) return false;
  // Idem : absent d'une sauvegarde exportée avant l'ajout des chapitres à
  // l'export ; chaque entrée est revalidée par `normalizeChapter` à la lecture.
  if (data.chapters !== undefined && !Array.isArray(data.chapters)) return false;
  /*
   * Les trois collections des chantiers Planning et Analytics ÉCHAPPAIENT à
   * cette validation — oubli, pas décision. Un fichier dont `workItems` est
   * une chaîne (sauvegarde tronquée, fusion de deux fichiers, édition
   * manuelle) était donc accepté, écrit tel quel, puis relu `[]` par
   * `readList` : toutes les échéances de l'appareil effacées et remplacées
   * par rien, sans un mot. C'est précisément la donnée que `exportBackup`
   * décrit comme la moins reconstituable du fichier.
   *
   * Même règle que ci-dessus : `undefined` reste valide (sauvegarde
   * antérieure à ces chantiers), la forme fine de chaque entrée reste du
   * ressort de `normalizeWorkItem`/`normalizeGrade`/`normalizeDayPlanRecord`
   * à la lecture.
   */
  if (data.workItems !== undefined && !Array.isArray(data.workItems)) return false;
  if (data.grades !== undefined && !Array.isArray(data.grades)) return false;
  if (data.dayPlans !== undefined && !Array.isArray(data.dayPlans)) return false;
  // Le carnet « À revoir » suit la même règle dès sa naissance, plutôt que
  // d'attendre qu'on redécouvre l'oubli : absent (sauvegarde antérieure) ⇒
  // restauré à `[]` ; présent mais pas un tableau ⇒ fichier refusé, jamais
  // un carnet effacé en silence.
  if (data.reviewItems !== undefined && !Array.isArray(data.reviewItems)) return false;
  // Carnet d'erreurs : même règle dès sa naissance.
  if (data.errors !== undefined && !Array.isArray(data.errors)) return false;
  // Check-in du soir : même règle, dès sa naissance.
  if (data.checkins !== undefined && !Array.isArray(data.checkins)) return false;
  return true;
}
