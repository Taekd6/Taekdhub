/**
 * NOTIFICATIONS — côté navigateur : savoir si l'appareil peut les recevoir,
 * et préparer l'abonnement. Les fonctions qui touchent au navigateur sont
 * dans components/notifications/push-settings.tsx ; ici, ce qui se teste.
 */

export type PushSupport =
  /** Le navigateur sait recevoir des notifications. */
  | "ok"
  /** iPhone ou iPad dans Safari, app NON installée : Apple n'autorise les notifications web qu'aux apps posées sur l'écran d'accueil (iOS 16.4+). */
  | "installer"
  /** Navigateur sans Web Push. */
  | "non";

export function isAppleMobile(userAgent: string, maxTouchPoints = 0): boolean {
  // Un iPad en mode « bureau » se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function pushSupport(env: { userAgent: string; maxTouchPoints: number; standalone: boolean; hasPushManager: boolean; hasNotification: boolean; hasServiceWorker: boolean }): PushSupport {
  if (isAppleMobile(env.userAgent, env.maxTouchPoints) && !env.standalone) return "installer";
  return env.hasPushManager && env.hasNotification && env.hasServiceWorker ? "ok" : "non";
}

/** La clé publique VAPID (base64 « url ») en octets, comme l'attend `pushManager.subscribe`. */
export function vapidKeyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64Url}${"=".repeat((4 - (base64Url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
