import { ANKI_DUE_STALE_HOURS, latestDueInfo, snapshotAgeHours, type AnkiSnapshot } from "@/lib/anki-snapshot";
import { chapterErrors, notesFor, type ChapterNotes } from "@/lib/chapter-notes";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { ErrorEntry, WorkItem } from "@/lib/storage";
import { dayKey } from "@/lib/study";
import { daysUntilDue, isActive, WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * « AUJOURD'HUI » (accueil) — ce qu'il faut faire, en quelques lignes.
 *
 * Règles, toutes écrites ici et rien d'autre (aucun score, aucun moteur) :
 *
 *   1. Les ÉCHÉANCES de l'élève : travaux à faire dont la date tombe dans les
 *      `DEADLINE_HORIZON_DAYS` prochains jours, ou en retard de moins de
 *      `OVERDUE_MAX_DAYS` jours. Un travail en retard depuis plus longtemps
 *      n'est pas proposé : le cours a avancé ; il reste dans « À faire ».
 *   2. Les ERREURS notées dans les chapitres EN COURS.
 *   3. Les CHAPITRES EN COURS eux-mêmes (réglage de l'élève, /chapitres).
 *
 * Rien ne vient d'un chapitre qui n'est pas « en cours » ni d'une échéance
 * lointaine : le cours avance, on ne revient pas à un exercice vieux de
 * trois mois. Au plus `MAX_LINES` lignes, chacune avec sa raison.
 *
 * Anki est une ligne À PART : TaekdHub montre le nombre de cartes dues et la
 * date du relevé, sans toucher au planning d'Anki.
 *
 * Fonctions pures.
 */

export const DEADLINE_HORIZON_DAYS = 14;
export const OVERDUE_MAX_DAYS = 7;
export const MAX_LINES = 5;
const MAX_DEADLINE_LINES = 3;

export interface TodayLine {
  id: string;
  kind: "echeance" | "erreurs" | "chapitre";
  title: string;
  /** La raison, en une phrase. */
  why: string;
  href: string;
  /** Échéance aujourd'hui, demain ou dépassée. */
  urgent: boolean;
}

export interface TodayAnki {
  due: number;
  /** Jour du relevé, « AAAA-MM-JJ ». */
  day: string;
  /** Relevé de plus de `ANKI_DUE_STALE_HOURS` : le nombre ne dit plus rien d'aujourd'hui. */
  stale: boolean;
  /** « aujourd'hui », « hier », « il y a 21 jours ». */
  ageLabel: string;
}

export interface TodayView {
  lines: TodayLine[];
  anki: TodayAnki | null;
  /** Aucun chapitre en cours choisi : l'écran invite à en choisir un. */
  needsChapter: boolean;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

function dayAge(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function dueLabel(days: number, time: string | null): string {
  const hour = time ? ` à ${time}` : "";
  if (days < -1) return `en retard de ${days * -1} jours`;
  if (days === -1) return "en retard d'un jour";
  if (days === 0) return `aujourd'hui${hour}`;
  if (days === 1) return `demain${hour}`;
  return `dans ${days} jours${hour}`;
}

/** Les échéances à montrer : les plus proches d'abord, en retard compris (récent seulement). */
function deadlineLines(workItems: WorkItem[], now: Date): TodayLine[] {
  const candidates = workItems
    .filter(isActive)
    .map((item) => ({ item, days: daysUntilDue(item, now) }))
    .filter((entry): entry is { item: WorkItem; days: number } => entry.days !== null && entry.days >= -OVERDUE_MAX_DAYS && entry.days <= DEADLINE_HORIZON_DAYS);
  candidates.sort((a, b) => a.days - b.days || Number(b.item.important) - Number(a.item.important) || (a.item.dueTime ?? "99:99").localeCompare(b.item.dueTime ?? "99:99") || a.item.createdAt.localeCompare(b.item.createdAt));
  return candidates.slice(0, MAX_DEADLINE_LINES).map(({ item, days }) => ({
    id: `echeance:${item.id}`,
    kind: "echeance",
    title: item.title,
    why: `${WORK_ITEM_KIND_META[item.kind].short} · ${dueLabel(days, item.dueTime)}`,
    href: "/echeances",
    urgent: days <= 1,
  }));
}

export function buildToday(input: { workItems: WorkItem[]; errors: ErrorEntry[]; chapterNotes: ChapterNotes[]; ankiSnapshots: AnkiSnapshot[]; currentChapterIds: string[]; now: Date }): TodayView {
  const { workItems, errors, chapterNotes, ankiSnapshots, now } = input;
  const current = input.currentChapterIds.filter((id) => PROGRAMME_BY_ID.has(id));

  const errorLines: TodayLine[] = [];
  const chapterLines: TodayLine[] = [];
  for (const id of current) {
    const chapter = PROGRAMME_BY_ID.get(id)!;
    const noted = chapterErrors(errors, id);
    if (noted.length > 0) {
      errorLines.push({
        id: `erreurs:${id}`,
        kind: "erreurs",
        title: `Relire tes erreurs · ${chapter.title}`,
        why: `${plural(noted.length, "erreur notée", "erreurs notées")}, la plus récente du ${noted[0].date.split("-").reverse().join("/")}`,
        href: `/chapitre/${id}`,
        urgent: false,
      });
    }
    const entry = notesFor(chapterNotes, id);
    chapterLines.push({
      id: `chapitre:${id}`,
      kind: "chapitre",
      title: entry?.cours ? `Revoir le cours · ${chapter.title}` : `Ranger le cours · ${chapter.title}`,
      why: entry?.cours ? "chapitre en cours, cours rangé" : "chapitre en cours, cours pas encore rangé : envoie-le à Claude",
      href: `/chapitre/${id}`,
      urgent: false,
    });
  }

  const lines = [...deadlineLines(workItems, now), ...errorLines, ...chapterLines].slice(0, MAX_LINES);

  const info = latestDueInfo(ankiSnapshots);
  const anki: TodayAnki | null = info
    ? { due: info.due, day: dayKey(info.takenAt), stale: snapshotAgeHours(info.takenAt, now) > ANKI_DUE_STALE_HOURS, ageLabel: ageLabel(dayAge(dayKey(info.takenAt), dayKey(now))) }
    : null;

  return { lines, anki, needsChapter: current.length === 0 };
}
