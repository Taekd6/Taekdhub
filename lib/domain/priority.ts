import { isDeadlineCategory } from "@/lib/domain/categories";
import { dayKey, daysBetween } from "@/lib/domain/date";
import { dueInfo, isMissedSlot, isOpen, isOverdue, nextSlot, remainingMinutes } from "@/lib/domain/tasks";
import type { AppState, Task, TimeEntry } from "@/lib/domain/types";

/**
 * ============================================================================
 * PRIORISATION — « qu'est-ce que je devrais faire maintenant ? »
 * ============================================================================
 *
 * Un score, et surtout des RAISONS. Un classement qu'on ne peut pas expliquer
 * n'est pas suivi : chaque tâche remontée dit pourquoi elle est là, en
 * français, dans les mots de l'élève (« pour demain », « prévue hier, pas
 * faite », « 3 h restantes, 2 jours »).
 *
 * Six composantes, additionnées. Elles sont volontairement lisibles une par
 * une, plutôt qu'un modèle opaque : c'est ce qui permet de corriger le
 * comportement quand il déplaît, et de le tester (domain/priority.test.ts).
 *
 *   1. PRESSION D'ÉCHÉANCE  — la principale. Croît quand la date approche, et
 *      d'autant plus vite qu'il reste beaucoup de travail à faire dessus.
 *      C'est ce qui distingue « DM de 3 h pour après-demain » (urgent) de
 *      « relire 20 min pour après-demain » (pas urgent).
 *   2. RETARD               — échéance dépassée ou créneau manqué.
 *   3. PRIORITÉ DÉCLARÉE    — ce que l'élève a dit lui-même.
 *   4. CRÉNEAU DU JOUR      — ce qui est prévu aujourd'hui passe avant ce qui
 *      ne l'est pas ; l'heure prévue départage.
 *   5. REPORTS RÉPÉTÉS      — une tâche qui glisse depuis trois jours remonte.
 *      Sans cela, une tâche sans échéance peut être reportée indéfiniment.
 *   6. EN COURS             — une tâche commencée se termine avant d'en ouvrir
 *      une autre. Le coût de reprise est réel.
 */

export interface ScoredTask {
  task: Task;
  score: number;
  /** Phrases courtes, déjà rédigées, dans l'ordre d'importance. Au plus trois sont affichées. */
  reasons: string[];
  /** Travail restant, en minutes. */
  minutes: number;
  overdue: boolean;
}

/** Poids — une constante nommée vaut mieux qu'un nombre au milieu d'une formule. */
const WEIGHT = {
  overdueBase: 120,
  overduePerDay: 12,
  overdueMax: 220,
  missedSlot: 55,
  deadlinePressureMax: 150,
  deadlineEvent: 40,
  priority: 22,
  scheduledToday: 70,
  scheduledSoonBonus: 25,
  postponed: 14,
  postponedMax: 56,
  inProgress: 45,
  noDueDecay: -6,
} as const;

/**
 * PRESSION D'ÉCHÉANCE — le cœur du classement.
 *
 * On ne compare pas une date à aujourd'hui : on compare le TRAVAIL RESTANT au
 * TEMPS RESTANT. `ratio = travail restant / jours restants` — une tâche de
 * 3 h à rendre dans 3 jours pèse une heure par jour ; la même à rendre demain
 * en pèse trois. C'est exactement le raisonnement qu'un élève fait à voix
 * haute, et il reste juste quelle que soit la taille des tâches.
 */
function deadlinePressure(task: Task, minutes: number, now: Date): number {
  if (!task.dueAt) return WEIGHT.noDueDecay;
  const days = daysBetween(now, task.dueAt);
  if (days < 0) return WEIGHT.deadlinePressureMax; // le retard est compté à part, mais la pression reste maximale.
  const horizon = Math.max(1, days); // « pour aujourd'hui » et « pour demain » partagent le même dénominateur : 1 jour.
  const perDay = minutes / horizon;
  // 180 min/jour sur une seule tâche = volume maximal. Au-delà, plafonner :
  // une tâche démesurée ne doit pas écraser tout le reste du classement.
  const volume = Math.min(1, perDay / 180);

  /*
   * La PROXIMITÉ décroît vite, et c'est délibéré. Une courbe linéaire
   * (`1 - jours / 14`) donne 0,80 à demain et 0,86 à après-demain : deux
   * échéances qu'un élève ne vit pas du tout de la même façon se retrouvaient
   * à six centièmes l'une de l'autre, si bien qu'un gros DM pour
   * après-demain passait devant un devoir à rendre DEMAIN. Une hyperbole
   * sépare réellement les jours proches (1 → 0,63 → 0,45 → 0,36…), ce qui
   * correspond à la façon dont une échéance se rapproche.
   *
   * Le volume ne fait plus que MODULER (de 0,6 à 1) au lieu de multiplier :
   * il départage deux tâches de même échéance, il ne renverse jamais l'ordre
   * des échéances.
   */
  const proximity = 1 / (1 + 0.6 * days);
  return Math.round(WEIGHT.deadlinePressureMax * proximity * (0.6 + 0.4 * volume));
}

export function scoreTask(task: Task, entries: TimeEntry[], now: Date = new Date()): ScoredTask {
  const minutes = remainingMinutes(task, entries);
  const reasons: string[] = [];
  let score = 0;

  const info = dueInfo(task, now);
  const overdue = isOverdue(task, now);

  if (info.state === "overdue" && info.days !== undefined) {
    const late = Math.abs(info.days);
    score += Math.min(WEIGHT.overdueMax, WEIGHT.overdueBase + late * WEIGHT.overduePerDay);
    reasons.push(late === 1 ? "Échéance dépassée depuis hier" : `Échéance dépassée depuis ${late} jours`);
  } else if (info.state === "today") {
    reasons.push(isDeadlineCategory(task.category) ? "C'est aujourd'hui" : "À rendre aujourd'hui");
  } else if (info.state === "tomorrow") {
    reasons.push(isDeadlineCategory(task.category) ? "C'est demain" : "À rendre demain");
  } else if (info.state === "soon" && info.days !== undefined) {
    reasons.push(`Dans ${info.days} jours`);
  }

  score += deadlinePressure(task, minutes, now);

  if (isDeadlineCategory(task.category)) score += WEIGHT.deadlineEvent;

  if (isMissedSlot(task, now)) {
    score += WEIGHT.missedSlot;
    reasons.push("Prévue plus tôt, pas faite");
  }

  score += (task.priority - 2) * WEIGHT.priority;
  if (task.priority === 4) reasons.push("Priorité critique");
  else if (task.priority === 3) reasons.push("Priorité haute");

  const upcoming = nextSlot(task, now);
  if (upcoming) {
    const days = daysBetween(now, upcoming.start);
    if (days === 0) {
      score += WEIGHT.scheduledToday;
      // Départage l'ordre du jour : plus l'heure prévue est proche, plus la
      // tâche remonte — sans jamais dépasser le poids d'un vrai retard.
      const untilStart = (new Date(upcoming.start).getTime() - now.getTime()) / 60_000;
      score += untilStart <= 0 ? WEIGHT.scheduledSoonBonus : Math.max(0, WEIGHT.scheduledSoonBonus - untilStart / 30);
      reasons.push("Prévue aujourd'hui");
    } else if (days === 1) {
      score += 10;
    }
  }

  if (task.postponedCount > 0) {
    score += Math.min(WEIGHT.postponedMax, task.postponedCount * WEIGHT.postponed);
    if (task.postponedCount >= 2) reasons.push(`Reportée ${task.postponedCount} fois`);
  }

  if (task.status === "doing") {
    score += WEIGHT.inProgress;
    reasons.push("Déjà commencée");
  }

  return { task, score: Math.round(score), reasons, minutes, overdue };
}

/** Toutes les tâches ouvertes, classées. C'est la liste de référence de « Aujourd'hui » et de la planification. */
export function rankOpenTasks(state: AppState, now: Date = new Date()): ScoredTask[] {
  return state.tasks
    .filter(isOpen)
    .map((task) => scoreTask(task, state.timeEntries, now))
    .sort((a, b) => b.score - a.score || a.minutes - b.minutes);
}

export interface NextAction {
  kind: "now" | "nothing-planned" | "empty" | "done-for-today";
  /** La tâche à faire maintenant — absente pour `nothing-planned`, `empty` et `done-for-today`. */
  scored?: ScoredTask;
  title: string;
  /** Une phrase, en français, qui justifie la proposition. */
  rationale: string;
  /** La suite immédiate : « ensuite », puis « plus tard ». */
  next: ScoredTask[];
  later: ScoredTask[];
}

/**
 * PROCHAINE ACTION — une seule décision affichable, avec sa justification.
 *
 * Le classement complet existe déjà (`rankOpenTasks`) ; ce qui manque à un
 * élève à 18 h, c'est UNE phrase. Ce module choisit donc la tête du
 * classement, puis compose la file « ensuite / plus tard » en respectant le
 * temps qu'il reste réellement dans la journée (`remainingCapacityMinutes`) :
 * proposer 4 h de travail à 21 h 30 ne sert personne.
 */
export function computeNextAction(
  state: AppState,
  options: { now?: Date; remainingCapacityMinutes?: number } = {}
): NextAction {
  const now = options.now ?? new Date();
  const ranked = rankOpenTasks(state, now);

  if (ranked.length === 0) {
    return state.tasks.length === 0
      ? { kind: "empty", title: "Rien à faire — pour l'instant", rationale: "Aucune tâche enregistrée. Commence par y mettre ce que tu as à faire cette semaine.", next: [], later: [] }
      : { kind: "done-for-today", title: "Tout est fait", rationale: "Aucune tâche ouverte. Profites-en, ou ajoute ce qui arrive la semaine prochaine.", next: [], later: [] };
  }

  const [first, ...rest] = ranked;
  const budget = options.remainingCapacityMinutes;

  // « Ensuite » : ce qui tient encore dans le temps restant de la journée. Sans
  // budget connu, on s'en tient à trois propositions.
  const next: ScoredTask[] = [];
  let used = first.minutes;
  for (const candidate of rest) {
    if (next.length >= 3) break;
    if (budget !== undefined && used + candidate.minutes > budget) continue;
    next.push(candidate);
    used += candidate.minutes;
  }
  const taken = new Set([first.task.id, ...next.map((item) => item.task.id)]);
  const later = rest.filter((item) => !taken.has(item.task.id)).slice(0, 4);

  return {
    kind: "now",
    scored: first,
    title: first.task.title,
    rationale: explain(first, now),
    next,
    later,
  };
}

/** Une phrase complète, pas une liste de mots-clés — c'est ce qui rend la proposition crédible. */
export function explain(scored: ScoredTask, now: Date = new Date()): string {
  const { task, minutes } = scored;
  const info = dueInfo(task, now);

  if (info.state === "overdue") {
    const late = Math.abs(info.days ?? 0);
    return `En retard de ${late} jour${late > 1 ? "s" : ""} — il reste ${minutes} min de travail dessus.`;
  }
  if (info.state === "today") return `À rendre aujourd'hui, ${minutes} min estimées.`;
  if (info.state === "tomorrow") return `À rendre demain : ${minutes} min à placer avant ce soir.`;
  if (info.state === "soon" && info.days) {
    const perDay = Math.ceil(minutes / info.days);
    return `Échéance dans ${info.days} jours — environ ${perDay} min par jour si tu l'étales.`;
  }
  const upcoming = nextSlot(task, now);
  if (upcoming && dayKey(upcoming.start) === dayKey(now)) {
    return `C'est ce que tu avais prévu aujourd'hui : ${minutes} min.`;
  }
  if (task.postponedCount >= 2) return `Reportée ${task.postponedCount} fois — ${minutes} min suffisent à la sortir de la liste.`;
  if (task.priority >= 3) return `Priorité ${task.priority === 4 ? "critique" : "haute"}, ${minutes} min estimées.`;
  return `${minutes} min estimées — rien de plus urgent pour l'instant.`;
}
