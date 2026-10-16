import { isMcpKeyValid } from "@/lib/mcp-auth";

/**
 * AUTORISATION D'HERMES — un jeton dans l'en-tête `Authorization: Bearer …`,
 * distinct du secret MCP de Claude.
 *
 * Le jeton n'est JAMAIS dans l'URL (donc pas dans les journaux de l'hébergeur
 * ni dans l'historique d'un client) et n'est jamais écrit ni renvoyé par le
 * serveur. La comparaison est à temps constant (lib/mcp-auth.ts).
 *
 * FERMÉ PAR DÉFAUT. Si `MCP_HERMES_TOKEN` n'est pas défini, ou trop court
 * pour résister à un essai répété, personne n'est autorisé : l'accès Hermes
 * n'existe que si l'élève l'a configuré avec une vraie valeur aléatoire
 * (`openssl rand -hex 32`).
 *
 * Fonctions pures.
 */

/** En dessous, la valeur configurée est refusée : un jeton court se devine. */
export const MIN_HERMES_TOKEN_LENGTH = 32;

/** Le jeton d'un en-tête `Authorization: Bearer <jeton>`, ou `undefined` si l'en-tête est absent ou d'une autre forme. */
export function bearerToken(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  return match ? match[1] : undefined;
}

/** `true` seulement si l'en-tête porte exactement le jeton configuré, et que celui-ci est assez long. */
export function isHermesAuthorized(authorizationHeader: string | null | undefined, configuredToken: string | undefined): boolean {
  if (!configuredToken || configuredToken.length < MIN_HERMES_TOKEN_LENGTH) return false;
  return isMcpKeyValid(bearerToken(authorizationHeader), configuredToken);
}
