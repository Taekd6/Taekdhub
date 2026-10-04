import type { NextConfig } from "next";

/**
 * En-têtes de sécurité envoyés avec chaque réponse. Volontairement prudents :
 * aucun ne change ce que l'application fait, ils retirent seulement des
 * possibilités dont elle n'a pas besoin.
 *
 * Pas de Content-Security-Policy pour l'instant : la page parle à Supabase
 * et à AnkiConnect (http://127.0.0.1:8765), et une politique trop stricte
 * casserait ces liaisons sans bruit. À ajouter avec des tests dédiés.
 */
const securityHeaders = [
  // Le navigateur respecte le type annoncé, sans le « deviner ».
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Une autre origine ne reçoit que le domaine, jamais le chemin complet.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aucun site ne peut afficher TaekdHub dans un cadre (détournement de clic).
  { key: "X-Frame-Options", value: "DENY" },
  // Caméra, micro et position : l'application n'en utilise aucun.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
