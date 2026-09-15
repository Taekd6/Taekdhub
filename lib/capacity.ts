import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";
import type { Preferences } from "@/lib/storage";

/**
 * CAPACITÉ — combien de minutes de travail personnel une journée peut
 * réellement absorber.
 *
 * Deux notions distinctes vivent ici, et les confondre produit exactement le
 * planning que personne ne tient :
 *
 *   CAPACITÉ DÉCLARÉE      ce dont l'élève dispose un jour donné, une fois
 *                          les cours, les colles et les trajets déduits.
 *                          Posée par lui dans Réglages (`capacityByWeekday`).
 *
 *   CAPACITÉ PLANIFIABLE   ce que TaekdHub s'autorise à remplir : la
 *                          déclarée, MOINS une marge. Toujours strictement
 *                          inférieure.
 *
 * La marge n'est pas de la prudence décorative. Un exercice dure plus
 * longtemps que prévu, un cours déborde, une correction traîne : une journée
 * planifiée à 100 % est en retard dès la première heure, et c'est le planning
 * entier que l'élève cesse alors de croire.
 *
 * À ne jamais confondre non plus avec `Preferences.dailyGoalMinutes`, qui est
 * un OBJECTIF — ce que l'élève VEUT faire. La capacité est un PLAFOND — ce
 * qu'il PEUT faire. Les deux sont indépendants et peuvent diverger dans les
 * deux sens.
 *
 * Fonctions pures : aucune dépendance à localStorage, React ou au DOM.
 */

/** Index de `capacityByWeekday` pour une date : 0 = lundi … 6 = dimanche (`Date#getDay` compte à partir du dimanche). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

/** Capacité DÉCLARÉE de ce jour-là, en minutes — telle que l'élève l'a réglée, sans marge. */
export function declaredCapacityMinutes(preferences: Preferences, date: Date): number {
  return preferences.capacityByWeekday[weekdayIndex(date)] ?? 0;
}

/**
 * Capacité PLANIFIABLE de ce jour-là — la déclarée diminuée de la marge.
 *
 * Arrondie à l'entier inférieur : mieux vaut planifier une minute de moins
 * que la marge ne le permet qu'une de plus.
 */
export function plannableMinutes(preferences: Preferences, date: Date): number {
  const declared = declaredCapacityMinutes(preferences, date);
  const kept = Math.max(0, 100 - preferences.planningMarginPercent) / 100;
  return Math.floor(declared * kept);
}

/**
 * Capacité planifiable CUMULÉE sur l'intervalle de jours [from, to], bornes
 * incluses — la mesure qui décide si un travail est casable avant son
 * échéance (voir lib/deadlines.ts).
 *
 * `from` postérieur à `to` renvoie 0 : une échéance déjà passée n'offre plus
 * aucune capacité, et c'est bien ce qu'il faut répondre.
 */
export function cumulativePlannableMinutes(preferences: Preferences, from: Date, to: Date): number {
  let total = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  // Garde-fou : une échéance saisie à plusieurs siècles d'ici ne doit pas
  // faire tourner cette boucle indéfiniment. Deux ans couvrent largement
  // l'horizon d'une prépa (le concours est à 18 mois au plus).
  let guard = 0;
  while (cursor <= last && guard < 800) {
    total += plannableMinutes(preferences, cursor);
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return total;
}

/** Minutes déjà travaillées un jour donné, toutes séances confondues — le temps qui n'est plus disponible aujourd'hui. */
export function workedMinutesOnDay(sessions: WorkSession[], date: Date): number {
  const key = dayKey(date);
  const seconds = sessions
    .filter((session) => dayKey(session.started_at) === key)
    .reduce((total, session) => total + session.duration_seconds, 0);
  return Math.floor(seconds / 60);
}

/**
 * Capacité planifiable RESTANTE aujourd'hui — la planifiable du jour, moins
 * ce qui a déjà été fait.
 *
 * N'est appliquée qu'au jour courant : pour les jours à venir, rien n'a
 * encore été travaillé, et retrancher quoi que ce soit reviendrait à
 * inventer une occupation.
 */
export function remainingPlannableToday(preferences: Preferences, sessions: WorkSession[], now: Date = new Date()): number {
  return Math.max(0, plannableMinutes(preferences, now) - workedMinutesOnDay(sessions, now));
}

/** Nombre minimum de journées observées pour un jour de semaine donné avant d'oser en tirer une suggestion — voir `suggestCapacityFromHistory`. */
export const CAPACITY_SUGGESTION_MIN_SAMPLES = 2;
/** Profondeur d'observation, en jours — quatre semaines : assez pour lisser une semaine creuse, assez court pour refléter le rythme actuel. */
const CAPACITY_SUGGESTION_WINDOW_DAYS = 28;

export interface CapacitySuggestion {
  /** Index du jour, 0 = lundi. */
  weekday: number;
  /** Minutes suggérées — la MÉDIANE des journées réellement travaillées ce jour-là, jamais une moyenne. */
  minutes: number;
  /** Combien de journées ont servi à la calculer — affiché tel quel, pour que l'élève juge de la solidité. */
  samples: number;
}

/**
 * Ce que l'historique DIT du rythme réel, jour de semaine par jour de
 * semaine — et rien de plus.
 *
 * Trois précautions, qui sont le sujet même de cette fonction :
 *
 *   — un jour de semaine observé moins de `CAPACITY_SUGGESTION_MIN_SAMPLES`
 *     fois n'est pas suggéré du tout. Deux mardis ne font pas une habitude,
 *     mais un seul ne fait rien du tout ;
 *   — la MÉDIANE, pas la moyenne : une seule journée de six heures avant un
 *     DS ne doit pas faire croire que tous les samedis y ressemblent ;
 *   — les journées à zéro minute sont EXCLUES. Un dimanche sans séance peut
 *     être un dimanche sans temps comme un dimanche sans envie : on ne sait
 *     pas, donc on ne conclut pas.
 *
 * Le résultat est une SUGGESTION. Rien ici n'écrit dans les préférences :
 * l'élève voit la proposition et décide. TaekdHub ne prétend pas connaître
 * son emploi du temps.
 */
export function suggestCapacityFromHistory(sessions: WorkSession[], now: Date = new Date()): CapacitySuggestion[] {
  const since = new Date(now.getTime() - CAPACITY_SUGGESTION_WINDOW_DAYS * 86400000);
  const minutesByDay = new Map<string, number>();
  for (const session of sessions) {
    const started = new Date(session.started_at);
    if (started < since || started > now) continue;
    const key = dayKey(started);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.duration_seconds / 60);
  }

  const byWeekday = new Map<number, number[]>();
  for (const [key, minutes] of minutesByDay) {
    if (minutes <= 0) continue;
    const index = weekdayIndex(new Date(`${key}T00:00:00`));
    const bucket = byWeekday.get(index) ?? [];
    bucket.push(minutes);
    byWeekday.set(index, bucket);
  }

  const suggestions: CapacitySuggestion[] = [];
  for (const [weekday, values] of [...byWeekday].sort((a, b) => a[0] - b[0])) {
    if (values.length < CAPACITY_SUGGESTION_MIN_SAMPLES) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
    suggestions.push({ weekday, minutes: Math.round(median), samples: values.length });
  }
  return suggestions;
}
