import { computeEstimationBias, type EstimationBias } from "@/lib/estimation";
import { computeWorkItemPriority, sortByPriority } from "@/lib/deadlines";
import { dayKey, subjects, totalSeconds } from "@/lib/study";
import { activeWorkItems } from "@/lib/work-items";
import { sessionsInWeek, startOfWeek, timeBySubjectInWeek, neglectedSubjects } from "@/lib/week";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";
import type { Preferences, WorkItem } from "@/lib/storage";

/**
 * BILAN HEBDOMADAIRE — des CONSTATS, pas un tableau de bord.
 *
 * L'écran Progression mesurait déjà beaucoup et n'interprétait presque rien :
 * « 45 min », « 8 exercices maîtrisés », « 1 % » — des chiffres exacts dont
 * l'élève ne sait pas quoi faire à sept heures du matin. Ce module produit
 * la couche manquante : mesure → interprétation → action.
 *
 * RÈGLE ABSOLUE, et c'est tout l'objet de ce fichier : chaque phrase
 * produite ici est adossée à un calcul réellement effectué dans la même
 * fonction, et cite son chiffre. Aucun constat n'est écrit « parce qu'il
 * faut bien dire quelque chose ». Un constat qu'on ne peut pas prouver est
 * un constat qui n'est pas produit — la liste est alors simplement plus
 * courte, et c'est très bien ainsi.
 *
 * Aucune mesure n'est réinventée : le temps par matière vient de
 * lib/week.ts, les matières délaissées aussi, le biais d'estimation de
 * lib/estimation.ts, le risque d'échéance de lib/deadlines.ts.
 *
 * Fonctions pures.
 */

/** Un constat — une phrase, et la clé qui dit de quel calcul elle sort. */
export interface WeeklyFinding {
  key: "jour-le-plus-charge" | "reports" | "biais-estimation" | "echeance-a-risque" | "matiere-delaissee" | "travaux-termines";
  sentence: string;
}

export interface WeeklyReview {
  /** Bornes de la semaine en cours (lundi 00:00 → maintenant). */
  weekStart: string;
  totalMinutes: number;
  bySubject: { subject: Subject; minutes: number }[];
  /** La journée la plus travaillée de la semaine — `null` s'il n'y a pas de quoi comparer. */
  busiestDay: { date: string; minutes: number } | null;
  completedCount: number;
  postponedCount: number;
  /** Échéances encore ouvertes qui ne tiennent plus, ou tout juste — déjà triées par urgence. */
  atRisk: { item: WorkItem; remainingMinutes: number; reason: string }[];
  findings: WeeklyFinding[];
  /** UN conseil au plus, déduit du premier constat actionnable — jamais une liste de recommandations génériques. */
  advice: string | null;
}

/** Il faut au moins deux journées travaillées pour qu'un « jour le plus chargé » veuille dire quelque chose. */
const MIN_DAYS_FOR_BUSIEST = 2;

export function computeWeeklyReview(
  workItems: WorkItem[],
  sessions: WorkSession[],
  exercises: Exercise[],
  preferences: Preferences,
  now: Date = new Date()
): WeeklyReview {
  const weekStart = startOfWeek(now);
  const weekSessions = sessionsInWeek(sessions, weekStart);
  const totalMinutes = Math.floor(totalSeconds(weekSessions) / 60);

  const bySubject = timeBySubjectInWeek(sessions, weekStart)
    .map(({ subject, seconds }) => ({ subject, minutes: Math.floor(seconds / 60) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  // ── Journée la plus chargée ────────────────────────────────────────
  const minutesByDay = new Map<string, number>();
  for (const session of weekSessions) {
    const key = dayKey(session.started_at);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.duration_seconds / 60);
  }
  const days = [...minutesByDay.entries()].map(([date, minutes]) => ({ date, minutes: Math.floor(minutes) })).sort((a, b) => b.minutes - a.minutes);
  // Strictement supérieure à la deuxième : deux journées à égalité ne
  // désignent aucune « journée la plus chargée », et l'affirmer serait une
  // interprétation que les données ne portent pas.
  const busiestDay = days.length >= MIN_DAYS_FOR_BUSIEST && days[0].minutes > days[1].minutes ? days[0] : null;

  // ── Travaux terminés et reportés dans la semaine ───────────────────
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const inWeek = (iso: string) => {
    const time = new Date(iso).getTime();
    return time >= weekStart.getTime() && time < weekEnd.getTime();
  };
  const completed = workItems.filter((item) => item.status === "terminé" && item.completedAt && inWeek(item.completedAt));
  const postponements = workItems.flatMap((item) =>
    item.postponements.filter((entry) => inWeek(entry.at)).map((entry) => ({ item, entry }))
  );

  // ── Échéances encore ouvertes qui ne tiennent plus ─────────────────
  const atRisk = sortByPriority(activeWorkItems(workItems).map((item) => computeWorkItemPriority(item, sessions, preferences, now)))
    .filter((priority) => priority.feasibility.level === "non casable" || priority.feasibility.level === "juste")
    .map((priority) => ({ item: priority.item, remainingMinutes: priority.remainingMinutes, reason: priority.feasibility.reason }));

  // ── Biais d'estimation le plus marqué ──────────────────────────────
  let strongestBias: EstimationBias | null = null;
  for (const subject of subjects) {
    const bias = computeEstimationBias(subject, workItems, sessions);
    if (bias && (!strongestBias || Math.abs(bias.deviationPercent) > Math.abs(strongestBias.deviationPercent))) strongestBias = bias;
  }

  const neglected = neglectedSubjects(exercises, sessions, now);

  // ── Constats ───────────────────────────────────────────────────────
  // Chacun n'existe que si son calcul a produit quelque chose. Aucun
  // remplissage : une semaine sans rien de notable produit une liste vide,
  // ce qui est une information en soi.
  const findings: WeeklyFinding[] = [];

  if (completed.length > 0) {
    findings.push({
      key: "travaux-termines",
      sentence: `${completed.length} travail${completed.length > 1 ? "x" : ""} terminé${completed.length > 1 ? "s" : ""} cette semaine.`,
    });
  }

  if (busiestDay) {
    findings.push({
      key: "jour-le-plus-charge",
      sentence: `${capitalize(weekdayName(busiestDay.date))} était ta journée la plus chargée : ${formatShort(busiestDay.minutes)}.`,
    });
  }

  if (postponements.length > 0) {
    const bySubjectCount = new Map<string, number>();
    for (const { item } of postponements) {
      const key = item.subject ?? "—";
      bySubjectCount.set(key, (bySubjectCount.get(key) ?? 0) + 1);
    }
    const [dominantSubject, dominantCount] = [...bySubjectCount].sort((a, b) => b[1] - a[1])[0];
    findings.push({
      key: "reports",
      sentence:
        dominantSubject !== "—" && dominantCount === postponements.length
          ? `Tu as reporté ton travail de ${dominantSubject} ${countLabel(postponements.length)} cette semaine.`
          : `${postponements.length} report${postponements.length > 1 ? "s" : ""} cette semaine.`,
    });
  }

  if (atRisk.length > 0) {
    const first = atRisk[0];
    findings.push({
      key: "echeance-a-risque",
      sentence: `${first.item.title}${first.item.dueDate ? ` (${weekdayName(first.item.dueDate)})` : ""} représente encore ${formatShort(first.remainingMinutes)} de préparation.`,
    });
  }

  if (strongestBias) findings.push({ key: "biais-estimation", sentence: strongestBias.sentence });

  if (neglected.length > 0) {
    const first = neglected[0];
    findings.push({
      key: "matiere-delaissee",
      sentence: `Aucune séance de ${first.subject} cette semaine, alors que ${first.pendingCount} exercice${first.pendingCount > 1 ? "s" : ""} y ${first.pendingCount > 1 ? "attendent" : "attend"}.`,
    });
  }

  return {
    weekStart: weekStart.toISOString(),
    totalMinutes,
    bySubject,
    busiestDay,
    completedCount: completed.length,
    postponedCount: postponements.length,
    atRisk,
    findings,
    advice: deriveAdvice({ atRisk, neglected, strongestBias, busiestDay }),
  };
}

/**
 * LE CONSEIL — un seul, et il DÉCOULE d'un constat précis.
 *
 * L'ordre n'est pas arbitraire : on conseille d'abord sur ce qui a une
 * échéance (le seul enjeu réellement daté), puis sur ce qui disparaît du
 * travail, puis sur la façon d'estimer. `null` quand rien ne le justifie —
 * un conseil générique ne vaut pas mieux que pas de conseil, il vaut moins,
 * parce qu'il apprend à ignorer les suivants.
 */
function deriveAdvice(input: {
  atRisk: { item: WorkItem; remainingMinutes: number }[];
  neglected: { subject: Subject; pendingCount: number }[];
  strongestBias: EstimationBias | null;
  busiestDay: { date: string; minutes: number } | null;
}): string | null {
  const [risk] = input.atRisk;
  if (risk) {
    return risk.item.dueDate
      ? `Réserve ${formatShort(risk.remainingMinutes)} avant ${weekdayName(risk.item.dueDate)} pour « ${risk.item.title} » — c'est ce qui manque aujourd'hui.`
      : `Réserve ${formatShort(risk.remainingMinutes)} pour « ${risk.item.title} », qui n'a encore aucune place dans ton planning.`;
  }
  const [neglected] = input.neglected;
  if (neglected) return `Prévois une séance de ${neglected.subject} : c'est la seule matière sans aucun travail cette semaine.`;
  if (input.strongestBias && input.strongestBias.deviationPercent > 0) {
    return `Ajoute environ ${input.strongestBias.deviationPercent} % à tes prochaines estimations de ${input.strongestBias.subject} : c'est l'écart que tes travaux terminés montrent.`;
  }
  if (input.busiestDay) return `Prévois davantage de marge le ${weekdayName(input.busiestDay.date)} : c'est ta journée la plus chargée.`;
  return null;
}

const WEEKDAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Nom du jour d'une date "AAAA-MM-JJ" — en minuscules, la capitalisation est la décision de l'appelant. */
function weekdayName(date: string): string {
  return WEEKDAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function countLabel(count: number): string {
  if (count === 1) return "une fois";
  if (count === 2) return "deux fois";
  return `${count} fois`;
}

function formatShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
