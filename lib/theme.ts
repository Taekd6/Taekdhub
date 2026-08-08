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
}
