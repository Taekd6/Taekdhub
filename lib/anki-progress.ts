import { ANKI_DUE_STALE_HOURS, latestFullSnapshot, snapshotAgeHours, type AnkiDeckStat, type AnkiSnapshot } from "@/lib/anki-snapshot";
import { mapDecks } from "@/lib/anki-mapping";

/**
 * AI-JE AVANCÉ ? — ce que le dernier relevé Anki dit des CARTES APPRISES.
 *
 * Trois faits par paquet, tous venus d'Anki : les cartes NOUVELLES vues cette semaine
 * (apprises), les cartes révisées, et la part de ces dernières où « À revoir » n'a PAS
 * été pressé. Un quatrième, entre deux relevés : les cartes « mûres » (intervalle de
 * 21 jours ou plus), celles que l'élève retient vraiment.
 *
 * CE N'EST PAS UNE MESURE DE COMPÉTENCE. Le taux ci-dessous est la part des cartes
 * révisées sans « À revoir » (pas la rétention exacte d'Anki), et les seuils sont
 * PROVISOIRES : à ajuster avec l'usage. Aucune note globale n'est produite : des
 * chiffres, un mot par paquet, une phrase qui les cite.
 *
 * Fonctions pures. Aucun accès à Anki : tout vient du relevé déjà enregistré.
 */

/** En dessous, la part sans « À revoir » ne dit rien : trop peu de cartes révisées. */
export const PROGRESS_MIN_REVIEWED = 10;
/** Au moins cette part de cartes sans « À revoir » : « solide ». */
export const PROGRESS_SOLID = 0.8;
/** En dessous de cette part : « fragile ». */
export const PROGRESS_FRAGILE = 0.7;

export type DeckVerdict = "solide" | "moyen" | "fragile" | "peu" | "calme";

export const DECK_VERDICT_LABEL: Record<DeckVerdict, string> = {
  solide: "Solide",
  moyen: "Correct",
  fragile: "Fragile",
  peu: "Trop peu pour juger",
  calme: "Rien cette semaine",
};

export interface DeckProgress {
  deck: string;
  /** Chapitre du programme, seulement si l'association est sûre. */
  chapterId: string | null;
  reviewed7: number;
  failed7: number;
  introduced7: number;
  reviewedToday: number;
  introducedToday: number;
  /** Part des cartes révisées sans « À revoir », ou `null` sous `PROGRESS_MIN_REVIEWED`. */
  keptRate: number | null;
  verdict: DeckVerdict;
}

export interface AnkiProgress {
  /** `false` : le relevé n'a pas l'activité récente (ancien relevé, ou Anki trop ancien). */
  available: boolean;
  takenAt: string | null;
  /** Le relevé a plus de 24 h : ce qui a été fait depuis n'y est pas. */
  stale: boolean;
  totals: { reviewed7: number; introduced7: number; reviewedToday: number; introducedToday: number; keptRate: number | null };
  decks: DeckProgress[];
  /** Variation des cartes mûres depuis un relevé plus ancien, ou `null` sans point de comparaison. */
  matureChange: { delta: number; since: string } | null;
  /** Les faits, en phrases, dans l'ordre où on les lit. */
  lines: string[];
  /** UNE phrase qui cite les chiffres ; jamais une note. */
  sentence: string;
}

const hasRecent = (deck: AnkiDeckStat): boolean => deck.reviewed7 !== undefined && deck.introduced7 !== undefined;

function verdictFor(reviewed7: number, introduced7: number, keptRate: number | null): DeckVerdict {
  if (reviewed7 === 0 && introduced7 === 0) return "calme";
  if (keptRate === null) return "peu";
  if (keptRate < PROGRESS_FRAGILE) return "fragile";
  if (keptRate >= PROGRESS_SOLID) return "solide";
  return "moyen";
}

/** « 2026-10-11 » → « 11 octobre ». */
const frenchDay = (day: string): string => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00`));

const percent = (value: number): string => `${Math.round(value * 100)} %`;
const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const EMPTY_TOTALS = { reviewed7: 0, introduced7: 0, reviewedToday: 0, introducedToday: 0, keptRate: null };

export function computeAnkiProgress(snapshots: AnkiSnapshot[], overrides: Record<string, string | null>, now: Date): AnkiProgress {
  const latest = latestFullSnapshot(snapshots);
  if (!latest) {
    return { available: false, takenAt: null, stale: false, totals: EMPTY_TOTALS, decks: [], matureChange: null, lines: [], sentence: "Aucun relevé Anki par paquet : fais-en un depuis l'ordinateur, Anki ouvert." };
  }
  const stale = snapshotAgeHours(latest.takenAt, now) > ANKI_DUE_STALE_HOURS;
  const measured = latest.decks.filter(hasRecent);
  if (measured.length === 0) {
    return {
      available: false,
      takenAt: latest.takenAt,
      stale,
      totals: EMPTY_TOTALS,
      decks: [],
      matureChange: null,
      lines: [],
      sentence: "Ce relevé ne contient pas l'activité des 7 derniers jours : refais un relevé depuis l'ordinateur (Anki ouvert) pour voir ce que tu as appris.",
    };
  }

  const chapterOf = new Map(mapDecks(latest.decks.map((deck) => deck.name), overrides).map((mapping) => [mapping.deck, mapping.chapterId]));
  const decks: DeckProgress[] = measured
    .map((deck) => {
      const reviewed7 = deck.reviewed7 ?? 0;
      const failed7 = Math.min(deck.failed7 ?? 0, reviewed7);
      const introduced7 = deck.introduced7 ?? 0;
      const keptRate = reviewed7 >= PROGRESS_MIN_REVIEWED ? (reviewed7 - failed7) / reviewed7 : null;
      return {
        deck: deck.name,
        chapterId: chapterOf.get(deck.name) ?? null,
        reviewed7,
        failed7,
        introduced7,
        reviewedToday: deck.reviewedToday ?? 0,
        introducedToday: deck.introducedToday ?? 0,
        keptRate,
        verdict: verdictFor(reviewed7, introduced7, keptRate),
      };
    })
    .sort((a, b) => b.reviewed7 + b.introduced7 - (a.reviewed7 + a.introduced7) || a.deck.localeCompare(b.deck));

  const sum = (pick: (deck: DeckProgress) => number) => decks.reduce((total, deck) => total + pick(deck), 0);
  const reviewed7 = sum((deck) => deck.reviewed7);
  const failed7 = sum((deck) => deck.failed7);
  const totals = {
    reviewed7,
    introduced7: sum((deck) => deck.introduced7),
    reviewedToday: sum((deck) => deck.reviewedToday),
    introducedToday: sum((deck) => deck.introducedToday),
    keptRate: reviewed7 >= PROGRESS_MIN_REVIEWED ? (reviewed7 - failed7) / reviewed7 : null,
  };

  // Comparaison : le plus ancien relevé complet, d'un autre jour, dans la fenêtre gardée.
  const earlier = snapshots
    .filter((entry) => entry.source !== "manuel" && entry.day < latest.day)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0];
  // Seuls les paquets présents aux DEUX relevés comptent : un paquet apparu entre-temps gonflerait la variation.
  const earlierMature = earlier ? new Map(earlier.decks.map((deck) => [deck.name, deck.mature])) : null;
  const common = earlierMature ? latest.decks.filter((deck) => earlierMature.has(deck.name)) : [];
  const matureChange =
    earlier && earlierMature && common.length > 0
      ? { delta: common.reduce((total, deck) => total + deck.mature - (earlierMature.get(deck.name) ?? 0), 0), since: earlier.day }
      : null;

  const lines: string[] = [
    `Cette semaine : ${plural(totals.reviewed7, "carte révisée", "cartes révisées")}, ${plural(totals.introduced7, "carte nouvelle apprise", "cartes nouvelles apprises")}.`,
    `Aujourd'hui (d'après le relevé) : ${plural(totals.reviewedToday, "carte révisée", "cartes révisées")}, ${plural(totals.introducedToday, "nouvelle", "nouvelles")}.`,
    totals.keptRate === null
      ? `Moins de ${PROGRESS_MIN_REVIEWED} cartes révisées cette semaine : trop peu pour parler de ce que tu retiens.`
      : `${percent(totals.keptRate)} des cartes révisées cette semaine sont passées sans « À revoir ».`,
  ];
  if (matureChange) {
    const { delta, since } = matureChange;
    lines.push(`Cartes mûres (intervalle de 21 jours ou plus) : ${delta > 0 ? `+${delta}` : delta === 0 ? "aucun changement" : `${delta}`} depuis le relevé du ${frenchDay(since)}.`);
  }
  if (stale) lines.push("Ce relevé a plus de 24 h : ce que tu as fait depuis n'y figure pas. Refais un relevé.");

  let sentence: string;
  if (totals.reviewed7 === 0 && totals.introduced7 === 0) sentence = "Aucune activité Anki relevée cette semaine.";
  else if (totals.keptRate === null) sentence = `Peu d'activité cette semaine (${plural(totals.reviewed7, "carte révisée", "cartes révisées")}) : continue avant de juger.`;
  else if (totals.keptRate >= PROGRESS_SOLID) sentence = `Tu avances solidement : ${percent(totals.keptRate)} des cartes révisées passent sans « À revoir », et ${plural(totals.introduced7, "nouvelle carte apprise", "nouvelles cartes apprises")}.`;
  else if (totals.keptRate < PROGRESS_FRAGILE) sentence = `Beaucoup d'oublis cette semaine (${percent(1 - totals.keptRate)} des cartes révisées ont reçu « À revoir ») : avant d'ajouter des cartes, consolide celles qui reviennent.`;
  else sentence = `Progression correcte : ${percent(totals.keptRate)} des cartes passent sans « À revoir ». Les paquets « fragiles » ci-dessous sont ceux à reprendre en premier.`;

  return { available: true, takenAt: latest.takenAt, stale, totals, decks, matureChange, lines, sentence };
}
