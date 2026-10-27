import ICAL from "ical.js";
import type { Subject } from "@/lib/supabase/types";

/**
 * CALENDRIERS DE L'ÉLÈVE (mission 18) — l'emploi du temps vient de SES agendas,
 * pas d'une saisie dans TaekdHub.
 *
 * L'élève a déjà son emploi du temps dans son agenda Google (cours, DS, TD…)
 * et quelques rendez-vous dans iCloud (oral d'anglais, colle de français).
 * Plutôt que de le lui faire recopier — et de le laisser diverger dès qu'un
 * cours bouge —, TaekdHub LIT ces agendas par leur adresse iCal secrète
 * (Google : « Adresse secrète au format iCal » ; iCloud : calendrier public).
 *
 *   Rien n'est STOCKÉ du contenu de l'agenda : la grille est relue à chaque
 *   affichage (cache court côté appareil pour l'hors-ligne seulement).
 *   L'agenda reste la source de vérité ; TaekdHub ne l'écrit jamais.
 *
 * Ce module est PUR (aucun réseau) : la route `/api/calendar` télécharge,
 * ce fichier analyse et déplie les récurrences sur la fenêtre demandée.
 */

export interface CalendarFeed {
  id: string;
  /** Nom affiché (« EDT », « Perso »). */
  label: string;
  /** Adresse iCal (https ou webcal). C'est un SECRET de l'élève : jamais affichée en entier, jamais dans une URL de TaekdHub. */
  url: string;
}

export type CalendarEventKind = "cours" | "td" | "tp" | "ds" | "colle" | "perso";

export interface CalendarEvent {
  /** Stable d'un affichage à l'autre : uid de l'événement + début de l'occurrence. */
  id: string;
  feedId: string;
  title: string;
  /** ISO avec décalage, ou "AAAA-MM-JJ" pour un événement sur la journée. */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  kind: CalendarEventKind;
  subject: Subject | null;
}

export const CALENDAR_FEEDS_MAX = 5;
/** Plafond de dépliage d'UNE récurrence : un cours hebdomadaire depuis septembre en fait ~40. */
const MAX_OCCURRENCES_SCANNED = 1500;
/** Plafond d'événements renvoyés pour une fenêtre (une semaine en compte ~45). */
export const MAX_EVENTS_RETURNED = 600;

/**
 * Hôtes acceptés. Une liste FERMÉE : la route serveur télécharge l'adresse
 * donnée, elle ne doit pas servir à atteindre n'importe quelle machine
 * (réseau interne, métadonnées du cloud…).
 */
const ALLOWED_HOSTS = [/^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/, /^(.+\.)?icloud\.com$/, /^outlook\.(office365|live)\.com$/, /^outlook\.office\.com$/];

/** Normalise et vérifie une adresse iCal ; renvoie l'URL https ou un message d'erreur en français. */
export function checkFeedUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Colle l'adresse iCal de ton agenda." };
  const withScheme = trimmed.replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "Ce n'est pas une adresse valide." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "L'adresse doit commencer par https:// ou webcal://." };
  if (url.username || url.password || url.port) return { ok: false, error: "Adresse refusée." };
  if (!ALLOWED_HOSTS.some((host) => host.test(url.hostname))) {
    return { ok: false, error: "Seuls les agendas Google, iCloud et Outlook sont acceptés." };
  }
  return { ok: true, url: url.toString() };
}

/** L'adresse, masquée pour l'affichage : on montre l'hôte, jamais le jeton. */
export function maskFeedUrl(url: string): string {
  try {
    const parsed = new URL(url.replace(/^webcals?:\/\//i, "https://"));
    return `${parsed.hostname}/…`;
  } catch {
    return "adresse illisible";
  }
}

export function normalizeCalendarFeeds(raw: unknown): CalendarFeed[] {
  if (!Array.isArray(raw)) return [];
  const feeds: CalendarFeed[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.url !== "string") continue;
    const checked = checkFeedUrl(record.url);
    if (!checked.ok || seen.has(checked.url)) continue;
    seen.add(checked.url);
    const id = typeof record.id === "string" && /^[\w-]{1,40}$/.test(record.id) ? record.id : `cal-${feeds.length + 1}`;
    const label = typeof record.label === "string" && record.label.trim() ? record.label.trim().slice(0, 30) : "Agenda";
    feeds.push({ id, label, url: checked.url });
    if (feeds.length >= CALENDAR_FEEDS_MAX) break;
  }
  return feeds;
}

/* ── Classement d'un événement, d'après son titre ─────────────────────── */

const SUBJECT_PATTERNS: Array<[RegExp, Subject]> = [
  [/\bmath/i, "Mathématiques"],
  [/\bchimi|\bcristallo/i, "Chimie"],
  [/\bphysi/i, "Physique"],
  [/\binfo\s*(sp[eé]|option)|\boption\s*info|\bocaml/i, "Informatique Spé"],
  [/\binfo|\bpython/i, "Informatique TC"],
  [/\bfran[cç]ais|\bphilo|\blettres/i, "Français"],
  [/\banglais|\benglish/i, "Anglais"],
];

export function subjectOfTitle(title: string): Subject | null {
  for (const [pattern, subject] of SUBJECT_PATTERNS) if (pattern.test(title)) return subject;
  return null;
}

export function kindOfTitle(title: string): CalendarEventKind {
  if (/\b(ds|devoir surveill|concours blanc|pr[ée]paration au ds)\b/i.test(title)) return "ds";
  if (/\b(colle|kh[oô]lle|oral|interro)\b/i.test(title)) return "colle";
  if (/\btd\b/i.test(title)) return "td";
  if (/\btp\b/i.test(title)) return "tp";
  if (subjectOfTitle(title) || /\btipe\b|\bsi\b/i.test(title)) return "cours";
  return "perso";
}

/* ── Analyse ICS et dépliage des récurrences ──────────────────────────── */

function iso(time: ICAL.Time): { value: string; allDay: boolean } {
  if (time.isDate) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return { value: `${time.year}-${pad(time.month)}-${pad(time.day)}`, allDay: true };
  }
  const date = time.toJSDate();
  return { value: date.toISOString(), allDay: false };
}

function endTime(time: ICAL.Time): number {
  return time.isDate ? Date.UTC(time.year, time.month - 1, time.day) : time.toJSDate().getTime();
}

/**
 * Tous les événements de `text` (un fichier .ics) qui CHEVAUCHENT
 * [from, to[. Récurrences dépliées (RRULE, EXDATE, occurrences modifiées par
 * RECURRENCE-ID), fuseaux respectés (VTIMEZONE du fichier).
 * Un fichier illisible renvoie `null` — l'appelant le signale, sans planter.
 */
export function eventsInRange(text: string, feedId: string, from: Date, to: Date): CalendarEvent[] | null {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    return null;
  }
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* fuseau illisible : l'heure retombera sur UTC pour ses événements */
    }
  }

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Component[] = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    if (component.hasProperty("recurrence-id")) exceptions.push(component);
    else {
      const event = new ICAL.Event(component);
      if (event.uid) masters.set(event.uid, event);
    }
  }
  for (const exception of exceptions) {
    const uid = exception.getFirstPropertyValue("uid");
    const master = typeof uid === "string" ? masters.get(uid) : undefined;
    if (master) {
      try {
        master.relateException(exception);
      } catch {
        /* exception orpheline : ignorée */
      }
    } else {
      const lone = new ICAL.Event(exception);
      masters.set(`${lone.uid}#${exceptions.indexOf(exception)}`, lone);
    }
  }

  const out: CalendarEvent[] = [];
  const push = (event: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    const startMs = endTime(start);
    const endMs = end ? endTime(end) : startMs;
    if (endMs <= fromMs || startMs >= toMs) return;
    const status = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") return;
    const title = (event.summary || "Sans titre").trim().slice(0, 120);
    const s = iso(start);
    const e = end ? iso(end) : s;
    out.push({
      id: `${event.uid}@${s.value}`,
      feedId,
      title,
      start: s.value,
      end: e.value,
      allDay: s.allDay,
      location: event.location ? event.location.trim().slice(0, 80) || null : null,
      kind: kindOfTitle(title),
      subject: subjectOfTitle(title),
    });
  };

  for (const event of masters.values()) {
    if (out.length >= MAX_EVENTS_RETURNED) break;
    try {
      if (!event.isRecurring()) {
        push(event, event.startDate, event.endDate);
        continue;
      }
      const iterator = event.iterator();
      let next: ICAL.Time | null;
      let scanned = 0;
      while ((next = iterator.next()) && scanned < MAX_OCCURRENCES_SCANNED) {
        scanned += 1;
        if (endTime(next) >= toMs) break;
        const details = event.getOccurrenceDetails(next);
        push(details.item, details.startDate, details.endDate);
      }
    } catch {
      /* un événement illisible n'empêche pas les autres */
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  return out.slice(0, MAX_EVENTS_RETURNED);
}
