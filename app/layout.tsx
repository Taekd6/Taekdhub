import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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
 * Mode : "light"/"dark" pose `data-theme` sur `<html>` ; "system" (ou
 * préférence absente/invalide) ne pose rien — voir app/globals.css, qui
 * laisse alors `prefers-color-scheme` décider. C'est la même règle que
 * `applyThemeMode` (lib/theme.ts), dupliquée ici pour la même raison que
 * l'accent ci-dessus.
 */
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('prepahub:preferences');if(!raw)return;var prefs=JSON.parse(raw);var accent=prefs.accent;if(/^#?[0-9a-fA-F]{6}$/.test(accent||'')){var hex=accent.replace('#','');var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);var lin=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};var lum=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);var fg=lum>0.45?'0 0 0':'255 255 255';var root=document.documentElement.style;root.setProperty('--accent-rgb',r+' '+g+' '+b);root.setProperty('--accent-fg-rgb',fg);}var mode=prefs.themeMode;if(mode==='light'||mode==='dark'){document.documentElement.setAttribute('data-theme',mode);}}catch(e){}})();`;

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TaekdHub — Ton système de travail en prépa",
  description: "Pilote ton travail, consolide tes acquis et avance avec précision.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaekdHub",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` : le script anti-flash ci-dessous pose
    // volontairement `style`/`data-theme` sur `<html>` AVANT l'hydratation
    // React (voir sa doc) — pour tout utilisateur ayant déjà enregistré une
    // préférence, ce `style` diffère nécessairement du HTML rendu côté
    // serveur (qui ignore localStorage), un mismatch React signale à
    // chaque rechargement (confirmé en audit) sans jamais "réparer" quoi
    // que ce soit — React garde déjà la valeur du DOM (donc la bonne),
    // seul l'avertissement est du bruit. Ce flag React est fait
    // précisément pour ce cas documenté (script anti-flash de thème),
    // limité au SEUL nœud concerné — jamais un silence général des
    // mismatchs ailleurs dans l'app.
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={inter.className}>
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}
