/** Lien direct vers un exo d'un chapitre : `/exos/<chapitre>#exo-<id>` (+ `?q=<question>` côté appelant via `exoHref`). */
export const exoAnchor = (entryId: string) => `exo-${entryId}`;

/** `#exo-<id>` ou `#exo-<id>~<question>` → la cible, ou `null`. */
export function parseExoTarget(hash: string): { id: string; question: string | null } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith("exo-")) return null;
  let body = raw.slice(4);
  try {
    body = decodeURIComponent(body);
  } catch {
    /* garde le texte brut */
  }
  const cut = body.lastIndexOf("~");
  if (cut === -1) return body ? { id: body, question: null } : null;
  return { id: body.slice(0, cut), question: body.slice(cut + 1) || null };
}

/** Le lien qui ouvre le chapitre à l'exo (et à la question) visé. */
export function exoHref(chapterId: string, entryId: string, question: string | null = null): string {
  return `/exos/${chapterId}#${exoAnchor(entryId)}${question ? `~${encodeURIComponent(question)}` : ""}`;
}
