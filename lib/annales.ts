import type { ChapterMemory } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * ANNALES — les exercices de concours corrigés avec Claude.
 *
 * Ils n'entrent PAS dans le localStorage : c'est le connecteur MCP
 * (app/api/mcp/[key]/route.ts) qui les écrit, côté serveur, dans la table
 * Supabase `exercise_logs` (supabase/migrations/0007). L'application les
 * LIT (hooks/use-annales.ts) quand l'élève est connecté.
 *
 * Les lignes viennent d'un outil appelé par un modèle de langage : matière
 * en texte libre (« maths », « Physique »), chapitre tel que tapé
 * (« réduction », « Réduction des endomorphismes »). Tout passe donc par
 * `normalizeAnnaleLog`, qui ne lève jamais et rejette ce qui est inutilisable.
 *
 * Fonctions pures : aucune dépendance à Supabase, React ou au DOM.
 */

export type AnnaleResult = "réussi" | "partiel" | "échec";

export const ANNALE_RESULTS: readonly AnnaleResult[] = ["réussi", "partiel", "échec"];

/** Un réussi vaut 1, un partiel ½, un échec 0 — la base du taux de réussite. */
const RESULT_VALUE: Record<AnnaleResult, number> = { réussi: 1, partiel: 0.5, échec: 0 };

/** Niveaux des concours, du plus accessible au plus sélectif. */
export const ANNALE_LEVELS = ["CCINP", "Mines", "Centrale", "X-ENS"] as const;
export type AnnaleLevel = (typeof ANNALE_LEVELS)[number] | "Autre";

export interface AnnaleLog {
  id: string;
  createdAt: string;
  /** Jour local (AAAA-MM-JJ) de `createdAt`. */
  day: string;
  /** `null` quand la matière saisie n'est pas reconnue — `subjectLabel` garde le texte. */
  subject: Subject | null;
  subjectLabel: string;
  chapter: string;
  /** Le chapitre sans casse, accents ni ponctuation : la clé de regroupement. */
  chapterKey: string;
  source: string | null;
  level: AnnaleLevel | null;
  result: AnnaleResult;
  hints: number;
  /** Temps réellement passé, en minutes. */
  minutes: number | null;
  /** Temps prévu avant de commencer, en minutes. */
  plannedMinutes: number | null;
  errors: string[];
  comment: string | null;
  /**
   * Aide utilisée pendant l'essai (colonne `aide`, migration 0008) quand le
   * connecteur l'a transmise ; sinon déduite des indices : aucun indice ⇒
   * « sans », au moins un ⇒ « indices ». `helpDeclared` dit lequel des deux.
   */
  help: "sans" | "indices" | "correction";
  helpDeclared: boolean;
}

/* ── Normalisation ────────────────────────────────────────────────── */

/** Minuscules, sans accents ni ponctuation, espaces réduits. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** « maths », « Mathématiques », « physique-chimie »… → la matière de l'application, ou `null`. */
export function toSubject(raw: string): Subject | null {
  const text = foldText(raw);
  if (!text) return null;
  if (text.startsWith("math")) return "Mathématiques";
  if (text.startsWith("phys")) return "Physique";
  if (text.startsWith("chim")) return "Chimie";
  if (text.startsWith("info")) return /\bspe/.test(text) ? "Informatique Spé" : "Informatique TC";
  if (text.startsWith("fran")) return "Français";
  if (text.startsWith("angl") || text.startsWith("engl")) return "Anglais";
  return null;
}

/** « Mines-Ponts », « e3a/CCINP », « ENS »… → un des quatre niveaux, « Autre », ou `null` si rien n'est dit. */
export function toLevel(raw: unknown): AnnaleLevel | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = foldText(raw);
  if (/\b(x|ens|polytechnique|ulm)\b/.test(text) || text.includes("x ens")) return "X-ENS";
  if (text.includes("centrale") || text.includes("supelec")) return "Centrale";
  if (text.includes("mines") || text.includes("ponts")) return "Mines";
  if (text.includes("ccinp") || text.includes("ccp") || text.includes("e3a")) return "CCINP";
  return "Autre";
}

function toResult(raw: unknown): AnnaleResult | null {
  if (typeof raw !== "string") return null;
  const text = foldText(raw);
  if (text.startsWith("reuss")) return "réussi";
  if (text.startsWith("partiel")) return "partiel";
  if (text.startsWith("echec") || text.startsWith("rate")) return "échec";
  return null;
}

function positiveInt(raw: unknown): number | null {
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function optionalText(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function localDay(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

/**
 * Une ligne de `exercise_logs` → `AnnaleLog`, ou `null` si elle n'a ni
 * identifiant, ni date lisible, ni chapitre, ni résultat reconnu.
 */
export function normalizeAnnaleLog(raw: unknown): AnnaleLog | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const created = typeof row.created_at === "string" ? new Date(row.created_at) : null;
  const chapter = optionalText(row.chapitre);
  const result = toResult(row.resultat);
  if (!id || !created || Number.isNaN(created.getTime()) || !chapter || !result) return null;

  const subjectLabel = optionalText(row.matiere) ?? "Matière inconnue";
  const declared = row.aide === "sans" || row.aide === "indices" || row.aide === "correction" ? row.aide : null;
  const hints = typeof row.indices === "number" && Number.isFinite(row.indices) ? Math.max(0, Math.round(row.indices)) : 0;
  return {
    id,
    createdAt: created.toISOString(),
    day: localDay(created),
    subject: toSubject(subjectLabel),
    subjectLabel,
    chapter,
    chapterKey: foldText(chapter),
    source: optionalText(row.source),
    level: toLevel(row.niveau),
    result,
    hints,
    minutes: positiveInt(row.temps_min),
    plannedMinutes: positiveInt(row.temps_prevu),
    errors: Array.isArray(row.erreurs) ? row.erreurs.map(optionalText).filter((entry): entry is string => entry !== null) : [],
    comment: optionalText(row.commentaire),
    help: declared ?? (hints > 0 ? "indices" : "sans"),
    helpDeclared: declared !== null,
  };
}

/** Normalise une liste brute, du plus récent au plus ancien. */
export function normalizeAnnaleLogs(rows: unknown): AnnaleLog[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(normalizeAnnaleLog)
    .filter((log): log is AnnaleLog => log !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ── Lien avec la mémoire des chapitres ───────────────────────────── */

/**
 * Le chapitre de Mémoire qui correspond à une annale : même matière, et un
 * titre qui contient l'autre (« réduction » ↔ « Réduction des
 * endomorphismes »). Au moins 4 lettres, pour que « TD » ne colle pas à tout.
 * Le titre le plus proche en longueur gagne.
 */
export function matchChapter(subject: Subject | null, chapterKey: string, chapters: ChapterMemory[]): ChapterMemory | null {
  if (!subject || chapterKey.length < 4) return null;
  let best: { chapter: ChapterMemory; gap: number } | null = null;
  for (const chapter of chapters) {
    if (chapter.archived || chapter.subject !== subject) continue;
    const key = foldText(chapter.title);
    if (key.length < 4 || !(key.includes(chapterKey) || chapterKey.includes(key))) continue;
    const gap = Math.abs(key.length - chapterKey.length);
    if (!best || gap < best.gap) best = { chapter, gap };
  }
  return best?.chapter ?? null;
}

/* ── Bilans ───────────────────────────────────────────────────────── */

export interface ResultCounts {
  count: number;
  réussi: number;
  partiel: number;
  échec: number;
  /** Réussi = 1, partiel = ½ — entre 0 et 1, `null` sans exercice. */
  successRate: number | null;
  /** Indices moyens par exercice, `null` sans exercice. */
  meanHints: number | null;
}

export function countResults(logs: AnnaleLog[]): ResultCounts {
  const counts = { count: logs.length, réussi: 0, partiel: 0, échec: 0 };
  let value = 0;
  let hints = 0;
  for (const log of logs) {
    counts[log.result] += 1;
    value += RESULT_VALUE[log.result];
    hints += log.hints;
  }
  return {
    ...counts,
    successRate: logs.length > 0 ? value / logs.length : null,
    meanHints: logs.length > 0 ? hints / logs.length : null,
  };
}

export interface ChapterSummary extends ResultCounts {
  /** `matière|chapitre` replié : stable d'un calcul à l'autre. */
  key: string;
  subject: Subject | null;
  subjectLabel: string;
  /** L'orthographe la plus récente. */
  chapter: string;
  lastDay: string;
  lastResult: AnnaleResult;
  /** Les résultats, du plus ancien au plus récent — la petite frise. */
  history: AnnaleResult[];
}

function groupKey(log: AnnaleLog): string {
  return `${log.subject ?? foldText(log.subjectLabel)}|${log.chapterKey}`;
}

/** Un bilan par chapitre, le plus fragile d'abord (taux de réussite, puis le plus d'essais). */
export function summarizeByChapter(logs: AnnaleLog[]): ChapterSummary[] {
  const groups = new Map<string, AnnaleLog[]>();
  for (const log of logs) {
    const key = groupKey(log);
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }
  const out: ChapterSummary[] = [];
  for (const [key, group] of groups) {
    const ordered = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = ordered[ordered.length - 1];
    out.push({
      key,
      subject: latest.subject,
      subjectLabel: latest.subject ?? latest.subjectLabel,
      chapter: latest.chapter,
      lastDay: latest.day,
      lastResult: latest.result,
      history: ordered.map((log) => log.result),
      ...countResults(ordered),
    });
  }
  return out.sort((a, b) => (a.successRate ?? 1) - (b.successRate ?? 1) || b.count - a.count || a.key.localeCompare(b.key));
}

export interface LevelSummary extends ResultCounts {
  level: AnnaleLevel;
}

/** Un bilan par niveau de concours, du plus accessible au plus sélectif ; seulement les niveaux tentés. */
export function summarizeByLevel(logs: AnnaleLog[]): LevelSummary[] {
  const order: AnnaleLevel[] = [...ANNALE_LEVELS, "Autre"];
  return order
    .map((level) => ({ level, ...countResults(logs.filter((log) => log.level === level)) }))
    .filter((entry) => entry.count > 0);
}

/** Les erreurs relevées à la correction, regroupées sans casse ni accents — les plus fréquentes d'abord. */
export function topErrorTags(logs: AnnaleLog[], limit = 6): { label: string; count: number }[] {
  const tags = new Map<string, { label: string; count: number }>();
  for (const log of logs) {
    for (const error of log.errors) {
      const key = foldText(error);
      if (!key) continue;
      const entry = tags.get(key) ?? { label: error, count: 0 };
      entry.count += 1;
      tags.set(key, entry);
    }
  }
  return [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

/* ── Calibration du temps ─────────────────────────────────────────── */

/**
 * « Est-ce que je sais combien de temps ça me prend ? » — le pendant, pour le
 * temps, de la calibration des notes (lib/calibration.ts).
 *
 * MÉDIANE du rapport temps réel / temps prévu, et pas moyenne : un exercice
 * abandonné à 3× le temps prévu ne doit pas, à lui seul, dire « tu sous-
 * estimes tout ». Trois exercices chronométrés au minimum, comme la
 * calibration des notes.
 */
export const TIME_CALIBRATION_MIN_SAMPLES = 3;
/** Entre 0,9× et 1,1× : bien estimé. */
const TIME_TOLERANCE = 0.1;

export interface TimeCalibration {
  /** `null` = toutes matières. */
  subject: Subject | null;
  count: number;
  sufficient: boolean;
  /** Médiane de temps réel / temps prévu — `null` tant que `sufficient` est faux. */
  medianRatio: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function timeSummary(logs: AnnaleLog[], subject: Subject | null): TimeCalibration {
  const ratios = logs.filter((log) => log.minutes !== null && log.plannedMinutes !== null).map((log) => log.minutes! / log.plannedMinutes!);
  const sufficient = ratios.length >= TIME_CALIBRATION_MIN_SAMPLES;
  return { subject, count: ratios.length, sufficient, medianRatio: sufficient ? Math.round(median(ratios) * 100) / 100 : null };
}

export function computeTimeCalibration(logs: AnnaleLog[]): { overall: TimeCalibration; bySubject: TimeCalibration[] } {
  const subjects: Subject[] = [];
  for (const log of logs) if (log.subject && !subjects.includes(log.subject)) subjects.push(log.subject);
  return {
    overall: timeSummary(logs, null),
    bySubject: subjects.map((subject) => timeSummary(logs.filter((log) => log.subject === subject), subject)).filter((entry) => entry.count > 0),
  };
}

function formatRatio(ratio: number): string {
  return ratio.toFixed(1).replace(".", ",");
}

/** « Tu mets en général 1,4 fois le temps prévu (médiane sur 6 exercices). » — `null` sous le seuil. */
export function describeTimeCalibration(summary: TimeCalibration): string | null {
  if (!summary.sufficient || summary.medianRatio === null) return null;
  const where = summary.subject ? ` en ${summary.subject.charAt(0).toLowerCase()}${summary.subject.slice(1)}` : "";
  const sample = `médiane sur ${summary.count} exercices`;
  const ratio = summary.medianRatio;
  if (Math.abs(ratio - 1) <= TIME_TOLERANCE) return `Tu estimes bien ton temps${where} (${sample}).`;
  if (ratio > 1) return `Tu mets en général ${formatRatio(ratio)} fois le temps prévu${where} (${sample}).`;
  return `Tu finis en général en ${Math.round(ratio * 100)} % du temps prévu${where} (${sample}) : tu peux viser plus dur.`;
}

/* ── Chapitres à reprendre (pour Next Move) ───────────────────────── */

/** Fenêtre d'observation : au-delà, un échec dit quelque chose d'un autre moment de l'année. */
export const WEAK_WINDOW_DAYS = 30;

export interface WeakChapter {
  key: string;
  subject: Subject;
  chapter: string;
  échecs: number;
  partiels: number;
  attempts: number;
  lastDay: string;
  lastResult: AnnaleResult;
  lastSource: string | null;
  meanHints: number;
}

/**
 * Les chapitres où les annales récentes bloquent : le DERNIER essai n'est pas
 * réussi, et soit c'est un échec, soit au moins deux essais n'ont pas abouti.
 * Un chapitre dont le dernier essai est réussi n'y est plus : c'est réglé.
 * Matière non reconnue : ignoré (Next Move raisonne par matière).
 */
export function weakChapters(logs: AnnaleLog[], now: Date): WeakChapter[] {
  const from = new Date(now);
  from.setDate(from.getDate() - (WEAK_WINDOW_DAYS - 1));
  const fromDay = localDay(from);
  const today = localDay(now);
  const recent = logs.filter((log) => log.subject !== null && log.day >= fromDay && log.day <= today);

  const out: WeakChapter[] = [];
  for (const summary of summarizeByChapter(recent)) {
    if (summary.lastResult === "réussi" || !summary.subject) continue;
    const notDone = summary.échec + summary.partiel;
    if (summary.lastResult !== "échec" && notDone < 2) continue;
    const latest = recent
      .filter((log) => groupKey(log) === summary.key)
      .reduce((best, log) => (log.createdAt > best.createdAt ? log : best));
    out.push({
      key: summary.key,
      subject: summary.subject,
      chapter: summary.chapter,
      échecs: summary.échec,
      partiels: summary.partiel,
      attempts: summary.count,
      lastDay: summary.lastDay,
      lastResult: summary.lastResult,
      lastSource: latest.source,
      meanHints: summary.meanHints ?? 0,
    });
  }
  return out;
}
