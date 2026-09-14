import type { CategoryFamily, TaskCategory } from "@/lib/domain/types";

/**
 * CATÉGORIES — quatre familles, et rien de décoratif.
 *
 * Chaque catégorie déclare :
 *   `family`     pour le regroupement dans les sélecteurs et le bilan ;
 *   `label`      le mot exact qu'un élève de prépa emploie ;
 *   `deadline`   « cette catégorie est une ÉCHÉANCE en soi » (un DS, une
 *                khôlle) : le calendrier la dessine comme un repère fixe et
 *                non comme du travail déplaçable, et la priorisation la traite
 *                comme un point dur (domain/priority.ts).
 *   `defaultMinutes` une estimation de départ crédible, pour que la création
 *                rapide ne demande pas de réfléchir à une durée.
 */
export interface CategoryMeta {
  family: CategoryFamily;
  label: string;
  deadline?: boolean;
  defaultMinutes: number;
}

export const CATEGORY_FAMILY_LABELS: Record<CategoryFamily, string> = {
  cours: "Cours",
  exercices: "Exercices",
  evaluations: "Évaluations",
  organisation: "Organisation",
};

export const CATEGORY_META: Record<TaskCategory, CategoryMeta> = {
  "cours-apprendre": { family: "cours", label: "Apprendre le cours", defaultMinutes: 45 },
  "cours-revoir": { family: "cours", label: "Revoir le cours", defaultMinutes: 30 },
  "cours-definitions": { family: "cours", label: "Définitions", defaultMinutes: 20 },
  "cours-theoremes": { family: "cours", label: "Théorèmes", defaultMinutes: 30 },
  "cours-demonstrations": { family: "cours", label: "Démonstrations", defaultMinutes: 45 },
  "exo-td": { family: "exercices", label: "TD", defaultMinutes: 60 },
  "exo-dm": { family: "exercices", label: "DM", defaultMinutes: 120 },
  "exo-annales": { family: "exercices", label: "Annales", defaultMinutes: 90 },
  "exo-personnels": { family: "exercices", label: "Exercices personnels", defaultMinutes: 45 },
  "exo-calcul": { family: "exercices", label: "Cahier de calcul", defaultMinutes: 30 },
  "exo-professeur": { family: "exercices", label: "Exercices du professeur", defaultMinutes: 60 },
  "eval-ds": { family: "evaluations", label: "DS", deadline: true, defaultMinutes: 240 },
  "eval-kholle": { family: "evaluations", label: "Khôlle", deadline: true, defaultMinutes: 60 },
  "eval-interro": { family: "evaluations", label: "Interrogation", deadline: true, defaultMinutes: 30 },
  "eval-concours-blanc": { family: "evaluations", label: "Concours blanc", deadline: true, defaultMinutes: 240 },
  "org-preparation": { family: "organisation", label: "Préparation", defaultMinutes: 45 },
  "org-correction": { family: "organisation", label: "Correction", defaultMinutes: 30 },
  "org-revision": { family: "organisation", label: "Révision", defaultMinutes: 45 },
  "org-bilan": { family: "organisation", label: "Bilan", defaultMinutes: 20 },
  "org-classement": { family: "organisation", label: "Classement / organisation", defaultMinutes: 20 },
  autre: { family: "organisation", label: "Autre", defaultMinutes: 30 },
};

export const CATEGORY_FAMILY_ORDER: readonly CategoryFamily[] = ["cours", "exercices", "evaluations", "organisation"];

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as TaskCategory[];

export function categoriesByFamily(family: CategoryFamily): TaskCategory[] {
  return ALL_CATEGORIES.filter((category) => CATEGORY_META[category].family === family);
}

export function categoryLabel(category: TaskCategory): string {
  return CATEGORY_META[category]?.label ?? CATEGORY_META.autre.label;
}

export function categoryFamily(category: TaskCategory): CategoryFamily {
  return CATEGORY_META[category]?.family ?? "organisation";
}

/** Une évaluation est un point FIXE du calendrier : elle ne se reporte pas, on s'y prépare. */
export function isDeadlineCategory(category: TaskCategory): boolean {
  return Boolean(CATEGORY_META[category]?.deadline);
}

export function isCategory(value: unknown): value is TaskCategory {
  return typeof value === "string" && value in CATEGORY_META;
}
