import { pruneSnoozes, type AppAlert } from "@/lib/alerts";

/**
 * QUOI ENVOYER SUR L'IPHONE — et surtout quoi NE PAS envoyer.
 *
 * Le serveur passe toutes les heures (app/api/push/cron/route.ts). Pour
 * chaque appareil abonné, il calcule les alertes (lib/alerts.ts) puis
 * demande ici s'il faut notifier. Les règles :
 *
 *   — seulement ce qui presse (« urgent ») ou ce qui manque (« attention ») :
 *     une fiche à revoir n'a rien à faire sur l'écran verrouillé ;
 *   — jamais deux fois la même alerte le même jour (`sent`) ;
 *   — UNE notification par passage au plus, la plus importante, qui dit
 *     combien d'autres attendent : une rafale apprend à tout ignorer ;
 *   — rien la nuit (22 h – 8 h) : le sommeil fait partie du travail.
 *
 * Pur et testé ; l'envoi lui-même est ailleurs.
 */

export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 8;

export interface PushNotification {
  title: string;
  body: string;
  url: string;
  /** Même `tag` = l'iPhone remplace la notification au lieu d'en empiler une deuxième. */
  tag: string;
}

export type SentMap = Record<string, string>;

export function planPush(alerts: AppAlert[], sent: SentMap, now: Date): { notification: PushNotification | null; sent: SentMap } {
  const kept = pruneSnoozes(sent, now);
  const hour = now.getHours();
  if (hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR) return { notification: null, sent: kept };
  const pending = alerts.filter((alert) => alert.level !== "info" && !kept[alert.id]);
  const [first, ...rest] = pending;
  if (!first) return { notification: null, sent: kept };
  const more = rest.length > 0 ? ` (+ ${rest.length} autre${rest.length > 1 ? "s" : ""} dans TaekdHub)` : "";
  return {
    notification: { title: first.title, body: `${first.body}${more}`, url: first.href, tag: first.id.split(":").slice(0, 2).join(":") },
    sent: { ...kept, [first.id]: now.toISOString() },
  };
}
