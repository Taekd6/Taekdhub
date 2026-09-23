import type { Metadata, Viewport } from "next";
import { Newsreader, Nunito } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import { ServiceWorker } from "@/components/service-worker";
import { DEEP_MAX_LUMINANCE, INK_MAX_LUMINANCE, LEGACY_DEFAULT_ACCENTS } from "@/lib/theme";
import {
  DEEP_MAX_LUMINANCE as SUBJECT_DEEP_MAX_LUMINANCE,
  SOFT_MAX_LUMINANCE as SUBJECT_SOFT_MAX_LUMINANCE,
  SUBJECT_KEYS,
  SUBJECT_PALETTES,
} from "@/lib/subject-colors";
import "./globals.css";

/**
 * SCRIPT ANTI-FLASH — applique l'accent, le mode d'apparence ET les couleurs
 * de matière persistés AVANT l'hydratation React. Sans lui, chaque page
 * s'afficherait d'abord avec les valeurs par défaut, puis « sauterait » vers
 * celles de l'élève. `ThemeSync` prend le relais après hydratation.
 *
 * Un script inline ne peut pas importer de module : les FORMULES
 * (assombrissement par mise à l'échelle des canaux, choix noir/blanc) sont
 * donc dupliquées de lib/theme.ts et lib/subject-colors.ts. Les DONNÉES, en
 * revanche — palettes, clés de matière, seuils de luminance, anciens
 * accents par défaut — sont injectées depuis ces modules au moment du rendu
 * serveur : elles ne peuvent pas diverger.
 *
 * Mode : "light" / "dark" / "system" est écrit tel quel dans `data-theme`
 * (lib/theme.ts#applyThemeMode) ; une préférence absente ou invalide pose
 * "dark", le défaut du produit — que app/globals.css applique d'ailleurs
 * aussi sans attribut.
 */
const PALETTE_DATA = JSON.stringify(Object.fromEntries(SUBJECT_PALETTES.map((palette) => [palette.id, palette.colors])));
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,st=d.style;var raw=localStorage.getItem('prepahub:preferences');var prefs={};if(raw){try{prefs=JSON.parse(raw)||{};}catch(e){prefs={};}}
var hexRe=/^#?[0-9a-fA-F]{6}$/;var rgbOf=function(h){h=String(h).trim().replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
var lin=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};var L=function(c){return 0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);};
var dk=function(c,t){if(L(c)<=t)return c;var lo=0,hi=1;for(var i=0;i<24;i++){var m=(lo+hi)/2;if(L([c[0]*m,c[1]*m,c[2]*m])>t){hi=m;}else{lo=m;}}return[Math.round(c[0]*lo),Math.round(c[1]*lo),Math.round(c[2]*lo)];};
var legacy=${JSON.stringify(LEGACY_DEFAULT_ACCENTS)};var accent=prefs.accent;
if(typeof accent==='string'&&hexRe.test(accent.trim())&&legacy.indexOf(accent.trim().toLowerCase())<0){var a=rgbOf(accent);var fg=L(a)>Math.sqrt(1.05*0.05)-0.05?'0 0 0':'255 255 255';st.setProperty('--accent-rgb',a.join(' '));st.setProperty('--accent-fg-rgb',fg);st.setProperty('--accent-ink-base-rgb',dk(a,${INK_MAX_LUMINANCE}).join(' '));st.setProperty('--accent-deep-base-rgb',dk(a,${DEEP_MAX_LUMINANCE}).join(' '));}
var mode=prefs.themeMode;d.setAttribute('data-theme',(mode==='light'||mode==='dark'||mode==='system')?mode:'dark');
var P=${PALETTE_DATA},K=${JSON.stringify(SUBJECT_KEYS)};var pal=P[prefs.subjectPalette]||P.neon;var ov=(prefs.subjectColors&&typeof prefs.subjectColors==='object')?prefs.subjectColors:{};
for(var s in K){var hex=(typeof ov[s]==='string'&&hexRe.test(ov[s].trim()))?ov[s]:pal[s];var c=rgbOf(hex);st.setProperty('--subj-'+K[s]+'-raw',c.join(' '));st.setProperty('--subj-'+K[s]+'-soft',dk(c,${SUBJECT_SOFT_MAX_LUMINANCE}).join(' '));st.setProperty('--subj-'+K[s]+'-deep',dk(c,${SUBJECT_DEEP_MAX_LUMINANCE}).join(' '));}
}catch(e){}})();`;

/**
 * DEUX FAMILLES, DEUX RÔLES TRÈS INÉGAUX — voir l'en-tête d'app/globals.css.
 *
 * `Nunito` porte TOUTE l'interface : navigation, contrôles, titres, grands
 * nombres. Ronde et charnue, choisie par l'élève sur maquette (« Nuit ») ;
 * variable, donc un seul fichier couvre de 400 à 900. Ses chiffres
 * tabulaires (`tnum`) alignent les durées en colonne.
 *
 * `Newsreader` ne sert qu'aux textes de LECTURE (`.t-read`) et aux grands
 * titres en serif. Seul l'axe `opsz` est chargé. (Il accompagnait aussi les
 * formules KaTeX des énoncés de l'ancienne banque d'exercices, retirée avec
 * KaTeX lui-même.)
 */
const sans = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
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
    statusBarStyle: "black-translucent",
    title: "TaekdHub",
  },
};

export const viewport: Viewport = {
  // Doit correspondre à `--canvas-rgb` (app/globals.css) : c'est la couleur
  // que le navigateur mobile étend derrière la barre d'état. Le thème étant
  // sombre PAR DÉFAUT quel que soit le système, une seule valeur : celle du
  // fond nuit.
  themeColor: "#0b0c10",
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
        <ServiceWorker />
      </body>
    </html>
  );
}
