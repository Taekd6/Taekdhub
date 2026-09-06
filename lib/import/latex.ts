import type { Level, Line, LineFragment } from "@/lib/import/types";

/**
 * DES FRAGMENTS DE PDF VERS DU LATEX QUE KATEX SAIT RENDRE.
 *
 * Contrainte de sortie : le format attendu par `RichMath`
 * (components/rich-math.tsx) — du texte libre où les mathématiques sont
 * entourées de `$…$`. Rien d'autre. Un import qui produirait un autre format
 * créerait une deuxième catégorie d'exercices, ce qu'on refuse.
 *
 * Le principe est de ne JAMAIS entourer de `$` du texte dont on n'est pas sûr
 * qu'il soit mathématique. Une phrase française prise pour une formule est
 * bien plus grave qu'une variable laissée en romain : la première devient
 * illisible, la seconde est seulement moins jolie. On part donc d'AMORCES
 * certaines — un exposant, un indice, un symbole mathématique, une variable
 * composée dans une autre police — puis on étend prudemment de part et
 * d'autre.
 */

/** Symboles Unicode → commande LaTeX. Table volontairement limitée à ce qu'on rencontre dans une feuille de prépa. */
const SYMBOLS: Record<string, string> = {
  "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint",
  "∑": "\\sum", "∏": "\\prod", "√": "\\sqrt", "∞": "\\infty",
  "∂": "\\partial", "∇": "\\nabla", "∅": "\\emptyset",
  "∈": "\\in", "∉": "\\notin", "∋": "\\ni", "⊂": "\\subset", "⊆": "\\subseteq",
  "⊃": "\\supset", "⊇": "\\supseteq", "∪": "\\cup", "∩": "\\cap", "∖": "\\setminus",
  "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "≈": "\\approx", "≡": "\\equiv",
  "∼": "\\sim", "≃": "\\simeq", "≅": "\\cong", "∝": "\\propto",
  "→": "\\to", "←": "\\leftarrow", "↦": "\\mapsto", "⇒": "\\Rightarrow",
  "⇐": "\\Leftarrow", "⇔": "\\Leftrightarrow", "↔": "\\leftrightarrow",
  "±": "\\pm", "∓": "\\mp", "×": "\\times", "÷": "\\div", "·": "\\cdot",
  "∀": "\\forall", "∃": "\\exists", "¬": "\\neg", "∧": "\\wedge", "∨": "\\vee",
  "⊕": "\\oplus", "⊗": "\\otimes", "⊥": "\\perp", "∠": "\\angle", "∥": "\\parallel",
  "…": "\\dots", "⋯": "\\cdots", "⋮": "\\vdots", "⋱": "\\ddots",
  "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}", "ℙ": "\\mathbb{P}", "𝕂": "\\mathbb{K}",
  "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\varepsilon",
  "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta", "ι": "\\iota", "κ": "\\kappa",
  "λ": "\\lambda", "μ": "\\mu", "ν": "\\nu", "ξ": "\\xi", "π": "\\pi", "ρ": "\\rho",
  "σ": "\\sigma", "τ": "\\tau", "υ": "\\upsilon", "φ": "\\varphi", "ϕ": "\\phi",
  "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega",
  "Γ": "\\Gamma", "Δ": "\\Delta", "Θ": "\\Theta", "Λ": "\\Lambda", "Ξ": "\\Xi",
  "Π": "\\Pi", "Σ": "\\Sigma", "Φ": "\\Phi", "Ψ": "\\Psi", "Ω": "\\Omega",
  "′": "'", "″": "''", "‴": "'''",
  "°": "^{\\circ}", "‰": "\\permil",
  "²": "^{2}", "³": "^{3}", "¹": "^{1}", "½": "\\frac{1}{2}", "¼": "\\frac{1}{4}", "¾": "\\frac{3}{4}",
};

/** Noms de fonctions qui appartiennent à la formule et non à la phrase. */
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "ln", "log", "exp", "lim", "sup", "inf", "max", "min",
  "det", "dim", "rg", "rang", "ker", "Ker", "Im", "Re", "Vect", "Sp", "tr", "Tr",
  "id", "Id", "pgcd", "ppcm", "mod", "argmin", "argmax",
]);

/** Opérateurs, relations et délimiteurs absorbés sans hésitation dans une formule. */
const MATH_PUNCTUATION = /^[=+\-*/<>^_|!~()[\]{},;:'&]+$/;

type Kind = "word" | "number" | "punct" | "space" | "symbol";

interface Token {
  text: string;
  kind: Kind;
  level: Level;
  /** Amorce certaine : on part de là pour délimiter une formule. */
  seed: boolean;
}

function classify(text: string): Kind {
  if (!text.trim()) return "space";
  if (/^\d+([.,]\d+)?$/.test(text)) return "number";
  if (/^[\p{L}]+$/u.test(text)) return "word";
  if (MATH_PUNCTUATION.test(text)) return "punct";
  return "symbol";
}

/** Découpe un fragment en unités assez fines pour qu'une formule puisse s'arrêter au milieu (« = 1 et » → `= 1` puis `et`). */
function tokenizeFragment(fragment: LineFragment, isMathFont: boolean): Token[] {
  const pieces = fragment.text.match(/\d+([.,]\d+)?|[\p{L}]+|\s+|[^\s\p{L}\d]/gu) ?? [];
  return pieces.map((piece) => {
    const kind = classify(piece);
    const symbolSeed = kind === "symbol" && [...piece].some((character) => character in SYMBOLS);
    // Une variable composée dans une AUTRE police que le corps du texte est
    // une amorce : c'est ainsi que tous les traitements de texte et LaTeX
    // distinguent le `f` d'une fonction du `f` d'un mot.
    const fontSeed = isMathFont && piece.trim().length > 0 && piece.trim().length <= 3 && kind !== "space";
    return {
      text: piece,
      kind,
      level: fragment.level,
      seed: fragment.level !== "base" || symbolSeed || fontSeed,
    };
  });
}

/**
 * Un jeton peut-il faire partie d'une formule s'il est voisin d'une amorce ?
 *
 * `differentials` n'est vrai que si la ligne porte une intégrale : sans cette
 * condition, la règle « d suivi d'une lettre » avalait « de » et « du », deux
 * des mots les plus fréquents du français — « le domaine de definition de I »
 * devenait « le domaine $de I$ ».
 */
function absorbable(token: Token, differentials: boolean): boolean {
  if (differentials && token.kind === "word" && /^d[a-z]$/.test(token.text)) return true;
  return absorbableBase(token);
}

function absorbableBase(token: Token): boolean {
  if (token.kind === "number" || token.kind === "punct" || token.kind === "symbol") return true;
  if (token.kind === "word") return token.text.length === 1 || FUNCTIONS.has(token.text);
  return false;
}

/**
 * `\in` suivi de `R` donne `\inR`, une commande qui n'existe pas : KaTeX
 * n'affiche alors plus rien. Une commande LaTeX doit être séparée de ce qui
 * la suit dès que ce serait lisible comme la suite de son nom.
 */
function toLatex(text: string): string {
  let out = "";
  for (const character of text) {
    const replacement = SYMBOLS[character] ?? character;
    if (out.endsWith("\\") === false && /\\[A-Za-z]+$/.test(out) && /^[A-Za-z]/.test(replacement)) out += " ";
    out += replacement;
  }
  return out;
}

/** Une commande LaTeX en fin de morceau ne doit pas se souder au morceau suivant. */
function joinLatex(left: string, right: string): string {
  if (!left) return right;
  if (/\\[A-Za-z]+$/.test(left) && /^[A-Za-z]/.test(right)) return `${left} ${right}`;
  return left + right;
}

/** Échappe ce qui, hors formule, serait interprété par KaTeX ou casserait le découpage de `RichMath`. */
function escapeProse(text: string): string {
  return text.replace(/\$/g, "\\$");
}

/**
 * Compose une ligne : les formules deviennent `$…$`, le reste demeure du
 * texte. Les exposants et indices consécutifs de même niveau sont regroupés
 * pour donner `u_{n+1}` et non `u_{n}_{+}_{1}`.
 */
export function renderLine(line: Line, mathFonts: Set<string>, bodySize: number): string {
  const tokens: Token[] = [];
  let reach: number | null = null;
  for (const fragment of line.fragments) {
    /*
     * LES ESPACES SE DÉDUISENT DE LA GÉOMÉTRIE, pas du contenu.
     *
     * Un PDF ne contient pas forcément d'espace entre deux fragments : le
     * suivant est simplement posé un peu plus loin. En se fiant aux seuls
     * fragments d'espacement, on obtenait « Soit$u_{n}$la suite » — tout le
     * texte collé aux formules. On insère donc une espace dès que l'écart
     * horizontal en vaut une, et jamais entre un exposant/indice et son
     * porteur, qui sont volontairement accolés.
     */
    if (reach !== null && fragment.level === "base" && fragment.x - reach > bodySize * 0.22) {
      tokens.push({ text: " ", kind: "space", level: "base", seed: false });
    }
    reach = Math.max(reach ?? 0, fragment.x + fragment.width);
    /*
     * L'amorce par la police ne vaut QU'AU CORPS DU TEXTE, et sur un fragment
     * court. Sans ces deux conditions, un titre composé en gras — donc dans
     * une police différente du corps — était pris pour une formule entière :
     * « Feuille 4 - Integrales et suites » devenait
     * « Feuille $4 -$ Integrales $et$ suites ».
     */
    const atBodySize = Math.abs(fragment.size - bodySize) <= bodySize * 0.12;
    const short = fragment.text.trim().length <= 3;
    const isMathFont = fragment.level === "base" && atBodySize && short && mathFonts.has(fragment.font);
    tokens.push(...tokenizeFragment(fragment, isMathFont));
  }
  if (!tokens.length) return "";
  const differentials = line.fragments.some((fragment) => /[∫∬∭∮]/.test(fragment.text));

  // Étendre chaque amorce de part et d'autre, tant que les jetons voisins
  // peuvent appartenir à la formule. Les espaces ne sont franchis que s'ils
  // débouchent sur un jeton absorbable : sinon la formule s'arrête avant.
  const inMath = tokens.map((token) => token.seed);
  const extend = (start: number, step: number) => {
    let index = start + step;
    let pendingSpaces: number[] = [];
    while (index >= 0 && index < tokens.length) {
      const token = tokens[index];
      if (token.kind === "space") {
        if (token.text.includes("\n")) break;
        pendingSpaces.push(index);
        index += step;
        continue;
      }
      if (!absorbable(token, differentials) && !token.seed) break;
      for (const space of pendingSpaces) inMath[space] = true;
      pendingSpaces = [];
      inMath[index] = true;
      index += step;
    }
  };
  tokens.forEach((token, index) => {
    if (!token.seed) return;
    extend(index, 1);
    extend(index, -1);
  });

  // Assemblage. Les espaces de bord et la ponctuation finale restent DEHORS :
  // « Soit $u_n$ la suite », pas « Soit$u_{n}$la suite » ni « $u_n.$ ».
  let out = "";
  let index = 0;
  while (index < tokens.length) {
    if (!inMath[index]) {
      out = joinLatex(out, escapeProse(tokens[index].text));
      index += 1;
      continue;
    }
    const span: Token[] = [];
    while (index < tokens.length && inMath[index]) {
      span.push(tokens[index]);
      index += 1;
    }
    // Espaces de tête et de queue, ponctuation de fin : hors de la formule.
    while (span.length && span[0].kind === "space") out += span.shift()!.text;
    let trailing = "";
    while (span.length && (span[span.length - 1].kind === "space" || /^[.;:,!?]$/.test(span[span.length - 1].text))) {
      trailing = span.pop()!.text + trailing;
    }
    // « $u_n$. » et non « $u_n$ . » : l'espace reconstruite depuis la géométrie
    // ne doit pas se glisser devant la ponctuation sortie de la formule.
    trailing = trailing.replace(/\s+(?=[.;:,!?])/g, "");

    let formula = "";
    let cursor = 0;
    while (cursor < span.length) {
      const token = span[cursor];
      if (token.level === "base") {
        formula = joinLatex(formula, toLatex(token.text));
        cursor += 1;
        continue;
      }
      // Tout l'exposant (ou tout l'indice) d'un seul tenant : `u_{n+1}`, pas `u_{n}_{+}_{1}`.
      let group = "";
      const level = token.level;
      while (cursor < span.length && span[cursor].level === level) {
        group = joinLatex(group, toLatex(span[cursor].text));
        cursor += 1;
      }
      formula += `${level === "sup" ? "^" : "_"}{${group.trim()}}`;
    }

    const trimmed = formula.trim();
    if (trimmed) out += `$${trimmed}$`;
    else out += formula;
    out += trailing;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

/** Polices « mathématiques » de la page : toutes celles qui ne sont pas la police de corps. */
export function mathFontsOf(bodyFontName: string | null, fonts: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const font of fonts) if (font !== bodyFontName) set.add(font);
  return set;
}

export const MATH_SYMBOLS = SYMBOLS;
