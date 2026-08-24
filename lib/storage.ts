import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import { DEFAULT_ACCENT, DEFAULT_THEME_MODE, hexToRgb, THEME_MODES, type ThemeMode } from "@/lib/theme";
import type { AttemptResult, Difficulty, Exercise, ExerciseLevel, ExerciseStatus, ExerciseType, LicenseStatus, Mastery, Priority, ProgrammeLevel, Subject, WorkSession } from "@/lib/supabase/types";

const ATTEMPT_RESULTS: readonly AttemptResult[] = ["réussi", "partiel", "échoué"];

const sessionsKey = "prepahub:sessions";
const exercisesKey = "prepahub:exercises";
const preferencesKey = "prepahub:preferences";
const chaptersKey = "prepahub:chapters";
const lastBackupKey = "prepahub:last-backup";
const weekSnapshotsKey = "prepahub:week-snapshots";

/**
 * `accent` (Sprint identité visuelle) : hex de la couleur d'accent choisie — voir lib/theme.ts.
 * `themeMode` (Sprint personnalisation) : clair/sombre/système — voir lib/theme.ts#ThemeMode, indépendant de `accent`.
 * `weeklyGoalMinutes` (Sprint Plan de travail) : objectif hebdomadaire, indépendant de `dailyGoalMinutes`
 * (voir lib/week.ts#computeWeeklySummary) — alimente le Dashboard ("Cette semaine") et les statistiques.
 * Absents d'une préférence enregistrée avant leur sprint respectif : retombent sur `defaults` via le
 * merge ci-dessous, comme tout champ ajouté après coup.
 */
export type Preferences = { displayName: string; dailyGoalMinutes: number; weeklyGoalMinutes: number; contestDate: string; accent: string; themeMode: ThemeMode };
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 240, weeklyGoalMinutes: 300, contestDate: "", accent: DEFAULT_ACCENT, themeMode: DEFAULT_THEME_MODE };

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
const PROGRAMME_LEVELS: readonly ProgrammeLevel[] = ["sup", "spe", "sup_spe"];
const EXERCISE_LEVELS: readonly ExerciseLevel[] = [1, 2, 3, 4, 5, 6];
const LICENSE_STATUSES: readonly LicenseStatus[] = ["libre", "à vérifier", "restreint"];

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

/**
 * Ramène une session, potentiellement issue d'une ancienne sauvegarde
 * (matière, champs manquants), vers la forme actuelle de `WorkSession`.
 * Exportée (Sprint 5) pour que lib/storage.test.ts vérifie directement la
 * rétrocompatibilité et le round-trip export/import de `result`, sans avoir
 * à simuler `localStorage`.
 */
export function normalizeSession(raw: unknown): WorkSession {
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
    // Absent de toute séance antérieure à ce champ (et de toute séance libre,
    // sans exercice) : null, jamais deviné — voir la doc du champ dans
    // lib/supabase/types.ts.
    result: (ATTEMPT_RESULTS as string[]).includes(item.result as string) ? (item.result as AttemptResult) : null,
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
  const createdAt = typeof item.created_at === "string" ? item.created_at : new Date().toISOString();
  // Sprint 2.5 : `last_opened_at` renommé `last_worked_at`.
  const lastWorkedAt = typeof item.last_worked_at === "string" ? item.last_worked_at : typeof item.last_opened_at === "string" ? item.last_opened_at : null;
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
    source_url: typeof item.source_url === "string" && item.source_url.trim() ? item.source_url : null,
    prerequisites: stringArray(item.prerequisites),
    pedagogical_goal: typeof item.pedagogical_goal === "string" && item.pedagogical_goal.trim() ? item.pedagogical_goal : null,
    level: (EXERCISE_LEVELS as number[]).includes(item.level as number) ? (item.level as ExerciseLevel) : null,
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
 * Fusionne une préférence potentiellement partielle/corrompue (import, ancienne
 * sauvegarde, édition manuelle du localStorage) avec `defaults` — même principe
 * que `normalizeExercise`/`normalizeChapter` : un champ absent OU DE MAUVAIS
 * TYPE retombe sur sa valeur par défaut plutôt que de propager une valeur
 * incohérente. Chaque champ est explicitement vérifié (comme partout ailleurs
 * dans ce fichier) — un simple `{ ...defaults, ...item }` laissait passer
 * n'importe quel type sans contrôle : un `displayName`/`accent` importé avec
 * un type incorrect (ex. un nombre au lieu d'une chaîne) faisait planter
 * l'app entière ailleurs (`preferences.displayName?.trim()` dans le Dashboard,
 * `hexToRgb(preferences.accent)` dans ThemeSync/ThemePicker — `?.` protège
 * contre `null`/`undefined`, jamais contre un type inattendu mais non-nul) —
 * reproduit réellement via un import de sauvegarde corrompue.
 *
 * `contestDate` : vérifié type STRING mais pas FORMAT jusqu'ici — un champ
 * qui `new Date(...)` en `NaN` (chaîne corrompue, format inattendu) ne
 * plante rien directement ici, mais se propage silencieusement jusqu'au
 * Dashboard (`contestDays`, app/(app)/dashboard non — dashboard-overview.tsx)
 * qui affichait littéralement "NaN j avant le concours" — reproduit
 * réellement via une préférence corrompue. `""` (aucune date choisie) reste
 * explicitement valide, seule une chaîne non vide mais non convertible en
 * date réelle retombe sur le défaut.
 */
export function normalizePreferences(raw: unknown): Preferences {
  const item = isRecord(raw) ? raw : {};
  const contestDate =
    typeof item.contestDate === "string" && (item.contestDate === "" || !Number.isNaN(new Date(item.contestDate).getTime()))
      ? item.contestDate
      : defaults.contestDate;
  return {
    displayName: typeof item.displayName === "string" ? item.displayName : defaults.displayName,
    dailyGoalMinutes: typeof item.dailyGoalMinutes === "number" && item.dailyGoalMinutes > 0 ? item.dailyGoalMinutes : defaults.dailyGoalMinutes,
    weeklyGoalMinutes: typeof item.weeklyGoalMinutes === "number" && item.weeklyGoalMinutes > 0 ? item.weeklyGoalMinutes : defaults.weeklyGoalMinutes,
    contestDate,
    accent: typeof item.accent === "string" && hexToRgb(item.accent) ? item.accent : defaults.accent,
    themeMode: (THEME_MODES as string[]).includes(item.themeMode as string) ? (item.themeMode as ThemeMode) : DEFAULT_THEME_MODE,
  };
}

/**
 * Fusionne `patch` avec les préférences RÉELLEMENT stockées à l'instant de
 * l'appel — jamais avec un instantané React potentiellement périmé.
 *
 * `usePrepahubData` n'est pas un store partagé : `components/preferences-form.tsx`
 * et `components/theme-picker.tsx` (Réglages) montent chacun leur PROPRE
 * instance du hook, chacune figée sur les préférences telles qu'elles
 * étaient à SON dernier montage/écriture. Sans cette fonction, l'un des deux
 * formulaires enregistrant `{ ...preferences, <son propre champ>: valeur }`
 * avec sa version périmée de `preferences` écrase silencieusement tout champ
 * que l'AUTRE formulaire vient de modifier entre-temps (ex. changer la
 * couleur d'accent puis enregistrer son prénom revenait à l'ancienne couleur).
 * `patchPreferences` relit `localData.preferences()` à chaque appel — la
 * seule source qui ne peut jamais être en retard sur elle-même — et n'y
 * applique que les champs explicitement fournis dans `patch`.
 */
export function patchPreferences(patch: Partial<Preferences>): Preferences {
  return { ...localData.preferences(), ...patch };
}

/**
 * Parse JSON tolérant à la corruption — une valeur illisible (JSON invalide,
 * ex. écriture localStorage interrompue par un crash navigateur, extension
 * défaillante, ou édition manuelle malformée) ne doit jamais faire planter
 * TOUTE l'application au premier `readAll()` : elle retombe sur `fallback`,
 * exactement comme un champ individuel manquant retombe déjà sur sa valeur
 * par défaut dans normalizeExercise/normalizeSession/normalizePreferences.
 * La donnée corrompue reste réellement perdue (rien à récupérer d'un JSON
 * invalide, aucune tentative de "deviner") — seule la PANNE TOTALE est
 * évitée, pour que l'utilisateur puisse au moins voir l'app tourner et
 * restaurer une sauvegarde si besoin, plutôt qu'un écran blanc sans issue.
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const localData = {
  sessions: (): WorkSession[] =>
    typeof window === "undefined" ? [] : safeParse<unknown[]>(localStorage.getItem(sessionsKey), []).map(normalizeSession),
  saveSessions: (items: WorkSession[]) => localStorage.setItem(sessionsKey, JSON.stringify(items)),
  exercises: (): Exercise[] =>
    typeof window === "undefined" ? [] : safeParse<unknown[]>(localStorage.getItem(exercisesKey), []).map(normalizeExercise),
  saveExercises: (items: Exercise[]) => localStorage.setItem(exercisesKey, JSON.stringify(items)),
  chapters: (): Chapter[] =>
    typeof window === "undefined"
      ? []
      : safeParse<unknown[]>(localStorage.getItem(chaptersKey), [])
          .map(normalizeChapter)
          .filter((item): item is Chapter => item !== null),
  saveChapters: (items: Chapter[]) => localStorage.setItem(chaptersKey, JSON.stringify(items)),
  preferences: (): Preferences =>
    typeof window === "undefined" ? defaults : normalizePreferences(safeParse<unknown>(localStorage.getItem(preferencesKey), {})),
  savePreferences: (preferences: Preferences) => localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
  /** Horodatage ISO de la dernière sauvegarde exportée (voir `exportBackup`), ou `null` si aucune n'a jamais été faite. */
  lastBackupAt: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(lastBackupKey)),
  saveLastBackupAt: (iso: string) => localStorage.setItem(lastBackupKey, iso),
  weekSnapshots: (): WeekSnapshot[] =>
    typeof window === "undefined"
      ? []
      : safeParse<unknown[]>(localStorage.getItem(weekSnapshotsKey), [])
          .map(normalizeWeekSnapshot)
          .filter((item): item is WeekSnapshot => item !== null),
  saveWeekSnapshots: (items: WeekSnapshot[]) => localStorage.setItem(weekSnapshotsKey, JSON.stringify(items)),
};

/** Rappel de sauvegarde (finalisation V1) : au-delà de ce nombre de jours sans export, la sauvegarde est considérée périmée. */
export const BACKUP_REMINDER_DAYS = 14;

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
export function exportBackup(): void {
  const data = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: localData.exercises(),
      sessions: localData.sessions(),
      preferences: localData.preferences(),
      // `chapters` (Sprint 3D) : indispensable dans la sauvegarde — les
      // exercices y renvoient par `chapter_id`. Sans lui, un changement
      // d'ordinateur restaurerait des exercices avec des chapitres
      // fantômes (chapter_id pointant vers un catalogue vide).
      chapters: localData.chapters(),
      weekSnapshots: localData.weekSnapshots(),
    },
    null,
    2
  );
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taekdhub-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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

/**
 * Écrit les cinq clés d'une restauration de sauvegarde (exercices, séances,
 * préférences, chapitres, semaines) de façon atomique au niveau applicatif —
 * voir components/data-backup.tsx#confirmImport, seul appelant. localStorage
 * n'offre aucune transaction native, mais chaque `setItem` est
 * individuellement indivisible : un import qui écrit plusieurs clés à la
 * suite peut donc échouer AU MILIEU (ex. quota dépassé sur un gros fichier —
 * reproduit réellement : exercices remplacés par l'import, séances restées
 * à l'ancienne version, car le fichier importé ne tenait pas en entier) et
 * laisser un mélange entre l'ancien et le nouveau — un état hybride pire
 * qu'un import raté. On relit d'abord la valeur ACTUELLE de chaque clé, on
 * tente les cinq écritures, et on restaure tout si l'une échoue.
 */
export function restoreBackup(payload: {
  exercises: Exercise[];
  sessions: WorkSession[];
  preferences: Preferences;
  chapters: Chapter[];
  weekSnapshots: WeekSnapshot[];
}): { ok: true } | { ok: false; rolledBack: boolean } {
  const previous = {
    exercises: localData.exercises(),
    sessions: localData.sessions(),
    preferences: localData.preferences(),
    chapters: localData.chapters(),
    weekSnapshots: localData.weekSnapshots(),
  };
  try {
    localData.saveExercises(payload.exercises);
    localData.saveSessions(payload.sessions);
    localData.savePreferences(payload.preferences);
    localData.saveChapters(payload.chapters);
    localData.saveWeekSnapshots(payload.weekSnapshots);
    return { ok: true };
  } catch {
    try {
      localData.saveExercises(previous.exercises);
      localData.saveSessions(previous.sessions);
      localData.savePreferences(previous.preferences);
      localData.saveChapters(previous.chapters);
      localData.saveWeekSnapshots(previous.weekSnapshots);
      return { ok: false, rolledBack: true };
    } catch {
      // Le rollback lui-même a échoué (quota toujours dépassé même pour les
      // anciennes valeurs, cas pathologique) : rien de plus à tenter ici,
      // l'appelant doit prévenir clairement l'utilisateur d'un état incertain.
      return { ok: false, rolledBack: false };
    }
  }
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
  return true;
}
