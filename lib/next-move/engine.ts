import { atRisk, AT_RISK_THRESHOLD } from "@/lib/chapter-memory";
import { computeCalibration } from "@/lib/calibration";
import { computeWorkItemPriority } from "@/lib/deadlines";
import { ERROR_TYPE_META, subjectInSentence } from "@/lib/error-log";
import { eveningPlan } from "@/lib/evening-minimums";
import { computeGradeStats, computeGradeTrend, formatAverage } from "@/lib/grades";
import { intentionsForToday, formatClock } from "@/lib/intentions";
import { dueReviewItems } from "@/lib/spaced-repetition";
import { computeSubjectTargets } from "@/lib/subject-targets";
import { dayKey, subjects as SUBJECT_ORDER } from "@/lib/study";
import { formatMinutesSpan } from "@/lib/utils";
import { activeWorkItems, daysUntilDue, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";
import type { ChapterMemory, DailyCheckin, ErrorEntry, ErrorType, Grade, NextMoveKind, NextMoveRecord, Preferences, ReviewItem, WorkItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * NEXT MOVE — « qu'est-ce que je fais maintenant ? »
 *
 * Un moteur DÉTERMINISTE de priorisation : aucune statistique apprise, aucun
 * modèle opaque. À partir des données déjà saisies, il fabrique des
 * CANDIDATS (une action concrète, une matière, une durée), leur donne un
 * score, puis compose une session qui tient dans le temps disponible.
 *
 * LA RÈGLE QUI GOUVERNE TOUT LE FICHIER : chaque point de score est un
 * `ScoreTerm` qui porte SA phrase. Un score qu'on ne peut pas expliquer est
 * un score auquel l'élève n'a aucune raison de se fier ; « Pourquoi ? » se
 * lit donc directement dans `terms`, sans rien recalculer.
 *
 * Le barème est à gros grain et n'a aucune valeur absolue : il ORDONNE. Il
 * reprend le barème existant des échéances (lib/deadlines.ts, 0 à ≈ 180)
 * pour que « DM pour demain » et « chapitre en train de s'effacer » se
 * comparent sur la même échelle.
 *
 * CE QUE LE MOTEUR NE PRÉTEND PAS : savoir ce qui marche pour l'élève. Il
 * applique des principes ordinaires (rappel actif avant oubli, erreurs
 * reprises à chaud, ne pas enchaîner 3 h de la même matière) à des chiffres
 * qu'il peut citer. La carte le dit : « d'après tes données ».
 *
 * Données RÉELLEMENT disponibles — et pas plus :
 *   le temps est suivi PAR MATIÈRE (et par travail planifié), pas par
 *   chapitre ; un chapitre n'apparaît donc que via la mémoire FSRS ou le
 *   titre d'une échéance. Les erreurs ont une matière et un type, pas de
 *   chapitre.
 *
 * Fonctions pures : aucune dépendance à localStorage, React ou au DOM.
 */

/* ── Types ────────────────────────────────────────────────────────── */

/** Même vocabulaire que `NextMoveRecord.kind` (lib/storage.ts), pour que l'historique se relise sans table de correspondance. */
export type MoveKind = NextMoveKind;

/** Libellé court d'un genre — pour relire une ligne d'historique, qui ne garde pas l'action détaillée. */
export const MOVE_KIND_LABEL: Record<MoveKind, string> = {
  échéance: "échéance",
  rappel: "rappel actif",
  cartes: "révisions espacées",
  erreurs: "reprise ciblée",
  bloc: "bloc de travail",
};

export interface ScoreTerm {
  /** Identifiant technique du terme (tests, analyse). */
  id: string;
  /** Points ajoutés — NÉGATIFS pour une pénalité. */
  points: number;
  /** La phrase montrée à l'élève. Courte, chiffrée quand c'est possible. */
  reason: string;
}

export interface MoveCandidate {
  /** Stable d'un calcul à l'autre : genre + matière + ancre. C'est la clé de l'historique. */
  key: string;
  kind: MoveKind;
  subject: Subject | null;
  /** Ce sur quoi porte l'action : « Électrostatique », « DM 4 », « 12 cartes », « Erreurs de méthode ». */
  title: string;
  /** L'action en deux ou trois mots : « rappel actif », « avancer le DM ». */
  action: string;
  /** Comment s'y prendre, en une phrase. */
  instruction: string;
  minMinutes: number;
  idealMinutes: number;
  maxMinutes: number;
  /** Où mène « Commencer ». */
  href: string;
  /** Un second lien utile (le carnet, la mémoire), facultatif. */
  resource: { label: string; href: string } | null;
  terms: ScoreTerm[];
  score: number;
}

export type StepKind = "move" | "pause";

export interface SessionStep {
  type: StepKind;
  minutes: number;
  /** Absent pour une pause. */
  candidate: MoveCandidate | null;
}

export type NextMoveStatus =
  /** Une recommandation solide. */
  | "ok"
  /** Des candidats, mais rien de pressant : la carte le dit au lieu d'inventer une urgence. */
  | "calme"
  /** Aucune donnée exploitable (nouvel inscrit) : on propose de commencer, sans prétendre recommander. */
  | "vide"
  /** Des candidats existent, mais aucun ne tient dans le temps demandé. */
  | "trop-court";

export interface NextMovePlan {
  status: NextMoveStatus;
  /** Le premier pas de la session, ou `null`. */
  primary: MoveCandidate | null;
  /** Une autre idée, d'une autre matière si possible. */
  alternative: MoveCandidate | null;
  steps: SessionStep[];
  /** Minutes de travail réellement composées (pauses comprises). */
  totalMinutes: number;
  /** Le temps pour lequel la session a été composée. */
  availableMinutes: number;
  /** `true` quand l'élève n'a pas choisi de durée : `availableMinutes` a été déduit. */
  auto: boolean;
  /** Tous les candidats, du plus prioritaire au moins prioritaire — pour le détail « pourquoi ». */
  ranked: MoveCandidate[];
  /** Constat de contexte, une ligne chacun (« Il est tard », « 3 h de maths aujourd'hui »). */
  context: string[];
}

export interface NextMoveInput {
  sessions: WorkSession[];
  workItems: WorkItem[];
  grades: Grade[];
  reviewItems: ReviewItem[];
  errors: ErrorEntry[];
  checkins: DailyCheckin[];
  chapterMemory: ChapterMemory[];
  preferences: Preferences;
  history: NextMoveRecord[];
  now: Date;
  /** Minutes choisies (« J'ai 30 min »), ou `null`/absent pour laisser le moteur décider. */
  availableMinutes?: number | null;
}

/* ── Barème ───────────────────────────────────────────────────────── */

/** Seuil sous lequel la meilleure recommandation n'est plus présentée comme pressante. */
export const CALM_THRESHOLD = 15;

/** Une échéance n'est candidate que si elle est pressante, importante ou planifiée ; au-delà, le planning suffit. */
const DEADLINE_HORIZON_DAYS = 14;

/** Rappel actif : jusqu'à 60 points pour un chapitre très menacé — (seuil − R) × 200. */
const RECALL_POINTS_PER_UNIT = 200;
const RECALL_MAX_POINTS = 60;
/** Chapitres par matière retenus comme candidats : au-delà, on se répète. */
const RECALL_PER_SUBJECT = 2;

/** Cartes de révision : 8 + 3 par carte due, plafonné. */
const CARDS_BASE = 8;
const CARDS_PER_ITEM = 3;
const CARDS_MAX = 40;
/** Minutes par carte — la même estimation que la bannière d'accueil (« ≈ 2 min par carte »). */
export const MINUTES_PER_CARD = 2;

/** Erreurs : fenêtre récente, et à partir de combien une matière mérite une reprise. */
export const ERROR_WINDOW_DAYS = 14;
const ERROR_MIN_COUNT = 2;
const ERROR_BASE = 10;
const ERROR_PER_ENTRY = 6;
const ERROR_MAX = 40;
const ERROR_DEEP_TYPE = 10;
const ERROR_NO_FIX = 8;
const ERROR_FRESH = 10;

/** Minimum du soir / objectif hebdo. */
const EVENING_BASE = 20;
const EVENING_EVENING_HOUR = 17;
const EVENING_EVENING_BONUS = 10;
const WEEKLY_BASE = 10;
const COUNTS_FOR_EVENING = 8;

/** Évaluation proche (DS, concours blanc) — bonus sur la préparation de la matière. */
const EXAM_KINDS = new Set(["ds", "concours"]);
const EXAM_WINDOW_DAYS = 7;

/** Plans « si… alors… ». */
const PLAN_TODAY = 25;
const PLAN_MISSED = 10;

/** Notes. */
const GRADE_DECLINE = 8;
const GRADE_BELOW_AVERAGE = 6;
const GRADE_BELOW_MARGIN = 1.5;
const CALIBRATION_OVERCONFIDENT = 5;
const CALIBRATION_THRESHOLD = 1;

/** Travail récent dans la même matière. */
const RECENT_WINDOW_HOURS = 3;
const RECENT_HEAVY_MINUTES = 120;
const RECENT_HEAVY_PENALTY = -30;
const RECENT_MEDIUM_MINUTES = 60;
const RECENT_MEDIUM_PENALTY = -12;

/** Énergie / heure. */
const LOW_ENERGY_LONG_PENALTY = -8;
const LOW_ENERGY_SHORT_BONUS = 5;
const LATE_HOUR = 22;
const LATE_LONG_PENALTY = -5;

/** Historique. */
const DONE_RECENTLY_HOURS = 12;
const DONE_RECENTLY_PENALTY = -40;
const SKIPPED_RECENTLY_HOURS = 24;
const SKIPPED_RECENTLY_PENALTY = -15;
const IGNORED_WINDOW_HOURS = 72;
const IGNORED_MIN_TIMES = 3;
const IGNORED_PENALTY = -8;

/** Composition. */
const DEFAULT_AUTO_MINUTES = 45;
const LATE_AUTO_MINUTES = 30;
const MAX_STEPS = 4;
const PAUSE_AFTER_MINUTES = 50;
const PAUSE_MINUTES = 5;
const SAME_SUBJECT_STEP_PENALTY = 5;

/** Ordre de départage à score égal : le plus contraint d'abord. */
const KIND_ORDER: MoveKind[] = ["échéance", "rappel", "erreurs", "cartes", "bloc"];

/* ── Petits outils ────────────────────────────────────────────────── */

const HOUR = 3_600_000;
const DAY = 86_400_000;

function sessionEnd(session: WorkSession): number {
  if (session.ended_at) return new Date(session.ended_at).getTime();
  return new Date(session.started_at).getTime() + session.duration_seconds * 1000;
}

function inSentence(subject: Subject): string {
  return subjectInSentence(subject);
}

function daysAgoLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  // Espace insécable : « 5 j » ne se coupe jamais en fin de ligne.
  return `il y a ${days}\u00a0j`;
}

function inDaysLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days}\u00a0j`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sumScore(terms: ScoreTerm[]): number {
  return terms.reduce((total, term) => total + term.points, 0);
}

function localMidnight(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

function dayDistance(from: string, to: string): number {
  return Math.round((localMidnight(to) - localMidnight(from)) / DAY);
}

function subjectRank(subject: Subject | null): number {
  return subject ? SUBJECT_ORDER.indexOf(subject) : SUBJECT_ORDER.length;
}

/** Tri stable et EXPLICITE : score, puis genre, puis matière, puis clé — jamais l'ordre du fichier. */
export function compareCandidates(a: MoveCandidate, b: MoveCandidate): number {
  return (
    b.score - a.score ||
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    subjectRank(a.subject) - subjectRank(b.subject) ||
    a.key.localeCompare(b.key)
  );
}

/* ── Contexte par matière ─────────────────────────────────────────── */

interface SubjectContext {
  /** Prochaine évaluation (DS, concours blanc) dans la fenêtre, la plus proche. */
  exam: { title: string; days: number; kindLabel: string } | null;
  /** Minutes restantes du minimum du soir, aujourd'hui. */
  eveningRemaining: number;
  /** Retard sur l'objectif hebdo, en minutes (0 si dans le rythme). */
  weeklyLag: { lag: number; done: number; expected: number; target: number } | null;
  /** Minutes travaillées dans la matière durant les dernières heures. */
  recentMinutes: number;
  gradeTerms: ScoreTerm[];
  overconfident: ScoreTerm | null;
}

function buildSubjectContexts(input: NextMoveInput): Map<Subject, SubjectContext> {
  const { sessions, workItems, grades, preferences, now } = input;
  const contexts = new Map<Subject, SubjectContext>();
  for (const subject of SUBJECT_ORDER) {
    contexts.set(subject, { exam: null, eveningRemaining: 0, weeklyLag: null, recentMinutes: 0, gradeTerms: [], overconfident: null });
  }

  // Évaluations proches — seules les échéances « DS » ou « concours » en portent.
  for (const item of activeWorkItems(workItems)) {
    if (!item.subject || !EXAM_KINDS.has(item.kind)) continue;
    const days = daysUntilDue(item, now);
    if (days === null || days < 0 || days > EXAM_WINDOW_DAYS) continue;
    const context = contexts.get(item.subject)!;
    if (!context.exam || days < context.exam.days) {
      context.exam = { title: item.title, days, kindLabel: WORK_ITEM_KIND_META[item.kind].short };
    }
  }

  for (const entry of eveningPlan(preferences, sessions, now).entries) {
    if (!entry.met) contexts.get(entry.subject)!.eveningRemaining = entry.minMinutes - entry.doneMinutes;
  }

  for (const target of computeSubjectTargets(sessions, preferences.weeklySubjectTargets, now, preferences.capacityByWeekday)) {
    if (target.pace !== "en retard") continue;
    contexts.get(target.subject)!.weeklyLag = {
      lag: Math.max(0, target.expectedMinutes - target.doneMinutes),
      done: target.doneMinutes,
      expected: target.expectedMinutes,
      target: target.targetMinutes,
    };
  }

  const since = now.getTime() - RECENT_WINDOW_HOURS * HOUR;
  for (const session of sessions) {
    const end = sessionEnd(session);
    const start = new Date(session.started_at).getTime();
    if (end <= since || start > now.getTime()) continue;
    // Seule la part de la séance tombée DANS la fenêtre compte.
    const overlap = Math.max(0, Math.min(end, now.getTime()) - Math.max(start, since));
    const context = contexts.get(session.subject);
    if (context) context.recentMinutes += Math.round(overlap / 60_000);
  }

  // Notes : une tendance à la baisse, ou une matière nettement sous la moyenne générale.
  const overall = computeGradeStats(grades).average;
  for (const subject of SUBJECT_ORDER) {
    const trend = computeGradeTrend(grades, subject);
    const context = contexts.get(subject)!;
    if (trend.trend.direction === "baisse" && trend.trend.first !== null && trend.trend.last !== null) {
      context.gradeTerms.push({
        id: "notes-baisse",
        points: GRADE_DECLINE,
        reason: `Notes en baisse en ${inSentence(subject)} (${formatAverage(round1(trend.trend.first))} → ${formatAverage(round1(trend.trend.last))})`,
      });
    }
    const average = trend.stats.average;
    if (overall !== null && average !== null && trend.stats.count >= 2 && average <= overall - GRADE_BELOW_MARGIN) {
      context.gradeTerms.push({
        id: "notes-sous-moyenne",
        points: GRADE_BELOW_AVERAGE,
        reason: `Moyenne de ${formatAverage(average)} en ${inSentence(subject)}, sous ta moyenne générale (${formatAverage(overall)})`,
      });
    }
  }

  for (const summary of computeCalibration(grades).bySubject) {
    if (!summary.subject || !summary.sufficient || summary.meanError === null || summary.meanError < CALIBRATION_THRESHOLD) continue;
    contexts.get(summary.subject)!.overconfident = {
      id: "calibration",
      points: CALIBRATION_OVERCONFIDENT,
      reason: `Tu te surestimes en ${inSentence(summary.subject)} (+${formatAverage(summary.meanError)} pt en moyenne) : un rappel vérifie ce que tu crois savoir`,
    };
  }

  return contexts;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ── Génération des candidats ─────────────────────────────────────── */

function timerHref(subject: Subject): string {
  return `/timer?matiere=${encodeURIComponent(subject)}`;
}

function deadlineCandidates(input: NextMoveInput): MoveCandidate[] {
  const { workItems, sessions, preferences, now } = input;
  const today = dayKey(now);
  const intentions = new Map(intentionsForToday(workItems, now).map((intention) => [intention.item.id, intention]));
  const out: MoveCandidate[] = [];

  for (const item of activeWorkItems(workItems)) {
    if (item.notBeforeDate && item.notBeforeDate > today) continue;
    const remaining = remainingMinutes(item, sessions);
    if (remaining <= 0) continue;
    const days = daysUntilDue(item, now);
    const intention = intentions.get(item.id);
    const relevant = (days !== null && days <= DEADLINE_HORIZON_DAYS) || item.important || intention;
    if (!relevant) continue;

    const priority = computeWorkItemPriority(item, sessions, preferences, now);
    const terms: ScoreTerm[] = [];
    if (priority.score > 0) {
      terms.push({ id: "échéance", points: priority.score, reason: priority.reasons.join(" · ") });
    }
    if (intention && !intention.missed) {
      terms.push({
        id: "plan-du-jour",
        points: PLAN_TODAY,
        reason: `Tu avais prévu de t'y mettre aujourd'hui${intention.plan.time ? ` à ${formatClock(intention.plan.time)}` : ""}`,
      });
    } else if (intention?.missed) {
      terms.push({ id: "plan-manqué", points: PLAN_MISSED, reason: "Un plan « si… alors… » est passé sans que ce soit fait" });
    }

    const kindLabel = WORK_ITEM_KIND_META[item.kind].short;
    const action = item.kind === "ds" || item.kind === "concours" ? `préparer le ${kindLabel}` : item.kind === "dm" ? "avancer le DM" : "avancer ce travail";
    out.push({
      key: `échéance:${item.id}`,
      kind: "échéance",
      subject: item.subject,
      title: item.title,
      action,
      instruction: `Il reste environ ${formatMinutesSpan(remaining)} sur « ${item.title} ». Le chrono rattache ce temps au travail.`,
      minMinutes: Math.min(15, remaining),
      idealMinutes: Math.min(50, remaining),
      maxMinutes: remaining,
      href: `/timer?travail=${encodeURIComponent(item.id)}`,
      resource: { label: "Échéances", href: "/echeances" },
      terms,
      score: 0,
    });
  }
  return out;
}

function recallCandidates(input: NextMoveInput): MoveCandidate[] {
  const today = dayKey(input.now);
  const perSubject = new Map<Subject, number>();
  const out: MoveCandidate[] = [];
  for (const { chapter, retrievability } of atRisk(input.chapterMemory, today)) {
    const count = perSubject.get(chapter.subject) ?? 0;
    if (count >= RECALL_PER_SUBJECT) continue;
    perSubject.set(chapter.subject, count + 1);

    const lastDay = chapter.reviews.length > 0 ? chapter.reviews[chapter.reviews.length - 1].day : chapter.learnedAt;
    const since = dayDistance(lastDay, today);
    const terms: ScoreTerm[] = [
      {
        id: "oubli",
        points: Math.min(RECALL_MAX_POINTS, Math.round((AT_RISK_THRESHOLD - retrievability) * RECALL_POINTS_PER_UNIT)),
        reason: `Chance estimée de t'en souvenir : ${Math.round(retrievability * 100)} %`,
      },
    ];
    // Information, pas des points : l'ancienneté est déjà dans la probabilité.
    terms.push({ id: "dernier-rappel", points: 0, reason: chapter.reviews.length > 0 ? `Dernier rappel ${daysAgoLabel(since)}` : `Appris ${daysAgoLabel(since)}, jamais révisé depuis` });

    out.push({
      key: `rappel:${chapter.id}`,
      kind: "rappel",
      subject: chapter.subject,
      title: chapter.title,
      action: "rappel actif",
      instruction: "Sans tes notes : écris définitions, théorèmes et une démonstration clé, puis vérifie et corrige. Note ensuite le rappel dans Mémoire.",
      minMinutes: 10,
      idealMinutes: 25,
      maxMinutes: 30,
      href: timerHref(chapter.subject),
      resource: { label: "Noter le rappel", href: "/memoire" },
      terms,
      score: 0,
    });
  }
  return out;
}

function cardCandidates(input: NextMoveInput): MoveCandidate[] {
  const due = dueReviewItems(input.reviewItems, input.now);
  const bySubject = new Map<Subject, number>();
  for (const item of due) bySubject.set(item.subject, (bySubject.get(item.subject) ?? 0) + 1);
  const out: MoveCandidate[] = [];
  for (const subject of SUBJECT_ORDER) {
    const count = bySubject.get(subject) ?? 0;
    if (count === 0) continue;
    const full = count * MINUTES_PER_CARD;
    out.push({
      key: `cartes:${subject}`,
      kind: "cartes",
      subject,
      title: `${count} carte${count > 1 ? "s" : ""} à réviser`,
      action: "révisions espacées",
      instruction: "Cherche chaque réponse de tête avant de la retourner, puis note honnêtement : c'est ce qui règle le prochain rappel.",
      minMinutes: Math.min(5, full),
      idealMinutes: clamp(full, 5, 30),
      maxMinutes: full,
      href: `/revoir/session?subject=${encodeURIComponent(subject)}`,
      resource: null,
      terms: [{ id: "cartes-dues", points: Math.min(CARDS_MAX, CARDS_BASE + CARDS_PER_ITEM * count), reason: `${count} carte${count > 1 ? "s" : ""} arrivée${count > 1 ? "s" : ""} à échéance` }],
      score: 0,
    });
  }
  return out;
}

const DEEP_ERROR_TYPES: ReadonlySet<ErrorType> = new Set(["méthode", "cours"]);

function errorCandidates(input: NextMoveInput): MoveCandidate[] {
  const today = dayKey(input.now);
  const from = dayKey(new Date(localMidnight(today) - (ERROR_WINDOW_DAYS - 1) * DAY));
  const recent = input.errors.filter((entry) => entry.date >= from && entry.date <= today);
  const out: MoveCandidate[] = [];

  for (const subject of SUBJECT_ORDER) {
    const own = recent.filter((entry) => entry.subject === subject);
    if (own.length < ERROR_MIN_COUNT) continue;

    const byType = new Map<ErrorType, number>();
    for (const entry of own) byType.set(entry.type, (byType.get(entry.type) ?? 0) + 1);
    // Type dominant : le plus fréquent ; à égalité, les types « de fond » (méthode, cours) d'abord.
    const [topType, topCount] = [...byType.entries()].sort(
      (a, b) => b[1] - a[1] || Number(DEEP_ERROR_TYPES.has(b[0])) - Number(DEEP_ERROR_TYPES.has(a[0])) || a[0].localeCompare(b[0])
    )[0];

    const terms: ScoreTerm[] = [
      {
        id: "erreurs-récentes",
        points: Math.min(ERROR_MAX, ERROR_BASE + ERROR_PER_ENTRY * own.length),
        reason: `${own.length} erreurs notées en ${inSentence(subject)} ces ${ERROR_WINDOW_DAYS} derniers jours`,
      },
    ];
    if (topCount >= 2 && DEEP_ERROR_TYPES.has(topType)) {
      terms.push({ id: "erreurs-de-fond", points: ERROR_DEEP_TYPE, reason: `Dont ${topCount} de ${ERROR_TYPE_META[topType].label.toLowerCase()} : le même point bloque` });
    }
    const withoutFix = own.filter((entry) => entry.fix === null).length;
    if (withoutFix > 0) {
      terms.push({ id: "erreurs-sans-correction", points: ERROR_NO_FIX, reason: `${withoutFix} sans « bonne idée » notée` });
    }
    const freshest = own.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), own[0].date);
    const age = dayDistance(freshest, today);
    if (age <= 1) {
      terms.push({ id: "erreur-fraîche", points: ERROR_FRESH, reason: `Erreur notée ${daysAgoLabel(age)} : à reprendre tant que c'est frais` });
    }

    const label = topCount >= 2 ? `Erreurs de ${ERROR_TYPE_META[topType].label.toLowerCase()}` : "Tes erreurs récentes";
    out.push({
      key: `erreurs:${subject}:${topCount >= 2 ? topType : "mix"}`,
      kind: "erreurs",
      subject,
      title: label,
      action: "reprise ciblée",
      instruction: "Refais les questions ratées sans regarder la correction, puis écris la bonne idée de chacune dans le carnet.",
      minMinutes: 10,
      idealMinutes: 20,
      maxMinutes: 35,
      href: timerHref(subject),
      resource: { label: "Mes erreurs", href: `/erreurs?subject=${encodeURIComponent(subject)}` },
      terms,
      score: 0,
    });
  }
  return out;
}

function blockCandidates(input: NextMoveInput, contexts: Map<Subject, SubjectContext>): MoveCandidate[] {
  const hour = input.now.getHours();
  const out: MoveCandidate[] = [];
  for (const subject of SUBJECT_ORDER) {
    const context = contexts.get(subject)!;
    const terms: ScoreTerm[] = [];
    if (context.eveningRemaining > 0) {
      terms.push({
        id: "minimum-du-soir",
        points: EVENING_BASE + Math.min(30, Math.round(context.eveningRemaining / 4)),
        reason: `Minimum du soir : encore ${formatMinutesSpan(context.eveningRemaining)} en ${inSentence(subject)}`,
      });
      if (hour >= EVENING_EVENING_HOUR) terms.push({ id: "c-est-le-soir", points: EVENING_EVENING_BONUS, reason: "C'est le moment de la soirée où il se fait" });
    }
    if (context.weeklyLag && context.weeklyLag.lag > 0) {
      terms.push({
        id: "objectif-hebdo",
        points: WEEKLY_BASE + Math.min(20, Math.round(context.weeklyLag.lag / 15)),
        reason: `Objectif de la semaine en retard : ${formatMinutesSpan(context.weeklyLag.done)} faites, ${formatMinutesSpan(context.weeklyLag.expected)} attendues à ce stade`,
      });
    }
    if (terms.length === 0) continue;
    const need = Math.max(context.eveningRemaining, context.weeklyLag?.lag ?? 0);
    out.push({
      key: `bloc:${subject}`,
      kind: "bloc",
      subject,
      title: subject,
      action: "bloc de travail",
      instruction: `Une séance de ${inSentence(subject)} sur ce que tu as en cours (TD, exercices, cours à reprendre). Le chrono compte le temps.`,
      minMinutes: Math.min(20, need),
      idealMinutes: clamp(need, 20, 50),
      maxMinutes: Math.max(need, 20),
      href: timerHref(subject),
      resource: null,
      terms,
      score: 0,
    });
  }
  return out;
}

/* ── Modulateurs ──────────────────────────────────────────────────── */

function latestCheckin(checkins: DailyCheckin[], now: Date): DailyCheckin | null {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY));
  return checkins.find((entry) => entry.date === today) ?? checkins.find((entry) => entry.date === yesterday) ?? null;
}

const SHORT_KINDS: ReadonlySet<MoveKind> = new Set(["cartes", "rappel"]);
const LONG_KINDS: ReadonlySet<MoveKind> = new Set(["échéance", "bloc"]);
/** Préparation d'une évaluation : ce qui consolide (mémoire, erreurs, cartes) — pas l'échéance elle-même, déjà notée. */
const EXAM_PREP_KINDS: ReadonlySet<MoveKind> = new Set(["rappel", "erreurs", "cartes"]);

function applyModifiers(candidate: MoveCandidate, input: NextMoveInput, contexts: Map<Subject, SubjectContext>): void {
  const { now, history } = input;
  const context = candidate.subject ? contexts.get(candidate.subject) : undefined;

  if (context) {
    if (context.exam && EXAM_PREP_KINDS.has(candidate.kind)) {
      const points = context.exam.days <= 1 ? 25 : context.exam.days <= 3 ? 18 : 10;
      candidate.terms.push({ id: "évaluation-proche", points, reason: `${context.exam.kindLabel} « ${context.exam.title} » ${inDaysLabel(context.exam.days)}` });
    }
    if (context.eveningRemaining > 0 && candidate.kind !== "bloc" && candidate.kind !== "cartes") {
      candidate.terms.push({ id: "compte-pour-le-soir", points: COUNTS_FOR_EVENING, reason: "Compte pour ton minimum du soir" });
    }
    for (const term of context.gradeTerms) if (candidate.kind !== "échéance") candidate.terms.push(term);
    if (context.overconfident && SHORT_KINDS.has(candidate.kind)) candidate.terms.push(context.overconfident);

    if (context.recentMinutes >= RECENT_HEAVY_MINUTES) {
      candidate.terms.push({ id: "déjà-beaucoup", points: RECENT_HEAVY_PENALTY, reason: `Tu viens de faire ${formatMinutesSpan(context.recentMinutes)} de ${inSentence(candidate.subject!)} : changer de matière aide` });
    } else if (context.recentMinutes >= RECENT_MEDIUM_MINUTES) {
      candidate.terms.push({ id: "déjà-un-peu", points: RECENT_MEDIUM_PENALTY, reason: `Déjà ${formatMinutesSpan(context.recentMinutes)} de ${inSentence(candidate.subject!)} ces dernières heures` });
    }
  }

  const checkin = latestCheckin(input.checkins, now);
  if (checkin && (checkin.energy <= 2 || checkin.sleepHours < 6)) {
    const why = checkin.energy <= 2 ? "Énergie basse au dernier check-in" : `${formatAverage(checkin.sleepHours)} h de sommeil au dernier check-in`;
    if (LONG_KINDS.has(candidate.kind)) candidate.terms.push({ id: "fatigue-long", points: LOW_ENERGY_LONG_PENALTY, reason: `${why} : un long bloc passe moins bien` });
    if (SHORT_KINDS.has(candidate.kind)) candidate.terms.push({ id: "fatigue-court", points: LOW_ENERGY_SHORT_BONUS, reason: `${why} : un format court convient` });
  }

  if (now.getHours() >= LATE_HOUR && LONG_KINDS.has(candidate.kind)) {
    candidate.terms.push({ id: "tard", points: LATE_LONG_PENALTY, reason: "Il est tard pour un long bloc" });
  }

  applyHistory(candidate, history, now);
  candidate.score = sumScore(candidate.terms);
}

function applyHistory(candidate: MoveCandidate, history: NextMoveRecord[], now: Date): void {
  const own = history.filter((record) => record.key === candidate.key);
  if (own.length === 0) return;
  const t = now.getTime();
  const age = (iso: string | null) => (iso ? (t - new Date(iso).getTime()) / HOUR : Infinity);

  const done = own.find((record) => record.status === "fait" && age(record.resolvedAt ?? record.startedAt) <= DONE_RECENTLY_HOURS);
  if (done) {
    const hours = Math.max(1, Math.round(age(done.resolvedAt ?? done.startedAt)));
    candidate.terms.push({ id: "déjà-fait", points: DONE_RECENTLY_PENALTY, reason: `Déjà fait il y a ${hours} h` });
    return;
  }
  if (own.some((record) => record.status === "écarté" && age(record.resolvedAt ?? record.proposedAt) <= SKIPPED_RECENTLY_HOURS)) {
    candidate.terms.push({ id: "écarté", points: SKIPPED_RECENTLY_PENALTY, reason: "Tu l'as mis de côté récemment" });
    return;
  }
  const ignored = own.filter((record) => record.status === "proposé" && age(record.proposedAt) <= IGNORED_WINDOW_HOURS).length;
  if (ignored >= IGNORED_MIN_TIMES) {
    candidate.terms.push({ id: "ignoré", points: IGNORED_PENALTY, reason: `Proposé ${ignored} fois sans suite : on varie` });
  }
}

/* ── Classement ───────────────────────────────────────────────────── */

/** Tous les candidats, notés et classés. Exposé pour les tests et pour le détail « pourquoi ». */
export function rankCandidates(input: NextMoveInput): MoveCandidate[] {
  const contexts = buildSubjectContexts(input);
  const candidates = [
    ...deadlineCandidates(input),
    ...recallCandidates(input),
    ...errorCandidates(input),
    ...cardCandidates(input),
    ...blockCandidates(input, contexts),
  ];
  for (const candidate of candidates) applyModifiers(candidate, input, contexts);
  return candidates.sort(compareCandidates);
}

/* ── Composition ──────────────────────────────────────────────────── */

/** Temps visé quand l'élève ne dit rien : une séance ordinaire, plus courte tard le soir. */
export function autoMinutes(now: Date): number {
  return now.getHours() >= LATE_HOUR ? LATE_AUTO_MINUTES : DEFAULT_AUTO_MINUTES;
}

/**
 * Compose une session qui tient dans `available` minutes.
 *
 * GLOUTON ET EXPLICABLE : on prend le meilleur candidat qui tient, on lui
 * donne sa durée idéale (bornée par ce qui reste), puis on recommence avec
 * ce qui reste. Une pause courte s'intercale après ≈ 50 min d'affilée s'il
 * reste de quoi travailler après. Une matière déjà programmée perd quelques
 * points pour les pas suivants — assez pour varier, pas assez pour écarter
 * une reprise ciblée qui prolonge naturellement un rappel.
 *
 * Le reliquat (moins que le minimum de tout candidat restant) est rendu aux
 * pas déjà choisis, dans l'ordre, jusqu'à leur durée maximale — plutôt que
 * d'inventer une tâche de remplissage.
 */
export function composeSession(ranked: MoveCandidate[], available: number): SessionStep[] {
  const steps: SessionStep[] = [];
  const used = new Set<string>();
  let remaining = available;
  let sinceBreak = 0;
  const bySubject = new Map<Subject | null, number>();

  while (remaining > 0 && steps.filter((step) => step.type === "move").length < MAX_STEPS) {
    const pool = ranked
      .filter((candidate) => !used.has(candidate.key) && candidate.minMinutes <= remaining && candidate.minMinutes > 0)
      .map((candidate) => ({ candidate, adjusted: candidate.score - SAME_SUBJECT_STEP_PENALTY * (bySubject.get(candidate.subject) ?? 0) }))
      .sort((a, b) => b.adjusted - a.adjusted || compareCandidates(a.candidate, b.candidate));
    const next = pool[0];
    // Après le premier pas, on n'ajoute que ce qui a une raison d'être là.
    if (!next || (steps.length > 0 && next.adjusted <= 0)) break;

    const candidate = next.candidate;
    const minutes = Math.min(candidate.idealMinutes, candidate.maxMinutes, remaining);
    steps.push({ type: "move", minutes, candidate });
    used.add(candidate.key);
    bySubject.set(candidate.subject, (bySubject.get(candidate.subject) ?? 0) + 1);
    remaining -= minutes;
    sinceBreak += minutes;

    const canContinue = ranked.some((other) => !used.has(other.key) && other.minMinutes > 0 && other.minMinutes <= remaining - PAUSE_MINUTES);
    if (sinceBreak >= PAUSE_AFTER_MINUTES && canContinue) {
      steps.push({ type: "pause", minutes: PAUSE_MINUTES, candidate: null });
      remaining -= PAUSE_MINUTES;
      sinceBreak = 0;
    }
  }

  // Une pause en dernière position ne sert à rien.
  while (steps.length > 0 && steps[steps.length - 1].type === "pause") {
    remaining += steps.pop()!.minutes;
  }

  // Reliquat : rendu aux pas existants, jusqu'à leur maximum.
  for (const step of steps) {
    if (remaining <= 0) break;
    if (step.type !== "move" || !step.candidate) continue;
    const room = step.candidate.maxMinutes - step.minutes;
    if (room <= 0) continue;
    const extra = Math.min(room, remaining);
    step.minutes += extra;
    remaining -= extra;
  }
  return steps;
}

/* ── Point d'entrée ───────────────────────────────────────────────── */

function describeContext(input: NextMoveInput, contexts: Map<Subject, SubjectContext>): string[] {
  const lines: string[] = [];
  const exams = SUBJECT_ORDER.map((subject) => ({ subject, exam: contexts.get(subject)!.exam }))
    .filter((entry): entry is { subject: Subject; exam: NonNullable<SubjectContext["exam"]> } => entry.exam !== null)
    .sort((a, b) => a.exam.days - b.exam.days);
  if (exams[0]) lines.push(`${exams[0].exam.kindLabel} de ${inSentence(exams[0].subject)} ${inDaysLabel(exams[0].exam.days)}`);
  const heavy = SUBJECT_ORDER.find((subject) => contexts.get(subject)!.recentMinutes >= RECENT_HEAVY_MINUTES);
  if (heavy) lines.push(`${formatMinutesSpan(contexts.get(heavy)!.recentMinutes)} de ${inSentence(heavy)} ces dernières heures`);
  if (input.now.getHours() >= LATE_HOUR) lines.push("Il est tard : format court");
  return lines;
}

/**
 * La recommandation. Toujours une réponse, même sans données : le statut dit
 * alors honnêtement qu'il n'y a pas de quoi recommander (« vide ») ou que
 * rien ne presse (« calme ») — le moteur n'invente jamais d'urgence.
 */
export function computeNextMove(input: NextMoveInput): NextMovePlan {
  const auto = input.availableMinutes === null || input.availableMinutes === undefined;
  const available = auto ? autoMinutes(input.now) : Math.max(0, Math.round(input.availableMinutes!));
  const ranked = rankCandidates(input);
  const context = describeContext(input, buildSubjectContexts(input));
  const base = { availableMinutes: available, auto, ranked, context };

  if (ranked.length === 0) {
    return { ...base, status: "vide", primary: null, alternative: null, steps: [], totalMinutes: 0 };
  }

  const steps = composeSession(ranked, available);
  const primary = steps.find((step) => step.type === "move")?.candidate ?? null;
  if (!primary) {
    return { ...base, status: "trop-court", primary: null, alternative: null, steps: [], totalMinutes: 0 };
  }

  // « Autre idée » REMPLACE le premier pas : on la prend d'une autre matière quand il y en a une.
  const others = ranked.filter((candidate) => candidate.key !== primary.key && candidate.score > 0);
  const alternative = others.find((candidate) => candidate.subject !== primary.subject) ?? others[0] ?? null;

  return {
    ...base,
    status: primary.score >= CALM_THRESHOLD ? "ok" : "calme",
    primary,
    alternative,
    steps,
    totalMinutes: steps.reduce((total, step) => total + step.minutes, 0),
  };
}

/** Les raisons à montrer sur la carte : les termes POSITIFS les plus lourds, puis les informations — au plus `limit`. */
export function topReasons(candidate: MoveCandidate, limit = 3): string[] {
  const positive = candidate.terms.filter((term) => term.points > 0).sort((a, b) => b.points - a.points);
  const neutral = candidate.terms.filter((term) => term.points === 0);
  return [...positive, ...neutral].slice(0, limit).map((term) => term.reason);
}
