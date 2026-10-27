import { bearerToken } from "@/lib/hermes-auth";
import { MIN_CAPTURE_TOKEN_LENGTH } from "@/lib/capture-handler";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import { mutateCollection, type CollectionStore } from "@/lib/mcp-collections";
import { completeFromReminders, doneReminderUrls, idFromReminder, MAX_COMPLETIONS_PER_CALL, openReminders } from "@/lib/rappels";
import { dayKey } from "@/lib/study";

/**
 * LE GESTIONNAIRE DE `/api/rappels` — voir lib/rappels.ts.
 *
 * Même porte que la capture rapide (lib/capture-handler.ts) : le jeton
 * `CAPTURE_TOKEN` dans `Authorization: Bearer …` (le raccourci de l'élève
 * l'a déjà), `MCP_USER_ID` pour le compte, FERMÉ si l'un manque.
 *
 *   GET   → { a_faire, termines }
 *   POST  { termines: [url ou id, …] }  → coche ces tâches, puis { coches, a_faire, termines }
 *
 * Une seule requête par passage du raccourci : il envoie ce qu'il a coché et
 * reçoit dans la même réponse ce qu'il doit créer et cocher.
 */

export interface RappelsEnv {
  token: string | undefined;
  userId: string | undefined;
  siteUrl: string;
  store: (userId: string) => CollectionStore;
  now: () => Date;
}

const MAX_BODY_BYTES = 16_384;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleRappels(req: Request, env: RappelsEnv): Promise<Response> {
  if (!env.token || env.token.length < MIN_CAPTURE_TOKEN_LENGTH || !env.userId) return json({ error: "Synchro Rappels non configurée sur le serveur." }, 503);
  if (!isMcpKeyValid(bearerToken(req.headers.get("authorization")), env.token)) return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });

  const store = env.store(env.userId);
  const now = env.now();
  let coches: string[] = [];

  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Requête trop grande." }, 413);
    let body: unknown = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: "JSON illisible." }, 400);
      }
    }
    const list = typeof body === "object" && body !== null ? (body as Record<string, unknown>).termines : undefined;
    // Raccourcis envoie une liste vide comme "" ou omet le champ : les deux valent « rien ».
    const values = Array.isArray(list) ? list : typeof list === "string" && list ? list.split(/\n/) : [];
    const ids = [...new Set(values.map(idFromReminder).filter((id): id is string => id !== null))].slice(0, MAX_COMPLETIONS_PER_CALL);
    if (ids.length > 0) {
      try {
        const outcome = await mutateCollection(store, (current) => {
          const { items, completed } = completeFromReminders(current, ids, now);
          return { ok: true as const, items, value: completed };
        });
        if (!outcome.ok) return json({ error: "Écriture impossible. Réessaie dans un instant." }, 500);
        coches = outcome.value;
      } catch {
        return json({ error: "Écriture impossible. Réessaie dans un instant." }, 500);
      }
    }
  } else if (req.method !== "GET") {
    return json({ error: "Méthode non prise en charge." }, 405);
  }

  try {
    const row = await store.read();
    const items = row?.items ?? [];
    return json({ coches, a_faire: openReminders(items, dayKey(now), env.siteUrl), termines: doneReminderUrls(items, now, env.siteUrl) }, 200);
  } catch {
    return json({ error: "Lecture impossible. Réessaie dans un instant." }, 500);
  }
}
