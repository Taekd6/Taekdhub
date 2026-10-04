import { adminDb, pushConfigured, sendPush, type StoredSubscription } from "@/lib/push-server";

/**
 * « ENVOYER UN ESSAI » (Réglages → Notifications) : une notification
 * immédiate sur les appareils de l'élève CONNECTÉ, pour vérifier que tout
 * marche sans attendre une vraie alerte. L'élève est identifié par son jeton
 * de session Supabase (`Authorization: Bearer …`), vérifié ici : on
 * n'envoie jamais à quelqu'un d'autre que lui.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pushConfigured()) return Response.json({ error: "Notifications non configurées sur le serveur." }, { status: 503 });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const db = adminDb();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return new Response("Unauthorized", { status: 401 });
  const user_id = auth.user.id;

  const { data: devices, error } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth, sent").eq("user_id", user_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!devices?.length) return Response.json({ error: "Aucun appareil abonné : active d'abord les notifications." }, { status: 404 });

  let sent = 0;
  for (const device of devices as StoredSubscription[]) {
    const outcome = await sendPush(device, { title: "TaekdHub", body: "Les notifications marchent. Tu seras prévenu de ce qui presse — jamais la nuit.", url: "/dashboard", tag: "essai" });
    if (outcome === "ok") sent += 1;
    if (outcome === "gone") await db.from("push_subscriptions").delete().eq("endpoint", device.endpoint).eq("user_id", user_id);
  }
  return Response.json({ envoyees: sent });
}
