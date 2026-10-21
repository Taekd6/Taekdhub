import { buildCalendar } from "@/lib/ics";
import { calendarEvents } from "@/lib/holiday-program";
import { isMcpKeyValid } from "@/lib/mcp-auth";

/**
 * LE FLUX D'ABONNEMENT DU CALENDRIER APPLE — `GET /api/calendar/<CALENDAR_TOKEN>.ics`.
 *
 * Calendrier Apple ne sait pas envoyer d'en-tête d'authentification : le jeton est donc dans l'ADRESSE (comme
 * le secret du connecteur MCP). Ce qu'il protège : le programme de séances, en LECTURE SEULE. Il ne donne accès à
 * aucune donnée du compte. FERMÉ PAR DÉFAUT : sans `CALENDAR_TOKEN` d'au moins 32 caractères, la route répond 503.
 *
 * Le sens est unique : TaekdHub écrit dans Calendrier Apple, il ne lit pas ce qu'on y ajoute.
 */

export const MIN_CALENDAR_TOKEN_LENGTH = 32;

export interface CalendarFeedEnv {
  token: string | undefined;
  /** L'adresse publique du site, sans barre finale : elle sert aux liens des événements. */
  baseUrl: string;
  now: () => Date;
}

/** « <jeton>.ics » ou « <jeton> » → le jeton. */
export function tokenFromSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  return segment.endsWith(".ics") ? segment.slice(0, -4) : segment;
}

export function handleCalendarFeed(segment: string | undefined, env: CalendarFeedEnv): Response {
  if (!env.token || env.token.length < MIN_CALENDAR_TOKEN_LENGTH) {
    return new Response("Calendrier non configuré sur le serveur.", { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!isMcpKeyValid(tokenFromSegment(segment), env.token)) {
    return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
  }
  const body = buildCalendar(
    { name: "TaekdHub", description: "Séances de travail, DS, colles et devoirs.", now: env.now(), refreshHours: 6 },
    calendarEvents(env.baseUrl, env.now())
  );
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="taekdhub.ics"',
      // Court : une séance modifiée doit arriver vite sur l'iPhone.
      "cache-control": "private, max-age=300",
    },
  });
}
