/**
 * Types partagés du pipeline d'import de feuilles d'exercices.
 *
 * Le pipeline est une suite de fonctions PURES, et c'est délibéré : seul
 * `pdf-source.ts` touche à pdf.js et à un fichier. Tout le reste — mise en
 * page, mathématiques, découpage en exercices, doublons — se teste sans
 * navigateur, à partir des structures décrites ici.
 *
 *   fichier → PdfPage[] → Line[] → SheetBlock[] → SheetExercise[] → lignes d'import
 */

/** Un fragment de texte tel que pdf.js le rend, avec sa position sur la page. */
export interface PdfItem {
  text: string;
  /** Coin gauche de la ligne de base, en points PDF (origine en bas à gauche). */
  x: number;
  y: number;
  width: number;
  /** Taille de police du fragment — c'est elle qui trahit exposants et indices. */
  size: number;
  /** Identifiant interne de police. Deux identifiants différents = deux polices : suffisant pour repérer les variables composées en italique, sans avoir à résoudre le vrai nom. */
  font: string;
}

export interface PdfPage {
  number: number;
  width: number;
  height: number;
  items: PdfItem[];
}

/** Niveau typographique d'un fragment dans sa ligne. */
export type Level = "base" | "sup" | "sub";

export interface LineFragment {
  text: string;
  level: Level;
  font: string;
  size: number;
  x: number;
  /** Largeur rendue — c'est l'écart entre deux fragments qui trahit une espace, le PDF n'en contenant pas toujours. */
  width: number;
}

export interface Line {
  page: number;
  /** Ligne de base, en points PDF. */
  y: number;
  /** Taille du corps de la ligne (hors exposants/indices). */
  size: number;
  fragments: LineFragment[];
  /**
   * Empilement suspect : un exposant ET un indice se superposent
   * horizontalement sans opérateur (∫, ∑…) devant. C'est la signature d'une
   * fraction ou d'une matrice, que l'extraction de texte seule ne sait pas
   * reconstruire — l'exercice sera signalé « à vérifier » plutôt que rendu
   * faussement.
   */
  stacked: boolean;
}

/** Un bloc de la feuille : un titre d'exercice, ou un morceau de son contenu. */
export interface SheetBlock {
  kind: "heading" | "text";
  page: number;
  /** Texte déjà converti (LaTeX inline compris) — voir lib/import/latex.ts. */
  text: string;
  /** Renseigné pour `kind: "heading"`. */
  number?: string;
  /** Titre écrit à la suite du numéro, s'il y en a un. */
  label?: string;
  stacked: boolean;
}

/** Un exercice détecté dans la feuille, avant toute décision de l'utilisateur. */
export interface SheetExercise {
  /** Numéro lu sur la feuille (« 2 », « II »…), `null` si la feuille n'en porte pas. */
  number: string | null;
  title: string;
  statement: string;
  /** Pages sur lesquelles l'exercice s'étend — un exercice à cheval en couvre plusieurs. */
  pages: number[];
  /** Sous-questions repérées (« 1. », « a) »…) : sert à proposer une difficulté et une durée. */
  parts: number;
  /** Raisons pour lesquelles cet exercice mérite une relecture avant import. */
  warnings: string[];
}

export interface SheetExtraction {
  /** En-tête de la feuille (titre, établissement, année) — sert à pré-remplir la source. */
  header: string;
  exercises: SheetExercise[];
  pages: number;
  /** `true` si aucune page ne contenait de texte : feuille scannée, extraction impossible. */
  scanned: boolean;
}
