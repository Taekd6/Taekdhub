import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildHermesEcheances, buildHermesToday, type CollectionStamps } from "@/lib/hermes-snapshot";
import { isHermesAuthorized } from "@/lib/hermes-auth";

/**
 * ACCÈS D'HERMES — LECTURE SEULE, séparé du connecteur de Claude.
 * URL : /api/mcp-hermes, avec `Authorization: Bearer <MCP_HERMES_TOKEN>`.
 *
 * AUTORISATION CÔTÉ SERVEUR. Ce serveur MCP n'enregistre QUE `get_today` et
 * `list_echeances` : les outils d'écriture n'existent pas ici, ils ne sont pas
 * « filtrés » après coup. Un jeton valide ne donne accès à rien d'autre. Le
 * connecteur de Claude (app/api/mcp/[key]/route.ts) et son secret ne sont pas
 * touchés.
 *
 * RIEN QUE DES LECTURES. Cette route n'appelle jamais `insert`, `update`,
 * `delete` ni `upsert` (lib/hermes-route.test.ts le vérifie dans le source).
 * La clé secrète de Supabase contourne pourtant la protection par ligne : la
 * lecture seule est garantie par ce code, pas par la base. Chaque requête
 * filtre donc `user_id` à la main, et les colonnes lues sont énumérées
 * (jamais « toutes les colonnes ») : les commentaires et les types d'erreurs des
 * annales ne sont même pas lus.
 *
 * AUCUN TEXTE LIBRE : tout ce qui sort passe par lib/hermes-snapshot.ts, qui
 * ne renvoie que des nombres, des dates, des valeurs de listes fermées et des
 * chapitres du programme officiel — ni titre, ni note, ni fiche, ni
 * identifiant d'échéance.
 *
 * AUCUN JOURNAL. Ni le jeton, ni les en-têtes, ni les paramètres ne sont
 * écrits ; un refus répond « Unauthorized » sans détail.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

let cachedOwner: string | null = null;

/** Même règle que le connecteur de Claude : `MCP_USER_ID`, sinon l'unique compte du projet, sinon rien. */
async function ownerId(): Promise<string | null> {
  if (process.env.MCP_USER_ID) return process.env.MCP_USER_ID;
  if (cachedOwner) return cachedOwner;
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 2 });
  if (error || data.users.length !== 1) return null;
  cachedOwner = data.users[0].id;
  return cachedOwner;
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/**
 * Une exception (configuration absente, réseau coupé…) ne devient JAMAIS la
 * réponse : son message pourrait nommer une adresse, une table ou une requête.
 */
async function safely(read: () => Promise<ReturnType<typeof text>>) {
  try {
    return await read();
  } catch {
    return text(UNAVAILABLE);
  }
}
/** Aucun message d'erreur de la base n'est relayé : il pourrait nommer une table, un identifiant ou une requête. */
const UNAVAILABLE = "Erreur : lecture impossible pour le moment.";
const NO_DATA = "Aucune donnée synchronisée : l'élève doit être connecté à son compte dans TaekdHub.";

/** Les collections de l'élève et la date de leur dernière écriture, en lecture seule. */
async function readCollections(user_id: string) {
  const { data, error } = await db().from("user_collections").select("collection, items, updated_at").eq("user_id", user_id);
  if (error) return null;
  const byName: Record<string, unknown> = {};
  const stamps: CollectionStamps = {};
  for (const row of data ?? []) {
    byName[row.collection as string] = row.items;
    stamps[row.collection as string] = row.updated_at as string;
  }
  return { byName, stamps };
}

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "get_today",
    {
      title: "État du jour (sans texte libre)",
      description:
        "L'état du jour dans TaekdHub, en lecture seule et sans aucun texte saisi par l'élève : prochain mouvement (genre, matière, minutes, identifiants de raisons), verrous de cours, points faibles par chapitre du programme, échéances à venir (type, matière, date, temps restant), chapitres qui s'effacent, erreurs récentes (matière, type, jour), annales en chiffres, cartes Anki dues. Le bloc `meta` donne la date de génération et la fraîcheur des données : si `donnees_anciennes` est vrai, aucune synchronisation récente n'a eu lieu — signale-le avant tout commentaire. Rien dans cette réponse ne permet d'écrire dans TaekdHub.",
      inputSchema: z.object({}),
    },
    () =>
      safely(async () => {
        const user_id = await ownerId();
        if (!user_id) return text(UNAVAILABLE);
        const [collections, annales] = await Promise.all([
          readCollections(user_id),
          // Colonnes énumérées : ni `commentaire` ni `erreurs`.
          db().from("exercise_logs").select("id, created_at, matiere, chapitre, source, niveau, resultat, indices, temps_min, temps_prevu, aide").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1000),
        ]);
        if (!collections || annales.error) return text(UNAVAILABLE);
        if (Object.keys(collections.byName).length === 0) return text(NO_DATA);
        return text(JSON.stringify(buildHermesToday(collections.byName, annales.data, collections.stamps, new Date())));
      })
  );

  server.registerTool(
    "list_echeances",
    {
      title: "Échéances à venir (sans titre)",
      description:
        "Les échéances encore à faire, d'aujourd'hui à `jours` jours (toutes si absent), la plus proche d'abord : type, matière, date, jours restants, minutes restantes, importance. Ni titre, ni note, ni identifiant : lecture seule. Le bloc `meta` donne la fraîcheur des données.",
      inputSchema: z.object({ jours: z.number().int().min(0).max(366).optional() }),
    },
    ({ jours }) =>
      safely(async () => {
        const user_id = await ownerId();
        if (!user_id) return text(UNAVAILABLE);
        const collections = await readCollections(user_id);
        if (!collections) return text(UNAVAILABLE);
        return text(JSON.stringify(buildHermesEcheances(collections.byName, collections.stamps, new Date(), jours)));
      })
  );
});

async function guarded(req: Request) {
  if (!isHermesAuthorized(req.headers.get("authorization"), process.env.MCP_HERMES_TOKEN)) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return mcp(req);
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export { guarded as GET, guarded as POST, guarded as DELETE };
