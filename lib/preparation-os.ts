import { computeNotionEvidence } from "@/lib/notions";
import { computeProgressBySubject, isExerciseEngaged } from "@/lib/progress";
import { recommendExercises, estimatedDurationMinutes } from "@/lib/recommendation";
import { subjects } from "@/lib/study";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";
import type { Chapter } from "@/lib/storage";

export interface PreparationSubjectState {
  subject: Subject;
  total: number;
  mastered: number;
  completionRate: number;
  pending: number;
  minutesToWork: number;
  lastWorkedAt: string | null;
}

export interface PreparationGap {
  subject: Subject;
  kind: "jamais commencé" | "délaissée" | "fragile" | "en difficulté";
  reason: string;
  urgency: number;
}

export interface PreparationSnapshot {
  subjects: PreparationSubjectState[];
  gaps: PreparationGap[];
  testedNotions: number;
  solidNotions: number;
  untestedNotions: number;
}

export interface PreparationPlanItem {
  subject: Subject;
  exerciseId: string;
  title: string;
  minutes: number;
  reason: string;
}

export interface PreparationPlan {
  requestedMinutes: number;
  allocatedMinutes: number;
  items: PreparationPlanItem[];
}

function daysSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86400000));
}

export function computePreparationSnapshot(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], now: Date = new Date()): PreparationSnapshot {
  const progress = computeProgressBySubject(exercises);
  const active = exercises.filter((e) => !e.archived);
  const states = subjects
    .map((subject) => {
      const p = progress.find((x) => x.subject === subject)!;
      const subjectExercises = active.filter((e) => e.subject === subject);
      const worked = subjectExercises.filter(isExerciseEngaged);
      const lastWorkedAt = worked
        .map((e) => e.last_worked_at)
        .filter((v): v is string => Boolean(v))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
      const recommendations = recommendExercises(subjectExercises, sessions, subjectExercises.length, { now });
      return {
        subject,
        total: p.total,
        mastered: p.mastered,
        completionRate: p.completionRate,
        pending: p.total - p.mastered,
        minutesToWork: recommendations.reduce((sum, r) => sum + estimatedDurationMinutes(r.exercise, sessions), 0),
        lastWorkedAt,
      };
    })
    .filter((s) => s.total > 0);

  const gaps = states.map((state) => {
    const days = daysSince(state.lastWorkedAt, now);
    if (state.lastWorkedAt === null && state.pending > 0) {
      return { subject: state.subject, kind: "jamais commencé" as const, reason: `${state.pending} exercices non maîtrisés et aucune séance enregistrée`, urgency: 3 };
    }
    if (days !== null && days >= 7 && state.pending > 0) {
      return { subject: state.subject, kind: "délaissée" as const, reason: `aucune activité depuis ${days} jours, ${state.pending} exercices restent à travailler`, urgency: 2 };
    }
    if (state.completionRate < 50 && state.pending > 0) {
      return { subject: state.subject, kind: "en difficulté" as const, reason: `${state.completionRate}% maîtrisé, ${state.pending} exercices restent à travailler`, urgency: 2 };
    }
    if (state.pending > 0 && state.completionRate < 80) {
      return { subject: state.subject, kind: "fragile" as const, reason: `${state.completionRate}% maîtrisé, ${state.pending} exercices restent à travailler`, urgency: 1 };
    }
    return null;
  }).filter((gap): gap is PreparationGap => gap !== null);

  const notionEvidence = computeNotionEvidence(active, sessions);
  return {
    subjects: states,
    gaps: gaps.sort((a, b) => b.urgency - a.urgency || a.subject.localeCompare(b.subject, "fr")),
    testedNotions: notionEvidence.filter((n) => n.state !== "jamais testée").length,
    solidNotions: notionEvidence.filter((n) => n.state === "solide").length,
    untestedNotions: notionEvidence.filter((n) => n.state === "jamais testée").length,
  };
}

export function computePreparationPlan(exercises: Exercise[], sessions: WorkSession[], chapters: Chapter[], totalMinutes: number, now: Date = new Date()): PreparationPlan {
  if (totalMinutes <= 0) return { requestedMinutes: totalMinutes, allocatedMinutes: 0, items: [] };
  const active = exercises.filter((e) => !e.archived);
  const snapshot = computePreparationSnapshot(active, sessions, chapters, now);
  const states = snapshot.subjects.filter((s) => s.pending > 0);
  if (states.length === 0) return { requestedMinutes: totalMinutes, allocatedMinutes: 0, items: [] };

  const candidates = new Map<Subject, ReturnType<typeof recommendExercises>>();
  for (const state of states) {
    const subjectExercises = active.filter((e) => e.subject === state.subject);
    candidates.set(state.subject, recommendExercises(subjectExercises, sessions, subjectExercises.length, { now }));
  }

  const urgencyBySubject = new Map(snapshot.gaps.map((gap) => [gap.subject, gap.urgency]));
  const ordered = [...states].sort((a, b) => (urgencyBySubject.get(b.subject) ?? 0) - (urgencyBySubject.get(a.subject) ?? 0) || a.completionRate - b.completionRate || a.subject.localeCompare(b.subject, "fr"));
  const taken = new Set<string>();
  const items: PreparationPlanItem[] = [];
  let remaining = totalMinutes;

  // A floor of one fitting exercise per subject is only attempted when the budget permits it.
  for (const state of ordered) {
    const candidate = candidates.get(state.subject)?.find((r) => !taken.has(r.exercise.id) && estimatedDurationMinutes(r.exercise, sessions) <= remaining);
    if (!candidate) continue;
    const minutes = estimatedDurationMinutes(candidate.exercise, sessions);
    items.push({ subject: state.subject, exerciseId: candidate.exercise.id, title: candidate.exercise.title, minutes, reason: candidate.reasons[0] ?? "À travailler" });
    taken.add(candidate.exercise.id);
    remaining -= minutes;
  }

  const all = recommendExercises(active, sessions, active.length, { now });
  for (const candidate of all) {
    if (taken.has(candidate.exercise.id)) continue;
    const minutes = estimatedDurationMinutes(candidate.exercise, sessions);
    if (minutes > remaining) continue;
    items.push({ subject: candidate.exercise.subject, exerciseId: candidate.exercise.id, title: candidate.exercise.title, minutes, reason: candidate.reasons[0] ?? "À travailler" });
    taken.add(candidate.exercise.id);
    remaining -= minutes;
    if (remaining <= 0) break;
  }

  return { requestedMinutes: totalMinutes, allocatedMinutes: totalMinutes - remaining, items };
}
