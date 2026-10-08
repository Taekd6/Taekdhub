import { remainingPlannableToday, workedMinutesOnDay } from "@/lib/capacity";
import { rankCandidates, skippedKeys, type MoveCandidate, type NextMoveInput } from "@/lib/next-move/engine";
import { buildWeeklyPlan, todaysPlan } from "@/lib/planning";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { formatMinutesSpan } from "@/lib/utils";
import { daysUntilDue, WORK_ITEM_KIND_META } from "@/lib/work-items";

/**
 * PLAN ADAPTATIF DE LA JOURNÉE — « avec le temps qu'il me reste, qu'est-ce
 * que je garde, qu'est-ce que je réduis, qu'est-ce que je déplace ? »
 *
 * CE MODULE N'INVENTE AUCUNE TÂCHE. Il reprend ce qui est déjà calculé :
 *   — les propositions de Next Move (lib/next-move/engine.ts), avec leur
 *     poids et leurs raisons ;
 *   — la part d'aujourd'hui du planning des échéances (lib/planning.ts).
 * Et il ne stocke AUCUN plan : il est recalculé à chaque affichage, comme le
 * planning. Seule une TRACE des versions successives est gardée, pour dire
 * ce qui a changé et pourquoi (lib/day-agenda-log.ts).
 *
 * TROIS PALIERS, règles explicites :
 *
 *   indispensable  échéance pour aujourd'hui, demain ou en retard ; minimum
 *                  du soir (l'engagement que tu as pris) ; révisions dues
 *                  (cartes « À revoir », Anki) ; préparation d'une épreuve
 *                  qui a lieu demain au plus tard.
 *   important      échéance dans 2 à 7 jours ou planifiée aujourd'hui par un
 *                  « si… alors… » ; exercice à refaire ; rappel d'un
 *                  chapitre qui s'efface ; révision Anki d'un chapitre ;
 *                  exercice ciblé du diagnostic ; préparation d'une épreuve
 *                  à venir.
 *   secondaire     tout le reste : bloc pour l'objectif de la semaine,
 *                  reprise d'erreurs, échéance lointaine.
 *
 * ARBITRAGE dans le temps restant (`budget`), palier par palier, et dans un
 * palier par poids décroissant :
 *
 *   1. Les indispensables sont TOUS gardés. S'ils dépassent le temps
 *      restant, ce qui peut l'être est ramené à sa durée minimale ; ce qui
 *      dépasse encore est DIT (`overflow`), jamais compressé ni caché : c'est
 *      à toi de décider (prolonger, demander un délai).
 *   2. Puis les importants, puis les secondaires : gardé à sa durée prévue
 *      s'il tient ; sinon RÉDUIT à ce qui reste, sans descendre sous sa durée
 *      minimale ; sinon DÉPLACÉ à demain, avec la raison.
 *
 * Rien n'est jamais retiré en silence : tout ce qui n'est pas gardé figure
 * dans `postponed`, avec sa raison.
 *
 * LE TEMPS RESTANT : la capacité planifiable du jour (capacité déclarée moins
 * la marge, lib/capacity.ts) moins ce qui est déjà fait, borné par l'heure
 * (pas au-delà de `DAY_END_HOUR`) — ou ce que tu as indiqué toi-même
 * (« il me reste 1 h »), diminué du travail fait depuis.
 *
 * Fonctions pures.
 */

export type AgendaTier = "indispensable" | "important" | "secondaire";
export const AGENDA_TIERS: readonly AgendaTier[] = ["indispensable", "important", "secondaire"];

export const TIER_LABEL: Record<AgendaTier, string> = {
  indispensable: "Indispensable aujourd'hui",
  important: "Important, déplaçable",
  secondaire: "Secondaire",
};

/** Heure au-delà de laquelle TaekdHub ne planifie plus rien. */
export const DAY_END_HOUR = 23;
/** Pas d'arrondi des durées. */
const STEP = 5;

export interface AgendaTask {
  key: string;
  title: string;
  subject: Subject | null;
  tier: AgendaTier;
  /** Pourquoi ce palier, en une phrase. */
  tierReason: string;
  /** Durée prévue et durée minimale acceptable. */
  idealMinutes: number;
  minMinutes: number;
  /** Poids de Next Move (ordre dans un palier). */
  score: number;
  href: string;
  action: string;
  /** Identifiant du travail, pour un report durable (lib/planning.ts#postponeWorkItem). */
  workItemId: string | null;
  /** Échéance du travail (AAAA-MM-JJ), quand il y en a une. */
  dueDate: string | null;
}

export interface KeptTask extends AgendaTask {
  minutes: number;
  /** Durée prévue avant réduction, quand elle a été réduite. */
  reducedFrom: number | null;
}

export interface PostponedTask extends AgendaTask {
  reason: string;
  /** « demain » — ou, pour une échéance, l'avertissement si demain est trop tard. */
  to: string;
}

export interface Budget {
  minutes: number;
  /** D'où vient le chiffre, en une phrase. */
  reason: string;
  /** « il me reste… » indiqué par l'élève, en vigueur. */
  overridden: boolean;
}

export interface DayAgenda {
  day: string;
  budget: Budget;
  kept: KeptTask[];
  postponed: PostponedTask[];
  /** Minutes gardées. */
  used: number;
  /** Minutes indispensables qui dépassent le temps restant — 0 si tout tient. */
  overflow: number;
  /** La phrase de synthèse. */
  summary: string;
}

export interface RemainingOverride {
  /** Minutes indiquées par l'élève… */
  minutes: number;
  /** …à cet instant (ISO). */
  at: string;
}

const roundStep = (minutes: number) => Math.max(0, Math.round(minutes / STEP) * STEP);

function minutesWorkedSince(input: Pick<NextMoveInput, "sessions">, since: Date, now: Date): number {
  let seconds = 0;
  for (const session of input.sessions) {
    const start = new Date(session.started_at).getTime();
    const end = start + session.duration_seconds * 1000;
    const from = Math.max(start, since.getTime());
    const to = Math.min(end, now.getTime());
    if (to > from) seconds += (to - from) / 1000;
  }
  return Math.floor(seconds / 60);
}

/** Le temps restant aujourd'hui, et d'où il vient. */
export function computeBudget(input: Pick<NextMoveInput, "sessions" | "preferences" | "now">, override: RemainingOverride | null): Budget {
  const { now } = input;
  const untilEnd = Math.max(0, (DAY_END_HOUR - now.getHours()) * 60 - now.getMinutes());
  if (override && dayKey(override.at) === dayKey(now)) {
    const since = minutesWorkedSince(input, new Date(override.at), now);
    const minutes = Math.max(0, Math.min(untilEnd, override.minutes - since));
    return {
      minutes,
      reason: `Tu as indiqué ${formatMinutesSpan(override.minutes)} à ${new Date(override.at).toTimeString().slice(0, 5)}${since > 0 ? `, ${formatMinutesSpan(since)} faites depuis` : ""}`,
      overridden: true,
    };
  }
  const capacity = remainingPlannableToday(input.preferences, input.sessions, now);
  const worked = workedMinutesOnDay(input.sessions, now);
  if (capacity <= untilEnd) {
    return {
      minutes: capacity,
      reason: worked > 0 ? `Capacité du jour moins ${formatMinutesSpan(worked)} déjà faites (marge comprise)` : "Capacité déclarée du jour, marge comprise",
      overridden: false,
    };
  }
  return { minutes: untilEnd, reason: `Il reste ${formatMinutesSpan(untilEnd)} avant ${DAY_END_HOUR} h`, overridden: false };
}

const EXAM_TOMORROW_POINTS = 25;

/** Le palier d'une proposition de Next Move — voir l'en-tête. */
function classify(candidate: MoveCandidate, input: NextMoveInput): { tier: AgendaTier; reason: string; workItemId: string | null; dueDate: string | null } {
  const ids = new Set(candidate.terms.map((term) => term.id));
  const examTomorrow = candidate.terms.some((term) => term.id === "évaluation-proche" && term.points >= EXAM_TOMORROW_POINTS);
  if (candidate.kind === "échéance") {
    const id = candidate.key.slice("échéance:".length);
    const item = input.workItems.find((entry) => entry.id === id);
    const days = item ? daysUntilDue(item, input.now) : null;
    const dueDate = item?.dueDate ?? null;
    if (days !== null && days <= 1) return { tier: "indispensable", reason: days < 0 ? "En retard" : days === 0 ? "À rendre aujourd'hui" : "À rendre demain", workItemId: id, dueDate };
    if ((days !== null && days <= 7) || ids.has("plan-du-jour")) return { tier: "important", reason: ids.has("plan-du-jour") ? "Prévu aujourd'hui (si… alors…)" : `À rendre dans ${days} jours`, workItemId: id, dueDate };
    return { tier: "secondaire", reason: days !== null ? `À rendre dans ${days} jours` : "Sans échéance", workItemId: id, dueDate };
  }
  if (examTomorrow) return { tier: "indispensable", reason: "Épreuve demain au plus tard", workItemId: null, dueDate: null };
  if (candidate.kind === "bloc" && ids.has("minimum-du-soir")) return { tier: "indispensable", reason: "Ton minimum du soir", workItemId: null, dueDate: null };
  if (candidate.kind === "refaire" && candidate.terms.some((term) => term.id.startsWith("bloc:minimum-du-soir"))) {
    return { tier: "indispensable", reason: "Remplit ton minimum du soir", workItemId: null, dueDate: null };
  }
  if (candidate.kind === "cartes") return { tier: "indispensable", reason: "Révisions dues", workItemId: null, dueDate: null };
  if (candidate.kind === "anki" && candidate.key === "anki:dues") return { tier: "indispensable", reason: "Cartes Anki dues", workItemId: null, dueDate: null };
  if (ids.has("bilan-semaine")) return { tier: "important", reason: "Priorité adoptée au bilan de la semaine", workItemId: null, dueDate: null };
  if (candidate.kind === "refaire") {
    const reason = candidate.key.startsWith("transfert:") ? "Vérifier la méthode sur un autre énoncé" : candidate.key.startsWith("exercice:") ? "Exercice ciblé du diagnostic" : "Nouvelle tentative prévue";
    return { tier: "important", reason, workItemId: null, dueDate: null };
  }
  if (ids.has("diagnostic")) return { tier: "important", reason: "Action adaptée au diagnostic", workItemId: null, dueDate: null };
  if (candidate.kind === "rappel") return { tier: "important", reason: ids.has("au-programme") ? "Au programme d'une épreuve" : "Chapitre qui s'efface", workItemId: null, dueDate: null };
  if (candidate.kind === "anki") return { tier: "important", reason: "Cours qui résiste dans Anki", workItemId: null, dueDate: null };
  if (ids.has("évaluation-proche")) return { tier: "important", reason: "Épreuve dans la semaine", workItemId: null, dueDate: null };
  if (candidate.kind === "bloc") return { tier: "secondaire", reason: "Objectif de la semaine", workItemId: null, dueDate: null };
  return { tier: "secondaire", reason: "Reprise d'erreurs récentes", workItemId: null, dueDate: null };
}

/** Les tâches du jour : propositions de Next Move, plus la part d'aujourd'hui des échéances que Next Move ne propose pas. */
export function agendaTasks(input: NextMoveInput): AgendaTask[] {
  const ranked = rankCandidates(input);
  const tasks: AgendaTask[] = ranked
    .filter((candidate) => candidate.score > 0 || candidate.kind === "échéance")
    .map((candidate) => {
      const { tier, reason, workItemId, dueDate } = classify(candidate, input);
      // Échéance indispensable : tout le reste, non réductible.
      if (candidate.kind === "échéance" && tier === "indispensable") {
        const remaining = candidate.maxMinutes;
        return { key: candidate.key, title: candidate.title, subject: candidate.subject, tier, tierReason: `${reason} — il reste ${formatMinutesSpan(remaining)}`, idealMinutes: remaining, minMinutes: remaining, score: candidate.score, href: candidate.href, action: candidate.action, workItemId, dueDate };
      }
      return {
        key: candidate.key,
        title: candidate.title,
        subject: candidate.subject,
        tier,
        tierReason: reason,
        idealMinutes: roundStep(candidate.idealMinutes) || candidate.idealMinutes,
        minMinutes: Math.min(roundStep(candidate.minMinutes) || candidate.minMinutes, roundStep(candidate.idealMinutes) || candidate.idealMinutes),
        score: candidate.score,
        href: candidate.href,
        action: candidate.action,
        workItemId,
        dueDate,
      };
    });

  // Le planning des échéances (lib/planning.ts) a réservé une part d'aujourd'hui : elle fixe la durée de l'échéance.
  const today = todaysPlan(buildWeeklyPlan(input.workItems, input.sessions, input.preferences, input.now));
  for (const slot of today?.slots ?? []) {
    const key = `échéance:${slot.workItemId}`;
    const existing = tasks.find((task) => task.key === key);
    if (existing) {
      // Une échéance indispensable (aujourd'hui, demain, en retard) garde TOUT son reste : la part que le planning
      // a pu caser aujourd'hui masquerait le manque. Les autres prennent la part réservée par le planning.
      if (existing.tier !== "indispensable") existing.idealMinutes = Math.max(existing.minMinutes, roundStep(slot.minutes));
      continue;
    }
    const item = input.workItems.find((entry) => entry.id === slot.workItemId);
    tasks.push({
      key,
      title: slot.title,
      subject: slot.subject,
      tier: "secondaire",
      tierReason: "Part d'aujourd'hui du planning des échéances",
      idealMinutes: roundStep(slot.minutes),
      minMinutes: Math.min(15, roundStep(slot.minutes)),
      score: 0,
      href: `/timer?travail=${encodeURIComponent(slot.workItemId)}`,
      action: WORK_ITEM_KIND_META[slot.kind].short,
      workItemId: slot.workItemId,
      dueDate: item?.dueDate ?? null,
    });
  }
  // Les mêmes indispensables n'ont pas à attendre le poids : palier d'abord, poids ensuite.
  return tasks.sort((a, b) => AGENDA_TIERS.indexOf(a.tier) - AGENDA_TIERS.indexOf(b.tier) || b.score - a.score || a.key.localeCompare(b.key));
}

function postponeTarget(task: AgendaTask, now: Date): string {
  if (!task.dueDate) return "demain";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dayKey(tomorrow) >= task.dueDate ? "demain — c'est le jour de l'échéance, à faire en premier" : "demain";
}

export function buildDayAgenda(input: NextMoveInput, override: RemainingOverride | null = null): DayAgenda {
  const budget = computeBudget(input, override);
  const tasks = agendaTasks(input);
  const skipped = skippedKeys(input.history, input.now);
  const kept: KeptTask[] = [];
  const postponed: PostponedTask[] = [];

  /* 1. Indispensables : tous gardés ; réduits au minimum si besoin ; le dépassement est dit. */
  const essentials = tasks.filter((task) => task.tier === "indispensable");
  const essentialTotal = essentials.reduce((sum, task) => sum + task.idealMinutes, 0);
  let excess = Math.max(0, essentialTotal - budget.minutes);
  // Les réductions commencent par le MOINS prioritaire des indispensables.
  const cuts = new Map<string, number>();
  for (const task of [...essentials].reverse()) {
    if (excess <= 0) break;
    const cut = Math.min(Math.max(0, task.idealMinutes - task.minMinutes), excess);
    if (cut > 0) cuts.set(task.key, cut);
    excess -= cut;
  }
  for (const task of essentials) {
    const minutes = task.idealMinutes - (cuts.get(task.key) ?? 0);
    kept.push({ ...task, minutes, reducedFrom: minutes < task.idealMinutes ? task.idealMinutes : null });
  }
  const overflow = excess;
  let left = Math.max(0, budget.minutes - kept.reduce((sum, task) => sum + task.minutes, 0));

  /* 2. Importants puis secondaires : gardé, réduit, ou déplacé — jamais en silence. */
  for (const task of tasks.filter((entry) => entry.tier !== "indispensable")) {
    if (skipped.has(task.key)) {
      postponed.push({ ...task, reason: "Tu l'as mis de côté (« Pas maintenant »)", to: postponeTarget(task, input.now) });
      continue;
    }
    if (task.idealMinutes <= left) {
      kept.push({ ...task, minutes: task.idealMinutes, reducedFrom: null });
      left -= task.idealMinutes;
      continue;
    }
    const reduced = Math.floor(left / STEP) * STEP;
    if (reduced >= task.minMinutes && reduced > 0) {
      kept.push({ ...task, minutes: reduced, reducedFrom: task.idealMinutes });
      left -= reduced;
      continue;
    }
    postponed.push({
      ...task,
      reason: left <= 0 ? "Plus de temps aujourd'hui" : `Il ne reste que ${formatMinutesSpan(left)}, il en faut au moins ${formatMinutesSpan(task.minMinutes)}`,
      to: postponeTarget(task, input.now),
    });
  }

  const used = kept.reduce((sum, task) => sum + task.minutes, 0);
  const summary =
    overflow > 0
      ? kept.some((task) => task.reducedFrom !== null)
        ? `L'indispensable dépasse ton temps restant de ${formatMinutesSpan(overflow)}, même réduit au minimum : décide ce que tu fais (prolonger, demander un délai).`
        : `L'indispensable dépasse ton temps restant de ${formatMinutesSpan(overflow)} : décide ce que tu fais (prolonger, demander un délai).`
      : kept.length === 0
        ? budget.minutes <= 0
          ? "Plus de temps prévu aujourd'hui : ce qui reste est déplacé à demain."
          : "Rien de prévu pour l'instant."
        : postponed.length > 0
          ? `${formatMinutesSpan(used)} gardées sur ${formatMinutesSpan(budget.minutes)} ; ${postponed.length} tâche${postponed.length > 1 ? "s" : ""} déplacée${postponed.length > 1 ? "s" : ""} à demain.`
          : `Tout tient : ${formatMinutesSpan(used)} sur ${formatMinutesSpan(budget.minutes)}.`;

  return { day: dayKey(input.now), budget, kept, postponed, used, overflow, summary };
}
