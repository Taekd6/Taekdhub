import { exerciseStatuses, exerciseTypes, subjects } from "@/lib/study";
import { DEFAULT_ACCENT, DEFAULT_THEME_MODE, THEME_MODES, type ThemeMode } from "@/lib/theme";
import type { AttemptResult, Difficulty, Exercise, ExerciseLevel, ExerciseStatus, ExerciseType, LicenseStatus, Mastery, ProgrammeLevel, Subject, WorkSession } from "@/lib/supabase/types";

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
// `dailyGoalMinutes: 60` correspond exactement au plus haut des trois préréglages du
// Dashboard/Réglages (PLAN_DURATION_PRESETS = [30, 45, 60], lib/plan.ts) : un premier
// objectif ambitieux mais tenable, jamais un chiffre hors de tout préréglage cliquable
// (l'ancien défaut de 240 min produisait un "Commencer une séance de 240 min" absurde
// dès la toute première visite, avant tout réglage par l'élève). `weeklyGoalMinutes: 300`
// reste cohérent avec ce nouveau quotidien (5 × 60 min ≈ une semaine de cours).
const defaults: Preferences = { displayName: "", dailyGoalMinutes: 60, weeklyGoalMinutes: 300, contestDate: "", accent: DEFAULT_ACCENT, themeMode: DEFAULT_THEME_MODE };

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
export const DEFAULT_MASTERY: Mastery = 0;
const MASTERY_VALUES: readonly Mastery[] = [0, 25, 50, 75, 100];
const PROGRAMME_LEVELS: readonly ProgrammeLevel[] = ["sup", "spe", "sup_spe"];
const EXERCISE_LEVELS: readonly ExerciseLevel[] = [1, 2, 3, 4, 5, 6];
const LICENSE_STATUSES: readonly LicenseStatus[] = ["libre", "à vérifier", "restreint"];

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
 * Fusionne une préférence potentiellement partielle/corrompue (import, ancienne
 * sauvegarde, édition manuelle du localStorage) avec `defaults` — même principe
 * que `normalizeExercise`/`normalizeChapter` : un champ absent ou invalide
 * retombe sur sa valeur par défaut plutôt que de propager une valeur incohérente
 * (notamment `themeMode`, posé tel quel en attribut DOM par `applyThemeMode`).
 */
export function normalizePreferences(raw: unknown): Preferences {
  const item = isRecord(raw) ? raw : {};
  const merged = { ...defaults, ...item };
  return { ...merged, themeMode: (THEME_MODES as string[]).includes(item.themeMode as string) ? (item.themeMode as ThemeMode) : DEFAULT_THEME_MODE };
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
 * Ce n'est pas une hypothèse d'école : la banque amorcée sérialise à elle
 * seule ~1,20 million de caractères, soit ~2,3 Mo en UTF-16 — l'unité que
 * les navigateurs facturent réellement — sur un quota de 5 Mo par origine.
 * Presque la moitié du budget est consommée avant la première séance.
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
 * de 1,35 Mo de JSON + reconstruction de 477 exercices), `sessions` vaut
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
 * (components/exercises/exercise-detail.tsx), et normaliser 477 exercices à
 * chaque touche coûtait trois fois le prix de l'écriture elle-même. Seules
 * les entrées réellement absentes de la liste entrante — zéro dans le cas
 * courant — sont normalisées.
 */
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
    const merged = mergeStored(sessionsKey, items, normalizeSession);
    writeKey(sessionsKey, JSON.stringify(merged));
    return merged;
  },
  exercises: (): Exercise[] => (typeof window === "undefined" ? [] : readList(exercisesKey).map(normalizeExercise)),
  /** REMPLACE intégralement la banque stockée — amorçage/réconciliation/restauration, voir `mergeExercises` pour une écriture incrémentale. */
  saveExercises: (items: Exercise[]): boolean => writeKey(exercisesKey, JSON.stringify(items)),
  /** Écriture incrémentale sûre : fusionne avec le disque (voir `mergeById`) et renvoie la liste réellement enregistrée. */
  mergeExercises: (items: Exercise[]): Exercise[] => {
    const merged = mergeStored(exercisesKey, items, normalizeExercise);
    writeKey(exercisesKey, JSON.stringify(merged));
    return merged;
  },
  chapters: (): Chapter[] =>
    typeof window === "undefined" ? [] : readList(chaptersKey).map(normalizeChapter).filter((item): item is Chapter => item !== null),
  saveChapters: (items: Chapter[]): boolean => writeKey(chaptersKey, JSON.stringify(items)),
  preferences: (): Preferences => (typeof window === "undefined" ? defaults : normalizePreferences(readRecord(preferencesKey))),
  savePreferences: (preferences: Preferences): boolean => writeKey(preferencesKey, JSON.stringify(preferences)),
  /** Horodatage ISO de la dernière sauvegarde exportée (voir `exportBackup`), ou `null` si aucune n'a jamais été faite. */
  lastBackupAt: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(lastBackupKey)),
  saveLastBackupAt: (iso: string): boolean => writeKey(lastBackupKey, iso),
  weekSnapshots: (): WeekSnapshot[] =>
    typeof window === "undefined" ? [] : readList(weekSnapshotsKey).map(normalizeWeekSnapshot).filter((item): item is WeekSnapshot => item !== null),
  saveWeekSnapshots: (items: WeekSnapshot[]): boolean => writeKey(weekSnapshotsKey, JSON.stringify(items)),
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
  return true;
}
