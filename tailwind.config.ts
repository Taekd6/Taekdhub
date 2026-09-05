import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutres — CSS variables (voir app/globals.css) : mêmes noms de
        // classes qu'avant ce sprint (bg-canvas, text-ink, …), mais la valeur
        // sous-jacente change avec le mode d'apparence (clair/sombre/système).
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        panel: "rgb(var(--panel-rgb) / <alpha-value>)",
        elevated: "rgb(var(--elevated-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        subtle: "rgb(var(--subtle-rgb) / <alpha-value>)",
        // Remplace `white` pour toute bordure/surbrillance discrète
        // (`border-hairline/[0.06]`, `divide-hairline/[0.06]`, …) — voir la
        // note en tête d'app/globals.css : blanc-sur-blanc serait invisible
        // en thème clair, cette teinte s'inverse donc avec le mode.
        hairline: "rgb(var(--hairline-rgb) / <alpha-value>)",
        // Fond « en creux » (champ, bouton secondaire, piste de sélecteur) —
        // theme-aware, contrairement au `black/20` codé en dur qu'il remplace.
        inset: "rgb(var(--inset-rgb) / var(--inset-alpha))",
        // `accent` (text-accent, bg-accent/10, border-accent…) = l'accent en
        // tant qu'ENCRE : identique à la couleur de marque en thème sombre,
        // assombri en thème clair où celle-ci tombait à 1,20:1 de contraste.
        // Le REMPLISSAGE de marque (bouton principal, lueur de fond) reste sur
        // `--accent-rgb` — voir app/globals.css.
        accent: {
          DEFAULT: "rgb(var(--accent-ink-rgb) / <alpha-value>)",
          // Couleur de marque brute, identique dans les deux thèmes — réservée
          // au logo. Un logo n'est pas un contrôle : il ne suit pas le
          // remplissage du bouton principal, qui lui s'assombrit en clair.
          brand: "rgb(var(--accent-rgb) / <alpha-value>)",
          solid: "rgb(var(--accent-solid-rgb) / <alpha-value>)",
          "solid-foreground": "rgb(var(--accent-solid-fg-rgb) / <alpha-value>)",
          dim: "rgb(var(--accent-ink-rgb) / 0.12)",
          glow: "rgb(var(--accent-rgb) / 0.25)",
          foreground: "rgb(var(--accent-fg-rgb) / <alpha-value>)",
        },
        // Échelle "zinc" réécrite en CSS variables (voir app/globals.css) :
        // TOUTES les classes text-zinc-N / bg-zinc-N déjà utilisées dans
        // l'application (une centaine d'occurrences, texte principal → très
        // discret) deviennent theme-aware sans qu'aucun composant n'ait
        // besoin d'être modifié — seule cette table change entre les modes.
        zinc: {
          50: "rgb(var(--zinc-50-rgb) / <alpha-value>)",
          100: "rgb(var(--zinc-100-rgb) / <alpha-value>)",
          200: "rgb(var(--zinc-200-rgb) / <alpha-value>)",
          300: "rgb(var(--zinc-300-rgb) / <alpha-value>)",
          400: "rgb(var(--zinc-400-rgb) / <alpha-value>)",
          500: "rgb(var(--zinc-500-rgb) / <alpha-value>)",
          600: "rgb(var(--zinc-600-rgb) / <alpha-value>)",
          700: "rgb(var(--zinc-700-rgb) / <alpha-value>)",
          800: "rgb(var(--zinc-800-rgb) / <alpha-value>)",
          900: "rgb(var(--zinc-900-rgb) / <alpha-value>)",
          950: "rgb(var(--zinc-950-rgb) / <alpha-value>)",
        },
        // Statut (réussi/attention/échec) — seules 200/300 (texte posé sur un
        // fond teinté à faible opacité, ex. Focus View "Réussi"/"Échoué",
        // badges) s'assombrissent en thème clair pour rester lisibles ; 400/500
        // (fonds/bordures en faible opacité) restent identiques entre thèmes —
        // voir app/globals.css pour le détail.
        emerald: {
          200: "rgb(var(--emerald-200-rgb) / <alpha-value>)",
          300: "rgb(var(--emerald-300-rgb) / <alpha-value>)",
          400: "rgb(var(--emerald-400-rgb) / <alpha-value>)",
          500: "rgb(var(--emerald-500-rgb) / <alpha-value>)",
        },
        amber: {
          200: "rgb(var(--amber-200-rgb) / <alpha-value>)",
          300: "rgb(var(--amber-300-rgb) / <alpha-value>)",
          400: "rgb(var(--amber-400-rgb) / <alpha-value>)",
          500: "rgb(var(--amber-500-rgb) / <alpha-value>)",
        },
        rose: {
          200: "rgb(var(--rose-200-rgb) / <alpha-value>)",
          300: "rgb(var(--rose-300-rgb) / <alpha-value>)",
          400: "rgb(var(--rose-400-rgb) / <alpha-value>)",
          500: "rgb(var(--rose-500-rgb) / <alpha-value>)",
        },
        // Identité de matière (lib/study.ts#subjectMeta) — même principe : 200 (texte) s'assombrit en clair, 400 (fond, faible opacité) inchangé.
        violet: { 200: "rgb(var(--violet-200-rgb) / <alpha-value>)", 400: "rgb(var(--violet-400-rgb) / <alpha-value>)" },
        sky: { 200: "rgb(var(--sky-200-rgb) / <alpha-value>)", 400: "rgb(var(--sky-400-rgb) / <alpha-value>)" },
        teal: { 200: "rgb(var(--teal-200-rgb) / <alpha-value>)", 400: "rgb(var(--teal-400-rgb) / <alpha-value>)" },
        orange: { 200: "rgb(var(--orange-200-rgb) / <alpha-value>)", 400: "rgb(var(--orange-400-rgb) / <alpha-value>)" },
      },
      fontFamily: {
        // Voir app/layout.tsx : `sans` = chrome, `serif` = contenu lu.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      /*
       * RAYONS — quatre marches, resserrées.
       *
       * L'ancienne échelle montait à 1,75 rem : au-delà d'une douzaine de
       * pixels, un coin arrondi cesse de dire « ceci est un bloc » et
       * commence à dire « ceci est un coussin ». Les blocs de contenu
       * s'arrondissent peu (10-12 px), les contrôles un peu moins (8 px), et
       * seules les pastilles sont pleinement rondes.
       */
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "0.875rem",
      },
      /*
       * OMBRES — une seule, et elle ne sert QU'AUX couches flottantes
       * (feuille modale, menu déroulant, barre collante au moment où elle se
       * décolle). Le contenu en place se détache par sa valeur et par un
       * filet : voir `.surface` dans app/globals.css. `glow` et `card` ont
       * été supprimées avec les surfaces qui les portaient.
       */
      boxShadow: {
        surface: "var(--shadow-surface)",
      },
      fontSize: {
        "2xs": ["0.71875rem", { lineHeight: "1rem" }],
      },
      /*
       * ANIMATIONS — trois, toutes courtes et toutes fonctionnelles.
       * `slide-up` (l'ancienne, 8 px sur 400 ms) faisait « monter » chaque
       * carte au chargement : sur une liste, trente éléments qui glissent
       * ensemble sont un effet, pas une information. Ne restent que
       * l'apparition d'un élément qui n'était pas là, et le battement du
       * témoin de chronomètre en marche.
       */
      animation: {
        "fade-in": "fadeIn .18s ease-out",
        "rise": "rise .22s cubic-bezier(.32,.72,0,1)",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
