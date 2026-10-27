import { handleCapture, type CaptureEnv } from "@/lib/capture-handler";
import { serverCollectionStore } from "@/lib/server-collection-store";

/**
 * CAPTURE RAPIDE (Apple Watch / Raccourcis) — voir lib/capture.ts et
 * lib/capture-handler.ts. Variables : `CAPTURE_TOKEN` (≥ 32 caractères,
 * `openssl rand -hex 32`), `MCP_USER_ID` (le compte à qui écrire),
 * `SUPABASE_URL` et `SUPABASE_SECRET_KEY`. Les dates sont celles de l'élève :
 * `MCP_TIMEZONE`, Europe/Paris par défaut, comme le connecteur.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const env: CaptureEnv = {
    token: process.env.CAPTURE_TOKEN,
    userId: process.env.MCP_USER_ID,
    store: (userId, collection) => serverCollectionStore(userId, collection),
    now: () => new Date(),
  };
  if (env.token && env.userId && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)) {
    return Response.json({ error: "Capture non configurée sur le serveur." }, { status: 503 });
  }
  return handleCapture(req, env);
}
