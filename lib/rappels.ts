import { normalizeWorkItem, type WorkItem } from "@/lib/storage";

/**
 * SYNCHRO AVEC RAPPELS D'APPLE (mission 18).
 *
 * Un site web ne peut pas écrire dans Rappels : c'est un RACCOURCI iOS de
 * l'élève qui fait le pont (guide : components/rappels/rappels-guide.tsx).
 * À chaque passage (fermeture de l'app Rappels, et à heures fixes), il :
 *
 *   1. envoie les rappels qu'il a COCHÉS dans la liste « TaekdHub » ;
 *   2. reçoit en retour les tâches ouvertes de TaekdHub, et crée celles qui
 *      manquent dans Rappels ;
 *   3. reçoit aussi les tâches TERMINÉES dans TaekdHub, et coche les rappels
 *      correspondants.
 *
 * LE LIEN entre un rappel et une tâche est l'URL du rappel :
 * `<site>/echeances?t=<id>`. Le titre peut être retouché dans Rappels sans
 * rien casser, et toucher le lien ouvre la tâche dans TaekdHub.
 *
 * Ce fichier est PUR : la route (app/api/rappels) n'y branche que le jeton
 * et Supabase.
 */

export const DEFAULT_SITE_URL = "https://taekdhub.vercel.app";
/** Tâches renvoyées : échues depuis 7 jours au plus, ou dans les 45 jours. Au-delà, Rappels serait noyé. */
const PAST_DAYS = 7;
const AHEAD_DAYS = 45;
/** Une tâche terminée reste annoncée 14 jours : le temps qu'un appareil éteint repasse. */
const DONE_DAYS = 14;
export const MAX_REMINDERS = 60;
export const MAX_COMPLETIONS_PER_CALL = 100;
/** Heure posée sur un rappel sans heure : le soir, au moment où l'on fait le point. */
export const DEFAULT_REMINDER_TIME = "19:00";

export interface ReminderItem {
  id: string;
  titre: string;
  /** "AAAA-MM-JJ" — jour du rappel : le jour planifié s'il y en a un, sinon l'échéance. */
  jour: string | null;
  /** "HH:MM" — heure du rappel (plan, sinon heure d'échéance, sinon 19:00 si daté). */
  heure: string | null;
  /** "AAAA-MM-JJTHH:MM" prêt pour l'action « Ajouter un rappel » ; null sans date. */
  date: string | null;
  notes: string;
  url: string;
  /** « [t:<id>] » — repère à chercher dans les notes si l'action « Rechercher des rappels » ne filtre pas sur l'URL. */
  marque: string;
  important: boolean;
}

export function reminderUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/echeances?t=${encodeURIComponent(id)}`;
}

/** L'identifiant de tâche porté par une URL de rappel (ou l'identifiant lui-même), sinon `null`. */
export function idFromReminder(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[\w:.-]{1,80}$/.test(trimmed) && !trimmed.includes("://")) return trimmed;
  try {
    const id = new URL(trimmed).searchParams.get("t");
    return id && /^[\w:.-]{1,80}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

const KIND_LABEL: Partial<Record<WorkItem["kind"], string>> = { ds: "DS", colle: "Khôlle", dm: "DM", exercices: "Exos", chapitre: "Chapitre", concours: "Concours" };

function hasId(raw: unknown): raw is { id: string } {
  return typeof raw === "object" && raw !== null && typeof (raw as { id?: unknown }).id === "string" && (raw as { id: string }).id.length > 0;
}

function normalizeAll(items: unknown): WorkItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(hasId).map((raw) => normalizeWorkItem(raw));
}

/** Les tâches ouvertes à refléter dans Rappels, les plus proches d'abord. */
export function openReminders(rawItems: unknown, today: string, siteUrl = DEFAULT_SITE_URL): ReminderItem[] {
  return normalizeAll(rawItems)
    .filter((item) => item.status === "à faire" || item.status === "en cours")
    .map((item) => {
      const jour = item.plan?.day ?? item.dueDate;
      return { item, jour };
    })
    .filter(({ jour }) => jour === null || (dayDiff(today, jour) >= -PAST_DAYS && dayDiff(today, jour) <= AHEAD_DAYS))
    .sort((a, b) => (a.jour ?? "9999").localeCompare(b.jour ?? "9999") || a.item.createdAt.localeCompare(b.item.createdAt))
    .slice(0, MAX_REMINDERS)
    .map(({ item, jour }) => {
      const heure = item.plan?.time ?? (item.plan ? null : item.dueTime) ?? (jour ? DEFAULT_REMINDER_TIME : null);
      const parts = [item.subject, KIND_LABEL[item.kind], item.dueDate && item.dueDate !== jour ? `pour le ${item.dueDate}` : null, item.note].filter(Boolean);
      return {
        id: item.id,
        titre: item.title,
        jour,
        heure: jour ? heure : null,
        date: jour ? `${jour}T${heure ?? DEFAULT_REMINDER_TIME}` : null,
        notes: [parts.join(" · "), `[t:${item.id}]`].filter(Boolean).join("\n"),
        url: reminderUrl(siteUrl, item.id),
        marque: `[t:${item.id}]`,
        important: item.important,
      };
    });
}

/** Les URL des tâches terminées (ou retirées) récemment dans TaekdHub : le raccourci coche les rappels correspondants. */
export function doneReminderUrls(rawItems: unknown, now: Date, siteUrl = DEFAULT_SITE_URL): string[] {
  const limit = now.getTime() - DONE_DAYS * 86400000;
  return normalizeAll(rawItems)
    .filter((item) => item.status === "terminé" || item.status === "abandonné")
    .filter((item) => {
      const stamp = Date.parse(item.completedAt ?? item.updatedAt ?? item.createdAt);
      return Number.isFinite(stamp) && stamp >= limit;
    })
    .map((item) => reminderUrl(siteUrl, item.id));
}

/**
 * Coche dans TaekdHub les tâches dont le rappel a été coché. Seules les tâches
 * visées et encore ouvertes changent ; toutes les autres entrées repartent
 * EXACTEMENT telles qu'elles ont été lues (même les illisibles).
 */
export function completeFromReminders(rawItems: unknown, ids: string[], now: Date): { items: unknown[]; completed: string[] } {
  const wanted = new Set(ids);
  const completed: string[] = [];
  const list = Array.isArray(rawItems) ? rawItems : [];
  const stamp = now.toISOString();
  const items = list.map((raw) => {
    if (!hasId(raw) || !wanted.has(raw.id)) return raw;
    const item = normalizeWorkItem(raw);
    if (item.status !== "à faire" && item.status !== "en cours") return raw;
    completed.push(item.id);
    return { ...(raw as Record<string, unknown>), status: "terminé", completedAt: stamp, updatedAt: stamp };
  });
  return { items, completed };
}
