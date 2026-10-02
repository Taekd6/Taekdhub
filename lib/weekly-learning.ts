import { ATTEMPT_CAUSE_LABEL, EXERCISE_LEVEL_LABEL, isCleanSuccess, type AttemptCause, type ExerciseAttempt } from "@/lib/attempts";
import { FINDING_LABEL, mainFinding, type FindingKind } from "@/lib/diagnostic";
import { levelToRequest, varietyWarning } from "@/lib/exercise-quality";
import type { DiagnosticContext } from "@/lib/diagnostic-context";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";
import type { WeeklyFocus } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";
import { isTransferKey, transferChecks } from "@/lib/transfer";

/**
 * BILAN HEBDOMADAIRE OPÉRATIONNEL — « qu'est-ce que je sais FAIRE de plus
 * qu'il y a sept jours, qu'est-ce qui coince encore, et qu'est-ce que je
 * change la semaine prochaine ? »
 *
 * Le bilan de l'onglet Progression (lib/weekly-review.ts) parle du TEMPS.
 * Celui-ci parle de COMPÉTENCES, et ne compte que des preuves :
 *
 *   vérifié         un exercice raté puis réussi SANS AIDE dans la semaine,
 *                   ou un transfert réussi sans aide (méthode acquise).
 *                   Le temps passé n'entre jamais ici.
 *   récurrent       une même cause d'échec sur au moins `RECURRING_MIN`
 *                   exercices DIFFÉRENTS d'un chapitre en `RECURRING_DAYS`
 *                   jours — un échec isolé n'est pas une difficulté.
 *   progrès         comparaison avec les sept jours précédents, seulement
 *                   quand chaque période a au moins `MIN_ATTEMPTS_TO_COMPARE`
 *                   tentatives ; sinon on le dit, sans conclure.
 *   à travailler    les chapitres en tête du diagnostic (lib/diagnostic.ts),
 *                   constat récent seulement, avec l'hypothèse affichée
 *                   comme telle.
 *   décisions       ce qui change la semaine prochaine. Les chapitres
 *                   proposés ne deviennent des priorités que si l'élève les
 *                   ADOPTE (preferences.weeklyFocus) ; Next Move les fait
 *                   alors passer devant pendant sept jours.
 *
 * Fonctions pures.
 */

export const BILAN_DAYS = 7;
export const RECURRING_DAYS = 14;
export const RECURRING_MIN = 2;
export const MIN_ATTEMPTS_TO_COMPARE = 3;
export const FOCUS_MAX = 3;
/** Au-delà, la file « À refaire » déborde : on la vide avant d'ouvrir de nouveaux exercices. */
export const RETRY_BACKLOG = 5;

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d + days, 12).toLocaleDateString("en-CA");
}

function pct(part: number, total: number): string {
  return `${Math.round((part / total) * 100)} %`;
}

export interface VerifiedSkill {
  label: string;
  subject: Subject | null;
  chapter: string | null;
  on: string;
  proof: "refait sans aide" | "transfert réussi";
  /** « 45 → 25 min », quand les deux temps sont connus. */
  minutes: string | null;
}

export interface RecurringDifficulty {
  chapterId: string;
  chapter: string;
  subject: Subject;
  cause: AttemptCause;
  /** Exercices différents ratés pour cette cause. */
  exercises: number;
  fact: string;
}

export interface ChapterToWork {
  chapterId: string;
  chapter: string;
  subject: Subject;
  kind: FindingKind;
  label: string;
  level: "établi" | "signal";
  fact: string;
  hypothesis: string;
  action: string;
}

export interface WeeklyDecision {
  /** Le chapitre qui deviendra prioritaire si la décision est adoptée ; `null` pour une règle de la semaine. */
  chapterId: string | null;
  text: string;
}

export interface WeeklyLearning {
  from: string;
  to: string;
  verified: VerifiedSkill[];
  recurring: RecurringDifficulty[];
  progress: string[];
  toWork: ChapterToWork[];
  decisions: WeeklyDecision[];
  /** Assez de tentatives cette semaine pour dire quelque chose ? */
  attemptsThisWeek: number;
}

export function computeWeeklyLearning(context: DiagnosticContext, attempts: ExerciseAttempt[], retryDelaysDays: number[], today: string): WeeklyLearning {
  const from = addDays(today, -(BILAN_DAYS - 1));
  const previousFrom = addDays(from, -BILAN_DAYS);
  const inWeek = (day: string | null) => day !== null && day >= from && day <= today;
  const chapterOf = (id: string | null) => (id ? PROGRAMME_BY_ID.get(id) ?? null : null);

  // ── Compétences vérifiées : des preuves, jamais du temps ──
  const verified: VerifiedSkill[] = [];
  for (const exercise of context.exercises) {
    if (exercise.status !== "vérifié" || !inWeek(exercise.verifiedOn) || isTransferKey(exercise.key)) continue;
    const first = exercise.steps[0].minutes;
    const last = exercise.steps[exercise.steps.length - 1].minutes;
    verified.push({ label: exercise.label, subject: exercise.subject, chapter: chapterOf(exercise.chapterId)?.title ?? null, on: exercise.verifiedOn!, proof: "refait sans aide", minutes: first !== null && last !== null ? `${first} → ${last} min` : null });
  }
  for (const check of transferChecks(context.exercises, attempts, retryDelaysDays, today)) {
    const last = check.attempts[check.attempts.length - 1];
    if (check.status !== "acquis" || !inWeek(last.day)) continue;
    verified.push({ label: `Méthode de « ${check.exercise.label} »`, subject: check.exercise.subject, chapter: chapterOf(check.exercise.chapterId)?.title ?? null, on: last.day, proof: "transfert réussi", minutes: null });
  }
  verified.sort((a, b) => a.on.localeCompare(b.on));

  // ── Difficultés récurrentes : même cause, plusieurs exercices, fenêtre courte ──
  const recurringFrom = addDays(today, -(RECURRING_DAYS - 1));
  const byCause = new Map<string, Set<string>>();
  for (const exercise of context.exercises) {
    if (!exercise.chapterId) continue;
    for (const step of exercise.steps) {
      if (step.day < recurringFrom || step.day > today || isCleanSuccess(step) || !step.cause) continue;
      const key = `${exercise.chapterId}|${step.cause}`;
      byCause.set(key, (byCause.get(key) ?? new Set()).add(exercise.key));
    }
  }
  const recurring: RecurringDifficulty[] = [];
  for (const [key, exercises] of byCause) {
    if (exercises.size < RECURRING_MIN) continue;
    const [chapterId, cause] = key.split("|") as [string, AttemptCause];
    const chapter = chapterOf(chapterId);
    if (!chapter) continue;
    recurring.push({
      chapterId,
      chapter: chapter.title,
      subject: chapter.subject,
      cause,
      exercises: exercises.size,
      fact: `${exercises.size} exercices différents ratés en ${RECURRING_DAYS} jours pour la même cause : ${ATTEMPT_CAUSE_LABEL[cause].toLowerCase()}.`,
    });
  }
  recurring.sort((a, b) => b.exercises - a.exercises || a.chapterId.localeCompare(b.chapterId));

  // ── Progrès : comparaison avec la semaine d'avant, seulement si les deux ont assez de tentatives ──
  const steps = context.exercises.filter((exercise) => !isTransferKey(exercise.key)).flatMap((exercise) => exercise.steps);
  const week = steps.filter((step) => step.day >= from && step.day <= today);
  const before = steps.filter((step) => step.day >= previousFrom && step.day < from);
  const progress: string[] = [];
  const clean = (list: typeof steps) => list.filter(isCleanSuccess).length;
  if (week.length >= MIN_ATTEMPTS_TO_COMPARE && before.length >= MIN_ATTEMPTS_TO_COMPARE) {
    const rate = clean(week) / week.length;
    const previousRate = clean(before) / before.length;
    const verb = rate > previousRate + 0.1 ? "en hausse" : rate < previousRate - 0.1 ? "en baisse" : "stable";
    progress.push(`Réussites sans aide : ${pct(clean(week), week.length)} des ${week.length} tentatives, contre ${pct(clean(before), before.length)} des ${before.length} la semaine d'avant — ${verb}.`);
  } else {
    progress.push(
      `Pas de comparaison avec la semaine d'avant : ${week.length} tentative${week.length > 1 ? "s" : ""} notée${week.length > 1 ? "s" : ""} cette semaine, ${before.length} la précédente (il en faut au moins ${MIN_ATTEMPTS_TO_COMPARE} de chaque côté).`
    );
  }
  const faster = verified.filter((skill) => skill.minutes !== null);
  if (faster.length > 0) progress.push(`Temps sur les exercices corrigés : ${faster.map((skill) => `${skill.label} ${skill.minutes}`).join(" ; ")}.`);

  // ── Chapitres à travailler : le diagnostic, constats récents seulement ──
  const toWork: ChapterToWork[] = [];
  for (const diagnosis of context.ranked) {
    const finding = mainFinding(diagnosis);
    if (!finding || finding.stale) continue;
    toWork.push({
      chapterId: diagnosis.chapter.id,
      chapter: diagnosis.chapter.title,
      subject: diagnosis.chapter.subject,
      kind: finding.kind,
      label: FINDING_LABEL[finding.kind],
      level: finding.level,
      fact: finding.evidence[0] ?? "",
      hypothesis: finding.hypothesis,
      action: finding.action,
    });
    if (toWork.length >= FOCUS_MAX) break;
  }

  // ── Décisions pour la semaine suivante ──
  const decisions: WeeklyDecision[] = toWork.map((entry) => ({ chapterId: entry.chapterId, text: `${entry.chapter} en priorité — ${entry.action}` }));
  // Variété : des réussites toutes faciles dans un chapitre travaillé cette semaine ⇒ monter d'un niveau.
  const workedChapters = new Set(context.exercises.filter((exercise) => exercise.chapterId && exercise.steps.some((step) => inWeek(step.day))).map((exercise) => exercise.chapterId!));
  for (const chapterId of workedChapters) {
    const warning = varietyWarning(context.exercises, chapterId);
    const chapter = chapterOf(chapterId);
    if (!warning || !chapter) continue;
    const target = levelToRequest(context.exercises, chapterId);
    decisions.push({ chapterId: null, text: `${chapter.title} : ${warning} Prochain exercice : ${EXERCISE_LEVEL_LABEL[target.level]}.` });
  }
  const backlog = context.exercises.filter((exercise) => exercise.status === "à-refaire" && !isTransferKey(exercise.key)).length;
  if (backlog >= RETRY_BACKLOG) decisions.push({ chapterId: null, text: `${backlog} exercices attendent d'être refaits sans aide : les refaire avant d'en ouvrir de nouveaux.` });
  const transfersDue = transferChecks(context.exercises, attempts, retryDelaysDays, today).filter((check) => check.status === "à-faire").length;
  if (transfersDue > 0) decisions.push({ chapterId: null, text: `${transfersDue} exercice${transfersDue > 1 ? "s" : ""} de transfert à faire : vérifier les méthodes corrigées sur d'autres énoncés.` });

  return { from, to: today, verified, recurring, progress, toWork, decisions, attemptsThisWeek: week.length };
}

/** La décision adoptée : les chapitres proposés, en vigueur `BILAN_DAYS` jours à partir d'aujourd'hui. */
export function adoptFocus(learning: WeeklyLearning, today: string): WeeklyFocus | null {
  const chapterIds = learning.decisions.map((decision) => decision.chapterId).filter((id): id is string => id !== null);
  return chapterIds.length > 0 ? { decidedOn: today, until: addDays(today, BILAN_DAYS), chapterIds } : null;
}
