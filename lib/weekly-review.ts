import { computeEstimationBias, type EstimationBias } from "@/lib/estimation";
import { computeWorkItemPriority, sortByPriority } from "@/lib/deadlines";
import { dayKey, subjects } from "@/lib/study";
import { activeWorkItems } from "@/lib/work-items";
import { sessionsInWeek, startOfWeek, timeBySubjectInWeek } from "@/lib/week";
import { computeWeeklyComparison, computeSubjectDistribution } from "@/lib/analytics/work-time";
import { withSignMinutes } from "@/lib/analytics/trend";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import type { Preferences, WorkItem } from "@/lib/storage";

/**
 * BILAN HEBDOMADAIRE — des CONSTATS, pas un tableau de bord.
 *
 * L'écran Progression mesurait déjà beaucoup et n'interprétait presque rien :
 * « 45 min », « 8 séances », « 1 % » — des chiffres exacts dont
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
  key:
    | "volume"
    | "jour-le-plus-charge"
    | "reports"
    | "biais-estimation"
    | "echeance-a-risque"
    | "matiere-sous-servie"
    | "travaux-termines";
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
/**
 * Une matière est « sous-servie » quand elle reçoit moins de cette FRACTION
 * de la part équitable — la part équitable valant 100 % / nombre de matières
 * réellement travaillées cette semaine.
 *
 * C'était un seuil ABSOLU de 20 %, ce qui n'a pas de sens pour un produit
 * qui compte sept matières : une répartition parfaitement équilibrée en
 * donne 14 % à chacune, donc TOUTES étaient candidates. Combiné au
 * `.find()` sur une liste triée par volume DÉCROISSANT, le constat désignait
 * la matière la MIEUX servie de la semaine : « Mathématiques représente
 * 17 % de ton temps », sur une semaine où les maths arrivaient en tête.
 */
const UNDERSERVED_FAIR_SHARE_RATIO = 0.6;

export function computeWeeklyReview(
  workItems: WorkItem[],
  sessions: WorkSession[],
  preferences: Preferences,
  now: Date = new Date()
): WeeklyReview {
  const weekStart = startOfWeek(now);
  /*
   * Les séances POSTÉRIEURES à l'instant de référence sont écartées.
   *
   * Incohérence constatée à l'écran : le bandeau du bilan annonçait
   * « 15 h 40 travaillées » pendant que la courbe du rythme, juste en
   * dessous, en affichait 3 h 55 — parce que `sessionsInWeek` retient toute
   * la semaine calendaire quand les séries temporelles s'arrêtent à
   * maintenant. Deux nombres contradictoires sur le même écran suffisent à
   * discréditer les deux.
   */
  const weekSessions = sessionsInWeek(sessions, weekStart).filter((session) => new Date(session.started_at) <= now);
  const upToNow = sessions.filter((session) => new Date(session.started_at) <= now);
  const bySubject = timeBySubjectInWeek(upToNow, weekStart)
    .map(({ subject, seconds }) => ({ subject, minutes: Math.floor(seconds / 60) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  /*
   * LE TOTAL EST LA SOMME DE CE QUI EST AFFICHÉ, et pas un second calcul.
   *
   * `Math.floor` appliqué une fois au cumul global, puis une fois par
   * matière, produisait deux chiffres incompatibles sur le MÊME bloc : deux
   * séances de 59 min 40 donnaient « 119 min » au total pour « 59 + 59 » en
   * détail. L'écart croît avec le nombre de matières (jusqu'à −6 min), et
   * rien à l'écran ne l'explique. On additionne donc les lignes réellement
   * montrées : le total peut perdre quelques secondes d'arrondi, il ne peut
   * plus contredire son propre détail.
   */
  const totalMinutes = bySubject.reduce((sum, entry) => sum + entry.minutes, 0);

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
    .map((priority) => ({
      item: priority.item,
      remainingMinutes: priority.remainingMinutes,
      reason: priority.feasibility.reason,
      // Le NIVEAU voyage avec le constat : « juste » et « non casable » sont
      // deux situations opposées, et le conseil les traitait pareil.
      level: priority.feasibility.level,
      // Ce qui MANQUE réellement — 0 partout sauf en « non casable ».
      shortfallMinutes: priority.feasibility.shortfallMinutes,
    }));

  // ── Biais d'estimation le plus marqué ──────────────────────────────
  let strongestBias: EstimationBias | null = null;
  for (const subject of subjects) {
    const bias = computeEstimationBias(subject, workItems, sessions);
    if (bias && (!strongestBias || Math.abs(bias.deviationPercent) > Math.abs(strongestBias.deviationPercent))) strongestBias = bias;
  }

  /*
   * Plus de constat « matière délaissée » : il signalait une matière sans
   * séance ALORS QUE des exercices de l'ancienne banque y attendaient. La
   * banque retirée, ce critère n'a plus d'objet ; le retard sur un budget
   * de matière, lui, est déjà dit par « Mes matières » (lib/subject-targets.ts),
   * et la matière sous-servie ci-dessous couvre le cas des échéances ouvertes.
   */

  // ── Constats ───────────────────────────────────────────────────────
  // Chacun n'existe que si son calcul a produit quelque chose. Aucun
  // remplissage : une semaine sans rien de notable produit une liste vide,
  // ce qui est une information en soi.
  const findings: WeeklyFinding[] = [];

  /*
   * CE QUI A CHANGÉ, en tête — c'est la première chose qu'on vient vérifier.
   *
   * L'écart est présenté « à ce stade de la semaine » : comparer un mercredi
   * à une semaine complète produirait une baisse tous les mercredis, et
   * l'élève apprendrait vite à ignorer la ligne.
   */
  const comparison = computeWeeklyComparison(sessions, now);
  if (comparison.currentMinutes > 0 || comparison.previousMinutes > 0) {
    /*
     * « Première semaine mesurée » se disait dès que la semaine PRÉCÉDENTE
     * était vide — ce qui n'a rien à voir. Un élève inscrit depuis la
     * rentrée, revenant après une semaine de vacances, s'entendait annoncer
     * qu'il démarrait. La seule condition honnête est : aucune séance
     * enregistrée AVANT le lundi de cette semaine.
     */
    const isFirstMeasuredWeek = !sessions.some((session) => {
      const started = new Date(session.started_at);
      return started < weekStart && started <= now;
    });
    findings.push({
      key: "volume",
      sentence: isFirstMeasuredWeek
        ? `${formatShort(comparison.currentMinutes)} travaillées — première semaine mesurée.`
        : comparison.previousMinutes > 0
          ? `${formatShort(comparison.currentMinutes)} travaillées, ${withSignMinutes(comparison.deltaMinutes)} par rapport à la semaine précédente à ce stade.`
          : `${formatShort(comparison.currentMinutes)} travaillées — rien n'avait été enregistré la semaine précédente.`,
    });
  }

  if (completed.length > 0) {
    findings.push({
      key: "travaux-termines",
      // « travaux », pas « travailx » : le pluriel de « travail » est irrégulier.
      sentence: `${completed.length} ${completed.length > 1 ? "travaux terminés" : "travail terminé"} cette semaine.`,
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

  /*
   * UNE MATIÈRE SOUS-SERVIE — la part du temps confrontée aux échéances
   * réellement ouvertes dans cette matière.
   *
   * C'est le seul constat qui croise deux moteurs, et il n'est produit que
   * quand les deux ont de quoi parler : une matière qui porte une échéance
   * ouverte mais reçoit moins d'un cinquième du temps de la semaine. En
   * dessous de ce seuil, l'écart relève du bruit hebdomadaire, pas d'un
   * déséquilibre — et l'annoncer chaque semaine le rendrait invisible.
   */
  const distribution = computeSubjectDistribution(sessions, weekStart, now);
  const openBySubject = new Map<Subject, number>();
  for (const item of activeWorkItems(workItems)) {
    if (item.subject) openBySubject.set(item.subject, (openBySubject.get(item.subject) ?? 0) + 1);
  }
  /*
   * La part équitable dépend du nombre de matières RÉELLEMENT travaillées
   * cette semaine — pas des sept du catalogue : une semaine à trois matières
   * n'a pas le même équilibre attendu qu'une semaine à six.
   *
   * Et parmi les candidates, on retient la PLUS sous-servie, pas la
   * première venue : `distribution` est triée par volume décroissant, donc
   * un `.find()` y prenait exactement la moins concernée.
   */
  const fairShare = distribution.length > 0 ? 100 / distribution.length : 0;
  const underserved = distribution
    .filter((entry) => (openBySubject.get(entry.subject) ?? 0) > 0 && entry.percent < fairShare * UNDERSERVED_FAIR_SHARE_RATIO)
    .reduce<(typeof distribution)[number] | null>((worst, entry) => (worst === null || entry.percent < worst.percent ? entry : worst), null);
  if (underserved && distribution.length > 1) {
    const open = openBySubject.get(underserved.subject) ?? 0;
    findings.push({
      key: "matiere-sous-servie",
      sentence: `${underserved.subject} représente ${underserved.percent} % de ton temps cette semaine, alors que ${open} échéance${open > 1 ? "s y sont ouvertes" : " y est ouverte"}.`,
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
    advice: deriveAdvice({ atRisk, strongestBias, busiestDay, underserved: underserved ?? null }),
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
  atRisk: { item: WorkItem; remainingMinutes: number; level: string; shortfallMinutes: number }[];
  strongestBias: EstimationBias | null;
  busiestDay: { date: string; minutes: number } | null;
  underserved: { subject: Subject; percent: number } | null;
}): string | null {
  const [risk] = input.atRisk;
  if (risk) {
    /*
     * « C'EST CE QUI MANQUE » NE SE DIT QUE QUAND QUELQUE CHOSE MANQUE.
     *
     * `atRisk` inclut le niveau « juste », où RIEN ne manque par définition
     * — la marge est seulement mince. Et même en « non casable », la phrase
     * citait `remainingMinutes` (tout le reste à faire) là où le manque réel
     * est `shortfallMinutes`. Deux chiffres différents sous le même mot,
     * dans un module dont l'en-tête promet que chaque phrase cite le sien.
     */
    if (!risk.item.dueDate) {
      return `Réserve ${formatShort(risk.remainingMinutes)} pour « ${risk.item.title} », qui n'a encore aucune place dans ton planning.`;
    }
    if (risk.level === "non casable" && risk.shortfallMinutes > 0) {
      return `Il manque ${formatShort(risk.shortfallMinutes)} pour tenir « ${risk.item.title} » avant ${weekdayName(risk.item.dueDate)} : avance-le, ou revois son ampleur.`;
    }
    return `Réserve ${formatShort(risk.remainingMinutes)} avant ${weekdayName(risk.item.dueDate)} pour « ${risk.item.title} » — la marge est mince.`;
  }
  if (input.underserved) {
    return `Prévois une séance supplémentaire de ${input.underserved.subject} : elle porte des échéances ouvertes et n'a reçu que ${input.underserved.percent} % de ton temps cette semaine.`;
  }
  if (input.strongestBias && input.strongestBias.deviationPercent > 0) {
    return `Ajoute environ ${input.strongestBias.deviationPercent} % à tes prochaines estimations de ${input.strongestBias.subject} : c'est l'écart que tes travaux terminés montrent.`;
  }
  /*
   * Le CONSTAT « dimanche était ta journée la plus chargée » est un fait sur
   * la semaine écoulée, et il reste. Le CONSEIL qui en découlait, lui,
   * transformait une observation sur DEUX journées comparables en une
   * habitude à corriger, et désignait un jour déjà passé — parfois
   * aujourd'hui même. Une semaine ne suffit pas à établir une habitude ;
   * l'affirmer est exactement le saut que ce module s'interdit ailleurs.
   */
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
