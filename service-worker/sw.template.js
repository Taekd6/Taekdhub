// Source du service worker — voir scripts/generate-sw.mjs, qui produit
// public/sw.js à partir de ce fichier en substituant le jeton de version
// ci-dessous par l'identifiant de build Next (.next/BUILD_ID). public/sw.js
// n'est jamais commité (voir .gitignore) : ne l'éditer qu'ici.
//
// La constante ci-dessous change à CHAQUE build de production, jamais en dev
// (service-worker-registration.tsx ne s'enregistre qu'en production). Ce
// changement fait varier les OCTETS de ce fichier d'un déploiement à l'autre
// — condition nécessaire pour que le navigateur détecte une mise à jour :
// il compare le script octet à octet à chaque contrôle, jamais son nom de
// version affiché.
const CACHE_VERSION = "__CACHE_VERSION__";

// Les six écrans de l'app + l'accueil public — préchargés à l'installation
// pour qu'un rechargement hors ligne fonctionne dès la première visite, sans
// attendre d'avoir déjà ouvert chaque page une fois en ligne.
const APP_SHELL_ROUTES = ["/", "/dashboard", "/session", "/timer", "/exercises", "/contests", "/history", "/progress", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.all(
        APP_SHELL_ROUTES.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch {
            // Une route indisponible pendant l'installation (réseau
            // capricieux, déploiement en cours) ne doit pas empêcher les
            // autres d'être mises en cache — elle sera rattrapée à la
            // première visite en ligne via `networkFirst` ci-dessous, qui
            // met en cache toute réponse réussie au passage.
          }
        })
      );
    })()
  );
  // PAS de self.skipWaiting() ici. Une nouvelle version installée reste EN
  // ATTENTE tant qu'un onglet utilise encore l'ancienne : la bascule est
  // déclenchée par l'utilisateur (voir components/service-worker-
  // registration.tsx, message "SKIP_WAITING" plus bas) — jamais imposée à un
  // onglet en plein travail (chrono Focus en cours, formulaire ouvert…).
  // Sur un tout premier enregistrement (aucun contrôleur existant), le
  // navigateur active de toute façon ce service worker immédiatement — cette
  // règle ne s'applique qu'aux MISES À JOUR d'une installation déjà active.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)));
      // clients.claim() ici est sûr, PAS agressif : cette étape ne s'exécute
      // que si le nouveau service worker a atteint "activate", ce qui
      // n'arrive jamais tout seul (voir plus haut — pas de skipWaiting
      // automatique). Elle est donc TOUJOURS la conséquence directe d'un
      // clic utilisateur sur "Mettre à jour", jamais d'un cycle silencieux
      // en tâche de fond. Sans ce claim, l'onglet qui vient de demander la
      // mise à jour resterait servi par l'ancien service worker jusqu'à un
      // second rechargement manuel — deux étapes au lieu d'une pour une
      // action déjà explicitement demandée.
      await self.clients.claim();
    })()
  );
});

// Déclenché par components/service-worker-registration.tsx quand
// l'utilisateur clique "Mettre à jour" sur le bandeau de nouvelle version —
// seul et unique déclencheur de skipWaiting dans tout ce fichier.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fragments Next.js immuables (nom de fichier haché par build) :
  // cache d'abord, jamais besoin de revalider — un nouveau build change le
  // nom du fichier, jamais le contenu servi sous une URL déjà en cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation (chargement de page, rechargement, retour/suivant) : réseau
  // d'abord pour la version la plus fraîche en ligne, cache en secours dès
  // que le réseau échoue (hors ligne) — jamais l'inverse, pour ne pas servir
  // une page périmée à un utilisateur qui a du réseau.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tout le reste (polices, images, manifest…) : cache immédiat s'il existe,
  // rafraîchi en tâche de fond.
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Ni réseau ni cache : rien de mieux à servir qu'une vraie erreur réseau
    // — jamais de page blanche silencieuse déguisée en succès.
    throw new Error("offline-and-not-cached");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
