import type { Subject } from "@/lib/supabase/types";

/**
 * MATIÈRES ET COULEUR — refonte « Apple » : il n'y en a plus.
 *
 * La refonte « Nuit » donnait à chaque matière sa teinte (violet pour les
 * maths, jaune pour la chimie…), réglable par palette (« Néon », « Pastel »,
 * « Sunset », « Océan ») et matière par matière. L'élève l'a jugée
 * « bizarre, pas premium », et a tranché : noir et blanc, plus UN accent.
 * Sept teintes de plus, c'était sept accents de trop.
 *
 * Ce qui reste :
 *
 *   — une CLÉ courte par matière, suffixe des variables CSS `--subj-<clé>`
 *     et des classes Tailwind `bg-subj-<clé>` (lib/study.ts#subjectMeta) ;
 *   — des PALIERS DE GRIS derrière ces variables (app/globals.css) : sept
 *     marches régulières, pour que deux segments voisins d'une colonne
 *     empilée se séparent. La matière se reconnaît à son NOM, toujours
 *     écrit à côté ; le gris ne fait que découper.
 *
 * Plus rien n'est réglable, donc plus rien n'est écrit sur `<html>` depuis
 * JavaScript : les paliers vivent dans la feuille de style et s'inversent
 * avec le thème comme n'importe quel neutre. Les anciennes préférences
 * (`subjectPalette`, `subjectColors`) sont ignorées à la lecture — voir
 * lib/storage.ts#normalizePreferences.
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

/** Palier de gris d'une matière (thème-aware) — pour un `style`, un `stroke` SVG. */
export function subjectFill(subject: Subject, alpha?: number): string {
  const key = SUBJECT_KEYS[subject];
  return alpha === undefined ? `rgb(var(--subj-${key}))` : `rgb(var(--subj-${key}) / ${alpha})`;
}
