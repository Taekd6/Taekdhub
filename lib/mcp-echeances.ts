import { foldText, toSubject } from "@/lib/annales";
import { withScope } from "@/lib/exam-prep";
import { normalizeChapterMemory, normalizeWorkItem, type ChapterMemory, type WorkItem, type WorkItemKind } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { createWorkItem, daysUntilDue, isActive } from "@/lib/work-items";

/**
 * ÉCHÉANCES DEPUIS CLAUDE — add/update/delete/list_echeance du connecteur MCP.
 *
 * Il n'y a PAS de table d'échéances à part : une échéance de TaekdHub est un
 * `WorkItem` daté (lib/storage.ts), rangé dans la collection synchronisée
 * `workItems`. C'est elle que lit `get_today` (lib/today-snapshot.ts) et
 * elle qu'affiche l'écran Échéances. Écrire ici, c'est donc écrire au même
 * endroit que l'élève quand il ajoute un DS à la main — rien à recopier,
 * rien qui puisse diverger.
 *
 * Fonctions PURES sur la liste brute : la route MCP les passe à
 * `mutateCollection` (lib/mcp-collections.ts), qui relit et réessaie en cas
 * d'écriture concurrente d'un appareil. Seules les entrées visées changent ;
 * toutes les autres repartent EXACTEMENT telles qu'elles ont été lues.
 */

export const ECHEANCE_TYPES = ["DS", "colle", "TD", "DM", "autre"] as const;
export type EcheanceType = (typeof ECHEANCE_TYPES)[number];

export const ECHEANCE_SUBJECTS = ["maths", "physique", "chimie", "info", "anglais"] as const;
export type EcheanceSubject = (typeof ECHEANCE_SUBJECTS)[number];

export const ECHEANCES_MAX = 20;

/** Au-delà, la date est presque sûrement une faute de frappe (2062 pour 2026). */
const MAX_DAYS_AHEAD = 366;
/** Temps de préparation réservé quand Claude ne le précise pas — la valeur par défaut du formulaire de l'app. */
const DEFAULT_MINUTES = 60;

const KIND_OF: Record<EcheanceType, WorkItemKind> = { DS: "ds", colle: "colle", TD: "exercices", DM: "dm", autre: "autre" };
const TYPE_OF: Partial<Record<WorkItemKind, EcheanceType>> = { ds: "DS", colle: "colle", exercices: "TD", dm: "DM", autre: "autre" };

export interface EcheanceInput {
  titre: string;
  matiere: EcheanceSubject;
  type: EcheanceType;
  date: string;
  chapitres?: string[];
  note?: string;
  minutes?: number;
}

export type EcheancePatch = Partial<EcheanceInput>;

type Result<T> = { ok: true; items: unknown[]; value: T } | { ok: false; error: string };

/**
 * Une date "AAAA-MM-JJ" qui existe vraiment, entre aujourd'hui et un an.
 * La regex seule laisse passer « 2026-02-30 » ; `new Date` aussi, en le
 * transformant en silence en 2 mars. On reconstruit donc le jour et on
 * vérifie qu'il n'a pas bougé.
 */
export function checkDate(date: string, today: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `« ${date} » n'est pas au format AAAA-MM-JJ`;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return `le ${date} n'existe pas`;
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days < 0) return `le ${date} est déjà passé (on est le ${today})`;
  if (days > MAX_DAYS_AHEAD) return `le ${date} est à plus d'un an : faute de frappe sur l'année ?`;
  return null;
}

function subjectOf(matiere: EcheanceSubject): Subject {
  return toSubject(matiere)!;
}

/** Même titre (sans tenir compte de la casse, des accents, de la ponctuation) et même jour. */
function duplicateKey(title: string, date: string | null): string {
  return `${foldText(title)}|${date ?? ""}`;
}

/**
 * Les chapitres nommés par Claude, rapprochés de la mémoire des chapitres de
 * l'élève (même matière, même titre à la casse près). Les reconnus
 * deviennent le programme de l'épreuve (`scope`, lu par la préparation de
 * DS) ; les autres sont gardés en clair dans la note — rien ne se perd.
 */
function resolveChapters(names: string[], subject: Subject, chapters: ChapterMemory[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const found = chapters.find((chapter) => !chapter.archived && chapter.subject === subject && foldText(chapter.title) === foldText(name));
    if (found) ids.push(found.id);
    else unknown.push(name);
  }
  return { ids, unknown };
}

const UNKNOWN_PREFIX = "Chapitres : ";

function composeNote(note: string | undefined, unknownChapters: string[]): string | undefined {
  const parts = [note?.trim() ?? "", unknownChapters.length ? `${UNKNOWN_PREFIX}${unknownChapters.join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join(" — ") : undefined;
}

function chapterList(raw: unknown): ChapterMemory[] {
  return Array.isArray(raw) ? raw.map(normalizeChapterMemory).filter((chapter): chapter is ChapterMemory => chapter !== null) : [];
}

function withNote(item: WorkItem, note: string | undefined): WorkItem {
  const next = { ...item };
  if (note) next.note = note;
  else delete next.note;
  return next;
}

/** Ajoute des échéances. Une date invalide refuse TOUT le lot (rien d'écrit) ; un doublon est seulement sauté. */
export function addEcheances(
  rawItems: unknown,
  inputs: EcheanceInput[],
  rawChapters: unknown,
  now: Date
): Result<{ added: WorkItem[]; duplicates: string[]; unknownChapters: string[] }> {
  const today = dayKey(now);
  const problems = inputs.map((input) => {
    const error = checkDate(input.date, today);
    return error ? `« ${input.titre} » : ${error}` : !input.titre.trim() ? "une échéance n'a pas de titre" : null;
  });
  if (problems.some(Boolean)) return { ok: false, error: `rien n'a été ajouté. ${problems.filter(Boolean).join(" ; ")}.` };

  const raw = Array.isArray(rawItems) ? rawItems : [];
  const chapters = chapterList(rawChapters);
  const taken = new Set(raw.map(normalizeWorkItem).filter((item) => item.status !== "abandonné").map((item) => duplicateKey(item.title, item.dueDate)));
  const added: WorkItem[] = [];
  const duplicates: string[] = [];
  const unknownChapters: string[] = [];

  for (const input of inputs) {
    const key = duplicateKey(input.titre, input.date);
    if (taken.has(key)) {
      duplicates.push(`${input.titre.trim()} (${input.date})`);
      continue;
    }
    taken.add(key);
    const subject = subjectOf(input.matiere);
    const { ids, unknown } = resolveChapters(input.chapitres ?? [], subject, chapters);
    unknownChapters.push(...unknown);
    let item = createWorkItem(
      { title: input.titre, kind: KIND_OF[input.type], subject, estimatedMinutes: input.minutes ?? DEFAULT_MINUTES, dueDate: input.date },
      now
    );
    if (ids.length) item = withScope(item, ids, now);
    item = withNote(item, composeNote(input.note, unknown));
    added.push(item);
  }

  // En TÊTE de liste, comme le formulaire de l'app (components/work/deadlines-overview.tsx).
  return { ok: true, items: [...added, ...raw], value: { added, duplicates, unknownChapters } };
}

function findIndex(raw: unknown[], id: string): number {
  return raw.findIndex((entry) => typeof entry === "object" && entry !== null && (entry as { id?: unknown }).id === id);
}

/** Corrige une échéance. Seuls les champs fournis changent ; `updatedAt` est posé pour que la fusion entre appareils retienne cette version. */
export function updateEcheance(rawItems: unknown, id: string, patch: EcheancePatch, rawChapters: unknown, now: Date): Result<WorkItem> {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const index = findIndex(raw, id);
  const current = index >= 0 ? normalizeWorkItem(raw[index]) : null;
  if (!current || current.status === "abandonné") return { ok: false, error: `aucune échéance avec l'id « ${id} » (list_echeances donne les ids).` };

  if (patch.date !== undefined) {
    const error = checkDate(patch.date, dayKey(now));
    if (error) return { ok: false, error: `rien n'a été modifié : ${error}.` };
  }
  if (patch.titre !== undefined && !patch.titre.trim()) return { ok: false, error: "rien n'a été modifié : le titre est vide." };

  const subject = patch.matiere ? subjectOf(patch.matiere) : current.subject;
  let next: WorkItem = {
    ...current,
    title: patch.titre?.trim() ?? current.title,
    kind: patch.type ? KIND_OF[patch.type] : current.kind,
    subject,
    dueDate: patch.date ?? current.dueDate,
    estimatedMinutes: patch.minutes !== undefined ? Math.max(1, Math.round(patch.minutes)) : current.estimatedMinutes,
  };

  const key = duplicateKey(next.title, next.dueDate);
  const clash = raw.map(normalizeWorkItem).some((other, i) => i !== index && other.status !== "abandonné" && duplicateKey(other.title, other.dueDate) === key);
  if (clash) return { ok: false, error: `rien n'a été modifié : une autre échéance « ${next.title} » existe déjà le ${next.dueDate}.` };

  if (patch.chapitres !== undefined) {
    const { ids, unknown } = resolveChapters(patch.chapitres, subject ?? "Mathématiques", chapterList(rawChapters));
    next = withScope(next, ids, now);
    const keptNote = patch.note ?? stripUnknown(current.note);
    next = withNote(next, composeNote(keptNote, unknown));
  } else if (patch.note !== undefined) {
    const unknownPart = current.note?.split(" — ").find((part) => part.startsWith(UNKNOWN_PREFIX));
    next = withNote(next, [patch.note.trim(), unknownPart ?? ""].filter(Boolean).join(" — ") || undefined);
  }
  next.updatedAt = now.toISOString();

  const items = [...raw];
  items[index] = next;
  return { ok: true, items, value: next };
}

function stripUnknown(note: string | undefined): string | undefined {
  return note?.split(" — ").filter((part) => !part.startsWith(UNKNOWN_PREFIX)).join(" — ") || undefined;
}

/**
 * Supprime une échéance — en la passant « abandonné », jamais en retirant la
 * ligne : la synchronisation fusionne par identifiant, et un appareil qui
 * l'aurait encore la ferait revenir (voir `WorkItemStatus`, lib/storage.ts).
 * Pour l'élève, elle a disparu partout.
 */
export function deleteEcheance(rawItems: unknown, id: string, now: Date): Result<WorkItem> {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const index = findIndex(raw, id);
  const current = index >= 0 ? normalizeWorkItem(raw[index]) : null;
  if (!current || current.status === "abandonné") return { ok: false, error: `aucune échéance avec l'id « ${id} » (list_echeances donne les ids).` };
  const next: WorkItem = { ...current, status: "abandonné", completedAt: null, updatedAt: now.toISOString() };
  const items = [...raw];
  items[index] = next;
  return { ok: true, items, value: next };
}

/** Ce que Claude voit d'une échéance — dans le vocabulaire de ses outils, pas celui du modèle. */
export function describeEcheance(item: WorkItem, rawChapters: unknown, now: Date) {
  const titles = new Map(chapterList(rawChapters).map((chapter) => [chapter.id, chapter.title]));
  return {
    id: item.id,
    titre: item.title,
    type: TYPE_OF[item.kind] ?? item.kind,
    matiere: item.subject,
    date: item.dueDate,
    dans_jours: daysUntilDue(item, now),
    chapitres: (item.scope?.chapterIds ?? []).map((id) => titles.get(id)).filter(Boolean),
    note: item.note ?? null,
    statut: item.status,
    minutes_prevues: item.estimatedMinutes,
  };
}

/** Les échéances encore à faire, d'aujourd'hui à `horizonDays` (toutes si absent), la plus proche d'abord. */
export function listEcheances(rawItems: unknown, rawChapters: unknown, now: Date, horizonDays?: number) {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  return raw
    .map(normalizeWorkItem)
    .filter(isActive)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: WorkItem; days: number } => entry.days !== null && entry.days >= 0 && (horizonDays === undefined || entry.days <= horizonDays))
    .sort((a, b) => a.days - b.days || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => describeEcheance(item, rawChapters, now));
}
