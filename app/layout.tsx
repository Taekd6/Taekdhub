import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import "./globals.css";

/**
 * Applique l'accent persisté AVANT l'hydratation React, pour éviter un flash
 * de l'accent par défaut chez un utilisateur qui en a choisi un autre
 * (Réglages → Apparence). Duplique volontairement le calcul de contraste de
 * lib/theme.ts#accentForeground (petit script inline, ne peut pas importer
 * de module) — `ThemeSync` prend le relais après hydratation.
 */
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('prepahub:preferences');if(!raw)return;var accent=JSON.parse(raw).accent;if(!/^#?[0-9a-fA-F]{6}$/.test(accent||''))return;var hex=accent.replace('#','');var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);var lin=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};var lum=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);var fg=lum>0.45?'0 0 0':'255 255 255';var root=document.documentElement.style;root.setProperty('--accent-rgb',r+' '+g+' '+b);root.setProperty('--accent-fg-rgb',fg);}catch(e){}})();`;

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
  themeColor: "#09090b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
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
