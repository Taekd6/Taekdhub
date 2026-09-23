import { subjects } from "@/lib/study";
import { darkenTo, hexToRgb } from "@/lib/theme";
import type { Subject } from "@/lib/supabase/types";

/**
 * IDENTITÉ DE COULEUR DES MATIÈRES — refonte « Nuit ».
 *
 * Chaque matière porte UNE teinte, reconnaissable d'un écran à l'autre : la
 * pastille d'une ligne d'exercice, le segment de l'anneau du jour, la colonne
 * de la semaine et la barre de budget parlent la même couleur. C'est ce qui
 * permet de lire « beaucoup de maths, pas d'anglais » sans lire un seul mot.
 *
 * La teinte vit dans des VARIABLES CSS (`--subj-math`, …), jamais dans une
 * classe codée en dur : l'élève choisit une palette, peut surcharger une
 * matière, et tout suit sans qu'aucun composant ne soit modifié — exactement
 * comme l'accent (lib/theme.ts#applyAccent).
 *
 * TROIS VALEURS PAR MATIÈRE, écrites sur `<html>` :
 *
 *   `--subj-<clé>-raw`   la couleur choisie, telle quelle — thème sombre ;
 *   `--subj-<clé>-soft`  assombrie juste assez pour qu'un TRAIT (barre,
 *                        segment d'anneau) tienne 3:1 sur une carte blanche
 *                        — thème clair ;
 *   `--subj-<clé>-deep`  assombrie pour qu'un TEXTE tienne 4,5:1 sur la
 *                        pastille teintée — thème clair.
 *
 * C'est app/globals.css qui décide, selon le thème, ce que valent
 * `--subj-<clé>` (remplissage) et `--subj-<clé>-ink` (texte) : un seul
 * endroit tranche, comme pour `--accent-ink-rgb`.
 *
 * Module PUR (aucun accès au DOM hors `applySubjectColors`, qui prend sa
 * racine en paramètre) : tout est testable sans navigateur.
 */

/** Clé courte de chaque matière — sert de suffixe aux variables CSS et aux classes Tailwind (`bg-subj-math`). */
export const SUBJECT_KEYS: Record<Subject, string> = {
  Mathématiques: "math",
  Physique: "phys",
  Chimie: "chim",
  "Informatique TC": "itc",
  "Informatique Spé": "isp",
  Français: "fr",
  Anglais: "en",
};

export type SubjectPaletteId = "neon" | "pastel" | "sunset" | "ocean";

export interface SubjectPalette {
  id: SubjectPaletteId;
  label: string;
  colors: Record<Subject, string>;
}

/*
 * QUATRE PALETTES, sept teintes chacune, toutes pensées d'abord pour le fond
 * nuit (#0b0c10) — le thème clair en dérive par assombrissement contrôlé.
 *
 * Règle commune : les sept teintes doivent se distinguer DEUX À DEUX dans
 * l'anneau du jour, où elles se touchent. D'où, dans chaque palette, une
 * seule teinte par famille (un violet, un bleu, un jaune…) et les deux
 * informatiques volontairement voisines mais séparées en luminosité : elles
 * restent deux matières, et leur parenté se voit.
 */
export const SUBJECT_PALETTES: SubjectPalette[] = [
  {
    id: "neon",
    label: "Néon",
    colors: {
      Mathématiques: "#a78bfa",
      Physique: "#38bdf8",
      Chimie: "#facc15",
      "Informatique TC": "#34d399",
      "Informatique Spé": "#2dd4bf",
      Français: "#fb923c",
      Anglais: "#f472b6",
    },
  },
  {
    /* Les mêmes familles que Néon, désaturées et éclaircies : pour qui
       trouve le néon trop vif le soir. */
    id: "pastel",
    label: "Pastel",
    colors: {
      Mathématiques: "#c4b5fd",
      Physique: "#93c5fd",
      Chimie: "#fde68a",
      "Informatique TC": "#86efac",
      "Informatique Spé": "#99f6e4",
      Français: "#fdba74",
      Anglais: "#f9a8d4",
    },
  },
  {
    /* Chaud dominant, avec un indigo et un violet pour ancrer le haut du
       ciel — sans eux, sept teintes chaudes se confondent dans l'anneau. */
    id: "sunset",
    label: "Sunset",
    colors: {
      Mathématiques: "#818cf8",
      Physique: "#c084fc",
      Chimie: "#fde047",
      "Informatique TC": "#fb923c",
      "Informatique Spé": "#f87171",
      Français: "#f472b6",
      Anglais: "#fed7aa",
    },
  },
  {
    /* Froid dominant : bleus, verts d'eau, un sable et un corail pour les
       matières littéraires, qu'on repère ainsi d'un coup d'œil. */
    id: "ocean",
    label: "Océan",
    colors: {
      Mathématiques: "#60a5fa",
      Physique: "#22d3ee",
      Chimie: "#fcd34d",
      "Informatique TC": "#4ade80",
      "Informatique Spé": "#a78bfa",
      Français: "#fb7185",
      Anglais: "#f0abfc",
    },
  },
];

export const DEFAULT_SUBJECT_PALETTE: SubjectPaletteId = "neon";
export const SUBJECT_PALETTE_IDS: SubjectPaletteId[] = SUBJECT_PALETTES.map((palette) => palette.id);

/** Surcharges par matière — seules les matières réellement surchargées sont présentes. */
export type SubjectColorOverrides = Partial<Record<Subject, string>>;

export function isSubjectPaletteId(value: unknown): value is SubjectPaletteId {
  return typeof value === "string" && (SUBJECT_PALETTE_IDS as string[]).includes(value);
}

export function paletteById(id: SubjectPaletteId): SubjectPalette {
  return SUBJECT_PALETTES.find((palette) => palette.id === id) ?? SUBJECT_PALETTES[0];
}

/**
 * Nettoie des surcharges lues depuis le disque ou une sauvegarde : seules les
 * matières connues, avec un hex valide (validé par le MÊME analyseur que
 * celui qui l'appliquera), passent. Tout le reste est ignoré sans bruit —
 * une surcharge corrompue ne doit jamais faire tomber la palette entière.
 */
export function normalizeSubjectColorOverrides(raw: unknown): SubjectColorOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const out: SubjectColorOverrides = {};
  for (const subject of subjects) {
    const value = source[subject];
    if (typeof value === "string" && hexToRgb(value)) out[subject] = value.trim().toLowerCase().replace(/^#?/, "#");
  }
  return out;
}

/** La couleur effective de chaque matière : la surcharge si elle existe, sinon la palette. */
export function resolveSubjectColors(paletteId: SubjectPaletteId, overrides: SubjectColorOverrides = {}): Record<Subject, string> {
  const palette = paletteById(paletteId);
  const clean = normalizeSubjectColorOverrides(overrides);
  return Object.fromEntries(subjects.map((subject) => [subject, clean[subject] ?? palette.colors[subject]])) as Record<Subject, string>;
}

/*
 * Plafonds de luminance du thème clair.
 *
 * SOFT 0,28 : un aplat de cette luminance tient 3:1 sur du blanc — le seuil
 * WCAG pour un élément graphique porteur de sens (barre, segment) —, avec
 * une marge pour l'arrondi des canaux (0,30 tombait à 2,996:1). Le jaune
 * néon, à 0,64, était un trait quasi invisible sur une carte blanche.
 *
 * DEEP 0,13 : le texte de la pastille se pose sur un fond teinté à ~18 %
 * au-dessus du blanc ou du #f4f5f7 ; la luminance de ce fond descend jusqu'à
 * ~0,80 pour les teintes les plus soutenues. 0,13 donne ≥ 4,5:1 dans le pire
 * cas (vérifié par lib/subject-colors.test.ts).
 */
export const SOFT_MAX_LUMINANCE = 0.28;
export const DEEP_MAX_LUMINANCE = 0.13;

/** Valeurs `r g b` (format des variables CSS du projet) à écrire sur la racine, pour une configuration donnée. */
export function subjectColorVariables(paletteId: SubjectPaletteId, overrides: SubjectColorOverrides = {}): Record<string, string> {
  const colors = resolveSubjectColors(paletteId, overrides);
  const vars: Record<string, string> = {};
  for (const subject of subjects) {
    const key = SUBJECT_KEYS[subject];
    const rgb = hexToRgb(colors[subject]) as [number, number, number];
    vars[`--subj-${key}-raw`] = rgb.join(" ");
    vars[`--subj-${key}-soft`] = darkenTo(rgb, SOFT_MAX_LUMINANCE).join(" ");
    vars[`--subj-${key}-deep`] = darkenTo(rgb, DEEP_MAX_LUMINANCE).join(" ");
  }
  return vars;
}

/** Écrit les variables sur `root` — utilisé par `ThemeSync` et le sélecteur de couleurs ; le script anti-flash (app/layout.tsx) en est la copie sans module. */
export function applySubjectColors(
  paletteId: SubjectPaletteId,
  overrides: SubjectColorOverrides = {},
  root: HTMLElement = document.documentElement
): void {
  for (const [name, value] of Object.entries(subjectColorVariables(paletteId, overrides))) root.style.setProperty(name, value);
}

/** Couleur CSS de REMPLISSAGE d'une matière (thème-aware) — pour un `style`, un `stroke` SVG. */
export function subjectFill(subject: Subject, alpha?: number): string {
  const key = SUBJECT_KEYS[subject];
  return alpha === undefined ? `rgb(var(--subj-${key}))` : `rgb(var(--subj-${key}) / ${alpha})`;
}
