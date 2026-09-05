import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import "katex/dist/katex.min.css";
import "./globals.css";

/**
 * Applique l'accent ET le mode d'apparence persistés AVANT l'hydratation
 * React, pour éviter un flash (accent par défaut, ou thème sombre par défaut
 * chez qui a choisi "clair") — même principe pour les deux : petit script
 * inline (ne peut pas importer de module, voir lib/theme.ts pour la version
 * "propre"), `ThemeSync` prend le relais après hydratation.
 *
 * Calcule aussi `--accent-ink-base-rgb` (encre) et `--accent-deep-base-rgb`
 * (aplat du bouton principal en thème clair) — mêmes formules que
 * `accentInk`/`accentDeep` (lib/theme.ts),
 * dupliquée ici pour la même raison que le reste de ce script : il ne peut
 * pas importer de module.
 *
 * Mode : "light"/"dark" pose `data-theme` sur `<html>` ; "system" (ou
 * préférence absente/invalide) ne pose rien — voir app/globals.css, qui
 * laisse alors `prefers-color-scheme` décider. C'est la même règle que
 * `applyThemeMode` (lib/theme.ts), dupliquée ici pour la même raison que
 * l'accent ci-dessus.
 */
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('prepahub:preferences');if(!raw)return;var prefs=JSON.parse(raw);var accent=prefs.accent;if(/^#?[0-9a-fA-F]{6}$/.test(accent||'')){var hex=accent.replace('#','');var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);var lin=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};var L=function(rr,gg,bb){return 0.2126*lin(rr)+0.7152*lin(gg)+0.0722*lin(bb);};var lum=L(r,g,b);var fg=lum>0.45?'0 0 0':'255 255 255';var root=document.documentElement.style;root.setProperty('--accent-rgb',r+' '+g+' '+b);root.setProperty('--accent-fg-rgb',fg);var dk=function(t){var lo=0,hi=1;if(lum<=t)return[r,g,b];for(var i=0;i<24;i++){var m=(lo+hi)/2;if(L(r*m,g*m,b*m)>t){hi=m;}else{lo=m;}}return[Math.round(r*lo),Math.round(g*lo),Math.round(b*lo)];};root.setProperty('--accent-ink-base-rgb',dk(0.163).join(' '));root.setProperty('--accent-deep-base-rgb',dk(0.045).join(' '));}var mode=prefs.themeMode;if(mode==='light'||mode==='dark'){document.documentElement.setAttribute('data-theme',mode);}}catch(e){}})();`;

/**
 * DEUX FAMILLES, DEUX RÔLES — voir l'en-tête d'app/globals.css.
 *
 * `Inter` porte le CHROME (navigation, contrôles, métadonnées) : il est fait
 * pour être lisible à 13 px et pour disparaître.
 *
 * `Newsreader` porte le CONTENU (titres, énoncés, corrections, grands
 * nombres). C'est un serif de lecture à taille optique variable, et surtout
 * la seule famille de l'app qui s'accorde avec le Computer Modern de KaTeX :
 * un énoncé mathématique cesse de changer de police à chaque formule.
 *
 * Seuls les poids réellement utilisés sont demandés (400/500 pour le serif,
 * axe variable complet pour Inter) — chaque graisse superflue est un fichier
 * à télécharger avant le premier rendu du texte.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

/**
 * `metadataBase` est requis pour que Next résolve les URL relatives des
 * balises Open Graph — sans lui, elles sont émises telles quelles et aucun
 * réseau ne sait quoi en faire. Surchargée par NEXT_PUBLIC_SITE_URL pour
 * qu'une préversion ne prétende pas être le site de production.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://taekdhub.vercel.app";
const TITLE = "TaekdHub — Ton système de travail en prépa";
const DESCRIPTION =
  "TaekdHub regarde ce que tu réussis, ce que tu rates et ce que tu n'obtiens qu'avec des indices, puis te dit quoi travailler maintenant — et pourquoi.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "TaekdHub",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "TaekdHub",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaekdHub",
  },
};

export const viewport: Viewport = {
  // Doit correspondre à `--canvas-rgb` (app/globals.css) : c'est la couleur
  // que le navigateur mobile étend derrière la barre d'état. Un écart, même
  // faible, dessine une bande au-dessus de la page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${newsreader.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}
