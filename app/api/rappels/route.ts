import { handleRappels, type RappelsEnv } from "@/lib/rappels-handler";
import { DEFAULT_SITE_URL } from "@/lib/rappels";
import { serverCollectionStore } from "@/lib/server-collection-store";

/**
 * SYNCHRO RAPPELS D'APPLE ⇄ TAEKDHUB — voir lib/rappels.ts et
 * lib/rappels-handler.ts. Mêmes variables que la capture rapide :
 * `CAPTURE_TOKEN`, `MCP_USER_ID`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";
export const dynamic = "force-dynamic";

function env(): RappelsEnv {
  return {
    token: process.env.CAPTURE_TOKEN,
    userId: process.env.MCP_USER_ID,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
    store: (userId) => serverCollectionStore(userId, "workItems"),
    now: () => new Date(),
  };
}

function misconfigured(e: RappelsEnv) {
  return Boolean(e.token && e.userId && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY));
}

export async function GET(req: Request) {
  const e = env();
  if (misconfigured(e)) return Response.json({ error: "Synchro Rappels non configurée sur le serveur." }, { status: 503 });
  return handleRappels(req, e);
}

export async function POST(req: Request) {
  const e = env();
  if (misconfigured(e)) return Response.json({ error: "Synchro Rappels non configurée sur le serveur." }, { status: 503 });
  return handleRappels(req, e);
}
