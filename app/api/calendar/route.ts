import { checkFeedUrl, eventsInRange } from "@/lib/calendar";

/**
 * LECTURE D'UN AGENDA (mission 18) — voir lib/calendar.ts.
 *
 * Le navigateur ne peut pas lire un .ics Google ou iCloud directement (CORS) :
 * cette route le télécharge et renvoie les événements d'une fenêtre.
 *
 *   POST, jamais GET : l'adresse iCal est un SECRET (elle donne accès à tout
 *   l'agenda), elle voyage dans le corps, pas dans une URL qui finirait dans
 *   des journaux.
 *   Hôtes en liste fermée (Google, iCloud, Outlook) et redirections refusées :
 *   la route ne peut pas servir à atteindre une autre machine.
 *   Rien n'est conservé côté serveur.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 3_000_000;
const MAX_RANGE_DAYS = 62;
const TIMEOUT_MS = 10_000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête illisible." }, 400);
  }
  const record = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const checked = checkFeedUrl(typeof record.url === "string" ? record.url : "");
  if (!checked.ok) return json({ error: checked.error }, 400);

  const from = new Date(typeof record.from === "string" ? record.from : "");
  const to = new Date(typeof record.to === "string" ? record.to : "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return json({ error: "Période invalide." }, 400);
  if ((to.getTime() - from.getTime()) / 86400000 > MAX_RANGE_DAYS) return json({ error: "Période trop longue." }, 400);

  let text: string;
  try {
    const response = await fetch(checked.url, {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/calendar, text/plain;q=0.8" },
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 403 || response.status === 401) {
      return json({ error: "Agenda introuvable : l'adresse a peut-être été réinitialisée." }, 502);
    }
    if (!response.ok) return json({ error: "L'agenda ne répond pas. Réessaie plus tard." }, 502);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return json({ error: "Agenda trop volumineux." }, 413);
    text = await response.text();
    if (text.length > MAX_BYTES) return json({ error: "Agenda trop volumineux." }, 413);
  } catch {
    return json({ error: "L'agenda ne répond pas. Réessaie plus tard." }, 502);
  }

  const events = eventsInRange(text, "feed", from, to);
  if (!events) return json({ error: "Ce fichier n'est pas un agenda lisible." }, 422);
  // L'identifiant de flux est posé par l'appareil, qui sait d'où vient la requête.
  return json({ events: events.map((event) => ({ id: event.id, title: event.title, start: event.start, end: event.end, allDay: event.allDay, location: event.location, kind: event.kind, subject: event.subject })) });
}
