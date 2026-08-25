import type { MetadataRoute } from "next";

/**
 * L'application elle-même (tableau de bord, séance, progression…) n'a rien à
 * faire dans un index : ses pages n'ont aucun sens hors du navigateur de
 * l'élève, dont toutes les données sont locales. Seule la page d'accueil,
 * qui explique le produit, est indexable.
 *
 * `robots.txt` répondait 404 : ce n'est pas une faute en soi, mais c'est le
 * genre de détail qui fait paraître un produit inachevé.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/session", "/exercises", "/progress", "/history", "/settings", "/timer"] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://taekdhub.vercel.app"}/sitemap.xml`,
  };
}
