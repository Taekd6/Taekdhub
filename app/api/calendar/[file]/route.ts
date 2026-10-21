import { handleCalendarFeed } from "@/lib/calendar-feed";

/**
 * Abonnement Calendrier Apple : `webcal://<site>/api/calendar/<CALENDAR_TOKEN>.ics`.
 * Voir lib/calendar-feed.ts. Variables : `CALENDAR_TOKEN` (≥ 32 caractères, `openssl rand -hex 32`),
 * `SITE_URL` (facultatif : l'adresse publique, sinon celle de la requête).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const segment = url.pathname.split("/").filter(Boolean).pop();
  const baseUrl = (process.env.SITE_URL || url.origin).replace(/\/+$/, "");
  return handleCalendarFeed(segment, { token: process.env.CALENDAR_TOKEN, baseUrl, now: () => new Date() });
}
