import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Le script du service worker (public/sw.js, généré par
        // scripts/generate-sw.mjs) ne doit JAMAIS être servi depuis un cache
        // HTTP intermédiaire (CDN, navigateur) : la détection de mise à jour
        // repose entièrement sur le navigateur comparant ses octets à chaque
        // vérification — un `/sw.js` mis en cache retarderait cette
        // détection indéfiniment, bien au-delà du filet de sécurité "24h"
        // que les navigateurs appliquent par défaut à ce fichier précis.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};
export default nextConfig;
