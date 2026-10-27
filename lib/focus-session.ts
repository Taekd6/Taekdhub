import { eveningList, localDay } from "@/lib/week-agenda";
import type { WorkItem } from "@/lib/storage";

/**
 * SESSION DE TRAVAIL EN CYCLES (demande de l'élève, 2026-10-27 : « un chrono
 * 50 min, 10 min de pause, et qu'à chaque session j'aie accompli quelque
 * chose »).
 *
 * Une session = UN objectif concret + des cycles travail / pause qui
 * s'enchaînent tout seuls. Tout est calculé à partir de l'heure de début :
 * rien ne « tourne » en arrière-plan, donc un iPhone verrouillé, un onglet
 * suspendu ou un rechargement ne décalent rien. La dernière phase est
 * toujours du travail (pas de pause après le dernier cycle).
 *
 * Pur et testé (lib/focus-session.test.ts) : la page (components/focus) et la
 * route du raccourci iOS (app/api/session) s'en servent toutes les deux.
 */

export interface FocusConfig {
  /** Minutes de travail par cycle. */
  workMinutes: number;
  /** Minutes de pause entre deux cycles. */
  breakMinutes: number;
  /** Nombre de cycles de travail. */
  cycles: number;
}

export const DEFAULT_FOCUS_CONFIG: FocusConfig = { workMinutes: 50, breakMinutes: 10, cycles: 2 };

export const FOCUS_LIMITS = {
  workMinutes: { min: 5, max: 120 },
  breakMinutes: { min: 1, max: 45 },
  cycles: { min: 1, max: 8 },
} as const;

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Toute entrée (formulaire, URL, JSON du raccourci) ramenée dans les bornes. */
export function normalizeFocusConfig(input: Partial<Record<keyof FocusConfig, unknown>> | null | undefined): FocusConfig {
  const d = DEFAULT_FOCUS_CONFIG;
  return {
    workMinutes: clamp(input?.workMinutes, FOCUS_LIMITS.workMinutes.min, FOCUS_LIMITS.workMinutes.max, d.workMinutes),
    breakMinutes: clamp(input?.breakMinutes, FOCUS_LIMITS.breakMinutes.min, FOCUS_LIMITS.breakMinutes.max, d.breakMinutes),
    cycles: clamp(input?.cycles, FOCUS_LIMITS.cycles.min, FOCUS_LIMITS.cycles.max, d.cycles),
  };
}

export type FocusPhaseKind = "travail" | "pause";

export interface FocusPhase {
  kind: FocusPhaseKind;
  /** Numéro du cycle, à partir de 1 (une pause porte le numéro du cycle qu'elle suit). */
  cycle: number;
  start: number;
  end: number;
}

/** Les phases de la session, en millisecondes epoch. */
export function buildPhases(startMs: number, config: FocusConfig): FocusPhase[] {
  const phases: FocusPhase[] = [];
  let t = startMs;
  for (let cycle = 1; cycle <= config.cycles; cycle++) {
    phases.push({ kind: "travail", cycle, start: t, end: t + config.workMinutes * 60_000 });
    t += config.workMinutes * 60_000;
    if (cycle < config.cycles) {
      phases.push({ kind: "pause", cycle, start: t, end: t + config.breakMinutes * 60_000 });
      t += config.breakMinutes * 60_000;
    }
  }
  return phases;
}

export type FocusState =
  | { status: "en cours"; phase: FocusPhase; index: number; remainingMs: number; totalPhases: number }
  | { status: "terminée" };

export function focusState(phases: FocusPhase[], nowMs: number): FocusState {
  const index = phases.findIndex((phase) => nowMs < phase.end);
  if (index === -1) return { status: "terminée" };
  const phase = phases[index];
  return { status: "en cours", phase, index, remainingMs: Math.max(0, phase.end - Math.max(nowMs, phase.start)), totalPhases: phases.length };
}

/** Secondes de TRAVAIL réellement écoulées à `nowMs` (les pauses ne comptent pas). */
export function workedSeconds(phases: FocusPhase[], nowMs: number): number {
  let ms = 0;
  for (const phase of phases) {
    if (phase.kind !== "travail" || nowMs <= phase.start) continue;
    ms += Math.min(nowMs, phase.end) - phase.start;
  }
  return Math.floor(ms / 1000);
}

export interface FocusAlert {
  at: number;
  title: string;
}

/**
 * Les alertes à poser (fin de chaque phase). Le raccourci iOS en fait des
 * rappels à l'heure dite : ce sont eux qui font vibrer la montre, iPhone
 * verrouillé compris — une page web ne le peut pas de façon fiable.
 */
export function focusAlerts(phases: FocusPhase[], goal: string): FocusAlert[] {
  return phases.map((phase, index) => {
    const next = phases[index + 1];
    if (!next) return { at: phase.end, title: `Session finie — ${goal} : fait ?` };
    if (phase.kind === "travail") return { at: phase.end, title: `Pause ${Math.round((next.end - next.start) / 60_000)} min — cycle ${phase.cycle} terminé` };
    return { at: phase.end, title: `Reprise — cycle ${next.cycle} : ${goal}` };
  });
}

export interface GoalSuggestion {
  /** Identifiant de la tâche TaekdHub, ou `null` pour un objectif libre. */
  id: string | null;
  title: string;
  /** Pourquoi on la propose, en clair. */
  reason: string;
}

const REASON: Record<"plan" | "aujourdhui" | "demain", string> = {
  plan: "prévu aujourd'hui",
  aujourdhui: "pour aujourd'hui",
  demain: "pour demain",
};

/**
 * Ce que TaekdHub propose comme objectif : d'abord la liste « Ce soir »
 * (planifié aujourd'hui, dû aujourd'hui ou demain), puis le travail en cours
 * le plus urgent. Jamais une tâche déjà terminée ou abandonnée.
 */
export function suggestGoals(workItems: WorkItem[], now: Date, max = 3): GoalSuggestion[] {
  const out: GoalSuggestion[] = [];
  const seen = new Set<string>();
  for (const entry of eveningList(workItems, now)) {
    if (entry.done || seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    out.push({ id: entry.item.id, title: entry.item.title, reason: REASON[entry.reason] });
  }
  const today = localDay(now);
  const rest = workItems
    .filter((item) => (item.status === "à faire" || item.status === "en cours") && !seen.has(item.id))
    .filter((item) => !item.notBeforeDate || item.notBeforeDate <= today)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || Number(b.important) - Number(a.important) || a.createdAt.localeCompare(b.createdAt));
  for (const item of rest) {
    out.push({ id: item.id, title: item.title, reason: item.dueDate ? `pour le ${item.dueDate.slice(8, 10)}/${item.dueDate.slice(5, 7)}` : item.status === "en cours" ? "en cours" : "sans date" });
  }
  return out.slice(0, max);
}

/** Heure locale « HH:MM » (pour les rappels créés par le raccourci). */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── État persistant de la page (une session à la fois, par appareil) ─────── */

export interface StoredFocusSession {
  goal: string;
  workItemId: string | null;
  startedAt: number;
  config: FocusConfig;
}

export function parseStoredFocus(raw: string | null): StoredFocusSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredFocusSession>;
    if (typeof value.goal !== "string" || !value.goal.trim() || typeof value.startedAt !== "number" || !Number.isFinite(value.startedAt)) return null;
    return {
      goal: value.goal.slice(0, 200),
      workItemId: typeof value.workItemId === "string" ? value.workItemId : null,
      startedAt: value.startedAt,
      config: normalizeFocusConfig(value.config ?? null),
    };
  } catch {
    return null;
  }
}
