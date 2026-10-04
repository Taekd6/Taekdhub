import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaekdHub",
    short_name: "TaekdHub",
    description: "Pilote ton travail, consolide tes acquis et avance avec précision en prépa scientifique.",
    // Identité stable de l'app installée : changer `start_url` plus tard ne la ferait pas réinstaller.
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /*
     * Ces deux couleurs peignent l'écran de démarrage de l'application
     * installée : sans elles, l'app s'ouvrirait sur un éclair d'une autre
     * couleur avant d'afficher son fond. Alignées sur
     * `--canvas-rgb` du thème clair (app/globals.css), comme l'est déjà
     * `viewport.themeColor` dans app/layout.tsx.
     */
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "fr",
    // Appui long sur l'icône (Android, ordinateur) : les trois gestes du jour.
    shortcuts: [
      { name: "Chrono", short_name: "Chrono", url: "/timer" },
      { name: "Réviser", short_name: "Réviser", url: "/revoir/session" },
      { name: "Le point du jour", short_name: "Le point", url: "/point" },
    ],
    icons: [
      { src: "/pwa/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
