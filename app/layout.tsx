import type { Metadata, Viewport } from "next";
import { Newsreader, Nunito } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import { ServiceWorker } from "@/components/service-worker";
import { RevealObserver } from "@/components/ui/reveal";
import { DEEP_MAX_LUMINANCE, INK_MAX_LUMINANCE, LEGACY_DEFAULT_ACCENTS, SOLID_MAX_LUMINANCE } from "@/lib/theme";
import "katex/dist/katex.min.css";
import "./globals.css";

/**
 * SCRIPT ANTI-FLASH — applique l'accent et le mode d'apparence persistés
 * AVANT l'hydratation React. Sans lui, chaque page s'afficherait d'abord
 * avec les valeurs par défaut, puis « sauterait » vers celles de l'élève.
 * `ThemeSync` prend le relais après hydratation.
 *
 * Un script inline ne peut pas importer de module : les FORMULES
 * (assombrissement par mise à l'échelle des canaux, choix noir/blanc) sont
 * donc dupliquées de lib/theme.ts. Les DONNÉES, en revanche — seuils de
 * luminance, anciens accents par défaut — sont injectées depuis ce module
 * au moment du rendu serveur : elles ne peuvent pas diverger.
 *
 * Mode : "light" / "dark" / "system" est écrit tel quel dans `data-theme`
 * (lib/theme.ts#applyThemeMode) ; une préférence absente ou invalide pose
 * "dark", le défaut du produit — que app/globals.css applique d'ailleurs
 * aussi sans attribut.
 *
 * Les couleurs de matière (refonte « Nuit ») ne sont plus écrites ici : les
 * matières n'ont plus de couleur, leurs paliers de gris vivent dans la
 * feuille de style.
 *
 * ENTRÉES AU DÉFILEMENT — `data-reveal="armed"` fige les animations
 * d'entrée (`.reveal`, `.grow-*`, `.ring-*`) sur leur première image
 * jusqu'à ce que `RevealObserver` voie l'élément entrer dans l'écran (voir
 * app/globals.css et components/ui/reveal.tsx). Posé ICI, avant le premier
 * rendu, pour qu'aucun bloc n'apparaisse puis disparaisse. Jamais armé sous
 * `prefers-reduced-motion` ni sans IntersectionObserver. Filet de sécurité :
 * si l'observateur ne s'est pas signalé (`__revealLive`) au bout de 4 s —
 * JavaScript en erreur, hydratation interminable —, on désarme, et tout
 * s'affiche. Un contenu ne doit jamais rester invisible.
 */
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,st=d.style;var raw=localStorage.getItem('prepahub:preferences');var prefs={};if(raw){try{prefs=JSON.parse(raw)||{};}catch(e){prefs={};}}
var hexRe=/^#?[0-9a-fA-F]{6}$/;var rgbOf=function(h){h=String(h).trim().replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
var lin=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};var L=function(c){return 0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);};
var dk=function(c,t){if(L(c)<=t)return c;var lo=0,hi=1;for(var i=0;i<24;i++){var m=(lo+hi)/2;if(L([c[0]*m,c[1]*m,c[2]*m])>t){hi=m;}else{lo=m;}}return[Math.round(c[0]*lo),Math.round(c[1]*lo),Math.round(c[2]*lo)];};
var legacy=${JSON.stringify(LEGACY_DEFAULT_ACCENTS)};var accent=prefs.accent;
if(typeof accent==='string'&&hexRe.test(accent.trim())&&legacy.indexOf(accent.trim().toLowerCase())<0){var a=rgbOf(accent);var fg=L(a)>Math.sqrt(1.05*0.05)-0.05?'0 0 0':'255 255 255';st.setProperty('--accent-rgb',a.join(' '));st.setProperty('--accent-fg-rgb',fg);st.setProperty('--accent-ink-base-rgb',dk(a,${INK_MAX_LUMINANCE}).join(' '));st.setProperty('--accent-deep-base-rgb',dk(a,${DEEP_MAX_LUMINANCE}).join(' '));st.setProperty('--accent-solid-base-rgb',dk(a,${SOLID_MAX_LUMINANCE}).join(' '));}
var mode=prefs.themeMode;d.setAttribute('data-theme',(mode==='light'||mode==='dark'||mode==='system')?mode:'dark');
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
 * `Newsreader` ne sert qu'à la colonne de LECTURE d'un énoncé (`.t-read`) :
 * les formules KaTeX y sont en serif, et un texte rond autour d'elles
 * changerait de dessin à chaque symbole. Seul l'axe `opsz` est chargé.
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
  // que le navigateur mobile étend derrière la barre d'état. Le thème étant
  // sombre PAR DÉFAUT quel que soit le système, une seule valeur : le noir.
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * `suppressHydrationWarning` sur `<html>` UNIQUEMENT — pas sur le corps
     * de la page.
     *
     * Le script anti-flash ci-dessous pose `data-theme` sur cette balise
     * AVANT que React n'hydrate, précisément pour éviter l'éclair de thème
     * clair au chargement. React compare alors un `<html>` serveur sans
     * `data-theme` à un `<html>` client qui en porte un, et signale une
     * divergence d'hydratation dans la console à chaque page, en thème
     * sombre. La divergence est voulue et sans conséquence : l'attribut est
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
