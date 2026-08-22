import { DEADLINE_RELEVANCE_HORIZON_DAYS } from "@/lib/deadline-horizon";
import type { Deadline, DeadlineType } from "@/lib/storage";
import type { Chapter } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/** Réexportée pour ne rien changer aux imports existants — définition réelle dans lib/deadline-horizon.ts, voir sa doc. */
export { DEADLINE_RELEVANCE_HORIZON_DAYS };

/**
 * Échéances (Sprint Study OS Phase 4 — "DS et khôlles") — module purement
 * fonctionnel, comme `lib/chapters.ts`/`lib/work-queue.ts` : le type
 * `Deadline` et sa persistance vivent dans `lib/storage.ts`, ce fichier ne
 * fait que le manipuler et en dériver un signal de priorité par chapitre,
 * consommé par `lib/recommendation.ts` (voir `chapterDeadlineSignals`).
 */

export function addDeadline(deadlines: Deadline[], input: Omit<Deadline, "id">): Deadline[] {
  return [...deadlines, { ...input, id: crypto.randomUUID() }];
}

export function removeDeadline(deadlines: Deadline[], id: string): Deadline[] {
  return deadlines.filter((deadline) => deadline.id !== id);
}

export function updateDeadline(deadlines: Deadline[], id: string, patch: Partial<Omit<Deadline, "id">>): Deadline[] {
  return deadlines.map((deadline) => (deadline.id === id ? { ...deadline, ...patch } : deadline));
}

/**
 * Jours (signés, peut être négatif) entre `now` et une date d'échéance —
 * délibérément différent de `lib/plan.ts#daysUntilContest` (qui plafonne à 0
 * et traite une date passée comme "aujourd'hui", pertinent pour UNE échéance
 * globale rarement laissée périmée). Ici, une liste de plusieurs échéances
 * doit pouvoir exclure proprement celles déjà passées (voir
 * `upcomingDeadlines`/`chapterDeadlineSignals` ci-dessous) plutôt que les
 * voir rester "urgentes" indéfiniment. `null` si la date est absente/invalide.
 */
export function daysUntilDeadline(date: string, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const startOfNow = new Date(now);
  startOfNow.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);
  return Math.round((startOfTarget.getTime() - startOfNow.getTime()) / 86400000);
}

export interface UpcomingDeadline {
  deadline: Deadline;
  days: number;
}

/** Échéances à venir (aujourd'hui inclus), triées de la plus proche à la plus lointaine — une échéance passée ou à date invalide n'apparaît jamais. */
export function upcomingDeadlines(deadlines: Deadline[], now: Date = new Date()): UpcomingDeadline[] {
  return deadlines
    .map((deadline) => ({ deadline, days: daysUntilDeadline(deadline.date, now) }))
    .filter((entry): entry is UpcomingDeadline => entry.days !== null && entry.days >= 0)
    .sort((a, b) => a.days - b.days);
}

/** La prochaine échéance à venir pour une matière donnée, ou `null` — pour l'affichage ("Prochaine échéance : DS dans 3 j") dans la carte "Échéances" du Dashboard. */
export function nearestDeadlineForSubject(deadlines: Deadline[], subject: Subject, now: Date = new Date()): UpcomingDeadline | null {
  return upcomingDeadlines(deadlines, now).find((entry) => entry.deadline.subject === subject) ?? null;
}

const TYPE_LABEL: Record<DeadlineType, string> = { DS: "ton DS", "khôlle": "ta khôlle", autre: "ton échéance" };

/** Libellé lisible pour une échéance à J-`days` — ex. "ton DS de Mathématiques dans 3 j" / "ta khôlle de Physique demain". */
export function deadlineLabel(deadline: Deadline, days: number): string {
  const when = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} j`;
  return `${TYPE_LABEL[deadline.type]} de ${deadline.subject} ${when}`;
}

export interface ChapterDeadlineSignal {
  /** Jours restants avant l'échéance la plus proche concernant ce chapitre — toujours 0-`DEADLINE_RELEVANCE_HORIZON_DAYS`. */
  days: number;
  /** Libellé prêt à l'affichage — voir `deadlineLabel`. */
  label: string;
}

/**
 * Résout les échéances en un signal par CHAPITRE (pas par matière) — pour que
 * `lib/recommendation.ts` puisse faire remonter précisément les exercices des
 * chapitres concernés, pas toute la matière. Un chapitre référencé par
 * plusieurs échéances ne garde que la plus proche (le signal le plus
 * actionnable). Un chapitre supprimé depuis (son id ne correspond plus à
 * aucun exercice) n'a simplement aucun effet — jamais d'erreur, cette Map
 * n'est consultée que par lookup, jamais itérée contre la liste des
 * chapitres existants.
 */
export function chapterDeadlineSignals(deadlines: Deadline[], now: Date = new Date()): Map<string, ChapterDeadlineSignal> {
  const signals = new Map<string, ChapterDeadlineSignal>();
  for (const { deadline, days } of upcomingDeadlines(deadlines, now)) {
    if (days > DEADLINE_RELEVANCE_HORIZON_DAYS) continue;
    const label = deadlineLabel(deadline, days);
    for (const chapterId of deadline.chapterIds) {
      const existing = signals.get(chapterId);
      if (!existing || days < existing.days) signals.set(chapterId, { days, label });
    }
  }
  return signals;
}

/** Libellés des chapitres associés à une échéance, dans l'ordre où ils sont stockés — pour l'affichage (Réglages, résumé d'une échéance). Un id sans chapitre correspondant (supprimé depuis) est simplement omis. */
export function deadlineChapterLabels(deadline: Deadline, chapters: Chapter[]): string[] {
  const byId = new Map(chapters.map((chapter) => [chapter.id, chapter.label]));
  return deadline.chapterIds.map((id) => byId.get(id)).filter((label): label is string => label !== undefined);
}
