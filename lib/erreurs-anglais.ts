import data from "@/data/erreurs-anglais.json";

/**
 * MES ERREURS D'ANGLAIS (thème, concours CCMP) — des erreurs rangées par
 * catégorie, à relire puis à retrouver en mode révision (`/erreurs-anglais`).
 *
 * Rédigées une fois par séance dans `data/erreurs-anglais.json`, jamais en
 * dur dans un écran : ajouter une erreur = ajouter une ligne à `erreurs`,
 * ajouter une catégorie = une ligne à `categories`. Le format ne change pas.
 *
 *   categories  `id`, `nom`, `regle` (la règle qui évite l'erreur) ;
 *   erreurs     `date` (AAAA-MM-JJ), `source`, `categorie` (= un `id`),
 *               `francais`, `faux` (ma version), `correct`.
 *
 * Une erreur dont `categorie` ne correspond à aucun `id` (faute de frappe)
 * n'est PAS écartée : elle s'affiche dans un groupe « Catégorie inconnue »,
 * en dernier, pour que l'oubli se voie au lieu de faire disparaître l'erreur.
 *
 * Ce n'est pas le carnet d'erreurs de `/erreurs` (saisi dans l'application,
 * synchronisé) : ici le contenu vient du dépôt, rien n'est stocké ni envoyé.
 */

export interface ErreurCategorie {
  id: string;
  nom: string;
  regle: string;
}

export interface ErreurAnglais {
  /** Position dans le fichier : clé stable le temps d'une séance (mélange, cartes retournées). */
  id: number;
  date: string;
  source: string;
  categorie: string;
  francais: string;
  faux: string;
  correct: string;
}

export interface ErreurGroupe {
  categorie: ErreurCategorie;
  erreurs: ErreurAnglais[];
}

export const UNKNOWN_CATEGORY: ErreurCategorie = {
  id: "?",
  nom: "Catégorie inconnue",
  regle: "Ces erreurs renvoient à une catégorie absente de la liste : corriger leur `categorie` dans data/erreurs-anglais.json.",
};

type RawData = {
  eleve?: string;
  maj?: string;
  categories: ErreurCategorie[];
  erreurs: Omit<ErreurAnglais, "id">[];
};

const raw = data as unknown as RawData;

export const ERREURS_MAJ: string | null = raw.maj ?? null;
export const ERREURS_CATEGORIES: ErreurCategorie[] = raw.categories;
export const ERREURS_ANGLAIS: ErreurAnglais[] = raw.erreurs.map((erreur, id) => ({ ...erreur, id }));

/**
 * Les erreurs rangées par catégorie, dans l'ordre des catégories du fichier ;
 * dans un groupe, la plus récente d'abord (à date égale, l'ordre du fichier).
 * Une catégorie sans erreur n'a pas de groupe.
 */
export function groupByCategory(categories: ErreurCategorie[], erreurs: ErreurAnglais[]): ErreurGroupe[] {
  const known = new Set(categories.map((categorie) => categorie.id));
  const newestFirst = (a: ErreurAnglais, b: ErreurAnglais) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id - b.id);

  const groups: ErreurGroupe[] = categories
    .map((categorie) => ({ categorie, erreurs: erreurs.filter((erreur) => erreur.categorie === categorie.id).sort(newestFirst) }))
    .filter((group) => group.erreurs.length > 0);

  const orphans = erreurs.filter((erreur) => !known.has(erreur.categorie)).sort(newestFirst);
  if (orphans.length > 0) groups.push({ categorie: UNKNOWN_CATEGORY, erreurs: orphans });
  return groups;
}

/** Les erreurs d'une catégorie (`null` = toutes). L'identifiant inconnu (`?`) filtre les orphelines. */
export function filterByCategory(categories: ErreurCategorie[], erreurs: ErreurAnglais[], categoryId: string | null): ErreurAnglais[] {
  if (categoryId === null) return erreurs;
  if (categoryId === UNKNOWN_CATEGORY.id) {
    const known = new Set(categories.map((categorie) => categorie.id));
    return erreurs.filter((erreur) => !known.has(erreur.categorie));
  }
  return erreurs.filter((erreur) => erreur.categorie === categoryId);
}

/** Un ordre au hasard (Fisher-Yates) des identifiants : une permutation, jamais un tirage avec remise. `random` est injectable pour les tests. */
export function shuffledOrder(ids: number[], random: () => number = Math.random): number[] {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Les erreurs dans l'ordre donné ; celles que l'ordre ne mentionne pas (ajoutées depuis) passent à la fin. */
export function sortByOrder(erreurs: ErreurAnglais[], order: number[]): ErreurAnglais[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...erreurs].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.id - b.id);
}

/** « 24 octobre 2026 » ; une date illisible est rendue telle quelle plutôt que masquée. */
export function formatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
