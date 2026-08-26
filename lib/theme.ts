/**
 * Personnalisation de l'accent (Sprint identité visuelle) — une seule teinte
 * réglable, propagée par variable CSS (`--accent-rgb`) que `tailwind.config.ts`
 * réutilise pour TOUTES les classes `accent` déjà existantes (`bg-accent`,
 * `text-accent/60`, etc.) : aucun composant n'a besoin d'être modifié pour en
 * bénéficier.
 *
 * Le texte posé sur l'accent (`text-accent-foreground`) est calculé — jamais
 * fixé à `black` — pour rester lisible quelle que soit la teinte choisie, y
 * compris une couleur personnalisée sombre.
 */

export interface AccentPreset {
  id: string;
  label: string;
  hex: string;
}

/** Teintes sobres, choisies pour un rendu premium/académique — jamais saturées au point de devenir "gadget". */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "lime", label: "Lime", hex: "#d4f36b" },
  { id: "azur", label: "Azur", hex: "#8ecbff" },
  { id: "ambre", label: "Ambre", hex: "#f5c26b" },
  { id: "corail", label: "Corail", hex: "#f0968a" },
  { id: "lavande", label: "Lavande", hex: "#b9a6f5" },
  { id: "menthe", label: "Menthe", hex: "#7fe0c4" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex;

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

/** Luminance relative WCAG — sert uniquement à choisir noir ou blanc pour le texte posé sur l'accent, pas à valider un ratio de contraste précis. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * L'ACCENT EN TANT QU'ENCRE — même teinte, assombrie juste ce qu'il faut pour
 * rester lisible sur un fond clair.
 *
 * L'accent avait une seule valeur pour deux usages opposés : le REMPLISSAGE
 * (bouton principal, lueur de fond), qui doit rester la couleur de marque
 * telle quelle, et l'ENCRE (texte, icônes, liens, teintes fines), qui se pose
 * sur le fond de la page. En thème clair, cette seconde famille tombait à
 * **1,20:1** de contraste avec l'accent par défaut — mesuré sur /progress :
 * les icônes de section, les liens « Travailler ce chapitre » et les pastilles
 * de pourcentage étaient à la limite de l'invisible. (15,95:1 en thème sombre,
 * d'où le fait que ça n'ait jamais sauté aux yeux.)
 *
 * L'accent restant personnalisable (n'importe quel hex), la valeur n'est pas
 * codée en dur : on assombrit la teinte choisie, par simple mise à l'échelle
 * des canaux — la couleur reste reconnaissable — jusqu'à passer sous le seuil
 * de luminance qui garantit 4,5:1 sur le fond clair de l'application.
 *
 * Écrite en `--accent-ink-base-rgb` : c'est app/globals.css qui décide, selon
 * le thème, si `--accent-ink-rgb` vaut cette version assombrie (clair) ou
 * l'accent tel quel (sombre). Un seul endroit tranche, jamais deux.
 */
/** Calibré pour 4,5:1 sur `--canvas` en thème clair (#f4f5f7) — la surface la plus sombre où l'encre se pose. */
const INK_MAX_LUMINANCE = 0.163;
/** Aplat principal en thème clair : nettement plus sombre que l'encre, pour porter du texte blanc (≈ 11:1) au lieu d'être un surligneur. */
const DEEP_MAX_LUMINANCE = 0.045;

/** Assombrit `rgb` par mise à l'échelle des canaux jusqu'à passer sous `target` — la teinte reste reconnaissable. */
function darkenTo(rgb: [number, number, number], target: number): [number, number, number] {
  if (relativeLuminance(rgb) <= target) return rgb;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2;
    if (relativeLuminance(rgb.map((c) => c * mid) as [number, number, number]) > target) high = mid;
    else low = mid;
  }
  return rgb.map((c) => Math.round(c * low)) as [number, number, number];
}

/** Teinte profonde de l'accent — remplissage du bouton principal en thème clair. */
export function accentDeep(hex: string): [number, number, number] {
  return darkenTo(hexToRgb(hex) ?? (hexToRgb(DEFAULT_ACCENT) as [number, number, number]), DEEP_MAX_LUMINANCE);
}

export function accentInk(hex: string): [number, number, number] {
  return darkenTo(hexToRgb(hex) ?? (hexToRgb(DEFAULT_ACCENT) as [number, number, number]), INK_MAX_LUMINANCE);
}

/** Noir ou blanc — jamais une autre teinte — selon ce qui contraste le mieux avec `hex`. Retombe sur l'accent par défaut si `hex` n'est pas un hex valide. */
export function accentForeground(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex) ?? (hexToRgb(DEFAULT_ACCENT) as [number, number, number]);
  return relativeLuminance(rgb) > 0.45 ? [0, 0, 0] : [255, 255, 255];
}

export function accentForegroundCss(hex: string): string {
  const [r, g, b] = accentForeground(hex);
  return r === 0 ? "#000000" : "#ffffff";
}

/** Écrit les variables CSS sur `root` — seul point d'entrée utilisé à la fois par `ThemeSync` (React) et par le script anti-flash inline (voir app/layout.tsx). */
export function applyAccent(hex: string, root: HTMLElement = document.documentElement): void {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const fg = accentForeground(hex);
  root.style.setProperty("--accent-rgb", rgb.join(" "));
  root.style.setProperty("--accent-fg-rgb", fg.join(" "));
  root.style.setProperty("--accent-ink-base-rgb", accentInk(hex).join(" "));
  root.style.setProperty("--accent-deep-base-rgb", accentDeep(hex).join(" "));
}

/**
 * Mode d'apparence (Sprint personnalisation) — indépendant de la couleur
 * d'accent ci-dessus. "system" ne fixe AUCUN attribut : c'est l'absence de
 * `data-theme` qui laisse `prefers-color-scheme` décider (voir
 * app/globals.css) — un seul mécanisme, jamais un troisième état dupliqué
 * en CSS.
 */
export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
export const DEFAULT_THEME_MODE: ThemeMode = "system";

/**
 * Pose `data-theme` sur `root` — "light"/"dark" explicite, ou retire
 * l'attribut pour "system" (voir la doc de `ThemeMode`). Seul point d'entrée,
 * utilisé par `ThemeSync` (React) et le script anti-flash inline
 * (app/layout.tsx), même principe que `applyAccent`.
 */
export function applyThemeMode(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}
