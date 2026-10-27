import { handleFocus, type FocusEnv } from "@/lib/focus-handler";
import { DEFAULT_SITE_URL } from "@/lib/rappels";
import { serverCollectionStore } from "@/lib/server-collection-store";

/**
 * SESSION DE TRAVAIL — le raccourci iOS « Start session » (voir
 * lib/focus-handler.ts). Mêmes variables que la synchro Rappels :
 * `CAPTURE_TOKEN`, `MCP_USER_ID`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
 * Lecture seule.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";
export const dynamic = "force-dynamic";

function env(): FocusEnv {
  return {
    token: process.env.CAPTURE_TOKEN,
    userId: process.env.MCP_USER_ID,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
    store: (userId) => serverCollectionStore(userId, "workItems"),
    now: () => new Date(),
  };
}

function misconfigured(e: FocusEnv) {
  return Boolean(e.token && e.userId && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY));
}

export async function GET(req: Request) {
  const e = env();
  if (misconfigured(e)) return Response.json({ error: "Session non configurée sur le serveur." }, { status: 503 });
  return handleFocus(req, e);
}

export async function POST(req: Request) {
  const e = env();
  if (misconfigured(e)) return Response.json({ error: "Session non configurée sur le serveur." }, { status: 503 });
  return handleFocus(req, e);
}
