import { computeTrend, type Trend } from "@/lib/analytics/trend";
import { startOfWeek } from "@/lib/week";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * RÉSULTATS DES EXERCICES — « est-ce que ce que je fais réussit ? ».
 *
 * DÉFINITION EXPLICITE DU TAUX DE RÉUSSITE, parce qu'un taux dont on ignore
 * le dénominateur ne veut rien dire :
 *
 *     réussite = réussis / (réussis + partiels + échoués)
 *
 * Le dénominateur est le nombre de tentatives ÉVALUABLES, c'est-à-dire
 * celles où l'élève a déclaré un résultat. Sont donc exclues :
 *
 *   — les séances libres (chronomètre, aucun exercice) ;
 *   — les séances où l'étape « comment ça s'est passé ? » a été passée ;
 *   — toutes les séances antérieures à l'introduction de `result`.
 *
 * `result === null` signifie « on ne sait pas », jamais « échoué » : les
 * compter comme des échecs inventerait des centaines de mauvaises
 * tentatives dans l'historique existant. Voir la doc de `WorkSession.result`.
 *
 * Ce module NE COMPTE PAS d'exercices « abandonnés » : cet état n'existe pas
 * dans le modèle (`AttemptResult` = réussi | partiel | échoué). L'inventer en
 * assimilant une séance sans résultat à un abandon serait exactement le
 * genre de métrique fabriquée que ce chantier s'interdit.
 *
 * Fonctions pures.
 */

export interface OutcomeStats {
  /** Exercices DISTINCTS touchés sur la période — une même fiche reprise trois fois compte une fois. */
  exercisesWorked: number;
  /** Tentatives portant un résultat déclaré : le dénominateur du taux. */
  evaluated: number;
  succeeded: number;
  partial: number;
  failed: number;
  /** Séances sans résultat déclaré — affiché tel quel, jamais réparti dans les autres cases. */
  unevaluated: number;
  /** `null` quand aucune tentative n'est évaluable : il n'y a alors pas de taux, pas « 0 % ». */
  successRate: number | null;
  /** Tentatives réussies SANS révéler d'indice — la preuve d'autonomie la plus forte du modèle. `null` si l'information n'a jamais été enregistrée. */
  autonomousSuccesses: number | null;
}

/**
 * En dessous de ce nombre de tentatives évaluables, un taux de réussite
 * existe mais ne doit jamais être présenté comme un niveau : deux exercices
 * réussis sur deux ne font pas « 100 % de réussite ». L'interface DOIT alors
 * afficher la mise en garde de `describeSampleSize`.
 */
export const OUTCOME_SOLID_SAMPLE = 8;

export function computeExerciseOutcomeStats(sessions: WorkSession[], since: Date | null = null, until: Date = new Date()): OutcomeStats {
  const scoped = sessions.filter((session) => {
    const started = new Date(session.started_at);
    return (!since || started >= since) && started <= until;
  });

  const withExercise = scoped.filter((session) => session.exercise_id !== null);
  const evaluatedSessions = scoped.filter((session) => session.result !== null);
  const succeeded = evaluatedSessions.filter((session) => session.result === "réussi");
  const hintsKnown = succeeded.filter((session) => session.hints_used !== null);

  return {
    exercisesWorked: new Set(withExercise.map((session) => session.exercise_id)).size,
    evaluated: evaluatedSessions.length,
    succeeded: succeeded.length,
    partial: evaluatedSessions.filter((session) => session.result === "partiel").length,
    failed: evaluatedSessions.filter((session) => session.result === "échoué").length,
    unevaluated: withExercise.length - evaluatedSessions.length,
    successRate: evaluatedSessions.length > 0 ? Math.round((succeeded.length / evaluatedSessions.length) * 100) : null,
    // `null` (et non 0) quand aucune réussite ne porte l'information : on ne
    // sait pas si l'élève s'en est sorti seul, et l'affirmer serait faux.
    autonomousSuccesses: hintsKnown.length > 0 ? hintsKnown.filter((session) => session.hints_used === 0).length : null,
  };
}

/**
 * La phrase à afficher À CÔTÉ d'un taux de réussite reposant sur trop peu de
 * tentatives. `null` quand l'échantillon suffit — pas de mise en garde
 * décorative.
 */
export function describeSampleSize(stats: OutcomeStats): string | null {
  if (stats.evaluated === 0) return "Aucune tentative notée sur cette période.";
  if (stats.evaluated < OUTCOME_SOLID_SAMPLE) {
    return `Calculé sur ${stats.evaluated} tentative${stats.evaluated > 1 ? "s" : ""} — échantillon encore limité.`;
  }
  return null;
}

export interface SuccessRatePoint {
  /** Lundi de la semaine, "AAAA-MM-JJ". */
  key: string;
  start: Date;
  /** `null` pour une semaine sans aucune tentative évaluable — un trou, pas un zéro. */
  rate: number | null;
  evaluated: number;
}

/**
 * Évolution hebdomadaire du taux de réussite.
 *
 * Une semaine sans tentative notée vaut `null`, JAMAIS 0 % : « aucune
 * tentative » et « toutes ratées » sont deux situations opposées, et les
 * confondre ferait plonger la courbe à chaque semaine de vacances. La
 * tendance ne porte donc que sur les semaines réellement mesurées.
 */
export function computeSuccessRateTrend(
  sessions: WorkSession[],
  weeks: number,
  now: Date = new Date()
): { points: SuccessRatePoint[]; trend: Trend } {
  const points: SuccessRatePoint[] = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const reference = new Date(now);
    reference.setDate(reference.getDate() - offset * 7);
    const start = startOfWeek(reference);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const stats = computeExerciseOutcomeStats(sessions, start, end < now ? end : now);
    points.push({ key: start.toLocaleDateString("en-CA"), start, rate: stats.successRate, evaluated: stats.evaluated });
  }

  const measured = points.filter((point) => point.rate !== null).map((point) => point.rate as number);
  // Bruit absolu de 5 points de pourcentage : sur un taux, 5 % relatifs
  // n'ont pas de sens (5 % de 80 % valent 4 points, 5 % de 20 % en valent 1).
  return { points, trend: computeTrend(measured, { absoluteNoise: 5, zeroIsMeasurement: true }) };
}
