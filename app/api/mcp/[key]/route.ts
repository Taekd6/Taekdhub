import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildTodaySnapshot } from "@/lib/today-snapshot";

/**
 * CONNECTEUR MCP — la porte d'entrée de Claude dans TaekdHub.
 * URL : /api/mcp/<MCP_SECRET>. Côté serveur uniquement (clé secrète Supabase).
 *
 * À QUI APPARTIENNENT LES DONNÉES. La clé secrète contourne la RLS : c'est
 * donc ici, et nulle part ailleurs, qu'on décide pour quel élève on lit et
 * on écrit. `MCP_USER_ID` le dit explicitement ; à défaut, s'il n'existe
 * qu'UN compte dans le projet, c'est lui. Avec plusieurs comptes et sans
 * `MCP_USER_ID`, le connecteur refuse plutôt que de deviner.
 *
 * Les dates (« aujourd'hui », « hier ») sont celles de l'élève, pas celles
 * du serveur (UTC sur Vercel) : `MCP_TIMEZONE`, Europe/Paris par défaut.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

let cachedOwner: string | null = null;

async function ownerId(): Promise<string | null> {
  if (process.env.MCP_USER_ID) return process.env.MCP_USER_ID;
  if (cachedOwner) return cachedOwner;
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 2 });
  if (error || data.users.length !== 1) return null;
  cachedOwner = data.users[0].id;
  return cachedOwner;
}

const NO_OWNER =
  "Erreur : impossible de savoir à quel compte TaekdHub rattacher les données. Renseigne MCP_USER_ID (l'identifiant du compte, Supabase → Authentication → Users) dans les variables d'environnement Vercel.";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "log_exercise",
    {
      title: "Enregistrer un exercice",
      description:
        "Enregistre le résultat d'un exercice d'annale corrigé (appelé après chaque correction). Il apparaît dans TaekdHub (page Annales) et nourrit ses recommandations. Pour une NOUVELLE tentative d'un exercice déjà fait, réutilise exactement la même `source` et le même `chapitre` : les tentatives sont regroupées sur cette clé.",
      inputSchema: z.object({
        matiere: z.string().describe("maths / physique / chimie"),
        chapitre: z.string().describe("ex : réduction, séries entières"),
        source: z.string().optional().describe("ex : Mines-Ponts 2023 MP1, partie II"),
        niveau: z.string().optional().describe("CCINP / Mines / Centrale / X-ENS"),
        resultat: z.enum(["réussi", "partiel", "échec"]),
        indices: z.number().int().min(0).max(3).optional(),
        aide: z
          .enum(["sans", "indices", "correction"])
          .optional()
          .describe("aide réellement utilisée pendant l'essai : sans, indices, ou correction (la correction a été montrée avant la fin). Seule une réussite « sans » prouve la maîtrise."),
        temps_min: z.number().int().optional().describe("temps réellement passé, en minutes"),
        temps_prevu: z.number().int().optional().describe("temps que l'élève pensait mettre, annoncé AVANT de commencer"),
        erreurs: z.array(z.string()).optional().describe("types d'erreurs relevés à la correction"),
        commentaire: z.string().optional(),
      }),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const { error } = await db().from("exercise_logs").insert({ ...args, user_id });
      // 42703 : la colonne `aide` n'existe pas encore (migration 0008 non appliquée) — on enregistre sans elle plutôt que de perdre l'exercice.
      if (error?.code === "42703" && args.aide !== undefined) {
        const { aide: _aide, ...rest } = args;
        void _aide;
        const retry = await db().from("exercise_logs").insert({ ...rest, user_id });
        return text(retry.error ? `Erreur : ${retry.error.message}` : "Enregistré (sans le niveau d'aide : migration 0008 à appliquer).");
      }
      return text(error ? `Erreur : ${error.message}` : "Enregistré.");
    }
  );

  server.registerTool(
    "get_progress",
    {
      title: "Historique de progression",
      description: "Renvoie l'historique des exercices, du plus récent au plus ancien (filtrable par matière/chapitre).",
      inputSchema: z.object({
        matiere: z.string().optional(),
        chapitre: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    },
    async ({ matiere, chapitre, limit }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      let q = db().from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(limit ?? 100);
      if (matiere) q = q.ilike("matiere", `%${matiere}%`);
      if (chapitre) q = q.ilike("chapitre", `%${chapitre}%`);
      const { data, error } = await q;
      return text(error ? `Erreur : ${error.message}` : JSON.stringify(data));
    }
  );

  server.registerTool(
    "get_today",
    {
      title: "Où j'en suis aujourd'hui",
      description:
        "L'état du jour dans TaekdHub : la recommandation Next Move (raison, problème corrigé, critère de fin), le point faible principal établi par le diagnostic (cours, méthode, application, calcul, temps… avec ses preuves), les exercices à refaire sans aide, les échéances et DS, la mémoire des chapitres, les erreurs récentes, les cartes Anki dues au dernier relevé. À appeler AVANT de proposer un exercice, pour viser le vrai point faible.",
      inputSchema: z.object({}),
    },
    async () => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const client = db();
      const [collections, annales] = await Promise.all([
        client.from("user_collections").select("collection, items").eq("user_id", user_id),
        client.from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (collections.error) return text(`Erreur : ${collections.error.message}`);
      if (annales.error) return text(`Erreur : ${annales.error.message}`);
      const byName: Record<string, unknown> = {};
      for (const row of collections.data ?? []) byName[row.collection as string] = row.items;
      if (Object.keys(byName).length === 0) {
        return text("Aucune donnée synchronisée : l'élève doit se connecter à son compte dans TaekdHub (Réglages → Compte) pour que ses séances, échéances et chapitres soient lisibles ici.");
      }
      return text(JSON.stringify(buildTodaySnapshot(byName, annales.data, new Date())));
    }
  );
});

async function guarded(req: Request) {
  const secret = process.env.MCP_SECRET;
  // Clé dans le chemin : /api/mcp/<clé>
  const key = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if (!secret || key !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  return mcp(req);
}

export const maxDuration = 60;
export { guarded as GET, guarded as POST, guarded as DELETE };
