import { atRisk } from "@/lib/chapter-memory";
import { computeWorkItemPriority } from "@/lib/deadlines";
import { subjectInSentence } from "@/lib/error-log";
import { eveningPlan } from "@/lib/evening-minimums";
import { isPending } from "@/lib/grades";
import { formatClock, intentionsForToday } from "@/lib/intentions";
import { computeNextMove, type NextMoveInput, type NextMovePlan } from "@/lib/next-move/engine";
import { daysBetween, dueReviewItems, effectiveSchedule } from "@/lib/spaced-repetition";
import { computeSubjectTargets } from "@/lib/subject-targets";
import { dayKey } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";
import { activeWorkItems, daysUntilDue, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";
import type { Preferences, WorkItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * LE POINT — l'écran qui accueille l'élève à l'ouverture de TaekdHub.
 *
 * Il répond, dans cet ordre, à quatre questions et à aucune autre :
 *
 *   1. QU'EST-CE QUE JE FAIS MAINTENANT ?   le premier pas de Next Move ;
 *   2. QU'EST-CE QUI PRESSE ?               retard, échéance du jour ou du
 *                                           lendemain, travail qui ne tient
 *                                           plus, DS dans ≤ 3 jours ;
 *   3. QU'EST-CE QUE JE REPOUSSE ?          reports répétés, plans « si…
 *                                           alors… » manqués, matière
 *                                           écartée par Next Move, cartes
 *                                           qui s'accumulent, objectif de la
 *                                           semaine qui décroche ;
 *   4. QU'EST-CE QUI M'ATTEND AUJOURD'HUI ?  minimum du soir, plans du jour,
 *                                           révisions du jour.
 *
 * TROIS LIGNES AU PLUS PAR SECTION, et une section vide n'est pas affichée :
 * l'objectif est de réduire la charge de décision, pas de dresser l'inventaire.
 *
 * LE TON. Les faits, avec leurs chiffres — jamais de reproche. « Reporté
 * 3 fois » est une information ; l'élève sait quoi en faire.
 *
 * Fonctions pures.
 */

export type BriefingTone = "urgent" | "repoussé" | "aujourd'hui" | "attention";

export interface BriefingItem {
  /** Stable — clé React et identifiant de test. */
  id: string;
  tone: BriefingTone;
  subject: Subject | null;
  title: string;
  detail: string;
  href: string;
}

export interface Briefing {
  greeting: string;
  /** Une phrase qui résume la situation (« 1 urgence, 2 choses repoussées »). */
  summary: string;
  move: NextMovePlan;
  urgent: BriefingItem[];
  postponed: BriefingItem[];
  today: BriefingItem[];
  /** `false` quand il n'y a vraiment rien à dire (nouvel inscrit) — l'écran n'est alors pas imposé. */
  hasContent: boolean;
}

export type BriefingInput = Omit<NextMoveInput, "availableMinutes">;

/** Lignes par section, au plus. */
export const BRIEFING_SECTION_MAX = 3;
/** Un travail est « repoussé » à partir de ce nombre de reports. */
export const POSTPONE_MIN = 2;
/** Une matière est « repoussée » quand Next Move l'a proposée sans suite au moins autant de fois sur 7 jours. */
export const SUBJECT_DODGED_MIN = 3;
/** Cartes en retard d'au moins `CARD_LATE_DAYS` jours : à partir de combien on le signale. */
export const CARD_BACKLOG_MIN = 5;
export const CARD_LATE_DAYS = 3;
/** Retard sur l'objectif de la semaine signalé à partir de (minutes). */
export const WEEKLY_LAG_MIN = 60;
/** Chapitre signalé « qui s'efface » sous ce seuil. */
export const FADING_THRESHOLD = 0.6;
/** Au-delà, une note en attente mérite qu'on demande si la copie est rendue. */
export const PENDING_GRADE_DAYS = 10;
/** L'écran revient après cette absence, même dans la journée. */
export const BRIEFING_AGAIN_HOURS = 4;

const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function dayName(day: string, today: string): string {
  const delta = daysBetween(today, day);
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta === -1) return "hier";
  // Dans la semaine, passé ou à venir, le jour se dit par son nom (« mardi »).
  if (Math.abs(delta) < 7) return WEEKDAYS[new Date(`${day}T00:00:00`).getDay()];
  return new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count > 1 ? pluralWord : word}`;
}

export function greetingFor(now: Date, name: string): string {
  const hour = now.getHours();
  const hello = hour < 5 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const first = name.trim();
  return first ? `${hello} ${first}` : hello;
}

function itemTitle(item: WorkItem): string {
  const kind = WORK_ITEM_KIND_META[item.kind].short;
  return item.title.toLowerCase().includes(kind.toLowerCase()) ? item.title : `${kind} · ${item.title}`;
}

/* ── 2. Ce qui presse ─────────────────────────────────────────────── */

function urgentItems(input: BriefingInput): BriefingItem[] {
  const { workItems, sessions, preferences, now } = input;
  const today = dayKey(now);
  const scored: Array<{ rank: number; item: BriefingItem }> = [];

  for (const item of activeWorkItems(workItems)) {
    const remaining = remainingMinutes(item, sessions);
    if (remaining <= 0 || !item.dueDate) continue;
    const days = daysUntilDue(item, now)!;
    const priority = computeWorkItemPriority(item, sessions, preferences, now);
    const href = `/timer?travail=${encodeURIComponent(item.id)}`;
    const left = `${formatMinutesSpan(remaining)} restantes`;

    if (days < 0) {
      scored.push({ rank: 0, item: { id: `retard:${item.id}`, tone: "urgent", subject: item.subject, title: `En retard : ${itemTitle(item)}`, detail: `Prévu pour ${dayName(item.dueDate, today)} · ${left}`, href } });
    } else if (priority.feasibility.level === "non casable") {
      scored.push({
        rank: 1,
        item: { id: `infaisable:${item.id}`, tone: "urgent", subject: item.subject, title: `Ne tient plus : ${itemTitle(item)}`, detail: `Il manque ${formatMinutesSpan(priority.feasibility.shortfallMinutes)} d'ici ${dayName(item.dueDate, today)}`, href: "/echeances" },
      });
    } else if (days <= 1) {
      scored.push({ rank: 2 + days, item: { id: `bientôt:${item.id}`, tone: "urgent", subject: item.subject, title: `Pour ${days === 0 ? "aujourd'hui" : "demain"} : ${itemTitle(item)}`, detail: left, href } });
    } else if ((item.kind === "ds" || item.kind === "concours") && days <= 3) {
      scored.push({ rank: 4 + days, item: { id: `évaluation:${item.id}`, tone: "urgent", subject: item.subject, title: `${itemTitle(item)} dans ${days} j`, detail: left, href } });
    }
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.item.id.localeCompare(b.item.id))
    .slice(0, BRIEFING_SECTION_MAX)
    .map((entry) => entry.item);
}

/* ── 3. Ce que tu repousses ───────────────────────────────────────── */

function postponedItems(input: BriefingInput, urgentIds: Set<string>): BriefingItem[] {
  const { workItems, history, reviewItems, preferences, sessions, now, chapterMemory, errors, grades } = input;
  const today = dayKey(now);
  const out: Array<{ rank: number; item: BriefingItem }> = [];

  // Reports répétés — le signal le plus direct.
  for (const item of activeWorkItems(workItems)) {
    if (item.postponements.length < POSTPONE_MIN) continue;
    const due = item.dueDate ? ` · échéance ${dayName(item.dueDate, today)}` : "";
    out.push({ rank: 10 - Math.min(item.postponements.length, 9), item: { id: `reporté:${item.id}`, tone: "repoussé", subject: item.subject, title: `${itemTitle(item)} reporté ${item.postponements.length} fois`, detail: `Déjà repoussé plusieurs fois${due}`, href: "/echeances" } });
  }

  // Plans « si… alors… » dont le jour est passé sans que le travail soit fait.
  for (const intention of intentionsForToday(workItems, now)) {
    if (!intention.missed) continue;
    out.push({ rank: 11, item: { id: `plan-manqué:${intention.item.id}`, tone: "repoussé", subject: intention.item.subject, title: `Prévu ${dayName(intention.plan.day, today)}, pas fait : ${itemTitle(intention.item)}`, detail: "Replanifie-le, ou abandonne-le franchement", href: "/echeances" } });
  }

  // Matières que Next Move propose et que l'élève laisse de côté (7 derniers jours).
  const since = now.getTime() - 7 * DAY;
  const settled = now.getTime() - 3 * HOUR;
  const dodged = new Map<Subject, number>();
  for (const record of history) {
    if (!record.subject) continue;
    const at = new Date(record.proposedAt).getTime();
    if (at < since) continue;
    if (record.status === "écarté" || (record.status === "proposé" && at <= settled)) dodged.set(record.subject, (dodged.get(record.subject) ?? 0) + 1);
  }
  for (const [subject, count] of dodged) {
    if (count < SUBJECT_DODGED_MIN) continue;
    out.push({ rank: 12, item: { id: `matière-repoussée:${subject}`, tone: "repoussé", subject, title: `${subject} : souvent remis à plus tard`, detail: `Proposée ${count} fois cette semaine, sans suite`, href: `/timer?matiere=${encodeURIComponent(subject)}` } });
  }

  // Cartes qui s'accumulent.
  const late = dueReviewItems(reviewItems, now).filter((item) => daysBetween(effectiveSchedule(item).dueAt, today) >= CARD_LATE_DAYS);
  if (late.length >= CARD_BACKLOG_MIN) {
    const oldest = Math.max(...late.map((item) => daysBetween(effectiveSchedule(item).dueAt, today)));
    out.push({ rank: 13, item: { id: "cartes-en-retard", tone: "repoussé", subject: null, title: `${plural(late.length, "carte")} en retard de révision`, detail: `La plus ancienne attend depuis ${oldest} j`, href: "/revoir/session" } });
  }

  // Objectifs de la semaine qui décrochent.
  for (const target of computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday)) {
    const lag = target.expectedMinutes - target.doneMinutes;
    if (target.pace !== "en retard" || lag < WEEKLY_LAG_MIN) continue;
    out.push({ rank: 14, item: { id: `semaine:${target.subject}`, tone: "repoussé", subject: target.subject, title: `${target.subject} en retard sur la semaine`, detail: `${formatMinutesSpan(target.doneMinutes)} faites, ${formatMinutesSpan(target.expectedMinutes)} attendues à ce stade`, href: `/timer?matiere=${encodeURIComponent(target.subject)}` } });
  }

  // À surveiller, en dernier : ce qui s'efface doucement.
  for (const { chapter, retrievability } of atRisk(chapterMemory, today, FADING_THRESHOLD).slice(0, 1)) {
    out.push({ rank: 15, item: { id: `s-efface:${chapter.id}`, tone: "attention", subject: chapter.subject, title: `${chapter.title} s'efface`, detail: `${Math.round(retrievability * 100)} % de chances de t'en souvenir`, href: `/timer?matiere=${encodeURIComponent(chapter.subject)}&chapitre=${encodeURIComponent(chapter.id)}` } });
  }
  const unfixed = errors.filter((entry) => entry.fix === null && daysBetween(entry.date, today) >= 3);
  if (unfixed.length >= 3) {
    out.push({ rank: 16, item: { id: "erreurs-sans-correction", tone: "attention", subject: null, title: `${plural(unfixed.length, "erreur")} sans « bonne idée »`, detail: "Une ligne chacune suffit à ne plus la refaire", href: "/erreurs" } });
  }
  const pending = grades.filter((grade) => isPending(grade) && daysBetween(grade.date, today) >= PENDING_GRADE_DAYS);
  if (pending.length > 0) {
    out.push({ rank: 17, item: { id: "notes-en-attente", tone: "attention", subject: pending[0].subject, title: pending.length > 1 ? `${pending.length} notes en attente` : `Note en attente : ${pending[0].title}`, detail: "Copie rendue ? Note le résultat pour ta calibration", href: "/progress" } });
  }

  return out
    .filter((entry) => !urgentIds.has(entry.item.id.split(":")[1] ?? ""))
    .sort((a, b) => a.rank - b.rank || a.item.id.localeCompare(b.item.id))
    .slice(0, BRIEFING_SECTION_MAX)
    .map((entry) => entry.item);
}

/* ── 4. Aujourd'hui ───────────────────────────────────────────────── */

function todayItems(input: BriefingInput): BriefingItem[] {
  const { preferences, sessions, workItems, reviewItems, now } = input;
  const out: BriefingItem[] = [];

  const evening = eveningPlan(preferences, sessions, now).entries.filter((entry) => !entry.met);
  if (evening.length > 0) {
    out.push({
      id: "minimum-du-soir",
      tone: "aujourd'hui",
      subject: null,
      title: `Ce soir : ${evening.map((entry) => `${subjectInSentence(entry.subject)} ${formatMinutesSpan(entry.minMinutes - entry.doneMinutes)}`).join(", ")}`,
      detail: "Ton minimum du soir, ce qu'il en reste",
      href: "/dashboard",
    });
  }

  for (const intention of intentionsForToday(workItems, now)) {
    if (intention.missed) continue;
    const when = intention.plan.time ? `${formatClock(intention.plan.time)} : ` : "";
    out.push({ id: `plan:${intention.item.id}`, tone: "aujourd'hui", subject: intention.item.subject, title: `${when}${itemTitle(intention.item)}`, detail: intention.plan.place ? `Ton plan, ${intention.plan.place}` : "Ton plan « si… alors… »", href: `/timer?travail=${encodeURIComponent(intention.item.id)}` });
  }

  // Seulement les cartes du jour : celles en retard sont déjà dans « Tu repousses ».
  const today = dayKey(now);
  const due = dueReviewItems(reviewItems, now).filter((item) => daysBetween(effectiveSchedule(item).dueAt, today) < CARD_LATE_DAYS).length;
  if (due > 0) out.push({ id: "cartes-du-jour", tone: "aujourd'hui", subject: null, title: `${plural(due, "carte")} à réviser`, detail: `≈ ${due * 2} min`, href: "/revoir/session" });

  return out.slice(0, BRIEFING_SECTION_MAX);
}

/* ── Assemblage ───────────────────────────────────────────────────── */

function summarize(urgent: number, postponed: number): string {
  if (urgent === 0 && postponed === 0) return "Rien d'urgent, rien de repoussé.";
  const parts: string[] = [];
  if (urgent > 0) parts.push(plural(urgent, "chose pressante", "choses pressantes"));
  if (postponed > 0) parts.push(plural(postponed, "chose à ne plus repousser", "choses à ne plus repousser"));
  return `${parts.join(", ")}.`;
}

export function buildBriefing(input: BriefingInput): Briefing {
  const move = computeNextMove({ ...input, availableMinutes: null });
  const urgent = urgentItems(input);
  const urgentWorkIds = new Set(urgent.map((item) => item.id.split(":")[1] ?? ""));
  const postponed = postponedItems(input, urgentWorkIds);
  const today = todayItems(input);
  const strictlyPostponed = postponed.filter((item) => item.tone === "repoussé").length;
  return {
    greeting: greetingFor(input.now, input.preferences.displayName),
    summary: summarize(urgent.length, strictlyPostponed),
    move,
    urgent,
    postponed,
    today,
    hasContent: move.status !== "vide" || urgent.length + postponed.length + today.length > 0,
  };
}

/** Clé LOCALE (propre à l'appareil, jamais synchronisée) : dernière fois que le point a été affiché. */
export const BRIEFING_SEEN_KEY = "prepahub:briefing:seen";

/** Clé LOCALE : dernier signe d'activité dans l'application (components/activity-tracker.tsx). */
export const LAST_ACTIVITY_KEY = "prepahub:activity:last";

/**
 * Faut-il ouvrir sur le point ? À la première ouverture de la journée, et
 * de nouveau après `BRIEFING_AGAIN_HOURS` d'ABSENCE — jamais à chaque
 * retour sur l'accueil dans la même séance de travail.
 *
 * L'absence se mesure depuis le dernier signe d'activité dans l'application
 * (`lastActivityIso`), pas depuis le dernier affichage du point : sinon un
 * élève au travail depuis 8 h était renvoyé sur le point à 12 h, puis à
 * 16 h. Sans trace d'activité (première version, stockage vidé), on retombe
 * sur le dernier affichage.
 */
export function shouldShowBriefing(preferences: Preferences, lastSeenIso: string | null, now: Date, lastActivityIso: string | null = null): boolean {
  if (!preferences.briefingOnOpen) return false;
  if (!lastSeenIso) return true;
  const lastSeen = new Date(lastSeenIso);
  if (Number.isNaN(lastSeen.getTime())) return true;
  if (dayKey(lastSeen) !== dayKey(now)) return true;
  const activity = lastActivityIso ? new Date(lastActivityIso) : null;
  const since = activity && !Number.isNaN(activity.getTime()) && activity > lastSeen ? activity : lastSeen;
  return now.getTime() - since.getTime() >= BRIEFING_AGAIN_HOURS * HOUR;
}
