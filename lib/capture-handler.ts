import { bearerToken } from "@/lib/hermes-auth";
import { appendOnce, captureAttempt, captureSession, parseCapture } from "@/lib/capture";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import { mutateCollection, type CollectionStore } from "@/lib/mcp-collections";

/**
 * LE GESTIONNAIRE DE `POST /api/capture` — séparé de la route pour être testé
 * sans réseau ni base (la route n'y branche que l'environnement et Supabase).
 *
 * FERMÉ PAR DÉFAUT, à trois niveaux :
 *   - `CAPTURE_TOKEN` absent ou de moins de 32 caractères : personne n'entre ;
 *   - `MCP_USER_ID` absent : on ne DEVINE pas à quel compte écrire (contrairement
 *     au connecteur de Claude, qui s'en remet à l'unique compte du projet) ;
 *   - jeton faux : 401, sans rien dire de ce qui existe.
 * Le jeton est dans l'en-tête `Authorization: Bearer …`, jamais dans l'URL.
 *
 * La réponse ne dit RIEN des données : « enregistré » ou « déjà enregistré ».
 */

export const MIN_CAPTURE_TOKEN_LENGTH = 32;
const MAX_BODY_BYTES = 2_048;

export interface CaptureEnv {
  token: string | undefined;
  userId: string | undefined;
  /** Une collection synchronisée du compte, avec la règle de révision des appareils. */
  store: (userId: string, collection: "sessions" | "attempts") => CollectionStore;
  now: () => Date;
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleCapture(req: Request, env: CaptureEnv): Promise<Response> {
  if (!env.token || env.token.length < MIN_CAPTURE_TOKEN_LENGTH || !env.userId) return json({ error: "Capture non configurée sur le serveur." }, 503);
  if (!isMcpKeyValid(bearerToken(req.headers.get("authorization")), env.token)) return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Requête trop grande." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "JSON illisible." }, 400);
  }

  const parsed = parseCapture(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const input = parsed.input;
  const now = env.now();

  const built = input.type === "seance" ? captureSession(input, now) : captureAttempt(input, now);
  if (!built) return json({ error: "Saisie invalide." }, 400);

  try {
    const outcome = await mutateCollection(env.store(env.userId, input.type === "seance" ? "sessions" : "attempts"), (current) => {
      const { items, duplicate } = appendOnce(current, built);
      return { ok: true as const, items, value: duplicate };
    });
    if (!outcome.ok) return json({ error: "Écriture impossible. Réessaie dans un instant." }, 500);
    return json({ enregistre: input.type, doublon: outcome.value }, 200);
  } catch {
    // Jamais le message de la base : il peut contenir des noms de tables ou de colonnes.
    return json({ error: "Écriture impossible. Réessaie dans un instant." }, 500);
  }
}
