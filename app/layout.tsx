import type { Metadata, Viewport } from "next";
import { Newsreader, Nunito } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import { ServiceWorker } from "@/components/service-worker";
import { RevealObserver } from "@/components/ui/reveal";
import { PALETTES, paletteVariables, resolvePaletteId } from "@/lib/theme";
import "./globals.css";

/**
 * SCRIPT ANTI-FLASH — applique la palette et le mode d'apparence persistés
 * AVANT l'hydratation React. Sans lui, chaque page s'afficherait d'abord
 * avec les valeurs par défaut, puis « sauterait » vers celles de l'élève.
 * `ThemeSync` prend le relais après hydratation.
 *
 * Un script inline ne peut pas importer de module. Rien n'y est pourtant
 * réécrit à la main :
 *
 *   — la TABLE des variables de chaque palette (lib/theme.ts#paletteVariables)
 *     est calculée au rendu serveur et injectée en JSON ;
 *   — le CHOIX de la palette (lib/theme.ts#resolvePaletteId, qui migre aussi
 *     les anciens `accent` / `subjectPalette`) est recopié par sa propre
 *     source (`Function#toString`) — la fonction est écrite pour ça :
 *     autonome, sans syntaxe récente.
 *
 * Le script et `normalizePreferences` ne peuvent donc pas trancher
 * différemment.
 *
 * Mode : "light" / "dark" / "system" est écrit tel quel dans `data-theme`
 * (lib/theme.ts#applyThemeMode) ; une préférence absente ou invalide pose
 * "light", le défaut du produit — que app/globals.css applique d'ailleurs
 * aussi sans attribut.
 *
 * ENTRÉES AU DÉFILEMENT — `data-reveal="armed"` fige les animations
 * d'entrée (`.reveal`, `.grow-*`, `.ring-*`, `.area-fade`) sur leur première
 * image jusqu'à ce que `RevealObserver` voie l'élément entrer dans l'écran
 * (voir app/globals.css et components/ui/reveal.tsx). Posé ICI, avant le
 * premier rendu, pour qu'aucun bloc n'apparaisse puis disparaisse. Jamais
 * armé sous `prefers-reduced-motion` ni sans IntersectionObserver. Filet de
 * sécurité : si l'observateur ne s'est pas signalé (`__revealLive`) au bout
 * de 4 s, on désarme, et tout s'affiche. Un contenu ne doit jamais rester
 * invisible.
 */
const PALETTE_TABLE = Object.fromEntries(PALETTES.map((palette) => [palette.id, paletteVariables(palette)]));

const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,st=d.style;var raw=localStorage.getItem('prepahub:preferences');var prefs={};if(raw){try{prefs=JSON.parse(raw)||{};}catch(e){prefs={};}}
var resolve=(${resolvePaletteId.toString()});var table=${JSON.stringify(PALETTE_TABLE)};var pid=resolve(prefs);var vars=table[pid];
if(vars){for(var k in vars){st.setProperty(k,vars[k]);}d.setAttribute('data-palette',pid);}
var mode=prefs.themeMode;d.setAttribute('data-theme',(mode==='light'||mode==='dark'||mode==='system')?mode:'light');
}catch(e){}
try{var r=document.documentElement;if('IntersectionObserver' in window&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){r.setAttribute('data-reveal','armed');setTimeout(function(){if(!window.__revealLive)r.removeAttribute('data-reveal');},4000);}}catch(e){}})();`;

/**
 * DEUX FAMILLES, DEUX RÔLES TRÈS INÉGAUX — voir l'en-tête d'app/globals.css.
 *
 * L'interface est composée en SF Pro Rounded sur les appareils Apple
 * (`ui-rounded`, en tête de `--font-sans`) : c'est la référence de l'élève,
 * et elle est déjà installée — rien à télécharger. `Nunito` n'est que le
 * RELAIS pour les autres systèmes : ronde et charnue comme elle, variable
 * (un seul fichier de 400 à 900), chiffres tabulaires. Exposée sous
 * `--font-nunito`, jamais appliquée directement : c'est la pile de
 * `--font-sans` qui décide.
 *
 * `Newsreader` ne sert qu'aux textes de LECTURE (`.t-read`) et aux grands
 * titres en serif. Seul l'axe `opsz` est chargé. (Il accompagnait aussi les
 * formules KaTeX des énoncés de l'ancienne banque d'exercices, retirée avec
 * KaTeX lui-même.)
 */
const sans = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
});

const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
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
  "TaekdHub suit ton travail de prépa : ton temps par matière, tes échéances, tes notes, tes révisions et tes erreurs — tout reste dans ton navigateur.";

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
    statusBarStyle: "default",
    title: "TaekdHub",
  },
};

export const viewport: Viewport = {
  // Doit correspondre à `--canvas-rgb` (app/globals.css) : c'est la couleur
  // que le navigateur mobile étend derrière la barre d'état. Le thème étant
  // clair PAR DÉFAUT quel que soit le système, une seule valeur : le fond clair.
  themeColor: "#f5f6fa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * `suppressHydrationWarning` sur `<html>` UNIQUEMENT — pas sur le corps
     * de la page.
     *
     * Le script anti-flash ci-dessous pose `data-theme` sur cette balise
     * AVANT que React n'hydrate, précisément pour éviter l'éclair de thème
     * au chargement. React compare alors un `<html>` serveur sans
     * `data-theme` à un `<html>` client qui en porte un, et signale une
     * divergence d'hydratation dans la console à chaque page. La divergence est voulue et sans conséquence : l'attribut est
     * écrit par le script, jamais par le rendu. On la tait ici, à la portée
     * la plus étroite possible — aucun contenu rendu par React n'est couvert
     * par cette exemption.
     */
    <html lang="fr" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <ThemeSync />
        <RevealObserver />
        <ServiceWorker />
      </body>
    </html>
  );
}
