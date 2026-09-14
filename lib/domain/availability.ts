import { atTime, dayKey, minutesFromTime, timeFromMinutes, weekdayOf } from "@/lib/domain/date";
import { WEEKDAYS, type Availability, type TimeRange } from "@/lib/domain/types";

/**
 * ============================================================================
 * DISPONIBILITÉS — la capacité RÉELLE de travail, jour par jour.
 * ============================================================================
 *
 * Sans elle, une application de planning ne peut rien dire d'utile : elle
 * empile des tâches et laisse croire que tout tient. Toute l'analyse de
 * charge (domain/workload.ts) et la planification automatique
 * (domain/scheduling.ts) reposent sur les plages décrites ici.
 *
 * Un jour a soit ses plages ORDINAIRES (`weekly`), soit — s'il existe une
 * exception à sa date — exactement les plages de cette exception. Une
 * exception REMPLACE, elle n'ajoute pas : c'est la seule façon d'exprimer
 * « ce mercredi-là, rien » (exception à zéro plage), qu'une addition ne
 * saurait pas dire.
 */

/**
 * Rythme de départ — des soirées en semaine, des journées le week-end.
 * Modifiable intégralement dans les réglages ; c'est un point de départ
 * plausible pour un interne/externe de prépa, pas une prescription.
 */
export const DEFAULT_AVAILABILITY: Availability = {
  weekly: {
    0: [{ start: "18:00", end: "22:00" }],
    1: [{ start: "18:00", end: "21:00" }],
    2: [{ start: "14:00", end: "19:00" }],
    3: [{ start: "18:00", end: "22:00" }],
    4: [{ start: "18:00", end: "20:00" }],
    5: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "18:00" }],
    6: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "18:00" }],
  },
  exceptions: [],
};

/** Plages valides et ordonnées, fusionnées si elles se chevauchent — une plage 18:00-22:00 doublée ne doit pas compter huit heures. */
export function normalizeRanges(ranges: TimeRange[]): TimeRange[] {
  const valid = ranges
    .map((range) => ({ ...range, startMin: minutesFromTime(range.start), endMin: minutesFromTime(range.end) }))
    .filter((range) => Number.isFinite(range.startMin) && Number.isFinite(range.endMin) && range.endMin > range.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const merged: { start: string; end: string; label?: string; startMin: number; endMin: number }[] = [];
  for (const range of valid) {
    const previous = merged[merged.length - 1];
    if (previous && range.startMin <= previous.endMin) {
      if (range.endMin > previous.endMin) {
        previous.endMin = range.endMin;
        previous.end = range.end;
      }
      continue;
    }
    merged.push({ ...range });
  }
  return merged.map(({ start, end, label }) => (label ? { start, end, label } : { start, end }));
}

/** Plages d'un jour donné — exception si elle existe, rythme hebdomadaire sinon. */
export function rangesForDay(availability: Availability, day: Date | string): TimeRange[] {
  const key = typeof day === "string" ? day : dayKey(day);
  const exception = availability.exceptions.find((item) => item.date === key);
  if (exception) return normalizeRanges(exception.ranges);
  const weekday = typeof day === "string" ? weekdayOf(new Date(`${key}T12:00:00`)) : weekdayOf(day);
  return normalizeRanges(availability.weekly[weekday] ?? []);
}

/** Capacité d'un jour, en minutes. */
export function capacityMinutes(availability: Availability, day: Date | string): number {
  return rangesForDay(availability, day).reduce(
    (total, range) => total + (minutesFromTime(range.end) - minutesFromTime(range.start)),
    0
  );
}

/** Capacité hebdomadaire ordinaire (hors exceptions) — affichée dans les réglages pour que le rythme choisi soit lisible d'un coup d'œil. */
export function weeklyCapacityMinutes(availability: Availability): number {
  let total = 0;
  for (const weekday of WEEKDAYS) {
    for (const range of normalizeRanges(availability.weekly[weekday] ?? [])) {
      total += minutesFromTime(range.end) - minutesFromTime(range.start);
    }
  }
  return total;
}

/** Un intervalle concret de la journée, en instants — ce que manipule la planification. */
export interface Slot {
  start: Date;
  end: Date;
  minutes: number;
}

/** Plages d'un jour converties en instants. */
export function slotsForDay(availability: Availability, day: Date | string): Slot[] {
  const key = typeof day === "string" ? day : dayKey(day);
  return rangesForDay(availability, key).map((range) => {
    const start = atTime(key, range.start);
    const end = atTime(key, range.end);
    return { start, end, minutes: (end.getTime() - start.getTime()) / 60_000 };
  });
}

/**
 * CRÉNEAUX LIBRES d'une journée : les plages disponibles moins ce qui y est
 * déjà posé, et moins le temps déjà écoulé si c'est aujourd'hui.
 *
 * Proposer à 21 h de commencer une tâche « à 18 h aujourd'hui » est la faute
 * qui discrédite un planificateur en une seule utilisation : `now` découpe
 * donc réellement la première plage.
 */
export function freeSlotsForDay(
  availability: Availability,
  day: Date | string,
  busy: { start: string; end: string }[],
  now?: Date
): Slot[] {
  const key = typeof day === "string" ? day : dayKey(day);
  const floor = now && dayKey(now) === key ? now.getTime() : undefined;

  const occupied = busy
    .map((item) => ({ start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }))
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
    .sort((a, b) => a.start - b.start);

  const free: Slot[] = [];
  for (const slot of slotsForDay(availability, key)) {
    let cursor = Math.max(slot.start.getTime(), floor ?? 0);
    const limit = slot.end.getTime();
    for (const item of occupied) {
      if (item.end <= cursor || item.start >= limit) continue;
      if (item.start > cursor) push(free, cursor, Math.min(item.start, limit));
      cursor = Math.max(cursor, item.end);
      if (cursor >= limit) break;
    }
    if (cursor < limit) push(free, cursor, limit);
  }
  return free;
}

/** Ignore les miettes : un trou de moins de 10 minutes n'est pas un créneau de travail. */
const MIN_USABLE_MINUTES = 10;

function push(list: Slot[], startMs: number, endMs: number): void {
  const minutes = (endMs - startMs) / 60_000;
  if (minutes < MIN_USABLE_MINUTES) return;
  list.push({ start: new Date(startMs), end: new Date(endMs), minutes: Math.round(minutes) });
}

/** Plage lisible « 18:00 → 22:00 ». */
export function formatRange(range: TimeRange): string {
  return `${range.start} → ${range.end}`;
}

/** Plage construite à partir d'un début et d'une durée — utilisé par l'éditeur de disponibilités. */
export function rangeOfDuration(start: string, minutes: number): TimeRange {
  return { start, end: timeFromMinutes(minutesFromTime(start) + minutes) };
}
