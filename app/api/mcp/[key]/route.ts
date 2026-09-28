import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

/**
 * CONNECTEUR MCP — la porte d'entrée de Claude dans TaekdHub.
 * URL : /api/mcp/<MCP_SECRET> (variante clé-dans-le-chemin de ../route.ts). Côté serveur uniquement (clé secrète Supabase).
 */
function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "log_exercise",
    {
      title: "Enregistrer un exercice",
      description: "Enregistre le résultat d'un exercice d'annale corrigé (appelé après chaque correction).",
      inputSchema: z.object({
        matiere: z.string().describe("maths / physique / chimie"),
        chapitre: z.string().describe("ex : réduction, séries entières"),
        source: z.string().optional().describe("ex : Mines-Ponts 2023 MP1, partie II"),
        niveau: z.string().optional().describe("CCINP / Mines / Centrale / X-ENS"),
        resultat: z.enum(["réussi", "partiel", "échec"]),
        indices: z.number().int().min(0).max(3).optional(),
        temps_min: z.number().int().optional(),
        temps_prevu: z.number().int().optional(),
        erreurs: z.array(z.string()).optional().describe("types d'erreurs relevés à la correction"),
        commentaire: z.string().optional(),
      }),
    },
    async (args) => {
      const { error } = await db().from("exercise_logs").insert(args);
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
      let q = db().from("exercise_logs").select("*").order("created_at", { ascending: false }).limit(limit ?? 100);
      if (matiere) q = q.eq("matiere", matiere);
      if (chapitre) q = q.ilike("chapitre", `%${chapitre}%`);
      const { data, error } = await q;
      return text(error ? `Erreur : ${error.message}` : JSON.stringify(data));
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
