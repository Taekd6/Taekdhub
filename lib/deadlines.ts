import { cumulativePlannableMinutes, remainingPlannableToday } from "@/lib/capacity";
import { daysUntilDue, isOverdue, remainingMinutes } from "@/lib/work-items";
import type { WorkSession } from "@/lib/supabase/types";
import type { Preferences, WorkItem } from "@/lib/storage";

/**
 * ÉCHÉANCES — deux questions, deux axes, jamais mélangés.
 *
 *   EST-CE EN RETARD ?    Un fait sur le PASSÉ : l'échéance est dépassée et
 *                         il reste du travail. Se lit dans
 *                         lib/work-items.ts#isOverdue.
 *
 *   EST-CE CASABLE ?      Une projection sur l'AVENIR : le temps qu'il reste
 *                         à faire tient-il dans la capacité planifiable d'ici
 *                         l'échéance. C'est `computeFeasibility`, ici.
 *
 * Confondre les deux est l'erreur que tout ce module existe pour empêcher.
 * Un DM rendu en retard d'un jour peut être rattrapable en une demi-heure ;
 * un DS dans six jours peut être déjà infaisable. « Proche » n'a jamais
 * voulu dire « impossible », et une échéance ne devient JAMAIS « impossible »
 * du seul fait qu'elle approche : il faut avoir compté les minutes
 * disponibles, et pouvoir les citer.
 *
 * Toutes les phrases produites ici sont dérivées de chiffres réellement
 * calculés et exposés dans le même objet (`remainingMinutes`,
 * `availableMinutes`, `shortfallMinutes`) : l'élève doit pouvoir contester le
 * verdict en relisant ses propres nombres.
 *
 * Fonctions pures — aucun localStorage, aucun React.
 */

export type FeasibilityLevel =
  /** Le travail restant tient confortablement dans la capacité d'ici l'échéance. */
  | "casable"
  /** Il tient, mais il ne reste presque rien pour l'imprévu. */
  | "juste"
  /** Il ne tient pas : `shortfallMinutes` dit combien il manque. */
  | "non casable"
  /** L'échéance est passée — la question « est-ce casable avant » n'a plus d'objet, c'est un retard (voir `isOverdue`). */
  | "échéance dépassée"
  /** Aucune date : rien à projeter, et surtout rien à dramatiser. */
  | "sans échéance";

export interface Feasibility {
  level: FeasibilityLevel;
  /** Minutes qu'il reste à faire sur ce travail. */
  remainingMinutes: number;
  /** Capacité PLANIFIABLE cumulée d'aujourd'hui à l'échéance incluse — marge déjà déduite, et le temps déjà travaillé aujourd'hui déjà retiré. */
  availableMinutes: number;
  /** Minutes manquantes — 0 partout sauf en « non casable ». */
  shortfallMinutes: number;
  /** Phrase explicite, construite à partir des trois nombres ci-dessus. Jamais un verdict sans ses chiffres. */
  reason: string;
}

/**
 * Au-delà de cette part de la capacité disponible, le travail « tient » mais
 * sans marge d'erreur — un exercice plus long que prévu suffit à le faire
 * basculer. 85 % : la marge globale (20 % par défaut) protège déjà des aléas
 * ordinaires ; ce seuil-ci signale qu'il ne reste même plus de quoi absorber
 * un décalage à l'intérieur de ce qui a été planifié.
 */
const TIGHT_RATIO = 0.85;

/**
 * Le travail restant tient-il d'ici l'échéance ?
 *
 * ISOLÉMENT — cette fonction ne regarde qu'UN travail. Deux travaux
 * séparément casables peuvent parfaitement être infaisables ensemble : ce
 * verdict-là ne peut venir que du planificateur, qui les place réellement
 * dans les mêmes journées (voir lib/planning.ts#buildWeeklyPlan). C'est la
 * mesure d'entrée, pas le mot de la fin.
 */
export function computeFeasibility(
  item: WorkItem,
  sessions: WorkSession[],
  preferences: Preferences,
  now: Date = new Date()
): Feasibility {
  const remaining = remainingMinutes(item, sessions);

  if (!item.dueDate) {
    return { level: "sans échéance", remainingMinutes: remaining, availableMinutes: 0, shortfallMinutes: 0, reason: "Aucune échéance fixée." };
  }

  const days = daysUntilDue(item, now) ?? 0;
  if (days < 0) {
    return {
      level: "échéance dépassée",
      remainingMinutes: remaining,
      availableMinutes: 0,
      shortfallMinutes: 0,
      reason: remaining > 0 ? `Échéance dépassée, il reste ${formatShort(remaining)} à faire.` : "Échéance dépassée.",
    };
  }

  // Aujourd'hui compte pour ce qu'il en reste (le temps déjà travaillé n'est
  // plus disponible) ; les jours suivants pour leur capacité planifiable
  // pleine, puisque rien n'y a encore été fait.
  const today = remainingPlannableToday(preferences, sessions, now);
  const laterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const due = new Date(`${item.dueDate}T00:00:00`);
  const later = days >= 1 ? cumulativePlannableMinutes(preferences, laterStart, due) : 0;
  const available = today + later;

  if (remaining === 0) {
    return { level: "casable", remainingMinutes: 0, availableMinutes: available, shortfallMinutes: 0, reason: "Le temps estimé est déjà fait." };
  }

  if (remaining > available) {
    const shortfall = remaining - available;
    return {
      level: "non casable",
      remainingMinutes: remaining,
      availableMinutes: available,
      shortfallMinutes: shortfall,
      // La formulation exigée par le cahier des charges : on DIT les deux
      // nombres. « Impossible » tout court n'est pas un verdict, c'est une
      // affirmation invérifiable.
      reason: `Il reste ${formatShort(remaining)} de travail pour ${formatShort(available)} disponibles avant l'échéance.`,
    };
  }

  if (remaining > available * TIGHT_RATIO) {
    return {
      level: "juste",
      remainingMinutes: remaining,
      availableMinutes: available,
      shortfallMinutes: 0,
      reason: `${formatShort(remaining)} à faire pour ${formatShort(available)} disponibles : il ne reste presque pas de marge.`,
    };
  }

  return {
    level: "casable",
    remainingMinutes: remaining,
    availableMinutes: available,
    shortfallMinutes: 0,
    reason: `${formatShort(remaining)} à faire, ${formatShort(available)} disponibles d'ici l'échéance.`,
  };
}

export type PriorityLevel = "élevée" | "moyenne" | "basse";

export interface WorkItemPriority {
  item: WorkItem;
  score: number;
  level: PriorityLevel;
  /** Raisons brutes, comme `ExerciseRecommendation.reasons` — chacune correspond à un terme réellement ajouté au score. */
  reasons: string[];
  feasibility: Feasibility;
  remainingMinutes: number;
  /** 0 = aujourd'hui, 1 = demain, négatif = dépassée, `null` = sans échéance. */
  daysUntilDue: number | null;
  overdue: boolean;
}

/*
 * BARÈME — volontairement à gros grain, et chaque terme porte sa raison.
 *
 * Le score n'a aucune signification absolue : il sert à ORDONNER, exactement
 * comme `urgencyScore` dans lib/recommendation.ts. Ce qui compte, c'est que
 * chaque point ajouté soit justifiable d'une phrase — un score qu'on ne peut
 * pas expliquer est un score auquel l'élève n'a aucune raison de se fier.
 */
const SCORE_OVERDUE = 100;
const SCORE_DUE_TODAY = 80;
const SCORE_DUE_TOMORROW = 60;
const SCORE_DUE_SOON = 40;
const SCORE_DUE_THIS_WEEK = 20;
const SCORE_DUE_LATER = 5;
const SCORE_NOT_FEASIBLE = 50;
const SCORE_TIGHT = 25;
const SCORE_IMPORTANT = 30;

const PRIORITY_HIGH_THRESHOLD = 80;
const PRIORITY_MEDIUM_THRESHOLD = 35;

/** Priorité d'un travail — recalculée à chaque affichage, jamais stockée : elle dépend de la date du jour, une valeur figée serait fausse dès le lendemain. */
export function computeWorkItemPriority(
  item: WorkItem,
  sessions: WorkSession[],
  preferences: Preferences,
  now: Date = new Date()
): WorkItemPriority {
  const feasibility = computeFeasibility(item, sessions, preferences, now);
  const remaining = remainingMinutes(item, sessions);
  const days = daysUntilDue(item, now);
  const overdue = isOverdue(item, sessions, now);
  const reasons: string[] = [];
  let score = 0;

  if (overdue) {
    score += SCORE_OVERDUE;
    const late = Math.abs(days ?? 0);
    reasons.push(late === 1 ? "En retard d'un jour" : `En retard de ${late} jours`);
  } else if (days === null) {
    reasons.push("Sans échéance");
  } else if (days === 0) {
    score += SCORE_DUE_TODAY;
    reasons.push("Échéance aujourd'hui");
  } else if (days === 1) {
    score += SCORE_DUE_TOMORROW;
    reasons.push("Échéance demain");
  } else if (days <= 3) {
    score += SCORE_DUE_SOON;
    reasons.push(`Échéance dans ${days} jours`);
  } else if (days <= 7) {
    score += SCORE_DUE_THIS_WEEK;
    reasons.push(`Échéance dans ${days} jours`);
  } else {
    score += SCORE_DUE_LATER;
    reasons.push(`Échéance dans ${days} jours`);
  }

  if (feasibility.level === "non casable") {
    score += SCORE_NOT_FEASIBLE;
    reasons.push("Plus assez de temps disponible");
  } else if (feasibility.level === "juste") {
    score += SCORE_TIGHT;
    reasons.push("Peu de marge avant l'échéance");
  }

  if (item.important) {
    score += SCORE_IMPORTANT;
    reasons.push("Marqué important");
  }

  const level: PriorityLevel =
    score >= PRIORITY_HIGH_THRESHOLD ? "élevée" : score >= PRIORITY_MEDIUM_THRESHOLD ? "moyenne" : "basse";

  return { item, score, level, reasons, feasibility, remainingMinutes: remaining, daysUntilDue: days, overdue };
}

/**
 * Tri du plus urgent au moins urgent, avec des départages EXPLICITES —
 * indispensables quand deux échéances tombent le même jour, où le score seul
 * laisserait l'ordre du fichier décider (un artefact d'implémentation, pas
 * un signal).
 *
 * Dans l'ordre : le score, puis le travail explicitement marqué important,
 * puis celui qui ne tient plus dans le temps disponible, puis le plus long à
 * finir (le plus court peut encore se caser ailleurs), puis le titre — pour
 * que l'ordre soit STABLE d'un affichage à l'autre.
 */
export function sortByPriority(priorities: WorkItemPriority[]): WorkItemPriority[] {
  return [...priorities].sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.item.important) - Number(a.item.important) ||
      Number(b.feasibility.level === "non casable") - Number(a.feasibility.level === "non casable") ||
      b.remainingMinutes - a.remainingMinutes ||
      a.item.title.localeCompare(b.item.title, "fr")
  );
}

/**
 * UNE phrase qui explique la priorité, sur le modèle de
 * lib/recommendation.ts#explainReasons : la raison la plus décisive, pas la
 * concaténation de toutes. Jamais de texte inventé — `null` quand il n'y a
 * rien à dire.
 */
export function explainPriority(priority: WorkItemPriority): string | null {
  if (priority.reasons.length === 0) return null;
  const { feasibility, remainingMinutes: remaining, daysUntilDue: days, overdue } = priority;

  // Un travail dont tout le temps estimé est passé n'attend plus du travail,
  // il attend une DÉCISION : le clore, ou rallonger l'estimation. Lui dire
  // « la charge tient dans ton rythme » serait absurde.
  if (remaining === 0) return "Le temps que tu avais estimé est déjà passé — tu peux le marquer terminé.";
  if (overdue) return `${priority.reasons[0]}, ${formatShort(remaining)} restent à faire.`;
  if (feasibility.level === "non casable") return feasibility.reason;
  if (days === 0) return `À rendre aujourd'hui — ${formatShort(remaining)} restent à faire.`;
  if (days === 1) return `À rendre demain — ${formatShort(remaining)} restent à faire.`;
  if (feasibility.level === "juste") return feasibility.reason;
  if (days === null) return `Sans échéance — ${formatShort(remaining)} à faire quand tu auras le temps.`;
  return `Échéance dans ${days} jours, ${formatShort(remaining)} à faire : la charge tient dans ton rythme.`;
}

/**
 * Durée compacte pour une phrase — « 45 min », « 2 h », « 1 h 30 ».
 *
 * Volontairement locale plutôt qu'importée de lib/utils.ts#formatSpan : les
 * phrases produites ici sont du DOMAINE (elles sont testées au caractère
 * près), et les faire dépendre d'un format d'affichage lierait les tests
 * métier à une décision de présentation.
 */
function formatShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
