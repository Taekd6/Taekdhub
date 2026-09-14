import { DEFAULT_AVAILABILITY, normalizeRanges } from "@/lib/domain/availability";
import { isCategory } from "@/lib/domain/categories";
import { safeIso } from "@/lib/domain/date";
import { DEFAULT_SUBJECTS, SUBJECT_TONES } from "@/lib/domain/subjects";
import { createId, sortSlots } from "@/lib/domain/tasks";
import type {
  AppState,
  Availability,
  Goal,
  Priority,
  Routine,
  Settings,
  Subject,
  SubjectTone,
  Task,
  TaskSlot,
  TaskStatus,
  TimeEntry,
  Weekday,
} from "@/lib/domain/types";

/**
 * ============================================================================
 * SCHÉMA PERSISTÉ — la frontière de confiance de l'application.
 * ============================================================================
 *
 * Tout ce qui vient du disque (localStorage, fichier de sauvegarde importé,
 * un jour une réponse Supabase) traverse `normalizeState`. RIEN d'invalide
 * n'en ressort : une date illisible, une durée négative, un statut inconnu,
 * un tableau devenu objet — tout retombe sur une valeur sûre.
 *
 * Ce n'est pas de la paranoïa. Dans la version précédente de TaekdHub, une
 * seule date corrompue dans le stockage suffisait à faire lever
 * `new Date(...).toISOString()` au moment du rendu, donc à afficher une PAGE
 * BLANCHE sur toute l'application, sans aucun moyen de revenir en arrière
 * depuis l'interface. Un outil dont toutes les données vivent dans le
 * navigateur n'a pas le droit de se comporter ainsi.
 *
 * Toute évolution du modèle passe par `STATE_VERSION` + une étape de
 * migration ci-dessous, jamais par une lecture « optimiste » ailleurs dans le
 * code.
 */

export const STATE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  accent: "#e0a758",
  themeMode: "system",
  defaultEstimateMinutes: 45,
  tightLoadRatio: 0.9,
};

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    tasks: [],
    timeEntries: [],
    goals: [],
    routines: [],
    subjects: DEFAULT_SUBJECTS.map((subject) => ({ ...subject })),
    availability: { weekly: { ...DEFAULT_AVAILABILITY.weekly }, exceptions: [] },
    settings: { ...DEFAULT_SETTINGS },
  };
}

/* ─────────────────────────── PRIMITIVES ─────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalStr(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Un compteur exploitable : fini, positif, entier. Une durée négative fausse durablement toutes les sommes. */
function positiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function nonNegativeInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value);
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const STATUSES: readonly TaskStatus[] = ["todo", "doing", "done", "cancelled"];

function status(value: unknown): TaskStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value) ? (value as TaskStatus) : "todo";
}

function priority(value: unknown): Priority {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : 2;
}

function tone(value: unknown): SubjectTone {
  return typeof value === "string" && (SUBJECT_TONES as string[]).includes(value) ? (value as SubjectTone) : "violet";
}

/** `HH:MM` valide, ou `null`. */
function time(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dayKeyValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/* ─────────────────────────── ENTITÉS ─────────────────────────── */

function normalizeSlots(value: unknown): TaskSlot[] {
  const slots: TaskSlot[] = [];
  for (const raw of array(value)) {
    if (!isRecord(raw)) continue;
    const start = safeIso(raw.start);
    const end = safeIso(raw.end);
    if (!start || !end) continue;
    slots.push({ start, end });
  }
  return sortSlots(slots);
}

export function normalizeTask(raw: unknown, now: string): Task | null {
  if (!isRecord(raw)) return null;
  const title = str(raw.title).trim();
  if (!title) return null; // une tâche sans titre n'est pas une tâche : on la laisse tomber plutôt que d'afficher une ligne vide.

  const createdAt = safeIso(raw.createdAt) ?? now;
  const dueAt = safeIso(raw.dueAt);

  return {
    id: str(raw.id) || createId(),
    title,
    subjectId: optionalStr(raw.subjectId),
    category: isCategory(raw.category) ? raw.category : "autre",
    description: optionalStr(raw.description),
    status: status(raw.status),
    priority: priority(raw.priority),
    estimatedMinutes: positiveInt(raw.estimatedMinutes),
    dueAt,
    dueDateOnly: dueAt ? raw.dueDateOnly === true : undefined,
    slots: normalizeSlots(raw.slots),
    completedAt: safeIso(raw.completedAt),
    source: optionalStr(raw.source),
    sourceUrl: optionalStr(raw.sourceUrl),
    notes: optionalStr(raw.notes),
    goalId: optionalStr(raw.goalId),
    routineId: optionalStr(raw.routineId),
    postponedCount: nonNegativeInt(raw.postponedCount),
    lastPostponedAt: safeIso(raw.lastPostponedAt),
    createdAt,
    updatedAt: safeIso(raw.updatedAt) ?? createdAt,
  };
}

export function normalizeTimeEntry(raw: unknown, now: string): TimeEntry | null {
  if (!isRecord(raw)) return null;
  const minutes = positiveInt(raw.minutes);
  const startedAt = safeIso(raw.startedAt);
  if (!minutes || !startedAt) return null;
  return {
    id: str(raw.id) || createId("e"),
    taskId: optionalStr(raw.taskId),
    subjectId: optionalStr(raw.subjectId),
    startedAt,
    minutes,
    note: optionalStr(raw.note),
    createdAt: safeIso(raw.createdAt) ?? startedAt ?? now,
  };
}

export function normalizeGoal(raw: unknown, now: string): Goal | null {
  if (!isRecord(raw)) return null;
  const title = str(raw.title).trim();
  if (!title) return null;
  const createdAt = safeIso(raw.createdAt) ?? now;
  const rawStatus = str(raw.status);
  return {
    id: str(raw.id) || createId("g"),
    title,
    description: optionalStr(raw.description),
    subjectId: optionalStr(raw.subjectId),
    targetDate: safeIso(raw.targetDate),
    targetMinutes: positiveInt(raw.targetMinutes),
    status: rawStatus === "done" || rawStatus === "archived" ? rawStatus : "active",
    createdAt,
    updatedAt: safeIso(raw.updatedAt) ?? createdAt,
  };
}

export function normalizeRoutine(raw: unknown, now: string): Routine | null {
  if (!isRecord(raw)) return null;
  const title = str(raw.title).trim();
  if (!title) return null;
  const createdAt = safeIso(raw.createdAt) ?? now;

  const rawRule = isRecord(raw.rule) ? raw.rule : {};
  const rule: Routine["rule"] =
    rawRule.kind === "everyNDays"
      ? { kind: "everyNDays", days: Math.min(30, Math.max(1, nonNegativeInt(rawRule.days, 1) || 1)) }
      : {
          kind: "weekly",
          weekdays: array(rawRule.weekdays)
            .filter((day): day is Weekday => typeof day === "number" && day >= 0 && day <= 6)
            .map((day) => Math.round(day) as Weekday),
        };

  return {
    id: str(raw.id) || createId("r"),
    title,
    subjectId: optionalStr(raw.subjectId),
    category: isCategory(raw.category) ? raw.category : "autre",
    estimatedMinutes: positiveInt(raw.estimatedMinutes),
    priority: priority(raw.priority),
    rule,
    horizonDays: Math.min(14, Math.max(1, nonNegativeInt(raw.horizonDays, 7) || 7)),
    active: raw.active !== false,
    notes: optionalStr(raw.notes),
    createdAt,
    updatedAt: safeIso(raw.updatedAt) ?? createdAt,
  };
}

export function normalizeSubject(raw: unknown, index: number): Subject | null {
  if (!isRecord(raw)) return null;
  const label = str(raw.label).trim();
  const id = str(raw.id).trim();
  if (!label || !id) return null;
  return {
    id,
    label,
    short: str(raw.short).trim().slice(0, 3) || label.slice(0, 1).toUpperCase(),
    tone: tone(raw.tone),
    order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : index,
    archived: raw.archived === true ? true : undefined,
  };
}

export function normalizeAvailability(raw: unknown): Availability {
  const source = isRecord(raw) ? raw : {};
  const rawWeekly = isRecord(source.weekly) ? source.weekly : {};

  const weekly = {} as Availability["weekly"];
  for (const weekday of [0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    const ranges = array(rawWeekly[String(weekday)])
      .map((item) => {
        if (!isRecord(item)) return null;
        const start = time(item.start);
        const end = time(item.end);
        if (!start || !end) return null;
        const label = optionalStr(item.label);
        return label ? { start, end, label } : { start, end };
      })
      .filter((item): item is { start: string; end: string; label?: string } => item !== null);
    weekly[weekday] = normalizeRanges(ranges);
  }

  const exceptions = array(source.exceptions)
    .map((item) => {
      if (!isRecord(item)) return null;
      const date = dayKeyValue(item.date);
      if (!date) return null;
      const ranges = array(item.ranges)
        .map((range) => {
          if (!isRecord(range)) return null;
          const start = time(range.start);
          const end = time(range.end);
          return start && end ? { start, end } : null;
        })
        .filter((range): range is { start: string; end: string } => range !== null);
      const label = optionalStr(item.label);
      return { date, ranges: normalizeRanges(ranges), ...(label ? { label } : {}) };
    })
    .filter((item): item is { date: string; ranges: { start: string; end: string }[]; label?: string } => item !== null);

  return { weekly, exceptions };
}

export function normalizeSettings(raw: unknown): Settings {
  const source = isRecord(raw) ? raw : {};
  const mode = str(source.themeMode);
  const accent = str(source.accent);
  return {
    displayName: str(source.displayName).slice(0, 60),
    accent: /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent.startsWith("#") ? accent : `#${accent}`) : DEFAULT_SETTINGS.accent,
    themeMode: mode === "light" || mode === "dark" ? mode : "system",
    defaultEstimateMinutes: Math.min(240, Math.max(5, nonNegativeInt(source.defaultEstimateMinutes, 45) || 45)),
    tightLoadRatio:
      typeof source.tightLoadRatio === "number" && source.tightLoadRatio >= 0.5 && source.tightLoadRatio <= 1
        ? source.tightLoadRatio
        : DEFAULT_SETTINGS.tightLoadRatio,
  };
}

/* ─────────────────────────── ÉTAT COMPLET ─────────────────────────── */

/**
 * Normalise un état complet venu du disque. Les références orphelines
 * (`subjectId` d'une matière supprimée, `goalId` d'un objectif effacé,
 * `taskId` d'une entrée de temps dont la tâche n'existe plus) sont COUPÉES
 * ici, pas laissées à chaque écran : sinon l'affichage d'une matière
 * fantôme finit par arriver, et on ne sait jamais où le corriger.
 */
export function normalizeState(raw: unknown, now: Date = new Date()): AppState {
  const iso = now.toISOString();
  const source = isRecord(raw) ? raw : {};

  const subjects = array(source.subjects)
    .map((item, index) => normalizeSubject(item, index))
    .filter((item): item is Subject => item !== null);

  const goals = array(source.goals)
    .map((item) => normalizeGoal(item, iso))
    .filter((item): item is Goal => item !== null);

  const tasks = array(source.tasks)
    .map((item) => normalizeTask(item, iso))
    .filter((item): item is Task => item !== null);

  const routines = array(source.routines)
    .map((item) => normalizeRoutine(item, iso))
    .filter((item): item is Routine => item !== null);

  const timeEntries = array(source.timeEntries)
    .map((item) => normalizeTimeEntry(item, iso))
    .filter((item): item is TimeEntry => item !== null);

  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const goalIds = new Set(goals.map((goal) => goal.id));
  const routineIds = new Set(routines.map((routine) => routine.id));
  const taskIds = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    if (task.subjectId && !subjectIds.has(task.subjectId)) task.subjectId = undefined;
    if (task.goalId && !goalIds.has(task.goalId)) task.goalId = undefined;
    if (task.routineId && !routineIds.has(task.routineId)) task.routineId = undefined;
  }
  for (const entry of timeEntries) {
    if (entry.taskId && !taskIds.has(entry.taskId)) entry.taskId = undefined;
    if (entry.subjectId && !subjectIds.has(entry.subjectId)) entry.subjectId = undefined;
  }

  return {
    version: STATE_VERSION,
    tasks,
    timeEntries,
    goals,
    routines,
    // Une sauvegarde sans aucune matière repart des matières par défaut :
    // sans matière, plus aucun sélecteur ne fonctionne, et l'élève se
    // retrouve bloqué sans comprendre pourquoi.
    subjects: subjects.length > 0 ? subjects : DEFAULT_SUBJECTS.map((subject) => ({ ...subject })),
    availability: source.availability === undefined ? { ...DEFAULT_AVAILABILITY } : normalizeAvailability(source.availability),
    settings: normalizeSettings(source.settings),
  };
}

/** Une sauvegarde exportée : l'état, plus de quoi savoir d'où elle vient. */
export interface BackupFile {
  app: "taekdhub";
  version: number;
  exportedAt: string;
  state: AppState;
}

export function buildBackup(state: AppState, now: Date = new Date()): BackupFile {
  return { app: "taekdhub", version: STATE_VERSION, exportedAt: now.toISOString(), state };
}

/**
 * Lecture d'un fichier de sauvegarde. Accepte aussi bien l'enveloppe
 * `{ app, version, state }` que l'état nu — un fichier édité à la main reste
 * importable, ce qui est exactement ce qu'on veut d'un format de secours.
 */
export function readBackup(raw: unknown, now: Date = new Date()): AppState | null {
  if (!isRecord(raw)) return null;
  const payload = isRecord(raw.state) ? raw.state : raw;
  if (!Array.isArray(payload.tasks) && !Array.isArray(payload.subjects)) return null;
  return normalizeState(payload, now);
}
