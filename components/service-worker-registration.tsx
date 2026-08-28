"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Enregistre le service worker (public/sw.js, généré par
 * scripts/generate-sw.mjs) et propose la mise à jour à l'utilisateur au lieu
 * de l'imposer — voir service-worker/sw.template.js, qui n'appelle jamais
 * `skipWaiting()` de lui-même. Seul ce composant en décide, sur clic
 * explicite : un onglet en plein travail (chrono Focus en cours, formulaire
 * ouvert) ne doit jamais basculer sous les pieds de l'utilisateur.
 *
 * Uniquement en production : en dev, `public/sw.js` n'existe pas (généré
 * après `next build`, jamais après `next dev`), et un service worker actif
 * pendant le développement ne fait que gêner (cache qui masque les
 * changements). `process.env.NODE_ENV` est remplacé statiquement au build,
 * cette condition ne coûte donc rien au runtime de production.
 */
export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Ne se déclenche QUE si un nouveau service worker prend le contrôle —
    // ce qui n'arrive jamais tout seul (voir sw.template.js) : uniquement
    // après l'appel à `skipWaiting()` déclenché plus bas par le clic sur
    // "Mettre à jour". Un onglet resté inactif ne se recharge donc jamais
    // sans action de l'utilisateur.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Une mise à jour a pu s'installer et rester en attente pendant que
        // cet onglet était fermé ou en arrière-plan.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `navigator.serviceWorker.controller` non nul = cette page était
            // déjà contrôlée par une version précédente : une VRAIE mise à
            // jour, pas le tout premier enregistrement (qui active sans
            // jamais passer par l'état "en attente").
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
            }
          });
        });

        // Les navigations complètes déclenchent déjà une vérification native
        // du navigateur ; dans une SPA, on reste souvent sur la même page
        // pendant des heures (une séance de travail entière) — revérifier au
        // retour d'onglet augmente les chances de détecter une mise à jour
        // dans un délai raisonnable sans sonder inutilement en arrière-plan.
        function onVisibilityChange() {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        }
        document.addEventListener("visibilitychange", onVisibilityChange);
      })
      .catch(() => {
        // Best-effort : l'app reste pleinement utilisable en ligne si
        // l'enregistrement échoue (navigateur restrictif, extension
        // bloquante, contexte non sécurisé) — seul le mode hors-ligne manque.
      });
  }, []);

  if (!waitingWorker || dismissed) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-accent/20 bg-accent/[0.06] px-4 py-2.5 text-sm">
      <p className="text-ink">Une nouvelle version de TaekdHub est disponible.</p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => waitingWorker.postMessage("SKIP_WAITING")}>
          <RefreshCw size={13} /> Mettre à jour
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ignorer cette notification" onClick={() => setDismissed(true)}>
          <X size={13} />
        </Button>
      </div>
    </div>
  );
}
