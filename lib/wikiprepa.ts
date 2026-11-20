/**
 * LECTURE DES PAGES DE CHAPITRE WIKIPREPA (onglet « Classiques » d'Exos).
 *
 * Wikiprepa n'a ni compte ni API : la page d'un chapitre
 * (`/concours/chapitre/<slug>`) affiche des cartes de questions — « CCINP
 * Physique-Chimie MP 2021, Q21 », badge « Incontournable », temps estimé,
 * difficulté — chacune avec un lien vers `…/corrige#qN`. On lit la page
 * côté serveur (route `app/api/wikiprepa`), on la réduit à du texte où
 * chaque lien de question devient un repère, et le texte de chaque carte
 * est ce qui précède son repère. Rien n'est recopié en base : seules les
 * questions que l'élève coche entrent dans son catalogue.
 */

export interface WikiQuestion {
  /** Adresse du corrigé sans ancre, ex. https://wikiprepa.fr/concours/ecrit/ccinp_physique-chimie_mp_2021/corrige */
  paper: string;
  /** Identifiant d'épreuve, ex. ccinp_physique-chimie_mp_2021 */
  slug: string;
  question: string;
  url: string;
  /** « CCINP Physique-Chimie MP 2021 » */
  titre: string;
  filiere: string;
  annee: number | null;
  incontournable: boolean;
  minutes: number | null;
  difficulte: string | null;
}

export const WIKI_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WIKI_BASE = "https://wikiprepa.fr";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", hellip: "…" };

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

const MARK = "\u0001";

/** Une page HTML → les questions de concours qu'elle relie (une par couple épreuve/question). */
export function parseWikiChapter(html: string): WikiQuestion[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*?href="((?:https?:\/\/(?:www\.)?wikiprepa\.fr)?\/concours\/ecrit\/([a-z0-9_-]+)\/corrige#q(\d+))"[^>]*>/gi, (_, _href: string, slug: string, q: string) => `${MARK}${slug}#${q}${MARK} `)
    .replace(/<[^>]+>/g, " ");
  const parts = decode(body).split(MARK);
  const out: WikiQuestion[] = [];
  const seen = new Set<string>();
  // parts : [texte, repère, texte, repère, …] — le texte avant un repère est sa carte.
  for (let i = 1; i < parts.length; i += 2) {
    const [slug, question] = parts[i].split("#");
    const key = `${slug}#${question}`;
    const card = (parts[i - 1] ?? "").replace(/\s+/g, " ").trim().slice(-1500);
    const prior = seen.has(key);
    const meta = describeCard(card, slug);
    if (prior) {
      // La même question peut être reliée deux fois (titre et bouton) : on garde la carte la plus riche.
      const existing = out.find((item) => `${item.slug}#${item.question}` === key);
      if (existing && meta.incontournable) existing.incontournable = true;
      if (existing && !existing.minutes && meta.minutes) existing.minutes = meta.minutes;
      if (existing && !existing.difficulte && meta.difficulte) existing.difficulte = meta.difficulte;
      continue;
    }
    seen.add(key);
    const paper = `${WIKI_BASE}/concours/ecrit/${slug}/corrige`;
    out.push({ paper, slug, question, url: `${paper}#q${question}`, ...meta });
  }
  return out;
}

const CONCOURS: Record<string, string> = { ccinp: "CCINP", centrale: "CentraleSupélec", mines: "Mines-Ponts", "x-ens": "X-ENS", ens: "ENS", e3a: "E3A", "banque-pt": "Banque PT", enac: "ENAC", "mines-telecom": "Mines-Télécom", x: "X" };

/** « ccinp_physique-chimie_mp_2021 » → « CCINP Physique-Chimie MP 2021 ». */
export function paperTitle(slug: string): { titre: string; filiere: string; annee: number | null } {
  const [concours = "", epreuve = "", filiere = "", year = ""] = slug.split("_");
  const name = CONCOURS[concours] ?? concours.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const ep = epreuve
    .split("-")
    .map((word) => (/^\d+$/.test(word) || word.length <= 1 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("-")
    .replace(/-(\d|[A-Z])$/, " $1")
    .replace(/-Qcm$/i, " QCM");
  const annee = Number(year) || null;
  return { titre: [name, ep, filiere.toUpperCase(), year].filter(Boolean).join(" "), filiere: filiere.toUpperCase(), annee };
}

function describeCard(chunk: string, slug: string) {
  const base = paperTitle(slug);
  // Le texte du lien de la carte précédente (« Indice et corrigé de …, Qn ») ouvre le morceau : on ne garde que ce qui suit.
  const cut = chunk.lastIndexOf("Indice et corrigé");
  let card = chunk;
  if (cut >= 0) {
    const rest = chunk.slice(cut);
    const end = /Q\d+/.exec(rest);
    card = end ? rest.slice(end.index + end[0].length) : "";
  }
  const minutes = /Temps estimé\s*:?\s*≈?\s*(\d+)\s*min/i.exec(card)?.[1];
  const difficulte = /Difficulté\s*:?\s*(Application directe|Intermédiaire|Exigeant|Difficile)/i.exec(card)?.[1] ?? null;
  return {
    ...base,
    incontournable: /\bIncontournable\b(?!s)/i.test(card),
    minutes: minutes ? Number(minutes) : null,
    difficulte: difficulte ? difficulte.charAt(0).toUpperCase() + difficulte.slice(1).toLowerCase() : null,
  };
}

/** La page « Tous les chapitres » → (slug, intitulé), sans doublon. */
export function parseWikiChapterList(html: string): { slug: string; label: string }[] {
  const out = new Map<string, string>();
  const re = /<a\b[^>]*?href="(?:https?:\/\/(?:www\.)?wikiprepa\.fr)?\/concours\/chapitre\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const label = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (label && !out.has(m[1])) out.set(m[1], label.slice(0, 120));
  }
  return [...out].map(([slug, label]) => ({ slug, label }));
}

export interface WikiSubject {
  slug: string;
  url: string;
  titre: string;
  filiere: string;
  annee: number | null;
}

/** Pages de maths : Wikiprepa y relie des sujets entiers (`/concours/ecrit/<slug>`), sans ancre par question. */
export function parseWikiSubjects(html: string): WikiSubject[] {
  const out = new Map<string, WikiSubject>();
  const re = /href="(?:https?:\/\/(?:www\.)?wikiprepa\.fr)?\/concours\/ecrit\/([a-z0-9_-]+)\/?"/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (out.has(m[1])) continue;
    out.set(m[1], { slug: m[1], url: `${WIKI_BASE}/concours/ecrit/${m[1]}`, ...paperTitle(m[1]) });
  }
  return [...out.values()];
}

/** Ordre d'affichage : MP/MPI d'abord, puis le plus récent. */
export function filiereRank(filiere: string): number {
  return /\bMP\b|^MP|MPI/.test(filiere) ? 0 : 1;
}
