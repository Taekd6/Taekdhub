import { ASSISTED_HINTS_THRESHOLD } from "@/lib/recommendation";
import { completedExercises, dayKey } from "@/lib/study";
import { secondsToWholeMinutes } from "@/lib/utils";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

/**
 * XP — ce que TaekdHub choisit de récompenser.
 *
 * L'ancienne formule accordait `minutes × 5` à TOUTE séance, quel qu'en soit
 * le résultat. Elle récompensait donc le temps passé devant l'application,
 * pas le travail accompli : laisser le chrono tourner sans rien résoudre
 * rapportait strictement autant que résoudre — davantage, même, puisqu'il
 * suffisait de durer. Sur un outil de prépa, c'est exactement l'habitude à
 * ne pas encourager, et c'est ce qui rendait la mécanique décorative : elle
 * montait toute seule et ne disait donc rien.
 *
 * La composante temps est supprimée. L'XP ne récompense plus que ce qui
 * prouve un apprentissage — et pondère par la difficulté, pour que monter
 * de palier rapporte réellement plus que rester en terrain connu.
 *
 * ## Trois failles fermées (audit final)
 * Un système de points se juge à ce qu'on peut en tirer SANS travailler.
 * Trois chemins rapportaient gros pour rien :
 * 1. Marquer un exercice « maîtrisé » dans un menu déroulant valait
 *    `difficulty × 25` — une auto-déclaration, sans la moindre trace de
 *    travail. Passer les 402 fiches en « maîtrisé » rapportait ~27 000 XP,
 *    plus que des mois de travail réel. → il faut désormais une PREUVE.
 * 2. Ouvrir le focus deux secondes, l'échapper, cliquer « Réussi » créditait
 *    une réussite pleine. Répété, ~1 000 XP par minute. → une séance de moins
 *    d'une minute ne crédite plus rien, exactement le seuil qui décide déjà
 *    si la tentative compte (`attempts`/`last_worked_at`, focus-view.tsx).
 * 3. Réussir vingt fois le MÊME exercice facile payait vingt fois le prix
 *    fort. → la 2ᵉ réussite vaut la moitié, la 3ᵉ ne vaut plus rien : le
 *    moteur de recommandation dit déjà exactement cela en faisant redescendre
 *    un exercice réussi plusieurs fois (`successPenalty`, recommendation.ts).
 *
 * Aucune de ces règles n'invente une notion : chacune reprend un seuil qui
 * existait déjà ailleurs dans le produit.
 */

/** Une réussite autonome enregistrée — la seule preuve de maîtrise que le produit possède. Même définition que le moteur (voir `ASSISTED_HINTS_THRESHOLD`). */
function isProvenSuccess(session: WorkSession): boolean {
  return (
    session.result === "réussi" &&
    session.hints_used !== null &&
    session.hints_used < ASSISTED_HINTS_THRESHOLD &&
    secondsToWholeMinutes(session.duration_seconds) > 0
  );
}

/**
 * Un exercice porté jusqu'à "maîtrisé" — l'accomplissement le plus fort.
 *
 * `status` est un menu déroulant : à lui seul il ne prouve rien. L'XP n'est
 * donc accordée que si l'historique contient au moins une réussite autonome
 * sur cet exercice. Un élève qui coche « maîtrisé » sans jamais l'avoir
 * travaillé garde son étiquette (c'est son carnet, pas celui de l'app) mais
 * ne gagne rien.
 */
export function xpFromExercise(exercise: Exercise, proven: boolean): number {
  if (exercise.status !== "maîtrisé" || exercise.archived || !proven) return 0;
  return exercise.difficulty * 25;
}

/**
 * XP d'une tentative, à partir de son résultat réel.
 *
 * Une réussite obtenue avec plusieurs indices vaut MOINS qu'une réussite
 * autonome : c'est une vraie progression, mais pas la même preuve — et
 * c'est exactement la distinction qu'utilise déjà le moteur de
 * recommandation (voir `ASSISTED_HINTS_THRESHOLD`, lib/recommendation.ts).
 * Les deux systèmes récompensent donc la même chose, au lieu de se
 * contredire.
 *
 * Un échec ne rapporte rien mais ne retire rien : se tromper fait partie du
 * travail, le produit n'a pas à le sanctionner.
 *
 * Une séance sans résultat renseigné (séance libre du chronomètre, ou
 * antérieure au suivi des résultats) vaut 0 : on ne sait pas ce qui s'y est
 * passé, on ne crédite donc rien.
 *
 * Une séance de moins d'une minute vaut 0 elle aussi, quel que soit le
 * résultat coché : c'est déjà le seuil à partir duquel une tentative compte
 * (`attempts` et `last_worked_at`, components/exercises/focus-view.tsx). Sans
 * lui, ouvrir puis refermer aussitôt le focus en cochant « Réussi » était le
 * moyen le plus rapide de gagner des niveaux.
 */
export function xpFromSession(session: WorkSession, difficulty = 3): number {
  if (secondsToWholeMinutes(session.duration_seconds) <= 0) return 0;
  if (session.result === "réussi") {
    const assisted = session.hints_used !== null && session.hints_used >= 2;
    return difficulty * (assisted ? 5 : 10);
  }
  if (session.result === "partiel") return difficulty * 3;
  return 0;
}

/**
 * Part d'XP encore à gagner sur un exercice déjà réussi : plein tarif la
 * première fois, moitié la deuxième, plus rien ensuite. Même message que
 * `successPenalty` (lib/recommendation.ts), qui fait redescendre dans les
 * recommandations un exercice enchaînant les réussites : au bout de deux
 * réussites, cet exercice n'a plus rien à prouver.
 */
const REPEAT_SHARES = [1, 0.5];

export function totalXp(exercises: Exercise[], sessions: WorkSession[]): number {
  const difficultyById = new Map(exercises.map((exercise) => [exercise.id, exercise.difficulty]));

  // Une seule passe chronologique : chaque exercice sait combien de réussites
  // le précèdent, donc combien la suivante vaut encore.
  const ordered = [...sessions].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const successCount = new Map<string, number>();
  let sessionXp = 0;
  for (const session of ordered) {
    const base = xpFromSession(session, session.exercise_id ? difficultyById.get(session.exercise_id) : undefined);
    if (base === 0) continue;
    if (!session.exercise_id || session.result !== "réussi") {
      sessionXp += base;
      continue;
    }
    const already = successCount.get(session.exercise_id) ?? 0;
    sessionXp += base * (REPEAT_SHARES[already] ?? 0);
    successCount.set(session.exercise_id, already + 1);
  }

  const provenExercises = new Set(
    sessions.filter((session) => session.exercise_id && isProvenSuccess(session)).map((session) => session.exercise_id as string)
  );
  const exerciseXp = completedExercises(exercises).reduce((sum, e) => sum + xpFromExercise(e, provenExercises.has(e.id)), 0);

  return Math.round(exerciseXp + sessionXp);
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) ** 2 * 100;
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; percent: number } {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return { current, needed, percent: Math.min(100, Math.round((current / needed) * 100)) };
}

/**
 * Jours travaillés d'affilée.
 *
 * Deux règles, chacune corrigeant un défaut réel :
 *
 * - Un jour ne compte qu'à partir d'UNE MINUTE de travail cumulée — même
 *   seuil que l'XP et que `attempts` (voir `xpFromSession`). Sans lui, ouvrir
 *   le focus deux secondes suffisait à entretenir une série indéfiniment :
 *   une série qu'on peut tenir sans travailler ne récompense pas la
 *   régularité, elle récompense le fait d'ouvrir l'application.
 * - Si RIEN n'a encore été fait aujourd'hui, le décompte démarre à hier. La
 *   version précédente partait systématiquement d'aujourd'hui : un élève avec
 *   douze jours d'affilée derrière lui lisait « 0 » chaque matin jusqu'à sa
 *   première séance — le produit effaçait sa régularité pour la seule raison
 *   que la journée n'était pas finie.
 */
export function computeStreak(sessions: WorkSession[], now: Date = new Date()): number {
  const workByDay = workByDayMap(sessions);
  const counts = (date: Date) => secondsToWholeMinutes(workByDay[dayKey(date)] ?? 0) > 0;

  const cursor = new Date(now);
  if (!counts(cursor)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (counts(cursor)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function workByDayMap(sessions: WorkSession[]): Record<string, number> {
  return sessions.reduce<Record<string, number>>((result, session) => {
    const key = dayKey(session.started_at);
    return { ...result, [key]: (result[key] || 0) + session.duration_seconds };
  }, {});
}

export function lastNDays(n: number): Date[] {
  return Array.from({ length: n }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (n - 1 - index));
    return date;
  });
}
