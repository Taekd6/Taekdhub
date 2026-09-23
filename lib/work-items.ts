import { dayKey } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import type { WorkItem, WorkItemKind, WorkItemStatus } from "@/lib/storage";

/**
 * MODÈLE DU TRAVAIL PLANIFIABLE — la couche « pour quand ».
 *
 * L'élève travaille sur ses propres feuilles : TaekdHub ne sait pas ce qu'il
 * y a dans un DM ou une série d'exercices, et ne prétend pas le savoir. Ce
 * module répond à trois questions, et à rien d'autre :
 *
 *   — qu'est-ce qui est à faire (`WorkItem`) ;
 *   — pour quand (`dueDate`) ;
 *   — combien en reste-t-il (`remainingMinutes`).
 *
 * Fonctions PURES, sans localStorage, sans React, sans DOM : la persistance
 * vit dans lib/storage.ts, la réactivité dans hooks/use-prepahub-data.ts.
 * Même contrat que lib/review-items.ts et lib/grades.ts.
 */

export const WORK_ITEM_KIND_META: Record<WorkItemKind, { label: string; short: string }> = {
  dm: { label: "Devoir maison", short: "DM" },
  ds: { label: "Devoir surveillé", short: "DS" },
  exercices: { label: "Série d'exercices", short: "Exercices" },
  chapitre: { label: "Révision de chapitre", short: "Révision" },
  concours: { label: "Préparation concours", short: "Concours" },
  autre: { label: "Autre travail", short: "Autre" },
};

/** Un travail encore à faire — ni terminé, ni abandonné (voir `WorkItemStatus`, lib/storage.ts). */
export function isActive(item: WorkItem): boolean {
  return item.status === "à faire" || item.status === "en cours";
}

/** Les travaux encore à faire, dans l'ordre reçu. Toujours passer par ici : un travail « abandonné » ne doit apparaître nulle part. */
export function activeWorkItems(items: WorkItem[]): WorkItem[] {
  return items.filter(isActive);
}

/**
 * Minutes RÉELLEMENT faites sur ce travail, sommées depuis les séances qui le
 * portent (`WorkSession.work_item_id`).
 *
 * Calculé à la demande et jamais stocké (règle du Sprint 2.6 : aucune durée
 * cumulée recopiée, pour éliminer tout risque de divergence). Une seule
 * source de vérité pour une durée : les séances.
 */
export function doneMinutes(item: WorkItem, sessions: WorkSession[]): number {
  const seconds = sessions
    .filter((session) => session.work_item_id === item.id)
    .reduce((total, session) => total + session.duration_seconds, 0);
  return Math.floor(seconds / 60);
}

/**
 * Minutes qu'il RESTE à faire — jamais négatif.
 *
 * C'est cette valeur, et elle seule, que le planificateur replace : reporter
 * un DM de 60 min dont 30 sont faites replanifie 30 min, pas 60. Dépasser
 * l'estimation ne crée pas de dette négative : un travail sur lequel on a
 * passé plus de temps que prévu et qui n'est pas déclaré terminé a
 * simplement 0 minute restante — l'élève décide s'il le clôt.
 */
export function remainingMinutes(item: WorkItem, sessions: WorkSession[]): number {
  return Math.max(0, item.estimatedMinutes - doneMinutes(item, sessions));
}

/** Avancement 0–100, plafonné — même convention que `DailyObjective.percent` (lib/next-action.ts). */
export function progressPercent(item: WorkItem, sessions: WorkSession[]): number {
  if (item.estimatedMinutes <= 0) return 0;
  return Math.min(100, Math.round((doneMinutes(item, sessions) / item.estimatedMinutes) * 100));
}

/**
 * Jours qui séparent aujourd'hui de l'échéance : 0 = aujourd'hui, 1 = demain,
 * −2 = il y a deux jours. `null` quand le travail n'a pas de date.
 *
 * Comparaison de JOURS, pas d'instants : une échéance « jeudi » reste à
 * 0 jour pendant tout le jeudi, y compris à 23 h. Un DM à rendre jeudi n'est
 * pas « en retard » à 9 h du matin ce jeudi-là.
 */
export function daysUntilDue(item: WorkItem, now: Date = new Date()): number | null {
  if (!item.dueDate) return null;
  const due = new Date(`${item.dueDate}T00:00:00`).getTime();
  const today = new Date(`${dayKey(now)}T00:00:00`).getTime();
  return Math.round((due - today) / 86400000);
}

/**
 * EN RETARD — un fait sur le PASSÉ : l'échéance est dépassée et il reste du
 * travail.
 *
 * À ne jamais confondre avec « infaisable » (lib/deadlines.ts), qui est une
 * projection sur l'AVENIR. Un travail peut être en retard et parfaitement
 * rattrapable ; un autre peut être dans les temps et déjà impossible à
 * caser. Les deux signaux ne se mélangent ni dans le code, ni à l'écran.
 */
export function isOverdue(item: WorkItem, sessions: WorkSession[], now: Date = new Date()): boolean {
  if (!isActive(item)) return false;
  const days = daysUntilDue(item, now);
  return days !== null && days < 0 && remainingMinutes(item, sessions) > 0;
}

/** Champs saisis à la création — le reste (id, dates, statut initial, compteurs) est posé par `createWorkItem`. */
export interface NewWorkItemInput {
  title: string;
  kind: WorkItemKind;
  subject: Subject | null;
  estimatedMinutes: number;
  dueDate: string | null;
  dueTime?: string | null;
  important?: boolean;
}

/** Fabrique pure — aucun effet de bord, l'appelant persiste le résultat via `saveWorkItems`. */
export function createWorkItem(input: NewWorkItemInput, now: Date = new Date()): WorkItem {
  return {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    kind: input.kind,
    subject: input.subject,
    estimatedMinutes: Math.max(1, Math.round(input.estimatedMinutes)),
    dueDate: input.dueDate,
    dueTime: input.dueTime ?? null,
    status: "à faire",
    important: input.important ?? false,
    notBeforeDate: null,
    // Champ HÉRITÉ de l'ancienne banque d'exercices — voir `WorkItem.chapterIds`.
    chapterIds: [],
    createdAt: now.toISOString(),
    completedAt: null,
    postponements: [],
  };
}

/**
 * Applique un correctif à un travail de la liste et renvoie une NOUVELLE
 * liste — jamais de mutation en place.
 *
 * `completedAt` est tenu ici, au seul endroit où le statut change : le poser
 * dans chaque appelant garantissait qu'un jour l'un d'eux l'oublierait, et
 * le bilan hebdomadaire compte les travaux terminés dans la semaine à partir
 * de cette date.
 */
export function updateWorkItem(items: WorkItem[], id: string, patch: Partial<WorkItem>, now: Date = new Date()): WorkItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (next.status === "terminé" && item.status !== "terminé") next.completedAt = now.toISOString();
    if (next.status !== "terminé") next.completedAt = null;
    return next;
  });
}

/** Marque le travail comme terminé — le temps déjà enregistré n'est jamais modifié, seul le statut change. */
export function completeWorkItem(items: WorkItem[], id: string, now: Date = new Date()): WorkItem[] {
  return updateWorkItem(items, id, { status: "terminé" }, now);
}

/**
 * SUPPRESSION — par changement de statut, jamais par retrait de la liste.
 *
 * Voir `WorkItemStatus` (lib/storage.ts) : la fusion par identifiant de
 * `mergeStored` n'est correcte que parce que rien n'est jamais réellement
 * supprimé dans cette application. Pour l'élève, un travail abandonné a
 * disparu — il n'apparaît dans aucun écran et dans aucun moteur.
 */
export function abandonWorkItem(items: WorkItem[], id: string): WorkItem[] {
  return updateWorkItem(items, id, { status: "abandonné" });
}

/** Travaux d'une matière donnée, encore à faire — utilisé pour cadrer le moteur de recommandation sur la portée d'un travail. */
export function activeItemsForSubject(items: WorkItem[], subject: Subject): WorkItem[] {
  return activeWorkItems(items).filter((item) => item.subject === subject);
}

/** Libellé court d'un statut, pour l'affichage — la valeur brute est déjà en français, mais le passage par une table évite qu'un écran en réinvente un. */
export const WORK_ITEM_STATUS_META: Record<WorkItemStatus, { label: string }> = {
  "à faire": { label: "À faire" },
  "en cours": { label: "En cours" },
  terminé: { label: "Terminé" },
  abandonné: { label: "Abandonné" },
};
