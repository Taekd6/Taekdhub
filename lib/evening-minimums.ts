import { plannableMinutesForWeekday, WEEKDAY_LABELS, weekdayIndex } from "@/lib/capacity";
import { dayKey, subjects } from "@/lib/study";
import type { Preferences } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * MINIMUM DU SOIR — « ce soir, au moins 2 h de maths et 1 h 30 de physique ».
 *
 * Une règle fixée À L'AVANCE, jour par jour (`Preferences.eveningMinimums`),
 * plutôt qu'une décision prise chaque soir : c'est la même logique que les
 * plans « si… alors… » (lib/intentions.ts) — décider une fois, puis
 * exécuter. Par défaut : chaque soir de semaine sauf le mardi.
 *
 * Le temps compté est celui de la JOURNÉE entière dans la matière, pas
 * seulement après 18 h : une heure de maths faite à midi compte pour le
 * minimum du soir. Ce qui compte, c'est le total fait ce jour-là.
 *
 * Fonctions pures.
 */

export interface EveningEntry {
  subject: Subject;
  minMinutes: number;
  doneMinutes: number;
  /** 0-100, plafonné. */
  percent: number;
  met: boolean;
}

export interface EveningPlan {
  entries: EveningEntry[];
  totalMinMinutes: number;
  allMet: boolean;
}

/** Les minimums de ce jour-là — liste vide un soir libre. */
export function minimumsFor(preferences: Preferences, date: Date): Partial<Record<Subject, number>> {
  return preferences.eveningMinimums[weekdayIndex(date)] ?? {};
}

/** Où en est le minimum du soir aujourd'hui, matière par matière, dans l'ordre des matières. */
export function eveningPlan(preferences: Preferences, sessions: WorkSession[], now: Date = new Date()): EveningPlan {
  const minimums = minimumsFor(preferences, now);
  const today = dayKey(now);
  const doneSeconds = new Map<Subject, number>();
  for (const session of sessions) {
    if (dayKey(session.started_at) !== today || new Date(session.started_at) > now) continue;
    doneSeconds.set(session.subject, (doneSeconds.get(session.subject) ?? 0) + session.duration_seconds);
  }
  const entries: EveningEntry[] = [];
  for (const subject of subjects) {
    const minMinutes = minimums[subject] ?? 0;
    if (minMinutes <= 0) continue;
    const doneMinutes = Math.floor((doneSeconds.get(subject) ?? 0) / 60);
    entries.push({
      subject,
      minMinutes,
      doneMinutes,
      percent: Math.min(100, Math.round((doneMinutes / minMinutes) * 100)),
      met: doneMinutes >= minMinutes,
    });
  }
  return {
    entries,
    totalMinMinutes: entries.reduce((sum, entry) => sum + entry.minMinutes, 0),
    allMet: entries.length > 0 && entries.every((entry) => entry.met),
  };
}

/**
 * L'objectif du jour réellement visé : jamais en dessous de la somme des
 * minimums du soir. Sans cela, l'anneau « Ma journée » annoncerait
 * « Objectif atteint » à 1 h un lundi où la règle en exige 3 h 30.
 */
export function effectiveDailyGoal(preferences: Preferences, now: Date = new Date()): number {
  const minimums = minimumsFor(preferences, now);
  const total = Object.values(minimums).reduce((sum, value) => sum + (value ?? 0), 0);
  return Math.max(preferences.dailyGoalMinutes, total);
}

/* ── Règle : le minimum du soir tient dans la capacité planifiable ──── */

/**
 * LE MINIMUM DU SOIR FAIT PARTIE DE LA CAPACITÉ — il ne s'y ajoute pas.
 *
 * Décision produit : le total des minimums d'un soir (toutes matières) ne
 * dépasse jamais la capacité PLANIFIABLE de ce jour-là (capacité déclarée
 * moins la marge, lib/capacity.ts). Sans cette règle, un minimum de 3 h 30
 * pour 2 h déclarées produisait à l'accueil des consignes contradictoires :
 * « assez pour aujourd'hui » d'un côté, « minimum pas atteint » de l'autre.
 *
 * Deux usages, et pas de troisième :
 *   — `eveningMinimumSaveErrors` REFUSE une saisie de Réglages qui violerait
 *     la règle ;
 *   — `eveningMinimumConflicts` DÉTECTE un réglage déjà enregistré qui la
 *     viole (ancienne version, autre appareil, onboarding) pour le signaler.
 * Aucune fonction ne CORRIGE un réglage : on ne réécrit jamais en silence ce
 * que l'élève a enregistré.
 */
export interface EveningMinimumConflict {
  /** 0 = lundi … 6 = dimanche. */
  weekday: number;
  /** Total des minimums du soir, toutes matières. */
  minimumMinutes: number;
  plannableMinutes: number;
  /** De combien le minimum dépasse la capacité planifiable. */
  excessMinutes: number;
}

type RulePreferences = Pick<Preferences, "eveningMinimums" | "capacityByWeekday" | "planningMarginPercent">;

function minimumTotal(preferences: Pick<Preferences, "eveningMinimums">, weekday: number): number {
  return Object.values(preferences.eveningMinimums[weekday] ?? {}).reduce((sum: number, value) => sum + (value ?? 0), 0);
}

function conflictOn(preferences: RulePreferences, weekday: number): EveningMinimumConflict | null {
  const minimumMinutes = minimumTotal(preferences, weekday);
  const plannable = plannableMinutesForWeekday(preferences, weekday);
  return minimumMinutes > plannable ? { weekday, minimumMinutes, plannableMinutes: plannable, excessMinutes: minimumMinutes - plannable } : null;
}

/** Les soirs où le minimum dépasse la capacité planifiable, du lundi au dimanche. */
export function eveningMinimumConflicts(preferences: RulePreferences): EveningMinimumConflict[] {
  return Array.from({ length: 7 }, (_, weekday) => conflictOn(preferences, weekday)).filter((entry): entry is EveningMinimumConflict => entry !== null);
}

/**
 * Ce qui interdit d'enregistrer `next` à la place de `current` — vide quand
 * l'enregistrement est permis.
 *
 * Un soir n'est jugé que s'il CHANGE (son minimum, ou sa capacité
 * planifiable via la capacité ou la marge) : on ne peut rien enregistrer qui
 * viole la règle, mais un ancien réglage incohérent que l'élève ne touche pas
 * ne l'empêche pas d'enregistrer son prénom ou ses objectifs. Il reste
 * signalé (`eveningMinimumConflicts`) jusqu'à ce qu'il le corrige.
 */
export function eveningMinimumSaveErrors(current: RulePreferences, next: RulePreferences): EveningMinimumConflict[] {
  return eveningMinimumConflicts(next).filter(
    ({ weekday }) => minimumTotal(next, weekday) !== minimumTotal(current, weekday) || plannableMinutesForWeekday(next, weekday) !== plannableMinutesForWeekday(current, weekday)
  );
}

/** « Lundi : 3 h 30 de minimum pour 1 h 36 planifiables » — la même phrase dans l'alerte et dans Réglages. */
export function describeEveningMinimumConflict(conflict: EveningMinimumConflict): string {
  return `${WEEKDAY_LABELS[conflict.weekday]} : ${formatMinutesSpan(conflict.minimumMinutes)} de minimum pour ${formatMinutesSpan(conflict.plannableMinutes)} planifiables`;
}

/* ── Le budget d'un jour, partagé avec le minimum du soir ───────────── */

/**
 * LE MINIMUM DU SOIR EST RÉSERVÉ AVANT TOUT LE RESTE.
 *
 * Le minimum fait partie de la capacité : le planning des échéances
 * (lib/planning.ts) et leur faisabilité (lib/deadlines.ts) ne peuvent donc
 * pas disposer de toute la capacité planifiable d'un soir de minimum. Avant,
 * ils l'ignoraient : le planning réservait 2 h à un DM sur les 2 h 32 d'un
 * soir qui en devait déjà 2 h 30 au minimum, et l'agenda du jour repoussait
 * alors le DM — « casé » d'un côté, « à demain » de l'autre, chaque jour.
 *
 * Une séance compte pour le minimum de SA matière (c'est ce que mesure
 * `eveningPlan`) : un DM de physique peut donc prendre la réserve de
 * physique, jamais celle des maths. D'où un budget en deux parts :
 *
 *   reserved  ce qui reste à faire du minimum, matière par matière ;
 *   free      le reste de la capacité, ouvert à tout travail.
 *
 * Réglage incohérent (minimum > capacité, signalé ailleurs) : la réserve
 * est plafonnée à la capacité, matière après matière dans l'ordre de
 * lib/study.ts — rien ne dépasse jamais la capacité planifiable.
 */
export interface DayBudget {
  free: number;
  reserved: Map<Subject, number>;
}

/**
 * Le budget d'un jour. `capacity` : la capacité planifiable encore
 * disponible ce jour-là (aujourd'hui : moins le travail déjà fait, voir
 * lib/capacity.ts#remainingPlannableToday). Aujourd'hui, la réserve ne garde
 * que ce qui RESTE du minimum ; un autre jour, le minimum entier.
 */
export function splitDayBudget(preferences: Preferences, sessions: WorkSession[], date: Date, capacity: number, now: Date = new Date()): DayBudget {
  const remaining = new Map<Subject, number>();
  if (dayKey(date) === dayKey(now)) {
    for (const entry of eveningPlan(preferences, sessions, now).entries) remaining.set(entry.subject, Math.max(0, entry.minMinutes - entry.doneMinutes));
  } else {
    const minimums = minimumsFor(preferences, date);
    for (const subject of subjects) remaining.set(subject, minimums[subject] ?? 0);
  }
  let left = Math.max(0, capacity);
  const reserved = new Map<Subject, number>();
  for (const subject of subjects) {
    const minutes = Math.min(left, remaining.get(subject) ?? 0);
    if (minutes <= 0) continue;
    reserved.set(subject, minutes);
    left -= minutes;
  }
  return { free: left, reserved };
}

/** Ce qu'un travail de cette matière peut prendre ce jour-là : la part libre, plus la réserve de SA matière. */
export function availableFor(budget: DayBudget, subject: Subject | null): number {
  return budget.free + (subject ? budget.reserved.get(subject) ?? 0 : 0);
}
