import type { MetadataRoute } from "next";

/**
 * L'application elle-même (cockpit, calendrier, planning…) n'a rien à faire
 * dans un index : ses pages n'ont aucun sens hors du navigateur de l'élève,
 * dont toutes les données sont locales. Seule la page d'accueil, qui explique
 * le produit, est indexable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/today", "/calendar", "/tasks", "/planning", "/review", "/goals", "/settings", "/api"] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://taekdhub.vercel.app"}/sitemap.xml`,
  };
}
