/**
 * REPRISE SUR « JWT issued at future » — connecteur MCP de Claude.
 *
 * Constat (incidents du 25/10 et du 01/11/2026) : `get_today` a renvoyé
 * « Erreur : JWT issued at future » pendant que d'autres outils, avec la même clé
 * et la même route, répondaient. Le dépôt ne fabrique ni ne vérifie aucun JWT
 * sur ce chemin : le message vient de Supabase, qui refuse la clé quand SON
 * horloge la juge datée du futur. La cause exacte n'est pas démontrée.
 *
 * Ce `fetch` refait UNE FOIS une requête refusée pour ce motif précis. C'est
 * sans risque pour une écriture : un refus d'authentification arrive avant
 * toute exécution, rien n'a été modifié. Tout autre refus, et toute autre
 * réponse, passent tels quels.
 *
 * Journal : seulement le code d'erreur (jamais la clé, l'URL ni les en-têtes),
 * pour mesurer la fréquence si l'incident revient.
 *
 * Fonctions pures, sans état.
 */

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Délai avant la nouvelle tentative : laisse l'horloge de Supabase rattraper la date de la clé. */
export const JWT_RETRY_DELAY_MS = 600;

const FUTURE_JWT = /JWT issued at future|PGRST303/i;

/** `true` si la réponse est un refus d'authentification dû à une clé datée du futur. */
export async function isFutureJwtRefusal(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    return FUTURE_JWT.test(await response.clone().text());
  } catch {
    return false;
  }
}

export function fetchWithFutureJwtRetry(
  baseFetch: FetchLike = (input, init) => fetch(input, init),
  delayMs: number = JWT_RETRY_DELAY_MS,
  log: (message: string) => void = (message) => console.warn(message)
): FetchLike {
  return async (input, init) => {
    const first = await baseFetch(input, init);
    if (!(await isFutureJwtRefusal(first))) return first;
    log("[mcp] Supabase a refusé la clé (PGRST303, JWT issued at future) : nouvelle tentative");
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return baseFetch(input, init);
  };
}
