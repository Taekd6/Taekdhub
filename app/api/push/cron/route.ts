import { computeAlerts } from "@/lib/alerts";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import { planPush } from "@/lib/push-plan";
import { adminDb, pushConfigured, sendPush, type StoredSubscription } from "@/lib/push-server";
import { normalizePreferences, normalizeReviewItem, normalizeSession, normalizeWorkItem } from "@/lib/storage";

/**
 * LE PASSAGE HORAIRE DES NOTIFICATIONS.
 *
 * Appelé toutes les heures par GitHub Actions (.github/workflows/push.yml)
 * avec `Authorization: Bearer <CRON_SECRET>`. Pour chaque appareil abonné :
 * les collections synchronisées de son élève → les alertes du moment
 * (lib/alerts.ts, les mêmes que la bannière de l'app) → au plus UNE
 * notification (lib/push-plan.ts) → envoi. Un abonnement mort (app
 * désinstallée, notifications coupées) est supprimé.
 *
 * L'heure est celle de l'élève (`MCP_TIMEZONE`, Europe/Paris par défaut),
 * comme pour le connecteur MCP : « 18 h » doit vouloir dire 18 h à Paris.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function list<T>(raw: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(normalize).filter((item): item is T => item !== null) : [];
}

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!isMcpKeyValid(token, process.env.CRON_SECRET)) return new Response("Unauthorized", { status: 401 });
  if (!pushConfigured()) return Response.json({ error: "Notifications non configurées (clés VAPID ou Supabase manquantes)." }, { status: 503 });

  const db = adminDb();
  const { data: subscriptions, error } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth, sent");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const byUser = new Map<string, StoredSubscription[]>();
  for (const subscription of (subscriptions ?? []) as StoredSubscription[]) byUser.set(subscription.user_id, [...(byUser.get(subscription.user_id) ?? []), subscription]);

  const report = { appareils: subscriptions?.length ?? 0, envoyees: 0, supprimees: 0, erreurs: 0 };
  for (const [user_id, devices] of byUser) {
    const { data: rows } = await db.from("user_collections").select("collection, items").eq("user_id", user_id).in("collection", ["sessions", "workItems", "reviewItems", "preferences"]);
    const byName = Object.fromEntries((rows ?? []).map((row) => [row.collection as string, row.items as unknown]));
    const alerts = computeAlerts({
      sessions: list(byName.sessions, normalizeSession),
      workItems: list(byName.workItems, normalizeWorkItem),
      reviewItems: list(byName.reviewItems, normalizeReviewItem),
      preferences: normalizePreferences(byName.preferences ?? {}),
      now,
    });
    for (const device of devices) {
      const plan = planPush(alerts, device.sent ?? {}, now);
      if (!plan.notification) {
        await db.from("push_subscriptions").update({ sent: plan.sent }).eq("endpoint", device.endpoint).eq("user_id", user_id);
        continue;
      }
      const outcome = await sendPush(device, plan.notification);
      if (outcome === "gone") {
        await db.from("push_subscriptions").delete().eq("endpoint", device.endpoint).eq("user_id", user_id);
        report.supprimees += 1;
      } else if (outcome === "ok") {
        await db.from("push_subscriptions").update({ sent: plan.sent }).eq("endpoint", device.endpoint).eq("user_id", user_id);
        report.envoyees += 1;
      } else report.erreurs += 1;
    }
  }
  return Response.json(report);
}
