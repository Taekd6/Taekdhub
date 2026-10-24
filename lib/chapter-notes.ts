import { foldText } from "@/lib/annales";
import { PROGRAMME, PROGRAMME_BY_ID, type ProgrammeChapter } from "@/lib/programme-data";
import type { ErrorEntry } from "@/lib/storage";

/**
 * LA PAGE D'UN CHAPITRE — le cours retapé et les méthodes, rangés par chapitre
 * du programme (`/chapitre/<id>`). Collection synchronisée `chapterNotes` :
 * UNE entrée par chapitre, écrite par le connecteur de Claude (outils
 * `save_course` et `add_methods`) ; l'application la lit et la met en PDF.
 *
 *   cours     le texte du cours, RETAPÉ proprement (titres `#`, listes `-`,
 *             maths en Unicode) — jamais le PDF du professeur lui-même : un
 *             texte se relit en une fois et ne demande aucun stockage de
 *             fichiers ;
 *   méthodes  « Quand je vois… » → étapes → piège éventuel. Une méthode du
 *             même titre en REMPLACE une ancienne : Claude peut la corriger.
 *
 * Les erreurs d'un chapitre ne sont pas ici : elles vivent dans le carnet
 * d'erreurs (`errors`, champ `programmeChapterId`) et sont seulement
 * filtrées par la page.
 *
 * Fonctions pures : le stockage et l'heure viennent d'ailleurs.
 */

export const COURSE_CHUNK_MAX = 30_000;
export const COURSE_TOTAL_MAX = 150_000;
export const METHODS_PER_CALL_MAX = 8;
export const METHODS_MAX = 40;
export const STEPS_MAX = 10;

export interface Methode {
  id: string;
  titre: string;
  /** « Quand je vois… » : ce qui doit faire penser à cette méthode. */
  quand: string;
  etapes: string[];
  piege?: string;
  createdAt: string;
}

export interface ChapterNotes {
  /** Identifiant de chapitre du programme (`lib/programme-data.ts`), p. ex. `m2-reduction`. */
  id: string;
  /** Le cours retapé, `null` tant qu'aucun n'a été rangé. */
  cours: string | null;
  coursUpdatedAt?: string;
  methodes: Methode[];
  updatedAt: string;
}

/* ── Retrouver un chapitre ──────────────────────────────────────── */

export type ChapterLookup = { ok: true; chapter: ProgrammeChapter } | { ok: false; error: string };

/**
 * Un chapitre à partir de ce que dit l'élève : l'identifiant exact, le titre
 * ou un alias (sans casse ni accents), ou — à défaut — une inclusion qui ne
 * désigne qu'UN chapitre. Ambigu ou inconnu : une erreur qui liste les
 * choix, jamais un chapitre deviné.
 */
export function findChapter(query: string, subject?: string | null): ChapterLookup {
  const wanted = foldText(query);
  if (!wanted) return { ok: false, error: "Chapitre vide : donne son titre ou son identifiant." };
  const byId = PROGRAMME_BY_ID.get(query.trim());
  if (byId) return { ok: true, chapter: byId };

  const pool = subject ? PROGRAMME.filter((chapter) => foldText(chapter.subject).startsWith(foldText(subject).slice(0, 4))) : PROGRAMME;
  const keys = (chapter: ProgrammeChapter) => [chapter.title, ...chapter.aliases].map(foldText);

  const exact = pool.filter((chapter) => keys(chapter).includes(wanted));
  if (exact.length === 1) return { ok: true, chapter: exact[0] };

  const partial = exact.length > 1 ? exact : pool.filter((chapter) => keys(chapter).some((key) => key.includes(wanted) || (key.length >= 5 && wanted.includes(key))));
  if (partial.length === 1) return { ok: true, chapter: partial[0] };
  if (partial.length === 0) return { ok: false, error: `Chapitre « ${query} » introuvable dans le programme. Utilise le titre du programme ou son identifiant (p. ex. m2-reduction).` };
  const choices = partial.slice(0, 8).map((chapter) => `${chapter.id} (${chapter.title})`);
  return { ok: false, error: `Chapitre « ${query} » ambigu : ${choices.join(" ; ")}. Reprends avec l'identifiant.` };
}

/* ── Lecture tolérante ──────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isoOr(value: unknown, fallback: string): string {
  const raw = text(value);
  return raw && !Number.isNaN(new Date(raw).getTime()) ? raw : fallback;
}

function normalizeMethode(raw: unknown, fallbackDate: string): Methode | null {
  if (!isRecord(raw)) return null;
  const titre = text(raw.titre);
  const quand = text(raw.quand);
  const etapes = (Array.isArray(raw.etapes) ? raw.etapes : []).map(text).filter(Boolean).slice(0, STEPS_MAX);
  if (!titre || !quand || etapes.length === 0) return null;
  const piege = text(raw.piege);
  return {
    id: text(raw.id) || crypto.randomUUID(),
    titre,
    quand,
    etapes,
    ...(piege ? { piege } : {}),
    createdAt: isoOr(raw.createdAt, fallbackDate),
  };
}

/** Une entrée sans chapitre connu n'a aucun sens et disparaît ; le reste est gardé tel quel. Un identifiant en double : la plus récente. */
export function normalizeChapterNotes(raw: unknown): ChapterNotes[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ChapterNotes>();
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const id = text(entry.id);
    if (!PROGRAMME_BY_ID.has(id)) continue;
    const updatedAt = isoOr(entry.updatedAt, new Date(0).toISOString());
    const cours = text(entry.cours);
    const coursUpdatedAt = text(entry.coursUpdatedAt);
    const item: ChapterNotes = {
      id,
      cours: cours || null,
      ...(cours && coursUpdatedAt ? { coursUpdatedAt: isoOr(coursUpdatedAt, updatedAt) } : {}),
      methodes: (Array.isArray(entry.methodes) ? entry.methodes : []).map((methode) => normalizeMethode(methode, updatedAt)).filter((methode): methode is Methode => methode !== null),
      updatedAt,
    };
    const known = byId.get(id);
    if (!known || item.updatedAt >= known.updatedAt) byId.set(id, item);
  }
  return [...byId.values()];
}

export function notesFor(all: ChapterNotes[], chapterId: string): ChapterNotes | null {
  return all.find((entry) => entry.id === chapterId) ?? null;
}

/** Les erreurs du carnet rattachées à ce chapitre, la plus récente d'abord (à date égale, la dernière saisie). */
export function chapterErrors(errors: ErrorEntry[], chapterId: string): ErrorEntry[] {
  return errors
    .filter((entry) => entry.programmeChapterId === chapterId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/* ── Écritures (appelées par le connecteur) ─────────────────────── */

export type Result<T> = { ok: true; items: ChapterNotes[]; value: T } | { ok: false; error: string };

function upsert(all: ChapterNotes[], chapterId: string, change: (current: ChapterNotes) => ChapterNotes): ChapterNotes[] {
  const current = notesFor(all, chapterId) ?? { id: chapterId, cours: null, methodes: [], updatedAt: new Date(0).toISOString() };
  const next = change(current);
  return [...all.filter((entry) => entry.id !== chapterId), next];
}

/**
 * Range le cours d'un chapitre. `remplacer` écrase l'ancien ; `ajouter` colle
 * la suite après l'ancien (un long cours s'envoie en plusieurs morceaux).
 */
export function setCourse(all: ChapterNotes[], chapterId: string, texte: string, mode: "remplacer" | "ajouter", now: Date): Result<{ longueur: number }> {
  if (!PROGRAMME_BY_ID.has(chapterId)) return { ok: false, error: "Chapitre inconnu." };
  const chunk = texte.replace(/\r\n?/g, "\n").trim();
  if (!chunk) return { ok: false, error: "Le texte du cours est vide." };
  if (chunk.length > COURSE_CHUNK_MAX) return { ok: false, error: `Morceau trop long (${chunk.length} caractères, ${COURSE_CHUNK_MAX} au plus) : envoie le cours en plusieurs fois avec mode « ajouter ».` };
  const before = mode === "ajouter" ? notesFor(all, chapterId)?.cours ?? "" : "";
  const joined = before ? `${before}\n\n${chunk}` : chunk;
  if (joined.length > COURSE_TOTAL_MAX) return { ok: false, error: `Le cours dépasserait ${COURSE_TOTAL_MAX} caractères pour ce chapitre.` };
  const stamp = now.toISOString();
  const items = upsert(all, chapterId, (current) => ({ ...current, cours: joined, coursUpdatedAt: stamp, updatedAt: stamp }));
  return { ok: true, items, value: { longueur: joined.length } };
}

export interface NewMethode {
  titre: string;
  quand: string;
  etapes: string[];
  piege?: string;
}

/** Ajoute des méthodes ; une méthode de même titre (sans casse ni accents) est REMPLACÉE, pas dupliquée. */
export function addMethodes(all: ChapterNotes[], chapterId: string, methodes: NewMethode[], now: Date): Result<{ added: number; replaced: number; total: number }> {
  if (!PROGRAMME_BY_ID.has(chapterId)) return { ok: false, error: "Chapitre inconnu." };
  const stamp = now.toISOString();
  const cleaned: Methode[] = [];
  for (const raw of methodes) {
    const methode = normalizeMethode({ ...raw, id: undefined, createdAt: stamp }, stamp);
    if (!methode) return { ok: false, error: `Méthode « ${raw.titre} » incomplète : il faut un titre, un « quand » et au moins une étape.` };
    cleaned.push(methode);
  }
  let added = 0;
  let replaced = 0;
  let total = 0;
  const items = upsert(all, chapterId, (current) => {
    const list = [...current.methodes];
    for (const methode of cleaned) {
      const index = list.findIndex((entry) => foldText(entry.titre) === foldText(methode.titre));
      if (index >= 0) {
        list[index] = { ...methode, id: list[index].id, createdAt: list[index].createdAt };
        replaced += 1;
      } else {
        list.push(methode);
        added += 1;
      }
    }
    total = list.length;
    return { ...current, methodes: list.slice(0, METHODS_MAX), updatedAt: stamp };
  });
  if (total > METHODS_MAX) return { ok: false, error: `Un chapitre ne garde que ${METHODS_MAX} méthodes : regroupe-en quelques-unes.` };
  return { ok: true, items, value: { added, replaced, total } };
}

/* ── Le cours, en blocs lisibles ────────────────────────────────── */

export type CourseBlock = { kind: "titre"; niveau: 1 | 2 | 3; texte: string } | { kind: "paragraphe"; texte: string } | { kind: "liste"; items: string[] };

/**
 * Le texte du cours en blocs : `#`, `##`, `###` = titres ; lignes `- ` ou
 * `* ` consécutives = une liste ; le reste, regroupé jusqu'à une ligne vide =
 * un paragraphe (les retours à la ligne internes sont gardés).
 */
export function parseCourse(source: string): CourseBlock[] {
  const blocks: CourseBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraphe", texte: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "liste", items: list });
    list = [];
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "titre", niveau: heading[1].length as 1 | 2 | 3, texte: heading[2] });
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (!trimmed) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** « 24 octobre 2026 » à partir d'un horodatage ISO ; illisible : rendu tel quel. */
export function formatStamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
}
