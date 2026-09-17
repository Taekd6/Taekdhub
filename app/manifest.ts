import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaekdHub",
    short_name: "TaekdHub",
    description: "Pilote ton travail, consolide tes acquis et avance avec précision en prépa scientifique.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    /*
     * Ces deux couleurs peignent l'écran de démarrage de l'application
     * installée. Elles étaient restées sur le noir bleuté du design d'avant,
     * alors que le produit est passé au papier chaud : l'app s'ouvrait sur un
     * éclair sombre avant d'afficher un fond crème. Alignées sur
     * `--canvas-rgb` du thème clair (app/globals.css), comme l'est déjà
     * `viewport.themeColor` dans app/layout.tsx.
     */
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    lang: "fr",
    icons: [
      { src: "/pwa/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
