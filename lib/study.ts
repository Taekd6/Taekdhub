import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, ExerciseStatus, ExerciseType, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

export const subjects: Subject[] = ["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé", "Français", "Anglais"];
export const exerciseStatuses: ExerciseStatus[] = ["à faire", "en cours", "à revoir", "maîtrisé"];
export const exerciseTypes: ExerciseType[] = ["TD", "DM", "DS", "Colle", "TP", "Annale", "Concours", "Personnel"];
/** Paliers de maîtrise, dans l'ordre d'affichage — source unique pour toute UI qui énumère les paliers (voir lib/progress.ts). */
export const masteryLevels: Mastery[] = [0, 25, 50, 75, 100];

/**
 * Identité de matière — une lettre, une teinte.
 *
 * La teinte n'est plus choisie ici : elle vient des variables `--subj-<clé>`
 * (lib/subject-colors.ts), réglables par l'élève (palette + surcharge par
 * matière). Les classes ci-dessous ne font que les RÉFÉRENCER — c'est pour ça
 * qu'elles restent écrites en entier, et non construites : Tailwind ne
 * génère que les classes qu'il lit littéralement (lib/ est dans `content`).
 *
 *   `className`  pastille : fond teinté à 18 % + lettre à l'encre de la
 *                matière (assombrie en thème clair pour tenir 4,5:1) ;
 *   `solid`      aplat plein — barre, segment, point de légende ;
 *   `ink`        texte seul, à la couleur de la matière ;
 *   `fill`       couleur CSS brute, pour un `style` ou un trait SVG.
 */
export const subjectMeta: Record<Subject, { short: string; className: string; solid: string; ink: string; fill: string }> = {
  Mathématiques: { short: "M", className: "bg-subj-math/[0.18] text-subj-math-ink", solid: "bg-subj-math", ink: "text-subj-math-ink", fill: "rgb(var(--subj-math))" },
  Physique: { short: "P", className: "bg-subj-phys/[0.18] text-subj-phys-ink", solid: "bg-subj-phys", ink: "text-subj-phys-ink", fill: "rgb(var(--subj-phys))" },
  Chimie: { short: "C", className: "bg-subj-chim/[0.18] text-subj-chim-ink", solid: "bg-subj-chim", ink: "text-subj-chim-ink", fill: "rgb(var(--subj-chim))" },
  "Informatique TC": { short: "IT", className: "bg-subj-itc/[0.18] text-subj-itc-ink", solid: "bg-subj-itc", ink: "text-subj-itc-ink", fill: "rgb(var(--subj-itc))" },
  "Informatique Spé": { short: "IS", className: "bg-subj-isp/[0.18] text-subj-isp-ink", solid: "bg-subj-isp", ink: "text-subj-isp-ink", fill: "rgb(var(--subj-isp))" },
  Français: { short: "F", className: "bg-subj-fr/[0.18] text-subj-fr-ink", solid: "bg-subj-fr", ink: "text-subj-fr-ink", fill: "rgb(var(--subj-fr))" },
  Anglais: { short: "A", className: "bg-subj-en/[0.18] text-subj-en-ink", solid: "bg-subj-en", ink: "text-subj-en-ink", fill: "rgb(var(--subj-en))" },
};

/** Couleurs par statut, pour que le sélecteur de statut reste immédiatement lisible d'un coup d'œil (Sprint 2B). Purement visuel — n'affecte pas le modèle de données. */
export const statusMeta: Record<ExerciseStatus, { className: string }> = {
  // `bg-white/[0.045]` était du BLANC en dur : invisible sur le fond papier du
  // thème clair, alors que les trois autres statuts s'y voyaient. `bg-inset`
  // suit le thème, comme tous les autres fonds en creux de l'application.
  "à faire": { className: "bg-inset text-muted" },
  "en cours": { className: "bg-sky-400/[0.18] text-sky-200" },
  "à revoir": { className: "bg-amber-400/[0.18] text-amber-200" },
  maîtrisé: { className: "bg-emerald-400/[0.18] text-emerald-200" },
};

export function dayKey(value: string | Date) { return new Date(value).toLocaleDateString("en-CA"); }
/** Un exercice est considéré acquis une fois "maîtrisé" — "à revoir" reste actif (fondation pour un futur suivi de type révision). */
export function completedExercises(exercises: Exercise[]) { return exercises.filter((exercise) => exercise.status === "maîtrisé" && !exercise.archived); }
export function totalSeconds(sessions: WorkSession[]) { return sessions.reduce((total, session) => total + session.duration_seconds, 0); }

/** Temps déjà investi aujourd'hui (toutes matières confondues), en secondes — source unique, réutilisée par le Dashboard et par la séance bornée par le temps (lib/recommendation.ts côté appelant). */
export function todaySeconds(sessions: WorkSession[], now: Date = new Date()): number {
  const today = dayKey(now);
  return totalSeconds(
    sessions.filter((session) => {
      // Aujourd'hui, ET déjà passé. Une séance datée à 23 h et lue à midi
      // (horloge décalée, sauvegarde importée) faisait afficher « 90 min
      // travaillées » et un anneau « Objectif du jour » à 100 % avant même
      // d'avoir commencé.
      if (dayKey(session.started_at) !== today) return false;
      return new Date(session.started_at) <= now;
    })
  );
}

/**
 * Temps réellement passé par exercice, en MINUTES — dérivé des `WorkSession`
 * liées par `exercise_id` (Sprint 2.6, seule source de vérité). Calculé en
 * un seul passage sur `sessions` (pas un par exercice) : point de perf
 * important dès que la banque grossit, réutilisé pour l'affichage ET le tri
 * "temps passé" (voir lib/exercise-sort.ts).
 */
export function minutesByExerciseMap(sessions: WorkSession[]): Map<string, number> {
  const secondsById = new Map<string, number>();
  for (const session of sessions) {
    if (!session.exercise_id) continue;
    secondsById.set(session.exercise_id, (secondsById.get(session.exercise_id) ?? 0) + session.duration_seconds);
  }
  const minutesById = new Map<string, number>();
  for (const [id, seconds] of secondsById) minutesById.set(id, secondsToWholeMinutes(seconds));
  return minutesById;
}

/** Confort pour un usage ponctuel (hors liste) — voir `minutesByExerciseMap` pour le cas "plusieurs exercices à la fois", nettement plus efficace. */
export function minutesSpentOnExercise(exerciseId: string, sessions: WorkSession[]): number {
  return minutesByExerciseMap(sessions).get(exerciseId) ?? 0;
}
