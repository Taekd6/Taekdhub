import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * SIMULATEUR D'ÉPREUVE — un sujet de concours en conditions réelles.
 *
 * L'élève compose sur papier ; TaekdHub tient l'horloge et le barème :
 *
 *   — le CHRONO de l'épreuve (4 h par défaut), qui survit à un rechargement
 *     de page ou à un téléphone qui décharge l'onglet ;
 *   — les QUESTIONS, chacune avec ses points au barème, et le temps passé
 *     dessus (la question « en cours » accumule le temps jusqu'à ce qu'on
 *     en change) ;
 *   — à la correction, un statut par question : faite (tous les points),
 *     partielle (la moitié), fausse ou pas abordée (rien).
 *
 * La note est la note BRUTE ramenée sur 20 — pas une note de concours
 * harmonisée, qui dépend de tous les candidats et que rien ici ne connaît.
 *
 * Fonctions pures : le moment présent est toujours passé en argument.
 */

export type QuestionStatus = "pas abordée" | "faite" | "partielle" | "fausse";
export const QUESTION_STATUSES: readonly QuestionStatus[] = ["faite", "partielle", "fausse", "pas abordée"];
const STATUS_SHARE: Record<QuestionStatus, number> = { faite: 1, partielle: 0.5, fausse: 0, "pas abordée": 0 };

export const DEFAULT_DURATION_MINUTES = 240;
export const DURATION_PRESETS = [60, 120, 180, 240] as const;

export interface SimQuestion {
  id: string;
  /** « I.1 », « Q7 », « Partie B ». */
  label: string;
  points: number;
  status: QuestionStatus;
  /** Temps cumulé, en secondes, hors période en cours. */
  seconds: number;
}

export interface ExamSim {
  id: string;
  subject: Subject;
  title: string;
  durationMinutes: number;
  startedAt: string;
  /** `null` tant que l'épreuve court. */
  endedAt: string | null;
  questions: SimQuestion[];
  /** La question sur laquelle l'élève travaille, et depuis quand. */
  active: { id: string; since: string } | null;
}

export const EXAM_SIM_KEY = "prepahub:epreuve-en-cours";

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${counter}`;
}

/** Les questions de départ : « Q1 » à « Qn », un point chacune — modifiables pendant l'épreuve. */
export function createExamSim(input: { subject: Subject; title: string; durationMinutes: number; questionCount: number }, now: Date): ExamSim {
  const count = Math.max(0, Math.min(60, Math.round(input.questionCount)));
  return {
    id: newId("epreuve"),
    subject: input.subject,
    title: input.title.trim() || "Épreuve blanche",
    durationMinutes: Math.max(10, Math.min(360, Math.round(input.durationMinutes))),
    startedAt: now.toISOString(),
    endedAt: null,
    questions: Array.from({ length: count }, (_, index) => ({ id: newId("q"), label: `Q${index + 1}`, points: 1, status: "pas abordée" as const, seconds: 0 })),
    active: null,
  };
}

/** Temps passé sur une question, période en cours comprise. */
export function questionSeconds(sim: ExamSim, question: SimQuestion, now: Date): number {
  if (sim.active?.id !== question.id) return question.seconds;
  return question.seconds + Math.max(0, Math.round((now.getTime() - new Date(sim.active.since).getTime()) / 1000));
}

/** Clôt la période de la question active (son temps est versé) sans en ouvrir d'autre. */
function closeActive(sim: ExamSim, now: Date): ExamSim {
  if (!sim.active) return sim;
  const active = sim.active;
  return {
    ...sim,
    active: null,
    questions: sim.questions.map((question) => (question.id === active.id ? { ...question, seconds: questionSeconds(sim, question, now) } : question)),
  };
}

/** Passe sur une question (ou sur aucune, `null`) : le temps de la précédente est versé. Re-toucher la question active la met en pause. */
export function focusQuestion(sim: ExamSim, id: string | null, now: Date): ExamSim {
  const closed = closeActive(sim, now);
  if (id === null || sim.active?.id === id || !sim.questions.some((question) => question.id === id)) return closed;
  return { ...closed, active: { id, since: now.toISOString() } };
}

export function addQuestion(sim: ExamSim): ExamSim {
  return { ...sim, questions: [...sim.questions, { id: newId("q"), label: `Q${sim.questions.length + 1}`, points: 1, status: "pas abordée", seconds: 0 }] };
}

export function updateQuestion(sim: ExamSim, id: string, patch: Partial<Pick<SimQuestion, "label" | "points" | "status">>): ExamSim {
  return {
    ...sim,
    questions: sim.questions.map((question) => {
      if (question.id !== id) return question;
      const points = patch.points === undefined ? question.points : Number.isFinite(patch.points) ? Math.max(0, Math.min(100, patch.points)) : question.points;
      return { ...question, ...patch, points };
    }),
  };
}

export function removeQuestion(sim: ExamSim, id: string, now: Date): ExamSim {
  const closed = sim.active?.id === id ? closeActive(sim, now) : sim;
  return { ...closed, questions: closed.questions.filter((question) => question.id !== id) };
}

/** Fin de l'épreuve (le chrono s'arrête) — la correction se fait ensuite. */
export function endExam(sim: ExamSim, now: Date): ExamSim {
  return { ...closeActive(sim, now), endedAt: sim.endedAt ?? now.toISOString() };
}

export function elapsedSeconds(sim: ExamSim, now: Date): number {
  const end = sim.endedAt ? new Date(sim.endedAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(sim.startedAt).getTime()) / 1000));
}

export function remainingSeconds(sim: ExamSim, now: Date): number {
  return sim.durationMinutes * 60 - elapsedSeconds(sim, now);
}

export interface ExamScore {
  earned: number;
  total: number;
  /** Note brute ramenée sur 20, au dixième — `null` sans barème. */
  outOf20: number | null;
  counts: Record<QuestionStatus, number>;
}

export function scoreExam(sim: ExamSim): ExamScore {
  const counts: Record<QuestionStatus, number> = { faite: 0, partielle: 0, fausse: 0, "pas abordée": 0 };
  let earned = 0;
  let total = 0;
  for (const question of sim.questions) {
    counts[question.status] += 1;
    total += question.points;
    earned += question.points * STATUS_SHARE[question.status];
  }
  return { earned, total, outOf20: total > 0 ? Math.round((earned / total) * 200) / 10 : null, counts };
}

/**
 * Les questions qui ont MANGÉ le temps : au-delà de 1,5 fois le temps que
 * leur barème justifiait (durée de l'épreuve × part des points). C'est le
 * constat le plus utile après une épreuve : où l'on s'est enlisé.
 */
export function timeSinks(sim: ExamSim, now: Date): { question: SimQuestion; seconds: number; fairSeconds: number }[] {
  const { total } = scoreExam(sim);
  if (total <= 0) return [];
  return sim.questions
    .map((question) => ({ question, seconds: questionSeconds(sim, question, now), fairSeconds: Math.round((question.points / total) * sim.durationMinutes * 60) }))
    .filter((entry) => entry.fairSeconds > 0 && entry.seconds > entry.fairSeconds * 1.5 && entry.seconds >= 300)
    .sort((a, b) => b.seconds / b.fairSeconds - a.seconds / a.fairSeconds);
}

/** Lecture blindée de l'épreuve en cours stockée sur l'appareil. */
export function parseExamSim(raw: string | null): ExamSim | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ExamSim>;
    if (!value || typeof value.id !== "string" || typeof value.startedAt !== "string" || Number.isNaN(new Date(value.startedAt).getTime())) return null;
    if (!subjects.includes(value.subject as Subject) || !Array.isArray(value.questions)) return null;
    const questions = value.questions
      .filter((question): question is SimQuestion => typeof question?.id === "string")
      .map((question) => ({
        id: question.id,
        label: typeof question.label === "string" ? question.label : "Q",
        points: typeof question.points === "number" && Number.isFinite(question.points) ? Math.max(0, question.points) : 1,
        status: QUESTION_STATUSES.includes(question.status) ? question.status : "pas abordée",
        seconds: typeof question.seconds === "number" && Number.isFinite(question.seconds) ? Math.max(0, question.seconds) : 0,
      }));
    const active = value.active && typeof value.active.id === "string" && typeof value.active.since === "string" && questions.some((question) => question.id === value.active!.id) ? value.active : null;
    return {
      id: value.id,
      subject: value.subject as Subject,
      title: typeof value.title === "string" ? value.title : "Épreuve blanche",
      durationMinutes: typeof value.durationMinutes === "number" && value.durationMinutes > 0 ? value.durationMinutes : DEFAULT_DURATION_MINUTES,
      startedAt: value.startedAt,
      endedAt: typeof value.endedAt === "string" ? value.endedAt : null,
      questions,
      active,
    };
  } catch {
    return null;
  }
}
