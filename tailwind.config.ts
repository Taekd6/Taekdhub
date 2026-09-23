import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // lib/study.ts porte les classes des matières et des statuts
    // (`subjectMeta`, `statusMeta`) : sans lui, leurs fonds n'étaient jamais générés.
    "./lib/**/*.{ts,tsx}",
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
        /*
         * IDENTITÉ DE MATIÈRE (refonte « Nuit ») — une teinte par matière,
         * réglable par l'élève (lib/subject-colors.ts). `subj-<clé>` =
         * remplissage (barre, segment, fond de pastille en faible opacité),
         * `subj-<clé>-ink` = texte posé sur ce fond. Les deux s'ajustent au
         * thème dans app/globals.css.
         */
        subj: {
          math: "rgb(var(--subj-math) / <alpha-value>)",
          "math-ink": "rgb(var(--subj-math-ink) / <alpha-value>)",
          phys: "rgb(var(--subj-phys) / <alpha-value>)",
          "phys-ink": "rgb(var(--subj-phys-ink) / <alpha-value>)",
          chim: "rgb(var(--subj-chim) / <alpha-value>)",
          "chim-ink": "rgb(var(--subj-chim-ink) / <alpha-value>)",
          itc: "rgb(var(--subj-itc) / <alpha-value>)",
          "itc-ink": "rgb(var(--subj-itc-ink) / <alpha-value>)",
          isp: "rgb(var(--subj-isp) / <alpha-value>)",
          "isp-ink": "rgb(var(--subj-isp-ink) / <alpha-value>)",
          fr: "rgb(var(--subj-fr) / <alpha-value>)",
          "fr-ink": "rgb(var(--subj-fr-ink) / <alpha-value>)",
          en: "rgb(var(--subj-en) / <alpha-value>)",
          "en-ink": "rgb(var(--subj-en-ink) / <alpha-value>)",
        },
      },
      fontFamily: {
        // Voir app/layout.tsx : `sans` (Nunito) = toute l'interface, `serif`
        // (Newsreader) = la colonne de lecture d'un énoncé, et elle seule.
        sans: ["var(--font-sans)", "ui-rounded", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      /*
       * RAYONS — refonte « Nuit » : franchement arrondis, cohérents avec une
       * police ronde. Contrôles à 12 px (`rounded-lg`), cartes à 20 px
       * (`rounded-2xl`, et `.surface`), pastilles et bouton principal en
       * `rounded-full`. Mêmes NOMS de classes qu'avant : seules les valeurs
       * changent, et tout l'écran suit.
       */
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "0.625rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.375rem",
      },
      /*
       * OMBRES — une seule, et elle ne sert QU'AUX couches flottantes
       * (feuille modale, menu). Le contenu en place se détache par son voile
       * et son filet : voir `.surface` dans app/globals.css.
       */
      boxShadow: {
        surface: "var(--shadow-surface)",
      },
      fontSize: {
        // Plancher de l'interface : 12 px. En dessous, une étiquette cesse
        // d'être lue et devient une texture.
        "2xs": ["0.75rem", { lineHeight: "1.0625rem" }],
      },
      /*
       * ANIMATIONS utilitaires. Le kit de mouvement de l'écran (entrée en
       * cascade, barres qui poussent, anneau qui se trace…) vit en classes
       * dans app/globals.css (`.reveal`, `.grow-x`, …) ; ici ne restent que
       * l'apparition ponctuelle d'un élément et le battement du témoin de
       * chronomètre.
       */
      animation: {
        "fade-in": "fadeIn .2s ease-out",
        "rise": "rise .35s cubic-bezier(.16,1,.3,1)",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
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
