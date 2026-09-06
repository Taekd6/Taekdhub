import type { Line, LineFragment, PdfItem, PdfPage } from "@/lib/import/types";

/**
 * RECONSTRUCTION DES LIGNES à partir de fragments positionnés.
 *
 * Un PDF ne contient pas de lignes : il contient des morceaux de texte posés à
 * des coordonnées. Un exposant n'est pas balisé comme tel — c'est juste un
 * fragment plus petit, posé un peu plus haut. Tout le sens typographique est
 * dans la géométrie, et c'est ce module qui le relit.
 *
 * La méthode tient en deux passes, et l'ordre compte :
 *  1. les fragments AU CORPS du texte fixent les lignes de base ;
 *  2. les fragments plus petits rejoignent ensuite la ligne de base la plus
 *     proche, au-dessus (exposant) ou en dessous (indice).
 *
 * L'inverse ne marche pas : traités dans l'ordre de haut en bas, un exposant
 * arrive AVANT le texte auquel il se rattache et ouvrirait une ligne à lui
 * tout seul.
 */

/** En dessous de ce rapport à la taille dominante, un fragment est un exposant ou un indice, pas du corps de texte. */
const SMALL_RATIO = 0.85;
/** Un fragment petit rejoint une ligne de base si elle est à moins d'un cadratin — au-delà, c'est une autre ligne. */
const ATTACH_RATIO = 1;
/**
 * Pénalité appliquée à un rattachement PAR LE BAS (le fragment deviendrait un
 * indice de la ligne du dessus).
 *
 * Un indice colle à sa ligne de base — un ou deux points — alors qu'une borne
 * d'intégrale ou un exposant s'en éloigne bien davantage. Sans cette
 * asymétrie, la borne supérieure d'un `∫` posée à mi-chemin entre deux lignes
 * partait s'accrocher au titre du dessus comme un indice : mesuré sur la
 * feuille de test, « Exercice 2. Une integrale a parametre » devenait
 * « …parametre$_{1}$ » et la formule perdait sa borne.
 */
const BELOW_PENALTY = 1.6;
/** Deux fragments de corps appartiennent à la même ligne si leurs lignes de base tiennent dans cette fraction du corps. */
const BASELINE_RATIO = 0.35;
/** Grands opérateurs qui portent LÉGITIMEMENT une borne au-dessus et une en dessous : leur empilement n'a rien de suspect. */
const BIG_OPERATORS = /[∫∑∏⋃⋂⨁⨂]|\b(lim|sup|inf|max|min)\b/;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Taille de corps de la page : la médiane pondérée par le nombre de caractères, pour qu'un gros titre isolé ne l'emporte pas sur vingt lignes de texte. */
export function bodySize(items: PdfItem[]): number {
  const weighted: number[] = [];
  for (const item of items) {
    const length = item.text.trim().length;
    if (!length || item.size <= 0) continue;
    for (let i = 0; i < length; i++) weighted.push(item.size);
  }
  return median(weighted) || 11;
}

/** Police de corps de la page — tout ce qui n'est PAS composé dedans, à taille de corps, est probablement une variable mathématique. */
export function bodyFont(items: PdfItem[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const length = item.text.trim().length;
    if (!length) continue;
    counts.set(item.font, (counts.get(item.font) ?? 0) + length);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [font, count] of counts) {
    if (count > bestCount) {
      best = font;
      bestCount = count;
    }
  }
  return best;
}

/** Regroupe les fragments d'une page en lignes, exposants et indices rattachés. */
export function buildLines(page: PdfPage): Line[] {
  const items = page.items.filter((item) => item.text.trim().length > 0);
  if (!items.length) return [];
  const size = bodySize(items);
  const smallThreshold = size * SMALL_RATIO;

  const body = items.filter((item) => item.size >= smallThreshold);
  const small = items.filter((item) => item.size < smallThreshold);

  // 1. Les lignes de base, posées par le corps du texte.
  const lines: { y: number; size: number; items: { item: PdfItem; level: "base" | "sup" | "sub" }[] }[] = [];
  for (const item of [...body].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const host = lines.find((line) => Math.abs(line.y - item.y) <= Math.max(line.size, item.size) * BASELINE_RATIO);
    if (host) {
      host.items.push({ item, level: "base" });
      host.size = Math.max(host.size, item.size);
    } else {
      lines.push({ y: item.y, size: item.size, items: [{ item, level: "base" }] });
    }
  }

  // 2. Les petits fragments rejoignent la ligne de base la PLUS PROCHE — au-dessus
  //    c'est un exposant, en dessous un indice. Trop loin de toutes, le fragment
  //    est une ligne à lui seul (une note, un numéro de page en petit corps).
  for (const item of small) {
    let nearest: (typeof lines)[number] | null = null;
    let distance = Infinity;
    let cost = Infinity;
    for (const line of lines) {
      const gap = Math.abs(line.y - item.y);
      const candidate = item.y < line.y ? gap * BELOW_PENALTY : gap;
      if (candidate < cost) {
        cost = candidate;
        distance = gap;
        nearest = line;
      }
    }
    if (nearest && distance <= size * ATTACH_RATIO && distance > 0.05 * size) {
      nearest.items.push({ item, level: item.y > nearest.y ? "sup" : "sub" });
    } else if (nearest && distance <= 0.05 * size) {
      nearest.items.push({ item, level: "base" });
    } else {
      lines.push({ y: item.y, size: item.size, items: [{ item, level: "base" }] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const ordered = line.items.sort((a, b) => a.item.x - b.item.x);
      const fragments: LineFragment[] = ordered.map(({ item, level }) => ({
        text: item.text,
        level,
        font: item.font,
        size: item.size,
        x: item.x,
        width: item.width,
      }));
      return { page: page.number, y: line.y, size: line.size, fragments, stacked: detectStacking(fragments) };
    })
    .filter((line) => line.fragments.some((fragment) => fragment.text.trim()));
}

/**
 * Repère une fraction ou une matrice écrite sur DEUX ÉTAGES — que l'extraction
 * de texte ne peut pas reconstruire, la barre de fraction et les délimiteurs
 * étant des traits et non du texte. On ne devine pas : on signale.
 *
 * La signature est un fragment haut et un fragment bas alignés horizontalement.
 * Encore faut-il ne pas confondre avec les deux cas parfaitement légitimes où
 * cela se produit aussi :
 *  - `u_n^2` : le porteur est une LETTRE, juste à gauche ;
 *  - `∫_0^1`, `∑`, `lim` : un grand opérateur, également à gauche.
 * On n'alerte donc que si rien, à gauche, ne peut porter ces deux étages.
 */
function detectStacking(fragments: LineFragment[]): boolean {
  const sups = fragments.filter((fragment) => fragment.level === "sup");
  const subs = fragments.filter((fragment) => fragment.level === "sub");
  for (const sup of sups) {
    for (const sub of subs) {
      if (Math.abs(sup.x - sub.x) > Math.max(sup.size, sub.size)) continue;
      const before = fragments.filter((fragment) => fragment.level === "base" && fragment.x < sup.x);
      const tail = before.map((fragment) => fragment.text).join("").trimEnd();
      if (BIG_OPERATORS.test(tail.slice(-6))) continue;
      // Une lettre ou un chiffre juste avant : c'est lui qui porte l'indice et
      // l'exposant, pas une fraction.
      if (/[\p{L}\d)\]]$/u.test(tail)) continue;
      return true;
    }
  }
  return false;
}

/**
 * Retire les en-têtes et pieds de page : un numéro de page répété en haut ou
 * en bas de chaque feuillet n'appartient à aucun exercice, et se retrouvait
 * sinon collé au milieu d'un énoncé à cheval sur deux pages.
 */
export function stripRunningHeads(lines: Line[], page: PdfPage): Line[] {
  const margin = page.height * 0.06;
  return lines.filter((line) => {
    const inMargin = line.y > page.height - margin || line.y < margin;
    if (!inMargin) return true;
    const text = line.fragments.map((fragment) => fragment.text).join("").trim();
    return !(text.length <= 8 || /^page\s*\d+/i.test(text));
  });
}
