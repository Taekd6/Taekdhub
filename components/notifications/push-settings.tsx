"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send, Share } from "lucide-react";
import { useAccount } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { Group, Row } from "@/components/ui/grouped";
import { pushSupport, vapidKeyBytes, type PushSupport } from "@/lib/push-client";
import { supabase } from "@/lib/supabase/client";

/**
 * Réglages → « Notifications » : recevoir sur l'iPhone ce qui presse, même
 * l'app fermée (lib/alerts.ts → app/api/push/cron).
 *
 * Le chemin, sans raccourci possible :
 *   1. sur iPhone, l'app doit être INSTALLÉE (Partager → « Sur l'écran
 *      d'accueil ») : Apple ne donne les notifications web qu'à elle ;
 *   2. être CONNECTÉ : le serveur doit savoir de qui calculer les alertes ;
 *   3. « Activer » : iOS demande la permission, le navigateur donne une
 *      adresse d'envoi, rangée dans `push_subscriptions` (RLS : la sienne
 *      seulement) ;
 *   4. « Envoyer un essai » pour vérifier tout de suite.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = { support: PushSupport; permission: NotificationPermission | "indisponible"; subscribed: boolean };

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export function PushSettings() {
  const { user } = useAccount();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const support = pushSupport({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      standalone,
      hasPushManager: "PushManager" in window,
      hasNotification: "Notification" in window,
      hasServiceWorker: "serviceWorker" in navigator,
    });
    const permission = "Notification" in window ? Notification.permission : "indisponible";
    if (support !== "ok") {
      setState({ support, permission, subscribed: false });
      return;
    }
    void currentSubscription()
      .then((subscription) => setState({ support, permission, subscribed: Boolean(subscription) }))
      .catch(() => setState({ support, permission, subscribed: false }));
  }, []);

  async function enable() {
    if (!PUBLIC_KEY || !supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((previous) => previous && { ...previous, permission });
        setMessage({ tone: "error", text: "Permission refusée. Pour la rendre : Réglages de l'iPhone → Notifications → TaekdHub." });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(PUBLIC_KEY) }));
      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        { endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", user_agent: navigator.userAgent.slice(0, 300) },
        { onConflict: "endpoint" }
      );
      if (error) throw new Error(error.message);
      setState((previous) => previous && { ...previous, permission, subscribed: true });
      setMessage({ tone: "ok", text: "Activées sur cet appareil. Touche « Envoyer un essai » pour vérifier." });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? `Activation impossible : ${cause.message}` : "Activation impossible." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await supabase?.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState((previous) => previous && { ...previous, subscribed: false });
      setMessage({ tone: "ok", text: "Désactivées sur cet appareil." });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/push/test", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const body = (await response.json().catch(() => ({}))) as { envoyees?: number; error?: string };
      setMessage(response.ok ? { tone: "ok", text: `Envoyé (${body.envoyees ?? 0} appareil${(body.envoyees ?? 0) > 1 ? "s" : ""}). Il arrive dans quelques secondes.` } : { tone: "error", text: body.error ?? "L'essai a échoué." });
    } finally {
      setBusy(false);
    }
  }

  const footer = "Seulement ce qui presse ou ce qui manque (échéance proche, chapitre verrouillé, minimum du soir), une fois par alerte et jamais entre 22 h et 8 h.";

  return (
    <Group id="notifications" title="Notifications" footer={footer}>
      {!state ? (
        <Row label="Notifications sur cet appareil" hint="Vérification…">
          <span />
        </Row>
      ) : !PUBLIC_KEY ? (
        <Row label="Notifications sur cet appareil" hint="Pas encore configurées sur ce déploiement (clés VAPID).">
          <BellOff size={18} className="text-subtle" aria-hidden />
        </Row>
      ) : state.support === "installer" ? (
        <Row stack label="Installe d'abord TaekdHub" hint="Sur iPhone, Apple réserve les notifications aux apps posées sur l'écran d'accueil.">
          <ol className="t-meta list-decimal space-y-1 pl-5">
            <li>
              Dans Safari, touche <Share size={13} className="inline align-[-2px]" aria-label="Partager" />, puis « Sur l&apos;écran d&apos;accueil ».
            </li>
            <li>Ouvre TaekdHub depuis sa nouvelle icône.</li>
            <li>Reviens ici : le bouton « Activer » apparaîtra.</li>
          </ol>
        </Row>
      ) : state.support === "non" ? (
        <Row label="Notifications sur cet appareil" hint="Ce navigateur ne sait pas les recevoir.">
          <BellOff size={18} className="text-subtle" aria-hidden />
        </Row>
      ) : !user ? (
        <Row label="Notifications sur cet appareil" hint="Connecte-toi à ton compte (plus bas) : le serveur doit savoir de qui calculer les alertes.">
          <BellOff size={18} className="text-subtle" aria-hidden />
        </Row>
      ) : state.subscribed ? (
        <Row stack label="Activées sur cet appareil" hint="Tu seras prévenu même l'app fermée.">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void test()} disabled={busy}>
              <Send size={14} aria-hidden /> Envoyer un essai
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void disable()} disabled={busy}>
              <BellOff size={14} aria-hidden /> Désactiver
            </Button>
          </div>
        </Row>
      ) : (
        <Row label="Notifications sur cet appareil" hint={state.permission === "denied" ? "Bloquées : Réglages de l'iPhone → Notifications → TaekdHub." : "Ce qui presse, sur l'écran verrouillé."}>
          <Button size="sm" onClick={() => void enable()} disabled={busy || state.permission === "denied"}>
            <Bell size={14} aria-hidden /> Activer
          </Button>
        </Row>
      )}
      {message && (
        <p role="status" className={message.tone === "ok" ? "mx-4 mb-3 rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink" : "mx-4 mb-3 rounded-xl bg-rose-400/[0.1] px-3 py-2 text-[0.875rem] font-semibold text-rose-300"}>
          {message.text}
        </p>
      )}
    </Group>
  );
}
