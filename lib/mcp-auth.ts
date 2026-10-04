import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Le connecteur MCP est protégé par un secret placé dans l'URL
 * (/api/mcp/<MCP_SECRET>). Le comparer avec `!==` répondait plus ou moins
 * vite selon le nombre de premiers caractères justes : en mesurant ces
 * écarts, on pourrait en théorie deviner le secret caractère par caractère.
 *
 * `timingSafeEqual` prend toujours le même temps, mais exige deux tampons de
 * même longueur. On compare donc les EMPREINTES SHA-256 (32 octets chacune) :
 * la longueur du secret ne fuit pas non plus.
 */
export function isMcpKeyValid(key: string | undefined, secret: string | undefined): boolean {
  if (!secret || !key) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(key), digest(secret));
}
