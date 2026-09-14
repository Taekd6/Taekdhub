/**
 * ============================================================================
 * TEMPS — toutes les manipulations de dates de l'application passent par ici.
 * ============================================================================
 *
 * Deux représentations, et une seule règle pour ne jamais les confondre :
 *
 *   ISO       un INSTANT (`2026-09-18T18:30:00.000Z`) — un créneau, un début
 *             de travail réel, un horodatage.
 *   DayKey    un JOUR LOCAL (`2026-09-18`) — l'unité du calendrier, de la
 *             charge quotidienne et des disponibilités.
 *
 * Le passage de l'un à l'autre est TOUJOURS local (fuseau du navigateur) :
 * `toISOString().slice(0, 10)` — le réflexe habituel — bascule de jour pour
 * tout le monde à l'est de Greenwich dès qu'il est 2 h du matin, ce qui
 * déplace silencieusement une échéance d'un jour. `dayKey` utilise donc
 * `en-CA`, le seul format de locale qui produise nativement `YYYY-MM-DD`.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Jour local d'un instant, `YYYY-MM-DD`. */
export function dayKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-CA");
}

/** Minuit local du jour contenant `value`. */
export function startOfDay(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date | string): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

/** Minuit local du LUNDI de la semaine contenant `value`. */
export function startOfWeek(value: Date | string): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

export function addDays(value: Date | string, days: number): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function addMinutes(value: Date | string, minutes: number): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(date.getTime() + minutes * 60_000);
}

/** Jour de la semaine au sens TaekdHub : 0 = lundi … 6 = dimanche. */
export function weekdayOf(value: Date | string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const date = value instanceof Date ? value : new Date(value);
  return ((date.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Minuit local d'une clé `YYYY-MM-DD`. Construit champ par champ : `new Date("2026-09-18")` serait interprété en UTC. */
export function dateFromDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

/** Combine un jour local et une heure `HH:MM` en un instant local. */
export function atTime(dayOrKey: Date | string, time: string): Date {
  const base = typeof dayOrKey === "string" ? dateFromDayKey(dayOrKey) : startOfDay(dayOrKey);
  const [hours, minutes] = time.split(":").map(Number);
  base.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return base;
}

/** Minutes écoulées depuis minuit, pour une heure `HH:MM`. */
export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** `HH:MM` à partir de minutes depuis minuit — borné à 23:59 pour ne jamais produire « 24:00 ». */
export function timeFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(total)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Heure locale `HH:MM` d'un instant. */
export function timeOf(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Suite de jours consécutifs, en clés, à partir de `from` (inclus). */
export function dayKeyRange(from: Date | string, days: number): string[] {
  const start = startOfDay(from);
  return Array.from({ length: Math.max(0, days) }, (_, index) => dayKey(addDays(start, index)));
}

/**
 * Nombre de JOURS CALENDAIRES entre deux instants — 0 pour aujourd'hui, 1
 * pour demain, -1 pour hier.
 *
 * Compté en jours locaux, pas en tranches de 24 h : une échéance demain à 8 h
 * vue à 22 h ce soir est « demain » (1), pas « dans 10 heures » (0). C'est ce
 * que compte réellement un élève, et tout l'affichage d'urgence en dépend.
 */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return dayKey(a) === dayKey(b);
}

/** Une date ISO réellement exploitable, ou `undefined` — frontière de confiance avec le stockage (voir lib/store/schema.ts). */
export function safeIso(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : value;
}

/* ─────────────────────────── AFFICHAGE ─────────────────────────── */

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const DAY_SHORT_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function formatDay(value: Date | string): string {
  return DAY_FORMAT.format(value instanceof Date ? value : new Date(value));
}

export function formatDayShort(value: Date | string): string {
  return DAY_SHORT_FORMAT.format(value instanceof Date ? value : new Date(value));
}

export function formatMonth(value: Date | string): string {
  return MONTH_FORMAT.format(value instanceof Date ? value : new Date(value));
}

/**
 * Jour EN MOTS quand c'est plus clair qu'une date : « aujourd'hui »,
 * « demain », « hier », puis le jour de la semaine dans les six jours qui
 * suivent, et la date complète au-delà.
 */
export function formatRelativeDay(value: Date | string, now: Date = new Date()): string {
  const diff = daysBetween(now, value);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  if (diff > 1 && diff <= 6) return formatDayShort(value);
  if (diff < -1 && diff >= -6) return `il y a ${-diff} jours`;
  return formatDayShort(value);
}

/**
 * Durée en minutes, écrite comme on la dit : « 45 min », « 1 h 30 », « 2 h ».
 * Jamais « 90 min » : au-delà de l'heure, personne ne compte en minutes.
 */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Variante compacte pour les grilles denses du calendrier : « 1h30 ». */
export function formatMinutesCompact(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** Valeur pour un `<input type="datetime-local">` (`YYYY-MM-DDTHH:MM`, en heure locale). */
export function toDateTimeLocalValue(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${dayKey(date)}T${timeOf(date)}`;
}

/** Lecture d'un `<input type="datetime-local">` — renvoie l'ISO de l'instant local correspondant, ou `undefined`. */
export function fromDateTimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
