import { subjects } from "@/lib/study";
import type { ReviewItem, ReviewKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * CARNET « À REVOIR » — noter en cinq secondes ce qu'il faudra reprendre.
 *
 * Modèle pur (création, cochage, suppression, tri, comptes) : la persistance
 * vit dans lib/storage.ts, la réactivité dans hooks/use-prepahub-data.ts —
 * même contrat que lib/grades.ts et lib/quick-log.ts. Aucune dépendance à
 * localStorage, React ou au DOM.
 *
 * LE BUDGET EST LE TEMPS DE SAISIE. Tout le suivi quotidien doit tenir en
 * trois à cinq minutes, sinon l'élève l'abandonne au bout d'une semaine. Une
 * entrée se réduit donc à ce qu'on tape (une ligne), où ça va (une matière,
 * retenue d'une fois sur l'autre) et ce que c'est (une nature, « à revoir »
 * par défaut). Pas de chapitre, pas de date, pas de priorité : chacun de ces
 * champs serait une décision de plus au moment précis où l'on veut seulement
 * noter et retourner au corrigé.
 *
 * LES MÉTHODES NE SE « FONT » PAS. « Revoir l'IPP » est une tâche : une fois
 * revue, elle n'a plus rien à faire sous les yeux. Une cartouche
 * (« suite convergente → monotone bornée ») est l'inverse : c'est une fiche
 * qu'on RELIT avant chaque DS, toute l'année. La traiter comme une tâche — la
 * cocher, la voir disparaître — détruirait exactement ce qu'elle est censée
 * construire : un recueil de méthodes par matière.
 *
 * Le choix retenu, et pourquoi :
 *
 *   — une méthode se coche « MAÎTRISÉE », pas « faite ». Le même champ
 *     `doneAt` porte l'information (un seul champ, une seule règle de
 *     sauvegarde), mais l'interface le dit autrement ;
 *   — maîtrisée, elle quitte les listes de TRAVAIL (l'accueil, « ouvertes »),
 *     parce qu'il n'y a plus rien à y faire aujourd'hui ;
 *   — mais elle RESTE dans la liste des cartouches de sa matière (le hub,
 *     /revoir filtré sur « méthodes »), simplement marquée. Le recueil ne
 *     rétrécit jamais tout seul : seule une suppression explicite en retire
 *     une ligne.
 *
 * On a écarté « archiver » : un troisième état (ouverte / maîtrisée /
 * archivée) pour une ligne de texte, c'est une décision de trop à chaque
 * cochage, et il n'aurait rien dit de plus que « maîtrisée ».
 */

/** Au-delà, ce n'est plus une note mais un paragraphe — sa place est dans le cahier, et une liste de lignes cesse d'être lisible d'un coup d'œil. */
export const REVIEW_TEXT_MAX = 200;

/**
 * `filter` : l'étiquette du filtre de /revoir, sans article — quatre options
 * (« Tout » compris) doivent tenir sur un téléphone de 375 px, et
 * « À apprendre » y était coupé en « À apprend… ».
 */
export const REVIEW_KIND_META: Record<ReviewKind, { label: string; filter: string; done: string; placeholder: string }> = {
  "à revoir": {
    label: "À revoir",
    filter: "Revoir",
    done: "Revu",
    placeholder: "Revoir intégration par parties",
  },
  "à apprendre": {
    label: "À apprendre",
    filter: "Apprendre",
    done: "Appris",
    placeholder: "Apprendre les formules de trigo",
  },
  méthode: {
    label: "Méthode",
    filter: "Méthodes",
    done: "Maîtrisée",
    placeholder: "Suite convergente → monotone bornée",
  },
};

export interface NewReviewItemInput {
  subject: Subject;
  text: string;
  kind: ReviewKind;
}

/**
 * Texte saisi ramené à une ligne exploitable, ou `null`.
 *
 * Les retours à la ligne (un collage depuis un PDF de corrigé) deviennent des
 * espaces : une entrée est une LIGNE. Au-delà de `REVIEW_TEXT_MAX`, on
 * refuse plutôt que de couper en silence — l'interface borne déjà le champ,
 * donc ce cas ne vient que d'un appel direct, et une note tronquée au milieu
 * d'un mot est pire qu'une note refusée.
 */
export function sanitizeReviewText(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > REVIEW_TEXT_MAX) return null;
  return text;
}

export function createReviewItem(input: NewReviewItemInput, now: Date = new Date()): ReviewItem | null {
  const text = sanitizeReviewText(input.text);
  if (text === null) return null;
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    text,
    kind: input.kind,
    createdAt: now.toISOString(),
    doneAt: null,
  };
}

export function isOpen(item: ReviewItem): boolean {
  return item.doneAt === null;
}

/** Coche ou décoche — le même geste pour « revu », « appris » et « maîtrisée ». Voir l'en-tête pour ce que cela veut dire d'une méthode. */
export function toggleReviewItem(items: ReviewItem[], id: string, now: Date = new Date()): ReviewItem[] {
  return items.map((item) => (item.id === id ? { ...item, doneAt: item.doneAt === null ? now.toISOString() : null } : item));
}

/** Une entrée SE SUPPRIME (faute de frappe, ligne devenue inutile) — voir `localData.saveReviewItems`, qui remplace au lieu de fusionner. */
export function removeReviewItem(items: ReviewItem[], id: string): ReviewItem[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Ouvertes d'abord, puis les plus récentes.
 *
 * Parmi les ouvertes, la plus récemment NOTÉE en tête : c'est celle qu'on
 * vient de taper, et la voir apparaître en haut est le seul accusé de
 * réception dont une saisie de cinq secondes a besoin. Parmi les cochées, la
 * plus récemment COCHÉE en tête — c'est elle qu'on voudrait décocher après
 * un doigt qui a glissé.
 */
export function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    if (!isOpen(a) && !isOpen(b)) return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export interface ReviewFilter {
  subject?: Subject | null;
  kind?: ReviewKind | null;
  /** `true` : seulement les ouvertes. `false`/absent : toutes. */
  openOnly?: boolean;
}

/** Filtre puis trie — le seul point d'entrée des listes affichées, pour qu'aucun écran ne trie à sa façon. */
export function selectReviewItems(items: ReviewItem[], filter: ReviewFilter = {}): ReviewItem[] {
  return sortReviewItems(
    items.filter(
      (item) =>
        (!filter.subject || item.subject === filter.subject) &&
        (!filter.kind || item.kind === filter.kind) &&
        (!filter.openOnly || isOpen(item))
    )
  );
}

/**
 * Les cartouches d'une matière — TOUTES, maîtrisées comprises : c'est un
 * recueil, pas une liste de tâches (voir l'en-tête). Les non maîtrisées
 * d'abord, parce que ce sont elles qu'on relit.
 */
export function methodsFor(items: ReviewItem[], subject: Subject): ReviewItem[] {
  return selectReviewItems(items, { subject, kind: "méthode" });
}

export interface SubjectReviewCount {
  subject: Subject;
  open: number;
  total: number;
}

/**
 * Entrées ouvertes et totales par matière, dans l'ordre canonique des
 * matières (lib/study.ts) — jamais trié par volume : un filtre dont les
 * boutons changent de place à chaque saisie ne se retrouve plus au pouce.
 * Seules les matières qui ont au moins une entrée sont renvoyées.
 */
export function countBySubject(items: ReviewItem[]): SubjectReviewCount[] {
  return subjects
    .map((subject) => {
      const scoped = items.filter((item) => item.subject === subject);
      return { subject, open: scoped.filter(isOpen).length, total: scoped.length };
    })
    .filter((entry) => entry.total > 0);
}

/** Mémoire de la dernière matière choisie : la saisie du soir porte presque toujours sur la matière du corrigé qu'on vient de disséquer. */
export const REVIEW_MEMORY_KEY = "prepahub:review:last-subject";

export function parseReviewMemory(raw: string | null): Subject | null {
  return raw && (subjects as string[]).includes(raw) ? (raw as Subject) : null;
}
