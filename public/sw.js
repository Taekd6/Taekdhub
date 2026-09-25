/*
 * TAEKDHUB — SERVICE WORKER
 * =========================================================================
 *
 * Ce qu'il apporte, et rien de plus : l'application s'ouvre SANS RÉSEAU.
 * Dans un train, au sous-sol de la bibliothèque, en avion — le travail
 * continue. C'est possible parce que TaekdHub est déjà local-first : toutes
 * les données vivent dans le `localStorage` du navigateur (lib/storage.ts),
 * aucun appel serveur n'est nécessaire pour lire ou écrire quoi que ce soit.
 * Il ne manquait que la coquille : le HTML, le JavaScript et les polices.
 *
 * ─── DEUX STRATÉGIES, ET LE CHOIX EST DICTÉ PAR L'URL ──────────────────
 *
 * LE HTML : RÉSEAU D'ABORD. Une page mise en cache d'abord servirait
 * indéfiniment la version d'hier après un déploiement — exactement le piège
 * du « je recharge et je vois encore l'ancienne ». On interroge donc toujours
 * le réseau, et le cache ne sert que de filet quand il ne répond pas.
 *
 * LES FICHIERS `/_next/static/…` : CACHE D'ABORD. Next y écrit le hachage du
 * contenu dans le nom du fichier ; une URL donnée ne changera JAMAIS de
 * contenu. Les servir depuis le cache est donc sans risque, et c'est ce qui
 * rend l'ouverture instantanée.
 *
 * ─── CE QUI N'EST JAMAIS MIS EN CACHE ──────────────────────────────────
 *
 * `/api/…` — aucune route n'y répond aujourd'hui (le copilote IA, /api/ai,
 * a été retiré avec la banque d'exercices), mais toute route dynamique
 * future doit parler au serveur ou échouer franchement : une réponse
 * rejouée depuis un cache serait un mensonge.
 *
 * Et rien d'autre que des GET de même origine : pas de POST, pas de
 * ressource tierce.
 *
 * ─── SI QUELQUE CHOSE TOURNE MAL ───────────────────────────────────────
 *
 * Incrémenter VERSION suffit : `activate` supprime tout cache dont le nom ne
 * figure plus dans `CURRENT`. Un utilisateur récupère la nouvelle coquille au
 * premier chargement en ligne, sans rien faire.
 *
 * Aucune donnée de l'élève ne transite ici. Le `localStorage` est hors de
 * portée d'un service worker : il ne peut ni le lire, ni l'effacer.
 */

// v3 : ajout de /memoire (mémoire des chapitres, FSRS).
// v2 : retrait de la banque d'exercices — les coquilles de /exercises,
// /session et /concours précachées en v1 sont supprimées à l'activation.
const VERSION = "v3";
const SHELL = `taekdhub-shell-${VERSION}`;
const ASSETS = `taekdhub-assets-${VERSION}`;
const CURRENT = [SHELL, ASSETS];

/*
 * Les écrans précachés à l'installation. On paie une poignée de requêtes une
 * seule fois, pour que la première ouverture hors ligne ne tombe pas sur une
 * page blanche si l'élève n'était encore passé que par l'accueil.
 *
 * Les fragments JavaScript, eux, ne sont pas listés : leurs noms portent un
 * hachage qui change à chaque build, donc les écrire ici serait périmé dès le
 * déploiement suivant. Ils entrent dans le cache au fil des visites, et comme
 * Next partage l'essentiel de son code entre les routes, une ou deux pages
 * consultées en ligne suffisent à couvrir le reste.
 */
const PRECACHE = [
  "/dashboard",
  "/preparation",
  "/progress",
  "/echeances",
  "/revoir",
  "/revoir/session",
  "/memoire",
  "/erreurs",
  "/history",
  "/timer",
  "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // `Promise.allSettled` et non `cache.addAll` : une seule route
      // injoignable ferait échouer TOUTE l'installation, et l'application
      // resterait sans service worker pour une raison secondaire.
      await Promise.allSettled(
        PRECACHE.map(async (path) => {
          const response = await fetch(path, { cache: "reload" });
          if (response.ok) await cache.put(path, response);
        })
      );
      // Prendre la main tout de suite plutôt qu'à la prochaine fermeture de
      // tous les onglets : sans cela, une correction publiée aujourd'hui
      // attendrait des jours sur un téléphone qu'on ne ferme jamais.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("taekdhub-") && !CURRENT.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/** Content-hashé par Next : le contenu d'une de ces URL ne change jamais. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // ── CACHE D'ABORD — fichiers immuables ──────────────────────────────
  if (isImmutable(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(ASSETS);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  // ── RÉSEAU D'ABORD — pages et tout le reste ─────────────────────────
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(SHELL);
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const hit = await caches.match(request);
        if (hit) return hit;
        // Une navigation vers un écran jamais visité, hors ligne : mieux vaut
        // l'accueil (précaché) qu'une page d'erreur du navigateur.
        if (request.mode === "navigate") {
          const fallback = await caches.match("/dashboard");
          if (fallback) return fallback;
        }
        throw error;
      }
    })()
  );
});
