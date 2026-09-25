/**
 * PALETTES EN DÉGRADÉ (refonte « Revolut clair ») — plus un accent, mais
 * QUATRE familles de dégradés, dont l'élève choisit une dans Réglages.
 *
 * ─── L'HISTOIRE, POUR NE PAS LA REFAIRE ─────────────────────────────
 *
 * « Papier » crème et laiton : laid. « Nuit » (une couleur vive par
 * matière) : « bizarre ». « Apple » gris monochrome : « pas fou, pas
 * envie ». Revolut sombre : « le noir, ça rend pas envie ». La maquette
 * retenue (« D2 · Style Revolut clair ») est un fond BLANC lumineux, des
 * halos pastel qui dérivent, des cartes blanches flottantes, et des cartes
 * en DÉGRADÉ vif pour ce qui compte : les matières, les révisions, le
 * bouton principal.
 *
 * ─── CE QU'UNE PALETTE CONTIENT ─────────────────────────────────────
 *
 *   `c1` → `c2`   le dégradé de marque : halos, courbe, avatar, bouton rond
 *                 du chrono (icône seule — le blanc n'a pas à s'y lire) ;
 *   `ink`         l'ENCRE en thème clair : liens, pastilles, onglet actif —
 *                 assez sombre pour tenir 4,5:1 sur le fond et le blanc ;
 *   `solid`       le dégradé des BOUTONS À TEXTE : deux teintes profondes,
 *                 chacune ≥ 4,5:1 avec le blanc. `c1 → c2` n'y suffirait pas
 *                 (du blanc sur #22d3ee tombe à 1,8:1) ;
 *   `cards`       quatre paires pour les cartes en dégradé, utilisées en
 *                 LISTE CYCLÉE (carte 1, 2, 3, 4, 1…) — pas une couleur
 *                 attitrée par matière : l'élève a rejeté l'identité
 *                 colorée des matières (« Nuit »), la couleur ne dit ici que
 *                 « carte n° k » ;
 *   `review`      la bannière des révisions du jour ;
 *   `dl`          les trois pastilles datées des échéances.
 *
 * Valeurs RECOPIÉES de la maquette validée (`renderVals`), pas réinventées —
 * à trois exceptions près : l'encre de Sunset (#d0364f → #cc344d), d'Océan
 * (#0a7aa8 → #09729d) et de Néon (#3f8a0c → #367a0a), assombries d'un
 * cheveu pour tenir 4,5:1 sur le fond #f5f6fa (lib/theme.test.ts). La
 * maquette ne les posait que sur des liens « Tout voir » ; l'application
 * les pose sur du texte courant. `solid` (boutons à texte) est un ajout :
 * la maquette n'avait pas de bouton à texte.
 *
 * Tout est publié en variables CSS sur `<html>` (`applyPalette`) — voir
 * app/globals.css pour leur usage, et app/layout.tsx pour le script
 * anti-flash qui les pose avant le premier rendu.
 */

export type PaletteId = "aurora" | "sunset" | "ocean" | "neon";

export interface Palette {
  id: PaletteId;
  label: string;
  c1: string;
  c2: string;
  ink: string;
  solid: [string, string];
  cards: [string, string][];
  review: [string, string];
  dl: [string, string, string];
}

export const PALETTES: Palette[] = [
  {
    id: "aurora",
    label: "Aurora",
    c1: "#7c5cff",
    c2: "#22d3ee",
    ink: "#5b3fd6",
    solid: ["#6d28d9", "#2563eb"],
    cards: [
      ["#6d28d9", "#2563eb"],
      ["#db2777", "#7c3aed"],
      ["#0891b2", "#4f46e5"],
      ["#9333ea", "#ec4899"],
    ],
    review: ["#f97316", "#ec4899"],
    dl: ["#7c3aed", "#2563eb", "#0891b2"],
  },
  {
    id: "sunset",
    label: "Sunset",
    c1: "#fb7185",
    c2: "#fbbf24",
    ink: "#cc344d",
    solid: ["#be185d", "#e11d48"],
    cards: [
      ["#e11d48", "#f97316"],
      ["#c026d3", "#fb7185"],
      ["#ea580c", "#facc15"],
      ["#be185d", "#8b5cf6"],
    ],
    review: ["#7c3aed", "#db2777"],
    dl: ["#e11d48", "#ea580c", "#c026d3"],
  },
  {
    id: "ocean",
    label: "Océan",
    c1: "#38bdf8",
    c2: "#34d399",
    ink: "#09729d",
    solid: ["#0369a1", "#0e7490"],
    cards: [
      ["#0369a1", "#0891b2"],
      ["#0d9488", "#22c55e"],
      ["#1d4ed8", "#06b6d4"],
      ["#0f766e", "#3b82f6"],
    ],
    review: ["#2563eb", "#14b8a6"],
    dl: ["#0369a1", "#0d9488", "#1d4ed8"],
  },
  {
    id: "neon",
    label: "Néon",
    c1: "#a3e635",
    c2: "#22d3ee",
    ink: "#367a0a",
    solid: ["#15803d", "#0f766e"],
    cards: [
      ["#16a34a", "#0ea5e9"],
      ["#9333ea", "#22d3ee"],
      ["#65a30d", "#14b8a6"],
      ["#db2777", "#f59e0b"],
    ],
    review: ["#84cc16", "#06b6d4"],
    dl: ["#16a34a", "#9333ea", "#0ea5e9"],
  },
];

export const PALETTE_IDS: PaletteId[] = PALETTES.map((palette) => palette.id);
export const DEFAULT_PALETTE: PaletteId = "aurora";

export function paletteById(id: PaletteId | string | undefined): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/**
 * MIGRATION DES ANCIENNES PRÉFÉRENCES — quelle palette pour un élève qui
 * n'en a jamais choisi ?
 *
 *   1. `palette` valide : c'est un choix, on le garde.
 *   2. `accent` (refonte « Apple », un hex) : on garde la FAMILLE de teinte
 *      choisie — un rose ou un orange devient Sunset, un vert Néon, un
 *      turquoise Océan, un bleu-violet Aurora. Les anciens accents PAR
 *      DÉFAUT (bleu Apple, « Miel », « Menthe ») n'ont jamais été choisis :
 *      ils donnent Aurora, comme un gris (« Graphite »).
 *   3. `subjectPalette` (refonte « Nuit ») : Sunset et Océan portent le même
 *      nom qu'aujourd'hui ; « neon » était le DÉFAUT d'alors (pas un
 *      choix), « pastel » n'a plus d'équivalent — les deux donnent Aurora.
 *   4. Rien : Aurora.
 *
 * AUTONOME — aucune référence extérieure, aucune syntaxe récente : sa source
 * est recopiée TELLE QUELLE dans le script anti-flash (app/layout.tsx, via
 * `Function#toString`), pour que le premier rendu et `normalizePreferences`
 * ne puissent jamais trancher différemment. D'où l'absence de toute
 * syntaxe récente (`?.`, `??`, étalement).
 */
export function resolvePaletteId(raw: unknown): PaletteId {
  const ids = ["aurora", "sunset", "ocean", "neon"];
  const prefs = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (typeof prefs.palette === "string" && ids.indexOf(prefs.palette) >= 0) return prefs.palette as PaletteId;
  const accent = typeof prefs.accent === "string" ? prefs.accent.trim().toLowerCase() : "";
  const match = /^#?([0-9a-f]{6})$/.exec(accent);
  const legacyDefaults = ["#0a84ff", "#e0a758", "#5eead4"];
  if (match && legacyDefaults.indexOf("#" + match[1]) < 0) {
    const r = parseInt(match[1].slice(0, 2), 16) / 255;
    const g = parseInt(match[1].slice(2, 4), 16) / 255;
    const b = parseInt(match[1].slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    // Un gris (ou presque) n'a pas de famille : défaut.
    if (max === 0 || delta / max < 0.2) return "aurora";
    let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = hue * 60;
    if (hue < 0) hue += 360;
    if (hue >= 330 || hue < 50) return "sunset";
    if (hue < 160) return "neon";
    if (hue < 205) return "ocean";
    return "aurora";
  }
  if (prefs.subjectPalette === "sunset" || prefs.subjectPalette === "ocean") return prefs.subjectPalette;
  return "aurora";
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminance relative WCAG. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/**
 * Noir ou blanc — le plus lisible des deux sur `hex`. Sert au texte posé
 * sur l'aplat brut `c1` (`text-accent-foreground`), rare : les cartes en
 * dégradé portent toujours du blanc sur des teintes choisies pour.
 */
const FOREGROUND_CROSSOVER = Math.sqrt(1.05 * 0.05) - 0.05;
export function accentForeground(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  return relativeLuminance(rgb) > FOREGROUND_CROSSOVER ? [0, 0, 0] : [255, 255, 255];
}

/**
 * TOUTES LES VARIABLES D'UNE PALETTE — une table nom → valeur, calculée ici
 * une fois, utilisée à la fois par `applyPalette` (React) et par le script
 * anti-flash (app/layout.tsx, qui reçoit la table de CHAQUE palette sérialisée
 * au rendu serveur). Aucune formule n'est donc dupliquée dans le script.
 *
 *   `--g1` / `--g2`             le dégradé de marque (hex) ;
 *   `--g1-rgb` / `--g2-rgb`     les mêmes en canaux, pour les halos et les
 *                               ombres colorées (`rgb(var(--g1-rgb) / .3)`) ;
 *   `--accent-*`                les anciens noms, remappés : `accent` (encre)
 *                               = `ink` en clair, `c2` en sombre (voir
 *                               app/globals.css) ; `accent-solid` = la
 *                               première teinte du dégradé des boutons ;
 *   `--btn-g1` / `--btn-g2`     le dégradé des boutons à texte blanc ;
 *   `--card-Na` / `--card-Nb`   les quatre paires de cartes, et
 *   `--card-grad-N`             les mêmes en `linear-gradient` prêt à poser ;
 *   `--review-a/b`, `--review-grad`, `--dl-1..3`.
 */
export function paletteVariables(palette: Palette): Record<string, string> {
  const rgb = (hex: string) => (hexToRgb(hex) ?? [0, 0, 0]).join(" ");
  const grad = (a: string, b: string) => `linear-gradient(135deg, ${a}, ${b})`;
  const vars: Record<string, string> = {
    "--g1": palette.c1,
    "--g2": palette.c2,
    "--g1-rgb": rgb(palette.c1),
    "--g2-rgb": rgb(palette.c2),
    "--accent-rgb": rgb(palette.c1),
    "--accent-fg-rgb": accentForeground(palette.c1).join(" "),
    "--accent-ink-base-rgb": rgb(palette.ink),
    "--accent-ink-dark-rgb": rgb(palette.c2),
    "--accent-solid-base-rgb": rgb(palette.solid[0]),
    "--btn-g1": palette.solid[0],
    "--btn-g2": palette.solid[1],
    "--review-a": palette.review[0],
    "--review-b": palette.review[1],
    "--review-grad": grad(palette.review[0], palette.review[1]),
  };
  palette.cards.forEach(([a, b], index) => {
    vars[`--card-${index + 1}a`] = a;
    vars[`--card-${index + 1}b`] = b;
    vars[`--card-grad-${index + 1}`] = grad(a, b);
  });
  palette.dl.forEach((color, index) => {
    vars[`--dl-${index + 1}`] = color;
  });
  return vars;
}

/** Nombre de paires de cartes par palette — les cartes en dégradé se succèdent modulo ce nombre. */
export const CARD_TONES = 4;

/** Écrit les variables de la palette sur `root` — appelé par `ThemeSync` et par le sélecteur des Réglages. */
export function applyPalette(id: PaletteId, root: HTMLElement = document.documentElement): void {
  const vars = paletteVariables(paletteById(id));
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.setAttribute("data-palette", id);
}

/**
 * Mode d'apparence — indépendant de la palette.
 *
 * CLAIR PAR DÉFAUT depuis la refonte « Revolut clair » : app/globals.css
 * pose les neutres CLAIRS sur `:root` nu, et le sombre n'existe que sous
 * `data-theme="dark"` (ou `data-theme="system"` quand le système est
 * sombre). "system" est donc toujours ÉCRIT dans l'attribut : son absence
 * veut dire « défaut du produit », c'est-à-dire clair.
 */
export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
export const DEFAULT_THEME_MODE: ThemeMode = "light";

/** Pose `data-theme` sur `root` — toujours, y compris "system". */
export function applyThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.setAttribute("data-theme", mode);
}
