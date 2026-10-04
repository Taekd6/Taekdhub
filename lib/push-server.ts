import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { PushNotification } from "@/lib/push-plan";

/**
 * L'ENVOI des notifications (serveur uniquement) : le client Supabase à clé
 * secrète et `web-push` configuré avec les clés VAPID — la signature de
 * TaekdHub auprès du service de notifications d'Apple (et de Google,
 * Mozilla…). Partagé par app/api/push/cron et app/api/push/test.
 *
 * Variables serveur (jamais `NEXT_PUBLIC_`, sauf la clé publique) :
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 *   SUPABASE_URL, SUPABASE_SECRET_KEY — les mêmes que le connecteur MCP.
 */

export interface StoredSubscription {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  sent: Record<string, string> | null;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function adminDb(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

let configured = false;

/** Envoie une notification. `gone` : l'appareil s'est désabonné (ou l'app a été désinstallée) — l'abonnement est à supprimer. */
export async function sendPush(subscription: Pick<StoredSubscription, "endpoint" | "p256dh" | "auth">, notification: PushNotification): Promise<"ok" | "gone" | "error"> {
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@taekdhub.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(notification), { TTL: 3600, urgency: "high" });
    return "ok";
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}
