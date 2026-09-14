import type { Subject, SubjectTone } from "@/lib/domain/types";

/**
 * MATIÈRES — des données, pas un type union.
 *
 * L'ancienne application figeait sept matières dans le système de types : en
 * ajouter une demandait de toucher au code, et une matière renommée cassait
 * toutes les fiches qui la référençaient par son libellé. Ici une tâche
 * référence un `id` stable, et la liste vit dans l'état persistable.
 */

/** Teintes disponibles — clés, pas des hex : la palette réelle suit le thème (voir app/globals.css). */
export const SUBJECT_TONES: readonly SubjectTone[] = ["violet", "sky", "emerald", "teal", "amber", "orange", "rose"];

/** Classes de la pastille de matière, par teinte. Fond en faible opacité + texte à sa teinte pleine, lisible dans les deux thèmes. */
export const SUBJECT_TONE_CLASS: Record<SubjectTone, string> = {
  violet: "bg-violet-400/20 text-violet-200",
  sky: "bg-sky-400/20 text-sky-200",
  emerald: "bg-emerald-400/20 text-emerald-200",
  teal: "bg-teal-400/20 text-teal-200",
  amber: "bg-amber-400/20 text-amber-200",
  orange: "bg-orange-400/20 text-orange-200",
  rose: "bg-rose-400/20 text-rose-200",
};

/** Couleur de trait (barre de matière dans le calendrier, jauge du bilan). */
export const SUBJECT_TONE_BAR: Record<SubjectTone, string> = {
  violet: "bg-violet-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  teal: "bg-teal-400",
  amber: "bg-amber-400",
  orange: "bg-orange-400",
  rose: "bg-rose-400",
};

/**
 * Les matières d'une prépa scientifique, posées au premier lancement. Elles
 * sont MODIFIABLES et SUPPRIMABLES depuis les réglages : ce n'est qu'un point
 * de départ raisonnable, pour que l'élève n'ait pas à saisir six lignes avant
 * de créer sa première tâche.
 */
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "maths", label: "Mathématiques", short: "M", tone: "violet", order: 0 },
  { id: "physique", label: "Physique", short: "P", tone: "sky", order: 1 },
  { id: "chimie", label: "Chimie", short: "C", tone: "amber", order: 2 },
  { id: "info", label: "Informatique", short: "I", tone: "emerald", order: 3 },
  { id: "francais", label: "Français / Philosophie", short: "F", tone: "orange", order: 4 },
  { id: "anglais", label: "Anglais", short: "A", tone: "rose", order: 5 },
  { id: "autre", label: "Autre", short: "•", tone: "teal", order: 6 },
];

export function subjectById(subjects: Subject[], id: string | undefined): Subject | undefined {
  if (!id) return undefined;
  return subjects.find((subject) => subject.id === id);
}

export function subjectLabel(subjects: Subject[], id: string | undefined): string {
  return subjectById(subjects, id)?.label ?? "Sans matière";
}

/** Matières visibles dans les sélecteurs, dans l'ordre choisi par l'élève. */
export function activeSubjects(subjects: Subject[]): Subject[] {
  return subjects.filter((subject) => !subject.archived).sort((a, b) => a.order - b.order);
}

/**
 * Identifiant lisible dérivé du libellé (`Sciences de l'ingénieur` → `sciences-de-l-ingenieur`),
 * suffixé si nécessaire pour rester unique. Un `id` lisible rend une
 * sauvegarde JSON compréhensible à l'œil nu, ce qu'un UUID ne fait pas.
 */
export function subjectIdFromLabel(label: string, existing: Subject[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "matiere";
  if (!existing.some((subject) => subject.id === base)) return base;
  let index = 2;
  while (existing.some((subject) => subject.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/** Deux premières lettres significatives — proposition de pastille quand l'élève n'en saisit pas. */
export function shortFromLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "•";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}
