import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import type { Difficulty, Exercise, ExerciseStatus, ExerciseType, Mastery, Priority, Subject, WorkSession } from "@/lib/supabase/types";

const sessionsKey = "prepahub:sessions";
const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";

export type Preferences = { displayName: string; dailyGoalMinutes: number; contestDate: string };
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 240, contestDate: "" };

/**
 * Valeurs par défaut pour les champs Sprint 2.5 — proposées, à ajuster si
 * besoin (voir rapport de sprint). Utilisées à la fois pour la migration des
 * anciennes données (ci-dessous) et pour la création d'un nouvel exercice
 * (components/exercises/exercise-manager.tsx), afin de n'avoir qu'une seule
 * source de vérité pour ces défauts.
 */
export const DEFAULT_PRIORITY: Priority = 3;
export const DEFAULT_MASTERY: Mastery = 0;
const MASTERY_VALUES: readonly Mastery[] = [0, 25, 50, 75, 100];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function migratePriority(raw: unknown): Priority {
  return typeof raw === "number" && raw >= 1 && raw <= 5 ? (Math.round(raw) as Priority) : DEFAULT_PRIORITY;
}

function migrateMastery(raw: unknown): Mastery {
  return typeof raw === "number" && (MASTERY_VALUES as number[]).includes(raw) ? (raw as Mastery) : DEFAULT_MASTERY;
}

function stringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
}

/** Ramène une session, potentiellement issue d'une ancienne sauvegarde (matière, champs manquants), vers la forme actuelle de `WorkSession`. */
function normalizeSession(raw: unknown): WorkSession {
  const item = isRecord(raw) ? raw : {};
  const startedAt = typeof item.started_at === "string" ? item.started_at : new Date().toISOString();
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    /** Absent avant le Sprint 2.5 : aucune ancienne session n'était liée à un exercice. */
    exercise_id: typeof item.exercise_id === "string" ? item.exercise_id : null,
    started_at: startedAt,
    ended_at: typeof item.ended_at === "string" ? item.ended_at : null,
    duration_seconds: typeof item.duration_seconds === "number" ? item.duration_seconds : 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: typeof item.created_at === "string" ? item.created_at : startedAt,
  };
}

/** Ramène un exercice, potentiellement issu d'une ancienne sauvegarde (Sprint 1/2A), vers la forme actuelle de `Exercise`. */
function normalizeExercise(raw: unknown): Exercise {
  const item = isRecord(raw) ? raw : {};
  // Sprint 2.5 : `chapter` (Sprint 1/2A) devient `title` ; `chapter_id` est un
  // nouveau champ qui référencera le futur catalogue de chapitres.
  const title = typeof item.title === "string" ? item.title : typeof item.chapter === "string" ? item.chapter : "";
  const createdAt = typeof item.created_at === "string" ? item.created_at : new Date().toISOString();
  // Sprint 2.5 : `last_opened_at` renommé `last_worked_at`.
  const lastWorkedAt = typeof item.last_worked_at === "string" ? item.last_worked_at : typeof item.last_opened_at === "string" ? item.last_opened_at : null;
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    subject: migrateSubject(item.subject),
    title,
    chapter_id: typeof item.chapter_id === "string" ? item.chapter_id : null,
    source: typeof item.source === "string" ? item.source : "",
    year: typeof item.year === "number" ? item.year : null,
    type: migrateType(item.type),
    difficulty: migrateDifficulty(item.difficulty),
    priority: migratePriority(item.priority),
    mastery: migrateMastery(item.mastery),
    status: migrateStatus(item.status),
    // Sprint 2.6 : `duration_minutes` n'existe plus — le temps passé se
    // calcule à la demande via `minutesSpentOnExercise` (lib/study.ts). Un
    // éventuel `duration_minutes` présent dans d'anciennes données (Sprint 1
    // à 2.5) est simplement ignoré ici, pas migré.
    estimated_minutes: typeof item.estimated_minutes === "number" ? item.estimated_minutes : null,
    attempts: typeof item.attempts === "number" ? item.attempts : 0,
    note: typeof item.note === "string" ? item.note : null,
    created_at: createdAt,
    updated_at: typeof item.updated_at === "string" ? item.updated_at : createdAt,
    tags: stringArray(item.tags),
    favorite: Boolean(item.favorite),
    archived: Boolean(item.archived),
    hints: stringArray(item.hints),
    correction: typeof item.correction === "string" ? item.correction : null,
    last_worked_at: lastWorkedAt,
  };
}

export const localData = {
  sessions: (): WorkSession[] =>
    typeof window === "undefined" ? [] : (JSON.parse(localStorage.getItem(sessionsKey) || "[]") as unknown[]).map(normalizeSession),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] =>
    typeof window === "undefined" ? [] : (JSON.parse(localStorage.getItem(exercisesKey) || "[]") as unknown[]).map(normalizeExercise),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
  preferences: (): Preferences => (typeof window === "undefined" ? defaults : { ...defaults, ...JSON.parse(localStorage.getItem(preferencesKey) || "{}") }),
  savePreferences: (preferences: Preferences) => localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
};

/** Forme d'un fichier de sauvegarde exporté par components/data-backup.tsx. */
export interface BackupPayload {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: WorkSession[];
  preferences: Preferences;
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
  return true;
}
