import { foldText } from "@/lib/annales";
import { isCleanSuccess, type ExerciseAttempt } from "@/lib/attempts";
import { PROGRAMME, PROGRAMME_BY_ID, type ProgrammeChapter } from "@/lib/programme-data";
import type { Subject } from "@/lib/supabase/types";

/**
 * EXOS — le catalogue des exercices à faire et le suivi case par case.
 *
 * LE CATALOGUE est une liste de RÉFÉRENCES rangées par chapitre du programme,
 * jamais un énoncé recopié : un sujet d'annale (lien Wikiprepa), un exercice
 * d'oral (lien BEOS), un exercice de manuel (livre, numéro, page). Il vit dans
 * la collection `chapterNotes` existante, champ facultatif `exos` : aucune
 * migration. Claude l'alimente par le connecteur (`add_exos`) ; l'élève peut
 * y coller un lien.
 *
 * UNE CASE = une question d'une entrée (« Q4 », « b »), ou l'entrée entière
 * quand elle n'a pas de questions. Cocher une case enregistre une TENTATIVE
 * dans `attempts` (lib/attempts.ts), avec la clé `caseKey` : rien d'autre
 * n'est stocké. L'état d'une case (dernier statut, date de retour) se
 * RECALCULE à chaque affichage à partir de ses tentatives.
 *
 * Trois statuts, ceux que l'élève choisit :
 *   seul     réussi sans aide        → retour dans 14, 30, 60, 120 puis 240 jours ;
 *   indices  réussi avec indices      → retour dans 7 jours ;
 *   rate     raté, ou corrigé ouvert  → retour dans 3 jours.
 *
 * Fonctions pures : l'heure et le stockage viennent d'ailleurs.
 */

/* ── Types ──────────────────────────────────────────────────────── */

export type ExoSource = "annale" | "beos" | "manuel" | "autre";
export const EXO_SOURCES: readonly ExoSource[] = ["annale", "beos", "manuel", "autre"];
export const EXO_SOURCE_LABEL: Record<ExoSource, string> = { annale: "Annales", beos: "BEOS", manuel: "Manuels", autre: "Autres" };

export type ExoStatus = "seul" | "indices" | "rate";
export const EXO_STATUSES: readonly ExoStatus[] = ["seul", "indices", "rate"];
export const EXO_STATUS_LABEL: Record<ExoStatus, string> = { seul: "Seul", indices: "Avec indices", rate: "Raté" };

/** Une référence du catalogue. */
export interface ExoEntry {
  id: string;
  source: ExoSource;
  /** « CCINP Maths 1 · MP 2025 · Ex. 3 », « BEOS n° 6123 », « Manuel X · ch. 3 · exo 3.7 ». */
  titre: string;
  /** Ce que l'exercice travaille, ou une précision (« Normes équivalentes », « Corrigé p. 158 »). */
  detail?: string;
  /** Lien vers l'énoncé ou la page de l'exercice (http(s) seulement). */
  url?: string;
  /** Lien vers le corrigé, s'il est ailleurs. */
  urlCorrige?: string;
  /** Libellés des questions (« 1 », « 2 », « a »…). Vide : l'entrée entière est une seule case. */
  questions: string[];
  /** Concours d'origine (« Mines-Ponts »), si connu. */
  concours?: string;
  annee?: number;
  /** 1 à 3 étoiles : difficulté indicative. */
  niveau?: 1 | 2 | 3;
  /** Page dans le manuel (« p. 142 »). */
  page?: string;
  createdAt: string;
}

export const EXOS_PER_CHAPTER_MAX = 400;
export const QUESTIONS_MAX = 40;

/* ── Lecture tolérante ──────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function httpUrl(value: unknown): string {
  const raw = str(value, 600);
  return /^https?:\/\/\S+$/i.test(raw) ? raw : "";
}

export function normalizeExoEntry(raw: unknown, fallbackDate: string): ExoEntry | null {
  if (!isRecord(raw)) return null;
  const titre = str(raw.titre, 160);
  const source = (EXO_SOURCES as readonly unknown[]).includes(raw.source) ? (raw.source as ExoSource) : null;
  if (!titre || !source) return null;
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q) => (typeof q === "number" ? String(q) : str(q, 12)))
    .filter(Boolean)
    .slice(0, QUESTIONS_MAX);
  const detail = str(raw.detail, 200);
  const url = httpUrl(raw.url);
  const urlCorrige = httpUrl(raw.urlCorrige);
  const concours = str(raw.concours, 60);
  const annee = typeof raw.annee === "number" && raw.annee >= 1990 && raw.annee <= 2100 ? Math.round(raw.annee) : 0;
  const niveau = raw.niveau === 1 || raw.niveau === 2 || raw.niveau === 3 ? raw.niveau : 0;
  const page = str(raw.page, 30);
  const created = str(raw.createdAt, 40);
  return {
    id: str(raw.id, 80) || crypto.randomUUID(),
    source,
    titre,
    ...(detail ? { detail } : {}),
    ...(url ? { url } : {}),
    ...(urlCorrige ? { urlCorrige } : {}),
    questions: [...new Set(questions)],
    ...(concours ? { concours } : {}),
    ...(annee ? { annee } : {}),
    ...(niveau ? { niveau } : {}),
    ...(page ? { page } : {}),
    createdAt: created && !Number.isNaN(new Date(created).getTime()) ? created : fallbackDate,
  };
}

export function normalizeExoEntries(raw: unknown, fallbackDate: string): ExoEntry[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ExoEntry>();
  for (const item of raw) {
    const entry = normalizeExoEntry(item, fallbackDate);
    if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()].slice(0, EXOS_PER_CHAPTER_MAX);
}

/* ── Ajout au catalogue ─────────────────────────────────────────── */

export interface NewExo {
  source: ExoSource;
  titre: string;
  detail?: string;
  url?: string;
  urlCorrige?: string;
  /** Libellés des questions, ou leur nombre (« 6 » → 1…6). */
  questions?: string[] | number;
  concours?: string;
  annee?: number;
  niveau?: 1 | 2 | 3;
  page?: string;
}

/** Même lien, ou même titre sans casse ni accents : c'est la même entrée. */
function sameExo(a: Pick<ExoEntry, "titre" | "url">, b: Pick<ExoEntry, "titre" | "url">): boolean {
  if (a.url && b.url && a.url.toLowerCase().replace(/\/+$/, "") === b.url.toLowerCase().replace(/\/+$/, "")) return true;
  return foldText(a.titre) === foldText(b.titre);
}

export function questionLabels(questions: NewExo["questions"]): string[] {
  if (typeof questions === "number") return Array.from({ length: Math.max(0, Math.min(QUESTIONS_MAX, Math.round(questions))) }, (_, i) => String(i + 1));
  return Array.isArray(questions) ? questions : [];
}

/**
 * Ajoute des entrées au catalogue d'un chapitre. Une entrée déjà présente
 * (même lien ou même titre) est MISE À JOUR sans perdre son identifiant :
 * les cases déjà cochées restent attachées.
 */
export function addExos(current: ExoEntry[], inputs: NewExo[], now: Date): { ok: true; items: ExoEntry[]; added: number; updated: number } | { ok: false; error: string } {
  const stamp = now.toISOString();
  const list = [...current];
  let added = 0;
  let updated = 0;
  for (const input of inputs) {
    const entry = normalizeExoEntry({ ...input, questions: questionLabels(input.questions), id: undefined, createdAt: stamp }, stamp);
    if (!entry) return { ok: false, error: `Entrée « ${String(input.titre).slice(0, 60)} » refusée : il faut un titre et une source (annale, beos, manuel, autre).` };
    if (input.url && !entry.url) return { ok: false, error: `Lien refusé pour « ${entry.titre} » : seulement http(s).` };
    const index = list.findIndex((known) => sameExo(known, entry));
    if (index >= 0) {
      list[index] = { ...entry, id: list[index].id, createdAt: list[index].createdAt };
      updated += 1;
    } else {
      list.push(entry);
      added += 1;
    }
  }
  if (list.length > EXOS_PER_CHAPTER_MAX) return { ok: false, error: `Plus de ${EXOS_PER_CHAPTER_MAX} entrées dans ce chapitre : range plutôt les meilleures.` };
  return { ok: true, items: list, added, updated };
}

/** Retrouve une entrée par identifiant, ou par titre (sans casse ni accents, inclusion si elle désigne une seule entrée). */
export function findExo(list: ExoEntry[], query: string): ExoEntry | null {
  const byId = list.find((entry) => entry.id === query.trim());
  if (byId) return byId;
  const wanted = foldText(query);
  if (!wanted) return null;
  const exact = list.filter((entry) => foldText(entry.titre) === wanted);
  if (exact.length === 1) return exact[0];
  const partial = list.filter((entry) => foldText(entry.titre).includes(wanted));
  return partial.length === 1 ? partial[0] : null;
}

/* ── Une case ───────────────────────────────────────────────────── */

/** `exo:<chapitre>:<entrée>` ou `exo:<chapitre>:<entrée>#<question>`. */
export function caseKey(chapterId: string, entryId: string, question: string | null): string {
  return `exo:${chapterId}:${entryId}${question ? `#${question}` : ""}`;
}

export function parseCaseKey(key: string): { chapterId: string; entryId: string; question: string | null } | null {
  const match = /^exo:([^:]+):([^#]+)(?:#(.+))?$/.exec(key);
  return match ? { chapterId: match[1], entryId: match[2], question: match[3] ?? null } : null;
}

/** Les cases d'une entrée : une par question, ou une seule. */
export function entryCases(chapterId: string, entry: ExoEntry): { key: string; question: string | null }[] {
  return entry.questions.length ? entry.questions.map((q) => ({ key: caseKey(chapterId, entry.id, q), question: q })) : [{ key: caseKey(chapterId, entry.id, null), question: null }];
}

export function statusOfAttempt(attempt: Pick<ExerciseAttempt, "result" | "help">): ExoStatus {
  if (isCleanSuccess(attempt)) return "seul";
  if (attempt.result === "échec" || attempt.help === "correction") return "rate";
  return "indices";
}

export const SEUL_LADDER = [14, 30, 60, 120, 240] as const;

/** Jours avant le retour d'une case, d'après son dernier statut et le nombre de « seul » d'affilée. */
export function intervalFor(status: ExoStatus, streak: number): number {
  if (status === "seul") return SEUL_LADDER[Math.min(Math.max(streak, 1), SEUL_LADDER.length) - 1];
  return status === "indices" ? 7 : 3;
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface CaseState {
  key: string;
  status: ExoStatus;
  /** Jour de la dernière tentative. */
  lastDay: string;
  /** « Seul » d'affilée, en remontant depuis la dernière tentative. */
  streak: number;
  /** Jour où la case revient. */
  next: string;
  attempts: number;
  /** Les statuts, du plus ancien au plus récent. */
  history: { day: string; status: ExoStatus }[];
  note: string | null;
}

/** L'état d'une case à partir de SES tentatives (dans n'importe quel ordre). `null` si elle n'a jamais été tentée. */
export function caseState(key: string, attempts: ExerciseAttempt[]): CaseState | null {
  const mine = attempts.filter((attempt) => attempt.exerciseKey === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!mine.length) return null;
  const history = mine.map((attempt) => ({ day: attempt.day, status: statusOfAttempt(attempt) }));
  const last = history[history.length - 1];
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].status === "seul"; i -= 1) streak += 1;
  const note = [...mine].reverse().find((attempt) => attempt.note)?.note ?? null;
  return { key, status: last.status, lastDay: last.day, streak, next: addDays(last.day, intervalFor(last.status, streak)), attempts: mine.length, history, note };
}

/** Toutes les cases tentées, indexées par clé (une seule passe sur les tentatives). */
export function caseStates(attempts: ExerciseAttempt[]): Map<string, CaseState> {
  const groups = new Map<string, ExerciseAttempt[]>();
  for (const attempt of attempts) {
    if (!attempt.exerciseKey.startsWith("exo:")) continue;
    const list = groups.get(attempt.exerciseKey);
    if (list) list.push(attempt);
    else groups.set(attempt.exerciseKey, [attempt]);
  }
  const states = new Map<string, CaseState>();
  for (const [key, list] of groups) {
    const state = caseState(key, list);
    if (state) states.set(key, state);
  }
  return states;
}

/** Le statut d'une case à une date passée (pour la courbe), d'après son historique. */
export function statusAt(state: CaseState, day: string): ExoStatus | null {
  let status: ExoStatus | null = null;
  for (const step of state.history) if (step.day <= day) status = step.status;
  return status;
}

/* ── Tentative ──────────────────────────────────────────────────── */

export interface ExoGrade {
  chapter: ProgrammeChapter;
  entry: ExoEntry;
  question: string | null;
  status: ExoStatus;
  note?: string | null;
}

export function caseLabel(entry: ExoEntry, question: string | null): string {
  return question ? `${entry.titre} · Q${question}` : entry.titre;
}

/** La tentative que crée une case cochée. */
export function attemptForGrade(grade: ExoGrade, now: Date, day: string): ExerciseAttempt {
  const stamp = now.toISOString();
  const help = grade.status === "indices" ? "indices" : "sans";
  const note = grade.note?.trim() ? grade.note.trim().slice(0, 400) : null;
  return {
    id: crypto.randomUUID(),
    exerciseKey: caseKey(grade.chapter.id, grade.entry.id, grade.question),
    label: caseLabel(grade.entry, grade.question).slice(0, 160),
    subject: grade.chapter.subject as Subject,
    chapterId: grade.chapter.id,
    origin: grade.entry.source === "annale" ? "annale" : "exercice",
    day,
    createdAt: stamp,
    updatedAt: stamp,
    result: grade.status === "rate" ? "échec" : "réussi",
    help,
    minutes: null,
    plannedMinutes: null,
    cause: null,
    lackOfTime: false,
    gradeId: null,
    note,
    ...(grade.entry.niveau ? { level: grade.entry.niveau === 1 ? "direct" : grade.entry.niveau === 2 ? "classique" : "difficile" } : {}),
  } as ExerciseAttempt;
}

/** Retire la DERNIÈRE tentative d'une case (« Effacer » annule le dernier geste, pas l'historique entier). */
export function undoLastAttempt(attempts: ExerciseAttempt[], key: string): ExerciseAttempt[] {
  const last = attempts.filter((attempt) => attempt.exerciseKey === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
  return last ? attempts.filter((attempt) => attempt.id !== last.id) : attempts;
}

/* ── Le tableau de bord ─────────────────────────────────────────── */

export interface CatalogueChapter {
  chapter: ProgrammeChapter;
  entries: ExoEntry[];
}

/** Les chapitres qui ont un catalogue, dans l'ordre du programme. */
export function catalogueChapters(notes: { id: string; exos?: ExoEntry[] }[]): CatalogueChapter[] {
  const byId = new Map(notes.map((entry) => [entry.id, entry.exos ?? []]));
  return PROGRAMME.filter((chapter) => (byId.get(chapter.id)?.length ?? 0) > 0).map((chapter) => ({ chapter, entries: byId.get(chapter.id)! }));
}

export interface ChapterExoStats {
  chapter: ProgrammeChapter;
  entries: number;
  cases: number;
  done: number;
  seul: number;
  indices: number;
  rate: number;
  due: number;
  /** (seul + ½ indices) / cases faites ; `null` tant que rien n'est fait. */
  mastery: number | null;
  bySource: Record<ExoSource, { cases: number; done: number }>;
}

export function chapterStats(item: CatalogueChapter, states: Map<string, CaseState>, today: string): ChapterExoStats {
  const stats: ChapterExoStats = {
    chapter: item.chapter,
    entries: item.entries.length,
    cases: 0,
    done: 0,
    seul: 0,
    indices: 0,
    rate: 0,
    due: 0,
    mastery: null,
    bySource: { annale: { cases: 0, done: 0 }, beos: { cases: 0, done: 0 }, manuel: { cases: 0, done: 0 }, autre: { cases: 0, done: 0 } },
  };
  for (const entry of item.entries) {
    for (const { key } of entryCases(item.chapter.id, entry)) {
      stats.cases += 1;
      stats.bySource[entry.source].cases += 1;
      const state = states.get(key);
      if (!state) continue;
      stats.done += 1;
      stats.bySource[entry.source].done += 1;
      stats[state.status] += 1;
      if (state.next <= today) stats.due += 1;
    }
  }
  stats.mastery = stats.done ? (stats.seul + 0.5 * stats.indices) / stats.done : null;
  return stats;
}

export interface DueCase {
  chapter: ProgrammeChapter;
  entry: ExoEntry;
  question: string | null;
  state: CaseState;
}

/** Les cases à revoir aujourd'hui (ou en retard), la plus en retard d'abord ; `chapterId` pour un seul chapitre. */
export function dueCases(catalogue: CatalogueChapter[], states: Map<string, CaseState>, today: string, chapterId?: string): DueCase[] {
  const out: DueCase[] = [];
  for (const item of catalogue) {
    if (chapterId && item.chapter.id !== chapterId) continue;
    for (const entry of item.entries) {
      for (const { key, question } of entryCases(item.chapter.id, entry)) {
        const state = states.get(key);
        if (state && state.next <= today) out.push({ chapter: item.chapter, entry, question, state });
      }
    }
  }
  return out.sort((a, b) => a.state.next.localeCompare(b.state.next) || a.state.lastDay.localeCompare(b.state.lastDay));
}

/** Les cases à reprendre d'un chapitre (raté ou avec indices), qu'elles soient dues ou non. */
export function weakCases(catalogue: CatalogueChapter[], states: Map<string, CaseState>, chapterId: string): DueCase[] {
  const out: DueCase[] = [];
  for (const item of catalogue) {
    if (item.chapter.id !== chapterId) continue;
    for (const entry of item.entries) {
      for (const { key, question } of entryCases(item.chapter.id, entry)) {
        const state = states.get(key);
        if (state && state.status !== "seul") out.push({ chapter: item.chapter, entry, question, state });
      }
    }
  }
  return out.sort((a, b) => (a.state.status === b.state.status ? a.state.next.localeCompare(b.state.next) : a.state.status === "rate" ? -1 : 1));
}

/** Combien de cases reviennent chaque jour sur `days` jours ; les retards comptent aujourd'hui. */
export function forecast(states: Iterable<CaseState>, today: string, days = 14): { day: string; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  for (const state of states) {
    if (state.next <= today) out[0].count += 1;
    else {
      const index = out.findIndex((slot) => slot.day === state.next);
      if (index > 0) out[index].count += 1;
    }
  }
  return out;
}

export function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return addDays(day, -((date.getUTCDay() + 6) % 7));
}

export interface WeekPoint {
  start: string;
  /** Tentatives faites cette semaine. */
  worked: number;
  /** Cases tentées au moins une fois à la fin de la semaine. */
  done: number;
  /** Maîtrise à la fin de la semaine, `null` sous 3 cases faites. */
  mastery: number | null;
}

/** La progression sur `weeks` semaines (la dernière est la semaine en cours, jusqu'à aujourd'hui). */
export function progression(states: Iterable<CaseState>, today: string, weeks = 12): WeekPoint[] {
  const list = [...states];
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const end = i === weeks - 1 ? today : addDays(start, 6);
    let worked = 0;
    let done = 0;
    let score = 0;
    for (const state of list) {
      worked += state.history.filter((step) => step.day >= start && step.day <= end).length;
      const status = statusAt(state, end);
      if (!status) continue;
      done += 1;
      score += status === "seul" ? 1 : status === "indices" ? 0.5 : 0;
    }
    return { start, worked, done, mastery: done >= 3 ? score / done : null };
  });
}

export function activityDays(states: Iterable<CaseState>): Map<string, number> {
  const days = new Map<string, number>();
  for (const state of states) for (const step of state.history) days.set(step.day, (days.get(step.day) ?? 0) + 1);
  return days;
}

/** Jours d'affilée avec au moins une case cochée (aujourd'hui compte s'il est commencé, sinon on part d'hier). */
export function streakDays(days: Map<string, number>, today: string): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export interface WeakChapter {
  stats: ChapterExoStats;
  /** Ce qu'on conseille, en une ou deux phrases, d'après les chiffres. */
  tip: string;
  /** Le dernier piège noté sur ce chapitre. */
  lastNote: string | null;
}

/**
 * Les chapitres où l'élève décroche le plus (3 au plus). Poids : ce qui
 * manque de maîtrise, plus les cases à reprendre, sur au moins 3 cases faites.
 */
export function weakChapters(catalogue: CatalogueChapter[], states: Map<string, CaseState>, today: string, limit = 3): WeakChapter[] {
  return catalogue
    .map((item) => ({ item, stats: chapterStats(item, states, today) }))
    .filter(({ stats }) => stats.done >= 3 && stats.mastery !== null && stats.mastery < 0.85)
    .map(({ item, stats }) => {
      const weight = (1 - (stats.mastery ?? 0)) * Math.log2(2 + stats.done) + stats.rate * 0.15;
      let tip: string;
      if (stats.rate >= stats.indices && stats.rate > 0)
        tip = `Tu rates plus que tu ne bloques : reprends d'abord le cours et les démos du chapitre, puis refais les ${stats.rate} case${stats.rate > 1 ? "s" : ""} ratée${stats.rate > 1 ? "s" : ""} sans regarder le corrigé.`;
      else if (stats.indices > 0)
        tip = `Tu y arrives avec de l'aide : refais à froid les ${stats.indices} case${stats.indices > 1 ? "s" : ""} « avec indices », sans indice, pour vérifier que l'idée est acquise.`;
      else tip = "Refais les cases à reprendre, puis attaque des sujets neufs.";
      let lastNote: string | null = null;
      let lastDay = "";
      for (const entry of item.entries)
        for (const { key } of entryCases(item.chapter.id, entry)) {
          const state = states.get(key);
          if (state?.note && state.lastDay >= lastDay) {
            lastDay = state.lastDay;
            lastNote = state.note;
          }
        }
      return { stats, tip, lastNote, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ stats, tip, lastNote }) => ({ stats, tip, lastNote }));
}

/* ── Lien collé ─────────────────────────────────────────────────── */

const CONCOURS: Record<string, string> = { centrale: "CentraleSupélec", ccinp: "CCINP", ccp: "CCINP", mines: "Mines-Ponts", "banque-pt": "Banque PT", x: "X-ENS", ens: "X-ENS", e3a: "E3A" };

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Un lien collé → une entrée de catalogue. Wikiprepa : concours, épreuve,
 * filière et année lus dans l'adresse, la question devient la case. BEOS :
 * le numéro de l'exercice. Ailleurs : le dernier segment de l'adresse.
 */
export function exoFromUrl(url: string): { exo: NewExo; question: string | null } | null {
  const trimmed = url.trim().replace(/[),.;]+$/, "");
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  let host = "";
  try {
    host = new URL(trimmed).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const wiki = /wikiprepa\.fr\/concours\/ecrit\/([^/?#]+)\/corrige(?:#q?(\d+))?/i.exec(trimmed);
  if (wiki) {
    const parts = wiki[1].split("_");
    const concours = CONCOURS[parts[0]] ?? cap(parts[0].replace(/-/g, " "));
    const epreuve = cap((parts[1] ?? "").replace(/-/g, " "));
    const filiere = (parts[2] ?? "").toUpperCase();
    const annee = Number(parts[3]);
    const base = trimmed.replace(/#.*$/, "");
    return {
      exo: { source: "annale", titre: [concours, epreuve, [filiere, parts[3] ?? ""].filter(Boolean).join(" ")].filter(Boolean).join(" · "), url: base, concours, ...(annee ? { annee } : {}), questions: wiki[2] ? [wiki[2]] : [] },
      question: wiki[2] ?? null,
    };
  }
  if (/beos/i.test(host)) {
    const number = /(\d{2,6})(?:\/?$|[?#])/.exec(trimmed.replace(/\/+$/, ""))?.[1];
    return { exo: { source: "beos", titre: number ? `BEOS n° ${number}` : "BEOS", url: trimmed }, question: null };
  }
  let last = trimmed.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() ?? host;
  try {
    last = decodeURIComponent(last);
  } catch {
    // Segment mal encodé : on le garde tel quel.
  }
  return { exo: { source: "autre", titre: `${host} · ${last.replace(/[-_]/g, " ")}`.slice(0, 160), url: trimmed }, question: null };
}

const WIKI_CORRIGE = /^(https?:\/\/(?:www\.)?wikiprepa\.fr\/concours\/ecrit\/[^/?#]+\/corrige)(?:[?#].*)?$/i;

/**
 * Lien direct vers une question : sur Wikiprepa, chaque question du corrigé a
 * son ancre `#qN`. Ailleurs (BEOS, manuel, lien collé), le lien de l'entrée.
 */
export function questionUrl(entry: ExoEntry, question: string | null): string | null {
  if (!entry.url) return null;
  const wiki = WIKI_CORRIGE.exec(entry.url.trim());
  if (wiki && question && /^\d+$/.test(question)) return `${wiki[1]}#q${question}`;
  return entry.url;
}

/** La question où reprendre : la première jamais faite, sinon la première à revoir, sinon aucune. */
export function resumeQuestion(chapterId: string, entry: ExoEntry, states: Map<string, CaseState>, today: string): string | null {
  const cases = entryCases(chapterId, entry).filter((item) => item.question);
  const fresh = cases.find((item) => !states.get(item.key));
  if (fresh) return fresh.question;
  const due = cases.find((item) => (states.get(item.key)?.next ?? "9999") <= today);
  return due?.question ?? null;
}

/** Ajoute la question à une entrée existante si elle n'y est pas (un 2e lien vers le même sujet, autre question). */
export function withQuestion(entry: ExoEntry, question: string | null): ExoEntry {
  if (!question || entry.questions.includes(question)) return entry;
  const questions = [...entry.questions, question].sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b));
  return { ...entry, questions };
}

export function chapterById(id: string): ProgrammeChapter | null {
  return PROGRAMME_BY_ID.get(id) ?? null;
}
