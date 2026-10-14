import { COGNITIVE_LABEL, COGNITIVE_LEVELS, type CognitiveLevel } from "@/lib/cognitive-load";
import type { DayAgenda } from "@/lib/day-agenda";
import type { DayPlacement, PlacementFit } from "@/lib/day-placement";
import { clockToMinutes, PERFORMANCE_LEVELS, WINDOW_IDS, WINDOW_LABEL, type PerformanceLevel, type WindowId } from "@/lib/performance-windows";
import { dayKey } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * TRACE DU PLAN DU JOUR — « qu'est-ce qui a changé, et pourquoi ? »
 *
 * Le plan (lib/day-agenda.ts) n'est jamais stocké : il est recalculé. Ce
 * module garde seulement des VERSIONS successives (une nouvelle chaque fois
 * que le plan change réellement) pour pouvoir dire, entre deux versions :
 *
 *   ce qui a changé   gardé → réduit, gardé → déplacé, déplacé → réintégré,
 *                     ajouté, terminé ;
 *   pourquoi          dépassement de temps dans une matière (fait depuis la
 *                     version précédente > prévu), fin plus rapide que
 *                     prévu, temps restant qui baisse au-delà du travail
 *                     fait (l'heure tourne, ou tu l'as indiqué), nouvelle
 *                     urgence apparue.
 *
 * Stockée SUR L'APPAREIL (`DAY_AGENDA_KEY`), sans synchronisation : c'est
 * une explication, pas une donnée de travail — tout ce qu'elle décrit se
 * recalcule depuis les données synchronisées. Une version par changement,
 * `MAX_VERSIONS` au plus par jour, les `KEEP_DAYS` derniers jours.
 *
 * SUGGESTIONS HORAIRES. Quand des plages de performance sont configurées
 * (lib/performance-windows.ts), chaque tâche gardée porte aussi ce que
 * TaekdHub suggérait à cet instant : son exigence cognitive et la plage
 * (lib/day-placement.ts). C'est une TRACE de ce qui a été affiché, pour
 * pouvoir la comparer à l'avis de l'élève ; ce n'est PAS une mesure de ses
 * résultats ni de son efficacité. Sans plages, rien n'est ajouté : le journal
 * est exactement celui d'avant, et les anciennes entrées (sans suggestion)
 * se lisent telles quelles.
 *
 * Fonctions pures.
 */

export const DAY_AGENDA_KEY = "prepahub:day-agenda";
const MAX_VERSIONS = 40;
const KEEP_DAYS = 7;
/** En dessous, un écart de minutes n'est pas un changement (arrondis, secondes). */
const TOLERANCE = 10;

export type TaskDecision = "gardé" | "réduit" | "déplacé";

/**
 * Ce que TaekdHub suggérait pour une tâche à l'instant de la version. Les
 * heures de la plage sont RECOPIÉES : l'élève peut modifier ses plages
 * ensuite, et on doit relire ce qui était réellement suggéré.
 */
export interface TaskSuggestion {
  load: CognitiveLevel;
  fit: PlacementFit;
  /** `null` : hors plage (aucune plage restante où la tâche tenait). */
  window: { id: WindowId; start: string; end: string; level: PerformanceLevel } | null;
}

export interface VersionTask {
  key: string;
  title: string;
  subject: Subject | null;
  tier: string;
  minutes: number;
  decision: TaskDecision;
  /** Absent : plages désactivées au moment de la version, ou version antérieure à ce champ ; absent aussi d'une tâche déplacée. */
  suggestion?: TaskSuggestion;
}

export interface AgendaVersion {
  at: string;
  budget: number;
  overflow: number;
  /** Minutes travaillées aujourd'hui, par matière, au moment de la version. */
  doneBySubject: Partial<Record<Subject, number>>;
  tasks: VersionTask[];
}

export interface AgendaLog {
  days: Record<string, { versions: AgendaVersion[]; override: { minutes: number; at: string } | null }>;
}

export function emptyLog(): AgendaLog {
  return { days: {} };
}

export function parseLog(raw: string | null): AgendaLog {
  if (!raw) return emptyLog();
  try {
    const parsed = JSON.parse(raw) as AgendaLog;
    if (!parsed || typeof parsed !== "object" || typeof parsed.days !== "object" || parsed.days === null) return emptyLog();
    const days: AgendaLog["days"] = {};
    for (const [day, entry] of Object.entries(parsed.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !entry || !Array.isArray(entry.versions)) continue;
      const override = entry.override && typeof entry.override.minutes === "number" && typeof entry.override.at === "string" ? entry.override : null;
      const versions = entry.versions.filter((version) => version && typeof version.at === "string" && Array.isArray(version.tasks));
      days[day] = { versions: versions.map((version) => ({ ...version, tasks: version.tasks.map(withValidSuggestion) })), override };
    }
    return { days };
  } catch {
    return emptyLog();
  }
}

const FITS: readonly PlacementFit[] = ["ideale", "acceptable", "hors-plage"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Une suggestion lisible, ou `null` : exigence, ajustement et plage doivent tous être valides. */
function readSuggestion(raw: unknown): TaskSuggestion | null {
  if (!isRecord(raw)) return null;
  const load = COGNITIVE_LEVELS.find((candidate) => candidate === raw.load);
  const fit = FITS.find((candidate) => candidate === raw.fit);
  if (!load || !fit) return null;
  const window = raw.window;
  if (window === null) return { load, fit, window: null };
  if (!isRecord(window)) return null;
  const id = WINDOW_IDS.find((candidate) => candidate === window.id);
  const level = PERFORMANCE_LEVELS.find((candidate) => candidate === window.level);
  const start = clockToMinutes(window.start);
  const end = clockToMinutes(window.end);
  if (!id || !level || start === null || end === null || end <= start) return null;
  return { load, fit, window: { id, start: window.start as string, end: window.end as string, level } };
}

/**
 * Une tâche d'un ancien journal est rendue TELLE QUELLE (même objet). Seule
 * une `suggestion` présente mais illisible est retirée — la tâche, elle, est
 * conservée.
 */
function withValidSuggestion(task: VersionTask): VersionTask {
  if (!isRecord(task) || !("suggestion" in task)) return task;
  const { suggestion, ...rest } = task;
  const read = readSuggestion(suggestion);
  return read ? { ...rest, suggestion: read } : rest;
}

function doneBySubject(sessions: WorkSession[], now: Date): Partial<Record<Subject, number>> {
  const today = dayKey(now);
  const out: Partial<Record<Subject, number>> = {};
  for (const session of sessions) {
    if (dayKey(session.started_at) !== today) continue;
    out[session.subject] = (out[session.subject] ?? 0) + session.duration_seconds / 60;
  }
  for (const subject of Object.keys(out) as Subject[]) out[subject] = Math.floor(out[subject]!);
  return out;
}

/**
 * La version du plan à cet instant. `placement` (lib/day-placement.ts) ajoute
 * à chaque tâche GARDÉE sa suggestion horaire ; absent ou désactivé (aucune
 * plage configurée), rien n'est ajouté : même version qu'avant.
 */
export function toVersion(agenda: DayAgenda, sessions: WorkSession[], now: Date, placement?: DayPlacement | null): AgendaVersion {
  const suggestions = new Map<string, TaskSuggestion>();
  if (placement?.enabled) {
    for (const placed of placement.ordered) {
      if (!placed.placement) continue;
      const { window, fit } = placed.placement;
      suggestions.set(placed.task.key, { load: placed.load.level, fit, window: window ? { id: window.id, start: window.start, end: window.end, level: window.level } : null });
    }
  }
  return {
    at: now.toISOString(),
    budget: agenda.budget.minutes,
    overflow: agenda.overflow,
    doneBySubject: doneBySubject(sessions, now),
    tasks: [
      ...agenda.kept.map((task) => {
        const suggestion = suggestions.get(task.key);
        return { key: task.key, title: task.title, subject: task.subject, tier: task.tier, minutes: task.minutes, decision: (task.reducedFrom !== null ? "réduit" : "gardé") as TaskDecision, ...(suggestion ? { suggestion } : {}) };
      }),
      ...agenda.postponed.map((task) => ({ key: task.key, title: task.title, subject: task.subject, tier: task.tier, minutes: 0, decision: "déplacé" as TaskDecision })),
    ],
  };
}

/** La suggestion d'une tâche en une ligne, ou `null` si la version n'en porte pas — pour relire le journal. */
export function describeSuggestion(task: VersionTask): string | null {
  const { suggestion } = task;
  if (!suggestion) return null;
  const where = suggestion.window ? `${WINDOW_LABEL[suggestion.window.id]} ${suggestion.window.start}-${suggestion.window.end} (plage ${suggestion.window.level})` : "hors plage";
  return `${task.title} · ${COGNITIVE_LABEL[suggestion.load]} · ${where}`;
}

/** Deux versions décrivent-elles le même plan ? Le temps restant compte par paliers de `TOLERANCE`. */
function samePlan(a: AgendaVersion, b: AgendaVersion): boolean {
  // La suggestion compte quand elle existe : un changement de plage SEUL est une nouvelle version. Sans suggestion, la signature est celle d'avant.
  const suggested = (task: VersionTask) => {
    const { suggestion } = task;
    if (!suggestion) return "";
    return `|${suggestion.load}|${suggestion.fit}|${suggestion.window ? `${suggestion.window.id}@${suggestion.window.start}-${suggestion.window.end}:${suggestion.window.level}` : "-"}`;
  };
  const signature = (version: AgendaVersion) =>
    version.tasks
      .map((task) => `${task.key}|${task.decision}|${task.minutes}${suggested(task)}`)
      .sort()
      .join(";");
  return signature(a) === signature(b) && Math.abs(a.budget - b.budget) < TOLERANCE && a.overflow === b.overflow;
}

/** Ajoute la version si le plan a changé ; ne garde que les derniers jours. Même référence si rien ne change. */
export function recordVersion(log: AgendaLog, day: string, version: AgendaVersion): AgendaLog {
  const entry = log.days[day] ?? { versions: [], override: null };
  const last = entry.versions[entry.versions.length - 1];
  if (last && samePlan(last, version)) return log;
  const days = { ...log.days, [day]: { ...entry, versions: [...entry.versions, version].slice(-MAX_VERSIONS) } };
  const kept = Object.keys(days).sort().slice(-KEEP_DAYS);
  return { days: Object.fromEntries(kept.map((key) => [key, days[key]])) };
}

export function setOverride(log: AgendaLog, day: string, override: { minutes: number; at: string } | null): AgendaLog {
  const entry = log.days[day] ?? { versions: [], override: null };
  return { days: { ...log.days, [day]: { ...entry, override } } };
}

export interface AgendaChange {
  title: string;
  /** « Réduit de 45 min à 20 min », « Déplacé à demain », « Ajouté »… */
  what: string;
}

export interface AgendaDiff {
  since: string;
  /** Les raisons du recalcul, chiffrées. */
  causes: string[];
  changes: AgendaChange[];
}

/** Ce qui sépare deux versions, et pourquoi. `null` sans version précédente. */
export function diffVersions(previous: AgendaVersion | undefined, current: AgendaVersion): AgendaDiff | null {
  if (!previous) return null;
  const causes: string[] = [];
  const hour = new Date(previous.at).toTimeString().slice(0, 5);

  // Dépassement ou avance, matière par matière : fait depuis la version précédente, face au prévu à ce moment-là.
  const subjects = new Set<Subject>([...(Object.keys(current.doneBySubject) as Subject[]), ...(previous.tasks.map((task) => task.subject).filter(Boolean) as Subject[])]);
  let doneTotal = 0;
  for (const subject of subjects) {
    const done = (current.doneBySubject[subject] ?? 0) - (previous.doneBySubject[subject] ?? 0);
    doneTotal += Math.max(0, done);
    const planned = previous.tasks.filter((task) => task.subject === subject && task.decision !== "déplacé").reduce((sum, task) => sum + task.minutes, 0);
    if (done > planned + TOLERANCE) {
      causes.push(`${subject} : ${formatMinutesSpan(done)} faites depuis ${hour} pour ${formatMinutesSpan(planned)} prévues (+${formatMinutesSpan(done - planned)})`);
    }
  }
  // Le travail fait depuis la version précédente : la première raison d'un recalcul, toujours dite quand il existe.
  const doneParts = [...subjects]
    .map((subject) => ({ subject, minutes: (current.doneBySubject[subject] ?? 0) - (previous.doneBySubject[subject] ?? 0) }))
    .filter((entry) => entry.minutes > 0);
  if (doneParts.length > 0 && !causes.some((cause) => cause.includes("faites depuis"))) {
    causes.push(`Travail fait depuis ${hour} : ${doneParts.map((entry) => `${entry.subject} ${formatMinutesSpan(entry.minutes)}`).join(", ")}`);
  }
  // Tâches terminées plus vite que prévu : sorties du plan, avec moins de temps que prévu dans leur matière.
  for (const task of previous.tasks) {
    if (task.decision === "déplacé" || current.tasks.some((entry) => entry.key === task.key) || !task.subject) continue;
    const done = (current.doneBySubject[task.subject] ?? 0) - (previous.doneBySubject[task.subject] ?? 0);
    if (done > 0 && done + TOLERANCE < task.minutes) causes.push(`« ${task.title} » terminé en ${formatMinutesSpan(done)} au lieu de ${formatMinutesSpan(task.minutes)}`);
  }
  // Le temps restant a baissé plus que le travail fait : l'heure tourne, ou tu l'as indiqué.
  const expected = previous.budget - doneTotal;
  if (current.budget < expected - TOLERANCE) causes.push(`Temps restant ramené à ${formatMinutesSpan(current.budget)} (au lieu de ${formatMinutesSpan(Math.max(0, expected))})`);
  else if (current.budget > expected + TOLERANCE) causes.push(`Temps restant porté à ${formatMinutesSpan(current.budget)}`);
  // Nouvelle urgence.
  for (const task of current.tasks) {
    if (task.tier === "indispensable" && !previous.tasks.some((entry) => entry.key === task.key)) causes.push(`Nouvelle urgence : « ${task.title} »`);
  }

  const changes: AgendaChange[] = [];
  for (const task of current.tasks) {
    const before = previous.tasks.find((entry) => entry.key === task.key);
    if (!before) {
      changes.push({ title: task.title, what: task.decision === "déplacé" ? "Nouvelle, déplacée à demain" : `Ajoutée (${formatMinutesSpan(task.minutes)})` });
      continue;
    }
    if (before.decision === task.decision && Math.abs(before.minutes - task.minutes) < STEP_TOLERANCE) continue;
    if (task.decision === "déplacé") changes.push({ title: task.title, what: "Déplacée à demain" });
    else if (before.decision === "déplacé") changes.push({ title: task.title, what: `Réintégrée (${formatMinutesSpan(task.minutes)})` });
    else if (task.minutes < before.minutes) changes.push({ title: task.title, what: `Réduite de ${formatMinutesSpan(before.minutes)} à ${formatMinutesSpan(task.minutes)}` });
    else changes.push({ title: task.title, what: `Allongée de ${formatMinutesSpan(before.minutes)} à ${formatMinutesSpan(task.minutes)}` });
  }
  for (const before of previous.tasks) {
    if (before.decision !== "déplacé" && !current.tasks.some((entry) => entry.key === before.key)) changes.push({ title: before.title, what: "Terminée ou plus nécessaire" });
  }
  return { since: previous.at, causes, changes };
}

const STEP_TOLERANCE = 5;
