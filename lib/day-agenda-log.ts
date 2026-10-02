import type { DayAgenda } from "@/lib/day-agenda";
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
 * Fonctions pures.
 */

export const DAY_AGENDA_KEY = "prepahub:day-agenda";
const MAX_VERSIONS = 40;
const KEEP_DAYS = 7;
/** En dessous, un écart de minutes n'est pas un changement (arrondis, secondes). */
const TOLERANCE = 10;

export type TaskDecision = "gardé" | "réduit" | "déplacé";

export interface VersionTask {
  key: string;
  title: string;
  subject: Subject | null;
  tier: string;
  minutes: number;
  decision: TaskDecision;
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
      days[day] = { versions: entry.versions.filter((version) => version && typeof version.at === "string" && Array.isArray(version.tasks)), override };
    }
    return { days };
  } catch {
    return emptyLog();
  }
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

export function toVersion(agenda: DayAgenda, sessions: WorkSession[], now: Date): AgendaVersion {
  return {
    at: now.toISOString(),
    budget: agenda.budget.minutes,
    overflow: agenda.overflow,
    doneBySubject: doneBySubject(sessions, now),
    tasks: [
      ...agenda.kept.map((task) => ({ key: task.key, title: task.title, subject: task.subject, tier: task.tier, minutes: task.minutes, decision: (task.reducedFrom !== null ? "réduit" : "gardé") as TaskDecision })),
      ...agenda.postponed.map((task) => ({ key: task.key, title: task.title, subject: task.subject, tier: task.tier, minutes: 0, decision: "déplacé" as TaskDecision })),
    ],
  };
}

/** Deux versions décrivent-elles le même plan ? Le temps restant compte par paliers de `TOLERANCE`. */
function samePlan(a: AgendaVersion, b: AgendaVersion): boolean {
  const signature = (version: AgendaVersion) =>
    version.tasks
      .map((task) => `${task.key}|${task.decision}|${task.minutes}`)
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
