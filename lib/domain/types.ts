/**
 * ============================================================================
 * MODÈLE DE DONNÉES — TaekdHub, système de pilotage de prépa
 * ============================================================================
 *
 * Le concept central est la TÂCHE. TaekdHub n'héberge AUCUN contenu
 * pédagogique : les énoncés, les cours, les TD et les annales vivent ailleurs
 * (classeurs, livres, banques de concours). Une tâche dit « faire les
 * exercices 12 à 18 du TD 4 », éventuellement avec un lien — jamais l'énoncé
 * lui-même.
 *
 * Quatre objets seulement sont écrits par l'élève :
 *
 *   Task        ce qu'il y a à faire, avec son échéance et son estimation.
 *   TimeEntry   du temps RÉELLEMENT travaillé. Seule source de vérité du
 *               temps réel : `Task` n'a pas de champ `actualMinutes` écrit à
 *               la main, il est TOUJOURS dérivé (voir domain/tasks.ts), pour
 *               qu'il n'existe jamais deux vérités contradictoires.
 *   Goal        un objectif, auquel des tâches se rattachent.
 *   Routine     un gabarit de tâche récurrente, qui matérialise de vraies
 *               tâches à l'avance.
 *
 * Le reste (`Availability`, `Settings`) est de la configuration.
 */

/** Jour de la semaine, 0 = lundi … 6 = dimanche — la semaine de travail commence le lundi partout dans l'app. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Lundi",
  1: "Mardi",
  2: "Mercredi",
  3: "Jeudi",
  4: "Vendredi",
  5: "Samedi",
  6: "Dimanche",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Lun",
  1: "Mar",
  2: "Mer",
  3: "Jeu",
  4: "Ven",
  5: "Sam",
  6: "Dim",
};

/**
 * MATIÈRE — extensible par l'élève, jamais figée dans le code.
 *
 * Les matières par défaut couvrent une prépa scientifique (voir
 * `DEFAULT_SUBJECTS`), mais rien n'empêche d'en ajouter une : ce sont des
 * données, pas un type union. Une tâche référence une matière par `id`, donc
 * renommer une matière ne casse aucune tâche.
 */
export interface Subject {
  id: string;
  label: string;
  /** Une à deux lettres, pour la pastille de matière dans les listes. */
  short: string;
  /** Clé de teinte — voir `SUBJECT_TONES` (domain/subjects.ts). Pas un hex : la palette suit le thème clair/sombre. */
  tone: SubjectTone;
  /** Ordre d'affichage, croissant. */
  order: number;
  archived?: boolean;
}

export type SubjectTone = "violet" | "sky" | "emerald" | "teal" | "amber" | "orange" | "rose";

/**
 * CATÉGORIE DE TÂCHE — la NATURE du travail, pas la matière.
 *
 * Quatre familles (cours / exercices / évaluations / organisation). La
 * catégorie sert à trois choses concrètes, jamais décoratives :
 *   — le calendrier distingue une échéance d'évaluation d'une tâche ordinaire ;
 *   — le bilan hebdomadaire mesure le temps par famille (« tu reportes
 *     systématiquement l'apprentissage ») ;
 *   — la priorisation donne un poids propre aux évaluations (domain/priority.ts).
 *
 * Volontairement une union fermée : un champ libre aurait produit quinze
 * orthographes de « révision » en un mois, et aucune statistique exploitable.
 * Ajouter une valeur ici reste une ligne de code, et la migration du stockage
 * tolère déjà les valeurs inconnues (elles retombent sur `autre`).
 */
export type TaskCategory =
  // Cours
  | "cours-apprendre"
  | "cours-revoir"
  | "cours-definitions"
  | "cours-theoremes"
  | "cours-demonstrations"
  // Exercices
  | "exo-td"
  | "exo-dm"
  | "exo-annales"
  | "exo-personnels"
  | "exo-calcul"
  | "exo-professeur"
  // Évaluations
  | "eval-ds"
  | "eval-kholle"
  | "eval-interro"
  | "eval-concours-blanc"
  // Organisation
  | "org-preparation"
  | "org-correction"
  | "org-revision"
  | "org-bilan"
  | "org-classement"
  | "autre";

export type CategoryFamily = "cours" | "exercices" | "evaluations" | "organisation";

/**
 * CYCLE DE VIE d'une tâche.
 *
 * `cancelled` (« abandonnée ») n'est pas un doublon de la suppression : une
 * tâche abandonnée reste dans l'historique et compte dans le bilan
 * hebdomadaire — c'est une information sur l'organisation de la semaine, pas
 * un déchet. Supprimer, c'est dire « cette tâche n'aurait jamais dû
 * exister ».
 */
export type TaskStatus = "todo" | "doing" | "done" | "cancelled";

/** Un créneau de travail posé dans le calendrier. Bornes ISO, `end` exclusif. */
export interface TaskSlot {
  start: string;
  end: string;
}

/** 1 = basse … 4 = critique. Un entier ordonné, pas une chaîne : la priorisation l'utilise comme poids. */
export type Priority = 1 | 2 | 3 | 4;

export const PRIORITIES: readonly Priority[] = [1, 2, 3, 4];

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "Basse",
  2: "Normale",
  3: "Haute",
  4: "Critique",
};

/**
 * TÂCHE — l'objet central.
 *
 * DATES : toutes en ISO 8601 complet (`2026-09-18T18:00:00.000Z` ou avec
 * offset local selon la saisie). Une seule exception assumée, `dueDateOnly` :
 * beaucoup d'échéances n'ont pas d'heure (« DM de physique pour lundi »), et
 * inventer 23:59 rendait le calendrier faux. Le drapeau dit « cette heure
 * n'est pas une vraie heure » — voir domain/date.ts#formatDue.
 *
 * DURÉES : toujours en MINUTES, entières et positives.
 */
export interface Task {
  id: string;
  title: string;
  subjectId?: string;
  category: TaskCategory;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  /** Charge estimée, en minutes. Absente = non estimée (la planification utilise alors `Settings.defaultEstimateMinutes`). */
  estimatedMinutes?: number;
  /** Échéance : à faire AVANT cette date. Absente = travail de fond, sans date imposée. */
  dueAt?: string;
  /** `true` quand l'échéance n'a pas d'heure significative (« pour lundi »). */
  dueDateOnly?: boolean;
  /**
   * CRÉNEAUX posés dans le calendrier — quand l'élève prévoit RÉELLEMENT de
   * travailler dessus. Distinct de `dueAt` (« pour quand c'est »).
   *
   * Une LISTE, et non le couple `scheduledStart` / `scheduledEnd` du premier
   * jet : un DM de 3 h ne se traite presque jamais d'un bloc, et toute la
   * valeur de la planification est justement de le RÉPARTIR (mercredi 1 h 30,
   * jeudi 1 h 30). Avec un créneau unique, « répartir » aurait voulu dire
   * créer trois fausses tâches, et la charge par jour serait devenue fausse.
   *
   * Invariants tenus par domain/tasks.ts : triés par début croissant, jamais
   * vides (une tâche non planifiée a `slots: []`), `end > start`.
   * `scheduledStart` / `scheduledEnd` restent disponibles en LECTURE, comme
   * dérivés (voir `firstSlotStart` / `lastSlotEnd`).
   */
  slots: TaskSlot[];
  completedAt?: string;
  /** Provenance libre : « TD 4 », « Livre Dunod p. 112 », « cahier de calcul ». */
  source?: string;
  sourceUrl?: string;
  notes?: string;
  goalId?: string;
  /** Renseigné quand la tâche a été matérialisée depuis une `Routine`. */
  routineId?: string;
  /** Nombre de fois où la tâche a été REPORTÉE (créneau repoussé). Alimente l'historique et la priorisation. */
  postponedCount: number;
  lastPostponedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * TEMPS RÉELLEMENT TRAVAILLÉ — la contrepartie factuelle du planning.
 *
 * `taskId` est facultatif : « 1h30 de cahier de calcul » est du travail réel
 * qui ne correspond à aucune tâche fichée. Dans ce cas `subjectId` porte
 * l'imputation par matière, pour que le bilan reste juste.
 */
export interface TimeEntry {
  id: string;
  taskId?: string;
  subjectId?: string;
  /** Début réel (ISO). Le bilan hebdomadaire range l'entrée dans la journée de ce début. */
  startedAt: string;
  minutes: number;
  note?: string;
  createdAt: string;
}

export type GoalStatus = "active" | "done" | "archived";

/**
 * OBJECTIF — « être à jour en physique », « faire 5 h de maths cette semaine ».
 *
 * Deux natures de mesure, non exclusives :
 *   — par TÂCHES : les tâches qui portent ce `goalId` (progression = part terminée) ;
 *   — par TEMPS : `targetMinutes`, mesuré sur les entrées de temps rattachées.
 */
export interface Goal {
  id: string;
  title: string;
  description?: string;
  subjectId?: string;
  targetDate?: string;
  targetMinutes?: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

/** Règle de récurrence — volontairement minimale : deux formes couvrent tout ce qu'un élève de prépa décrit réellement. */
export type RecurrenceRule =
  | { kind: "weekly"; weekdays: Weekday[] }
  | { kind: "everyNDays"; days: number };

/**
 * ROUTINE — un gabarit qui MATÉRIALISE de vraies tâches à l'avance.
 *
 * Choix structurant : une routine ne s'affiche jamais « en tant que routine »
 * dans le planning. Elle crée des `Task` normales sur l'horizon
 * (`horizonDays`), qui se reportent, se terminent et se comptent comme les
 * autres. Un objet fantôme, présent dans la vue mais absent des données,
 * fausserait toute mesure de charge.
 */
export interface Routine {
  id: string;
  title: string;
  subjectId?: string;
  category: TaskCategory;
  estimatedMinutes?: number;
  priority: Priority;
  rule: RecurrenceRule;
  /** Nombre de jours d'avance matérialisés. Court par défaut : une routine ne doit pas remplir le calendrier de trois semaines de tâches fantômes. */
  horizonDays: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Plage horaire d'un jour, en heures locales « HH:MM ». `end` est exclusif et toujours > `start`. */
export interface TimeRange {
  start: string;
  end: string;
  label?: string;
}

/**
 * DISPONIBILITÉS — la capacité réelle de travail.
 *
 * `weekly` est le rythme ordinaire ; `exceptions` REMPLACE (jamais ne
 * complète) le rythme d'une date donnée — un jour férié se décrit par une
 * exception à zéro plage, ce qu'une simple addition ne saurait pas exprimer.
 */
export interface Availability {
  weekly: Record<Weekday, TimeRange[]>;
  exceptions: AvailabilityException[];
}

export interface AvailabilityException {
  /** Jour local au format `YYYY-MM-DD`. */
  date: string;
  ranges: TimeRange[];
  label?: string;
}

export interface Settings {
  displayName: string;
  /** Hex de l'accent — voir lib/theme.ts. */
  accent: string;
  themeMode: "light" | "dark" | "system";
  /** Estimation retenue quand une tâche n'en porte pas — la planification a besoin d'un nombre, pas d'un trou. */
  defaultEstimateMinutes: number;
  /**
   * Part de la capacité d'une journée au-delà de laquelle le planning est
   * jugé TENDU (avant d'être « surchargé » à 100 %). Une journée remplie à
   * 95 % n'a aucune marge pour un imprévu : le dire avant le débordement est
   * tout l'intérêt du signal.
   */
  tightLoadRatio: number;
}

/**
 * ÉTAT PERSISTÉ — un seul objet, une seule clé de stockage.
 *
 * Un blob unique plutôt que six clés indépendantes : l'écriture devient
 * atomique (jamais de tâches enregistrées sans leur entrée de temps), la
 * sauvegarde est exactement l'état, et une future table Supabase
 * `user_state` ou un découpage en tables se dérivent tous les deux de cette
 * forme sans réécrire l'application (voir lib/store/repository.ts).
 */
export interface AppState {
  version: number;
  tasks: Task[];
  timeEntries: TimeEntry[];
  goals: Goal[];
  routines: Routine[];
  subjects: Subject[];
  availability: Availability;
  settings: Settings;
}
