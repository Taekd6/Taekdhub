import type { MetadataRoute } from "next";

/** Une seule URL publique : la page d'accueil. Le reste est un espace de travail privé, volontairement exclu (voir app/robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taekdhub.vercel.app";
  return [{ url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
