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
        // `accent` (text-accent, bg-accent/10, border-accent…) = l'accent en
        // tant qu'ENCRE : identique à la couleur de marque en thème sombre,
        // assombri en thème clair où celle-ci tombait à 1,20:1 de contraste.
        // Le REMPLISSAGE de marque (bouton principal, lueur de fond) reste sur
        // `--accent-rgb` — voir app/globals.css.
        accent: {
          DEFAULT: "rgb(var(--accent-ink-rgb) / <alpha-value>)",
          solid: "rgb(var(--accent-rgb) / <alpha-value>)",
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
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        surface: "0 12px 34px rgba(0,0,0,.16)",
        glow: "0 0 22px rgb(var(--accent-rgb) / .18)",
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 12px 34px rgba(0,0,0,.16)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      animation: {
        "fade-in": "fadeIn .4s ease-out",
        "slide-up": "slideUp .4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
