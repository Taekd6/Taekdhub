import data from "@/data/referentiel-index.json";
import { foldText } from "@/lib/annales";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import { REFERENTIEL_DECK_CHAPTERS } from "@/lib/referentiel-decks";

/**
 * RECHERCHE DANS LE RÉFÉRENTIEL (3 423 cartes rédigées de notre main, scripts/referentiel).
 *
 * Lecture seule, côté serveur (outil MCP `chercher_referentiel`). L'index (`data/referentiel-index.json`) est généré par
 * `python3 scripts/referentiel/referentiel.py index` ; lib/referentiel-search.test.ts échoue s'il diverge des `.jsonl`.
 *
 * HONNÊTETÉ. Une carte n'a que les sources QUI ONT ÉTÉ LUES à sa production (identifiants du registre
 * `referentiel/sources*.json`) : jamais de page ni de section — on le dit. Aucun résultat → on le dit, sans rien inventer.
 * Les cartes sont des reformulations : ce ne sont pas des extraits de cours protégés.
 */

export interface RefCard {
  id: string;
  /** Identifiant du chapitre du référentiel (dernier segment du paquet Anki). */
  c: string;
  /** Matière : Mathématiques, Physique, Chimie, Informatique. */
  m: string;
  g: string;
  t: string;
  r: string;
  v: string;
  /** Identifiants des sources lues citées par la carte (vide : vérifiée par raisonnement seulement). */
  s: string[];
  e: "confirmé" | "à confirmer";
}

export interface RefSource {
  titre: string;
  auteur: string;
  url: string;
  type: string;
}

export interface RefIndex {
  cartes: RefCard[];
  sources: Record<string, RefSource>;
}

export const REFERENTIEL_INDEX: RefIndex = data as RefIndex;

export const REFERENTIEL_LIMIT_DEFAULT = 8;
export const REFERENTIEL_LIMIT_MAX = 25;

export interface RefQuery {
  /** Mots-clés (« théorème spectral », « effet de peau »). */
  q?: string;
  /** Matière du référentiel (Mathématiques, Physique, Chimie…). */
  matiere?: string | null;
  /** Chapitre du programme TaekdHub (ex. m2-reduction) : les paquets du référentiel qui lui sont rattachés. */
  chapterId?: string | null;
  /** Identifiant d'un chapitre du référentiel (ex. reduction). */
  chapitre?: string | null;
  type?: string | null;
  limit?: number;
}

export interface RefHit {
  id: string;
  matiere: string;
  chapitre: string;
  /** Chapitre du programme TaekdHub, quand le rattachement est sans ambiguïté. */
  programme: { id: string; titre: string } | null;
  groupe: string;
  type: string;
  recto: string;
  verso: string;
  /** « confirmé » : figure dans le programme officiel lu ou un cours lu ; sinon « à confirmer ». */
  exigibilite: string;
  /** Sources lues citées par cette carte ; vide = vérifiée par raisonnement, sans source lue. */
  sources: { id: string; titre: string; auteur: string; url: string }[];
}

export interface RefResult {
  total: number;
  affiches: number;
  resultats: RefHit[];
  avertissements: string[];
}

const STOP = new Set(["de", "du", "des", "la", "le", "les", "un", "une", "et", "en", "au", "aux", "sur", "pour", "que", "qui", "est", "dans", "par", "ou", "a"]);

/** Au plus 12 mots : au-delà, la requête n'est plus une recherche mais un texte collé. */
const MAX_WORDS = 12;

function tokens(text: string): string[] {
  return [...new Set(foldText(text).split(" ").filter((word) => word.length >= 2 && !STOP.has(word)))].slice(0, MAX_WORDS);
}

/** Textes repliés (sans accents ni casse) de chaque carte, calculés une fois : une recherche ne replie pas 3 400 cartes à chaque appel. */
const FOLDED = new WeakMap<RefCard, { recto: string; verso: string; where: string }>();

function folded(card: RefCard): { recto: string; verso: string; where: string } {
  let entry = FOLDED.get(card);
  if (!entry) {
    entry = { recto: ` ${foldText(card.r)}`, verso: ` ${foldText(card.v)}`, where: ` ${foldText(`${card.g} ${card.c.replace(/-/g, " ")}`)}` };
    FOLDED.set(card, entry);
  }
  return entry;
}

/** Un mot de la requête correspond au DÉBUT d'un mot du texte (« diagonalis » trouve « diagonalisable » ; « or » ne trouve plus « théorème »). */
const startsAWord = (text: string, word: string) => text.includes(` ${word}`);

function score(card: RefCard, words: string[]): { all: boolean; points: number } {
  const { recto, verso, where } = folded(card);
  let points = 0;
  let matched = 0;
  for (const word of words) {
    const inRecto = startsAWord(recto, word);
    const inVerso = startsAWord(verso, word);
    const inWhere = startsAWord(where, word);
    if (inRecto || inVerso || inWhere) matched += 1;
    points += (inRecto ? 3 : 0) + (inWhere ? 2 : 0) + (inVerso ? 1 : 0);
  }
  return { all: matched === words.length, points };
}

const NOTE_SOURCES =
  "Les sources citées sont celles qui ont été LUES lors de la production du référentiel (identifiant du registre, titre, url publique). Les pages et sections précises ne sont pas conservées : pour une page, il faut rouvrir le document. Une carte sans source lue est vérifiée par raisonnement seulement.";

export function searchReferentiel(query: RefQuery, index: RefIndex = REFERENTIEL_INDEX): RefResult {
  const limit = Math.min(REFERENTIEL_LIMIT_MAX, Math.max(1, Math.round(query.limit ?? REFERENTIEL_LIMIT_DEFAULT)));
  const avertissements: string[] = [];
  const words = query.q ? tokens(query.q) : [];
  const hasFilter = Boolean(query.matiere || query.chapterId || query.chapitre || query.type);
  if (words.length === 0 && !hasFilter) {
    return { total: 0, affiches: 0, resultats: [], avertissements: ["Requête vide ou sans mot exploitable (mots de moins de 2 lettres, mots vides, symboles) : donne des mots-clés (`q`) et/ou un filtre (`matiere`, `chapitre`, `type`). Rien n'a été cherché."] };
  }
  if (words.length === 0 && query.q?.trim()) {
    avertissements.push(`Aucun mot exploitable dans « ${query.q.trim().slice(0, 60)} » : seul le filtre a été appliqué, les cartes ne sont PAS classées par pertinence.`);
  }

  let pool = index.cartes;
  if (query.matiere) {
    const wanted = foldText(query.matiere);
    // Préfixe de 4 lettres (« maths », « Mathématiques », « physique-chimie »…) ; moins de 3 lettres : rien, plutôt qu'une matière devinée.
    pool = wanted.length < 3 ? [] : pool.filter((card) => foldText(card.m).slice(0, 4) === wanted.slice(0, 4));
  }
  if (query.chapterId) {
    const slugs = new Set(Object.entries(REFERENTIEL_DECK_CHAPTERS).filter(([, id]) => id === query.chapterId).map(([slug]) => slug));
    if (slugs.size === 0) avertissements.push(`Aucun paquet du référentiel n'est rattaché sans ambiguïté au chapitre « ${query.chapterId} » : filtre sans résultat.`);
    pool = pool.filter((card) => slugs.has(card.c));
  }
  if (query.chapitre) pool = pool.filter((card) => foldText(card.c) === foldText(query.chapitre!));
  if (query.type) pool = pool.filter((card) => foldText(card.t) === foldText(query.type!));

  let ranked: { card: RefCard; points: number }[];
  if (words.length === 0) {
    ranked = pool.map((card) => ({ card, points: 0 }));
  } else {
    const scored = pool.map((card) => ({ card, ...score(card, words) })).filter((entry) => entry.points > 0);
    const complete = scored.filter((entry) => entry.all);
    if (complete.length > 0) ranked = complete;
    else {
      ranked = scored;
      if (scored.length > 0) avertissements.push("Aucune carte ne contient TOUS les mots : résultats partiels (certains mots seulement), à vérifier avant de s'en servir.");
    }
    ranked.sort((a, b) => b.points - a.points || a.card.id.localeCompare(b.card.id, "fr", { numeric: true }));
  }

  if (ranked.length === 0) {
    avertissements.push("Aucune carte du référentiel ne correspond. N'invente ni carte ni source : dis à l'élève que le référentiel ne couvre pas ce point.");
  }
  const shown = ranked.slice(0, limit).map(({ card }): RefHit => {
    const programmeId = REFERENTIEL_DECK_CHAPTERS[card.c];
    const chapter = programmeId ? PROGRAMME_BY_ID.get(programmeId) : undefined;
    return {
      id: card.id,
      matiere: card.m,
      chapitre: card.c,
      programme: chapter ? { id: chapter.id, titre: chapter.title } : null,
      groupe: card.g,
      type: card.t,
      recto: card.r,
      verso: card.v,
      exigibilite: card.e,
      sources: card.s.filter((id) => id in index.sources).map((id) => ({ id, ...index.sources[id] })).map(({ titre, auteur, url, id }) => ({ id, titre, auteur, url })),
    };
  });
  if (ranked.length > shown.length) {
    avertissements.push(`Résultats tronqués : ${shown.length} cartes affichées sur ${ranked.length} trouvées. Précise la requête (chapitre, type, mots) ou augmente \`limite\` (max ${REFERENTIEL_LIMIT_MAX}) ; ne conclus pas à partir des seules cartes affichées.`);
  }
  if (shown.length > 0) {
    if (shown.some((hit) => hit.sources.length === 0)) avertissements.push("Certaines cartes n'ont aucune source lue (vérifiées par raisonnement seulement).");
    if (shown.some((hit) => hit.exigibilite !== "confirmé")) avertissements.push("Certaines cartes ont une exigibilité « à confirmer » (rappel de MPSI, hors programme ou absent des sources lues).");
    avertissements.push(NOTE_SOURCES);
  }
  return { total: ranked.length, affiches: shown.length, resultats: shown, avertissements };
}
