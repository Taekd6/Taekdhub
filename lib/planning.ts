import { plannableMinutes, remainingPlannableToday } from "@/lib/capacity";
import { computeWorkItemPriority, sortByPriority, type WorkItemPriority } from "@/lib/deadlines";
import { dayKey } from "@/lib/study";
import { activeWorkItems, daysUntilDue, remainingMinutes, updateWorkItem } from "@/lib/work-items";
import { computeDailyLoad, type DailyLoad } from "@/lib/workload";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import type { Preferences, WorkItem, WorkItemKind } from "@/lib/storage";

/**
 * PLANIFICATION — la source de vérité du « QUAND », et d'elle seule.
 *
 * La séparation des rôles est la décision structurante de tout ce chantier,
 * et elle doit rester lisible dans le code :
 *
 *   ÉCHÉANCES (lib/deadlines.ts)   ce qui presse, et pourquoi.
 *   CAPACITÉ  (lib/capacity.ts)    combien de minutes chaque jour peut absorber.
 *   PLANNING  (ce module)          QUEL JOUR, et COMBIEN DE MINUTES.
 *
 * Ce module ne décide JAMAIS du contenu : il réserve du temps. Ce qu'il y a
 * dans un créneau — la feuille d'exercices, le DM, le chapitre à relire —
 * l'élève le sait ; TaekdHub ne fait que chronométrer (le créneau part au
 * chrono, rattaché à son travail).
 *
 * LE PLAN N'EST PAS PERSISTÉ. Il est recalculé à chaque affichage à partir
 * des travaux, des séances, de la capacité et de la date. Le stocker créerait
 * une seconde source de vérité qui divergerait au premier report — c'est
 * exactement la règle qui interdit déjà de stocker une durée cumulée
 * (Sprint 2.6). Seules les DÉCISIONS de l'élève sont persistées : l'échéance,
 * l'estimation, et le « pas avant » qu'écrit un report.
 *
 * Fonctions pures — aucun localStorage, aucun React, aucun DOM.
 */

/** Horizon de planification, en jours (aujourd'hui inclus). Deux semaines : au-delà, la capacité déclarée et les estimations ne valent plus grand-chose. */
export const PLANNING_HORIZON_DAYS = 14;

/**
 * Plus petit créneau qu'on accepte de poser. En dessous, on préfère
 * concentrer sur moins de jours : émietter un DM en sept fois cinq minutes
 * produit un planning que personne ne suit, et qui coûte à chaque fois le
 * temps de s'y remettre.
 */
export const MIN_SLOT_MINUTES = 15;

/** Les créneaux sont arrondis à ce pas — un planning se lit en quarts d'heure, pas à la minute près. */
const SLOT_ROUNDING_MINUTES = 5;

export interface PlannedSlot {
  /** "AAAA-MM-JJ". */
  date: string;
  workItemId: string;
  title: string;
  subject: Subject | null;
  kind: WorkItemKind;
  minutes: number;
  /** Pourquoi ce travail, ce jour-là — dérivé de la priorité réellement calculée, jamais d'un texte générique. */
  reason: string;
}

export interface PlannedDay {
  /** "AAAA-MM-JJ". */
  date: string;
  slots: PlannedSlot[];
  load: DailyLoad;
}

/** Un travail que le planificateur n'a PAS pu caser en entier avant son échéance — jamais masqué, jamais repoussé en douce après la date. */
export interface UnplaceableWork {
  item: WorkItem;
  /** Minutes qui n'ont trouvé aucune place avant l'échéance. */
  missingMinutes: number;
  /** Phrase explicite citant les deux nombres en jeu. */
  reason: string;
}

export interface WeeklyPlan {
  days: PlannedDay[];
  unplaceable: UnplaceableWork[];
  /** Priorités calculées, déjà triées — réutilisées telles quelles par l'interface pour ne pas les recalculer. */
  priorities: WorkItemPriority[];
}

/**
 * Construit le planning des `PLANNING_HORIZON_DAYS` prochains jours.
 *
 * L'algorithme tient en quatre règles, dans cet ordre :
 *
 *  1. LES PLUS URGENTS SERVENT EN PREMIER. Les travaux sont traités dans
 *     l'ordre de `sortByPriority`, donc un travail dont l'échéance est
 *     lointaine ne peut jamais préempter la capacité d'un travail qui presse.
 *     C'est ce qui empêche de planifier du travail inutilement tôt.
 *
 *  2. ON ÉTALE, ON N'ENTASSE PAS LA VEILLE. Le temps restant d'un travail est
 *     réparti sur les jours qui le séparent de son échéance, pas posé en bloc
 *     sur le premier jour venu ni sur le dernier. Le nombre de jours
 *     réellement utilisés est borné par `MIN_SLOT_MINUTES`, pour ne pas
 *     émietter.
 *
 *  3. LA MARGE EST INTOUCHABLE. Aucun créneau n'est posé au-delà de la
 *     capacité PLANIFIABLE du jour (lib/capacity.ts). Une journée n'est donc
 *     jamais remplie à 100 % de la capacité déclarée par le planificateur —
 *     seule la réalité peut le faire, et c'est alors « surchargé » qui
 *     s'affiche.
 *
 *  4. CE QUI NE RENTRE PAS SE DIT. Les minutes qui n'ont pas trouvé de place
 *     avant l'échéance ne sont pas replacées après : elles ressortent dans
 *     `unplaceable`, avec le chiffre qui manque. Décaler silencieusement une
 *     échéance serait mentir à l'élève sur la seule chose qu'il ne contrôle
 *     pas.
 *
 * Un travail EN RETARD fait exception à la règle 4 : son échéance étant
 * passée, il n'y a plus de « avant » où le caser. Il est replacé dès
 * aujourd'hui, sur l'horizon — le retard est déjà dit par ailleurs
 * (`isOverdue`), le planning sert à le rattraper.
 */
export function buildWeeklyPlan(
  workItems: WorkItem[],
  sessions: WorkSession[],
  preferences: Preferences,
  now: Date = new Date()
): WeeklyPlan {
  const active = activeWorkItems(workItems);
  const priorities = sortByPriority(active.map((item) => computeWorkItemPriority(item, sessions, preferences, now)));

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon: Date[] = Array.from({ length: PLANNING_HORIZON_DAYS }, (_, offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date;
  });

  // Capacité restante par jour. Aujourd'hui démarre amputé de ce qui a déjà
  // été travaillé : les minutes passées ne sont plus disponibles.
  const capacityLeft = new Map<string, number>();
  horizon.forEach((date, index) => {
    capacityLeft.set(dayKey(date), index === 0 ? remainingPlannableToday(preferences, sessions, now) : plannableMinutes(preferences, date));
  });

  const slotsByDay = new Map<string, PlannedSlot[]>(horizon.map((date) => [dayKey(date), []]));
  const unplaceable: UnplaceableWork[] = [];

  /*
   * CE QUI PEUT ENCORE ÊTRE TENU PASSE AVANT CE QUI NE TIENT DÉJÀ PLUS.
   *
   * Défaut observé en parcours réel, et il est grave : un seul travail
   * surdimensionné — un « concours blanc » estimé à 10 h pour après-demain —
   * arrivait en tête par son score, absorbait TOUTE la capacité de la
   * semaine, et faisait basculer dans l'infaisable un DM qui tenait
   * parfaitement avant lui. Une saisie trop ambitieuse détruisait le
   * planning entier, en silence.
   *
   * Les travaux encore réalisables sont donc servis d'abord, chacun dans
   * l'ordre de priorité ; ceux qui ne tiennent déjà plus se servent ensuite
   * sur ce qui reste. Ils ne sont pas abandonnés pour autant : ils reçoivent
   * toute la capacité disponible et ressortent dans `unplaceable` avec ce
   * qui leur manque — l'élève arbitre, TaekdHub ne décide pas à sa place.
   *
   * La faisabilité lue ici est celle calculée EN ISOLATION (lib/deadlines.ts).
   * Un travail réalisable seul peut parfaitement devenir infaisable une fois
   * les autres placés : c'est alors le planning qui le dit, et c'est le bon
   * verdict — celui qui tient compte de tout le reste.
   */
  const stillFeasible = priorities.filter((priority) => priority.feasibility.level !== "non casable");
  const alreadyShort = priorities.filter((priority) => priority.feasibility.level === "non casable");

  for (const priority of [...stillFeasible, ...alreadyShort]) {
    const { item } = priority;
    let remaining = remainingMinutes(item, sessions);
    if (remaining <= 0) continue;

    // Fenêtre de placement : du premier jour autorisé (un report écrit
    // `notBeforeDate`, jamais une nouvelle échéance) jusqu'à l'échéance.
    const notBefore = item.notBeforeDate ? new Date(`${item.notBeforeDate}T00:00:00`) : today;
    const start = notBefore > today ? notBefore : today;
    const days = daysUntilDue(item, now);
    /*
     * L'ÉCHÉANCE EST-ELLE SEULEMENT DANS LE CHAMP DE VISION DU PLANNING ?
     *
     * Régression corrigée ici, et elle était grave. La fenêtre de placement
     * est bornée à `PLANNING_HORIZON_DAYS` (14 jours), mais la règle 4 plus
     * bas ne testait que `days >= 0` : tout travail dont le reste à faire
     * dépassait la capacité de DEUX SEMAINES ressortait dans `unplaceable`
     * avec « ne trouvent pas de place avant l'échéance », y compris pour une
     * échéance à quarante jours. Un concours blanc de 2 000 min dû dans
     * 40 jours était déclaré infaisable alors que `computeFeasibility` le
     * disait « casable » sur les 3 120 min réellement disponibles : les deux
     * moteurs se contredisaient sur le même travail, en tête de l'écran
     * Échéances, et `postponeWorkItem` en héritait un `breaksDeadline` faux.
     *
     * Un planning de 14 jours ne SAIT RIEN de ce qui se passe au jour 40. Il
     * ne doit donc rien en dire : c'est `computeFeasibility` (lib/deadlines.ts),
     * qui cumule la capacité jusqu'à l'échéance réelle, qui fait autorité
     * au-delà de l'horizon. Ne rien affirmer est ici la seule réponse
     * honnête — et c'est la même règle que « retard ≠ impossible », dans
     * l'autre sens : LOIN ≠ IMPOSSIBLE.
     */
    const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : null;
    const dueBeyondHorizon = due !== null && due > horizon[horizon.length - 1];
    const window = horizon.filter((date) => {
      if (date < start) return false;
      if (days === null) return true; // sans échéance : tout l'horizon
      if (days < 0) return true; // en retard : l'échéance est passée, on rattrape dès que possible
      return due === null || date <= due;
    });

    if (window.length === 0) {
      // Même garde : si l'échéance est au-delà de l'horizon, l'absence de
      // jour disponible DANS l'horizon ne dit rien sur l'échéance elle-même.
      if (!dueBeyondHorizon) {
        unplaceable.push({
          item,
          missingMinutes: remaining,
          reason: `Aucun jour disponible avant l'échéance : il reste ${formatShort(remaining)} à faire.`,
        });
      }
      continue;
    }

    /*
     * Règle 2 — combien de jours utiliser.
     *
     * L'étalement ne vaut que pour un travail dont l'échéance est DEVANT :
     * c'est là qu'entasser la veille est une faute. Deux cas s'en excluent,
     * et les y soumettre produisait un planning absurde, constaté à l'écran :
     *
     *   — EN RETARD : un TP dû avant-hier était réparti en quinze minutes
     *     par jour sur quatorze jours. Un travail en retard se rattrape, il
     *     ne se lisse pas ;
     *   — SANS ÉCHÉANCE : une révision d'une heure saupoudrait quinze
     *     minutes sur chaque journée de la quinzaine, polluant tout le
     *     planning pour un travail qui ne pressait pas.
     *
     * Dans ces deux cas on remplit au plus tôt, et le second passage ci-dessous
     * s'occupe du reste. Sinon, le nombre de jours est borné par la taille
     * minimale d'un créneau, pour ne pas émietter.
     */
    const spread = days !== null && days >= 0;
    const maxUsefulDays = Math.max(1, Math.floor(remaining / MIN_SLOT_MINUTES));
    const daysToUse = spread ? Math.min(window.length, maxUsefulDays) : 1;
    const target = roundSlot(Math.ceil(remaining / daysToUse));

    const explanation = explainPlanningDecision(priority);

    // Premier passage : la part visée, jour après jour.
    for (const date of window) {
      if (remaining <= 0) break;
      const key = dayKey(date);
      const left = capacityLeft.get(key) ?? 0;
      if (left <= 0) continue;
      const minutes = Math.min(target, left, remaining);
      if (minutes < Math.min(MIN_SLOT_MINUTES, remaining)) continue;
      pushSlot(slotsByDay, key, item, minutes, explanation);
      capacityLeft.set(key, left - minutes);
      remaining -= minutes;
    }

    // Second passage : ce qui reste va dans la capacité encore libre, sans
    // plafond de part — sinon un travail refuserait une place réellement
    // disponible et se déclarerait infaisable à tort.
    for (const date of window) {
      if (remaining <= 0) break;
      const key = dayKey(date);
      const left = capacityLeft.get(key) ?? 0;
      if (left <= 0) continue;
      const minutes = Math.min(left, remaining);
      if (minutes < Math.min(MIN_SLOT_MINUTES, remaining)) continue;
      const existing = slotsByDay.get(key)?.find((slot) => slot.workItemId === item.id);
      if (existing) existing.minutes += minutes;
      else pushSlot(slotsByDay, key, item, minutes, explanation);
      capacityLeft.set(key, left - minutes);
      remaining -= minutes;
    }

    // Règle 4 — ce qui n'est pas entré se dit, avec son chiffre. Uniquement
    // pour une échéance que l'horizon atteint réellement : voir `dueBeyondHorizon`.
    if (remaining > 0 && item.dueDate && (days ?? 0) >= 0 && !dueBeyondHorizon) {
      unplaceable.push({
        item,
        missingMinutes: remaining,
        reason: `${formatShort(remaining)} ne trouvent pas de place avant l'échéance : tes journées d'ici là sont déjà pleines.`,
      });
    }
  }

  const days: PlannedDay[] = horizon.map((date) => {
    const key = dayKey(date);
    const slots = slotsByDay.get(key) ?? [];
    const planned = slots.reduce((total, slot) => total + slot.minutes, 0);
    return { date: key, slots, load: computeDailyLoad(date, planned, preferences, sessions) };
  });

  return { days, unplaceable, priorities };
}

function pushSlot(
  slotsByDay: Map<string, PlannedSlot[]>,
  key: string,
  item: WorkItem,
  minutes: number,
  reason: string
): void {
  slotsByDay.get(key)?.push({
    date: key,
    workItemId: item.id,
    title: item.title,
    subject: item.subject,
    kind: item.kind,
    minutes,
    reason,
  });
}

/** Arrondit un créneau au pas d'affichage, sans jamais descendre sous ce pas. */
function roundSlot(minutes: number): number {
  return Math.max(SLOT_ROUNDING_MINUTES, Math.round(minutes / SLOT_ROUNDING_MINUTES) * SLOT_ROUNDING_MINUTES);
}

/**
 * Pourquoi ce travail est placé là — une phrase, dérivée de la priorité
 * réellement calculée. On ne fabrique jamais une justification, on formule
 * celle qui existe.
 */
export function explainPlanningDecision(priority: WorkItemPriority): string {
  if (priority.overdue) return `${priority.reasons[0]} — replacé dès que possible.`;
  if (priority.feasibility.level === "non casable") return priority.feasibility.reason;
  if (priority.daysUntilDue === null) return "Sans échéance — placé dans le temps qui reste.";
  if (priority.daysUntilDue === 0) return "À rendre aujourd'hui.";
  if (priority.daysUntilDue === 1) return "À rendre demain.";
  return `Réparti d'ici l'échéance, dans ${priority.daysUntilDue} jours.`;
}

/** Ce qui est prévu aujourd'hui, ou `null` si l'horizon est vide — raccourci consommé par l'accueil. */
export function todaysPlan(plan: WeeklyPlan): PlannedDay | null {
  return plan.days[0] ?? null;
}

export type PostponeTarget = "demain" | "prochain-jour-disponible" | string;

export interface PostponeOutcome {
  workItems: WorkItem[];
  /** Le jour à partir duquel le travail redevient planifiable. */
  toDate: string;
  /**
   * `true` quand le report rend le travail infaisable avant son échéance.
   * L'appelant DOIT le dire à l'élève — le report a quand même lieu, mais il
   * a un coût, et ce coût doit être visible (voir le cahier des charges : ne
   * jamais masquer le problème, ne jamais toucher l'échéance en douce).
   */
  breaksDeadline: boolean;
  /** Phrase expliquant la conséquence, ou `null` quand il n'y en a pas. */
  warning: string | null;
}

/**
 * REPORTER — décale le premier jour où le travail redevient planifiable, et
 * RIEN D'AUTRE.
 *
 * En particulier, l'échéance n'est jamais modifiée : reporter son travail ne
 * repousse pas la date du DS. C'est la distinction que tout le modèle
 * protège, et c'est aussi pourquoi un report peut parfaitement rendre un
 * travail infaisable — auquel cas `breaksDeadline` le signale au lieu de
 * l'absorber en silence.
 *
 * Le planning n'est pas « décalé » : il est RECALCULÉ. Comme il est dérivé
 * (jamais persisté), il suffit de rappeler `buildWeeklyPlan` après ce report
 * pour que tout le reste se replace autour — y compris les autres travaux,
 * qui récupèrent la capacité libérée.
 *
 * Et c'est le temps RESTANT qui sera replanifié, pas la durée initiale : un
 * DM de 60 min dont 30 sont faites reviendra pour 30 min (voir
 * lib/work-items.ts#remainingMinutes).
 */
export function postponeWorkItem(
  workItems: WorkItem[],
  sessions: WorkSession[],
  preferences: Preferences,
  id: string,
  target: PostponeTarget,
  now: Date = new Date()
): PostponeOutcome {
  const item = workItems.find((entry) => entry.id === id);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!item) return { workItems, toDate: dayKey(today), breaksDeadline: false, warning: null };

  const toDate = resolvePostponeTarget(target, preferences, today);
  const next = updateWorkItem(
    workItems,
    id,
    {
      notBeforeDate: toDate,
      postponements: [...item.postponements, { at: now.toISOString(), fromDate: dayKey(today), toDate }],
    },
    now
  );

  // Conséquence réelle, mesurée sur le planning RECALCULÉ — pas devinée.
  const replanned = buildWeeklyPlan(next, sessions, preferences, now);
  const blocked = replanned.unplaceable.find((entry) => entry.item.id === id);

  return {
    workItems: next,
    toDate,
    breaksDeadline: Boolean(blocked),
    warning: blocked ? blocked.reason : null,
  };
}

/**
 * Traduit une cible de report en jour concret.
 *
 * « Prochain jour disponible » cherche le premier jour dont la capacité
 * planifiable est non nulle — reporter au dimanche un élève qui a déclaré
 * zéro minute le dimanche ne reporterait rien du tout.
 */
function resolvePostponeTarget(target: PostponeTarget, preferences: Preferences, today: Date): string {
  if (target === "demain") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dayKey(tomorrow);
  }
  if (target === "prochain-jour-disponible") {
    const cursor = new Date(today);
    for (let offset = 1; offset <= PLANNING_HORIZON_DAYS; offset += 1) {
      cursor.setDate(cursor.getDate() + (offset === 1 ? 1 : 1));
      if (plannableMinutes(preferences, cursor) > 0) return dayKey(cursor);
    }
    return dayKey(cursor);
  }
  return target;
}

function formatShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
