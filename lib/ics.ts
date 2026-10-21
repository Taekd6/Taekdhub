/**
 * ICS (RFC 5545) — écrire un calendrier que Calendrier Apple (iPhone, montre, Mac) accepte,
 * en import ponctuel (.ics) comme en abonnement (webcal://).
 *
 * CHOIX, ET POURQUOI
 *   - Heures en UTC (« …Z ») : pas de VTIMEZONE à écrire, donc pas de définition de fuseau
 *     fausse. La conversion depuis l'heure de Paris tient compte du changement d'heure
 *     (`parisToUtc`) : le dimanche 25 octobre 2026, on passe de UTC+2 à UTC+1.
 *   - `UID` stable par événement : réimporter ou se réabonner MET À JOUR au lieu de dupliquer.
 *   - Alarmes `VALARM` en `DISPLAY` : c'est ce qui fait sonner l'iPhone et la montre ; elles
 *     sont fiables, contrairement aux notifications d'un site web.
 *   - Lignes repliées à 75 OCTETS (pas 75 caractères : « é » en pèse 2), sans couper un caractère.
 *
 * Fonctions pures, sans accès réseau ni disque.
 */

export const PARIS = "Europe/Paris";

const PARIS_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARIS,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Décalage de Paris par rapport à UTC, en minutes, à l'instant `utcMs` (120 l'été, 60 l'hiver). */
function parisOffsetMinutes(utcMs: number): number {
  const parts = PARIS_PARTS.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** « 2026-10-24T09:30 » (heure de Paris) → l'instant UTC correspondant. */
export function parisToUtc(local: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error(`Heure locale illisible : ${local}`);
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : la première devine le décalage, la seconde le confirme de l'autre côté d'un changement d'heure.
  let utc = guess - parisOffsetMinutes(guess) * 60_000;
  utc = guess - parisOffsetMinutes(utc) * 60_000;
  return new Date(utc);
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** « 20261024T073000Z ». */
export function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** « 2026-10-25 » → « 20261025 ». */
export function formatDate(day: string): string {
  return day.replace(/-/g, "");
}

/** Le jour suivant d'un « AAAA-MM-JJ » (fin exclusive d'un événement sur la journée). */
export function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Échappement d'un champ texte : barre oblique, point-virgule, virgule, saut de ligne. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Replie une ligne à 75 octets (continuation : CRLF + espace) sans couper un caractère multi-octets. */
export function foldLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let size = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > limit) {
      out.push(current);
      current = " ";
      size = 1;
      limit = 75;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out;
}

export interface IcsEvent {
  /** Stable d'une génération à l'autre : c'est lui qui permet la mise à jour. */
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  /** Heure de Paris, « AAAA-MM-JJTHH:mm » — événement horaire. */
  start?: string;
  end?: string;
  /** « AAAA-MM-JJ » — événement sur la journée (le jour de repos). */
  allDay?: string;
  /** Minutes AVANT le début ; 0 = au début. Vide = aucune alarme. */
  alarms?: number[];
  categories?: string[];
  /** `false` : n'occupe pas le calendrier (jour de repos). */
  busy?: boolean;
  /** À incrémenter quand le contenu change. */
  sequence?: number;
}

export interface IcsCalendar {
  name: string;
  description?: string;
  /** Instant de génération (injecté pour des tests stables). */
  now: Date;
  /** Intervalle de rafraîchissement proposé aux abonnés, en heures. */
  refreshHours?: number;
}

/** « dans 45 min », « dans 3 h », « dans 14 jours » : ce que dit l'alarme. */
export function alarmLead(minutes: number): string {
  if (minutes < 90) return `dans ${minutes} min`;
  if (minutes < 2 * 1440) return `dans ${Math.round(minutes / 60)} h`;
  return `dans ${Math.round(minutes / 1440)} jours`;
}

function alarmBlock(minutes: number, label: string): string[] {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(label)}`,
    `TRIGGER:${minutes === 0 ? "PT0S" : `-PT${minutes}M`}`,
    "END:VALARM",
  ];
}

function eventLines(event: IcsEvent, stamp: string): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${stamp}`];
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.allDay)}`, `DTEND;VALUE=DATE:${formatDate(nextDay(event.allDay))}`);
  } else if (event.start && event.end) {
    lines.push(`DTSTART:${formatUtc(parisToUtc(event.start))}`, `DTEND:${formatUtc(parisToUtc(event.end))}`);
  } else {
    throw new Error(`Événement sans date : ${event.uid}`);
  }
  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.categories?.length) lines.push(`CATEGORIES:${event.categories.map(escapeText).join(",")}`);
  lines.push("STATUS:CONFIRMED", `TRANSP:${event.busy === false ? "TRANSPARENT" : "OPAQUE"}`, `SEQUENCE:${event.sequence ?? 0}`);
  for (const minutes of event.alarms ?? []) lines.push(...alarmBlock(minutes, minutes === 0 ? event.summary : `${event.summary} ${alarmLead(minutes)}`));
  lines.push("END:VEVENT");
  return lines;
}

/** Le texte complet du fichier .ics (fins de ligne CRLF, lignes repliées). */
export function buildCalendar(calendar: IcsCalendar, events: IcsEvent[]): string {
  const stamp = formatUtc(calendar.now);
  const refresh = `PT${calendar.refreshHours ?? 6}H`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaekdHub//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-TIMEZONE:${PARIS}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    `X-PUBLISHED-TTL:${refresh}`,
  ];
  if (calendar.description) lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);
  for (const event of events) lines.push(...eventLines(event, stamp));
  lines.push("END:VCALENDAR");
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}
