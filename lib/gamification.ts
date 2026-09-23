import { currentStreak } from "@/lib/analytics/consistency";
import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";

/*
 * L'XP a disparu de ce module. Elle ne récompensait que des preuves tirées
 * de l'ancienne banque d'exercices (réussite autonome sur une fiche, fiche
 * « maîtrisée ») : la banque retirée, il ne restait plus rien à compter — et
 * aucun écran ne l'affichait plus. Restent la série et le temps par jour,
 * qui ne dépendent que des séances.
 */

/**
 * Jours travaillés d'affilée.
 *
 * Deux règles, chacune corrigeant un défaut réel :
 *
 * - Un jour ne compte qu'à partir d'UNE MINUTE de travail cumulée. Sans ce
 *   seuil, lancer le chrono deux secondes suffisait à entretenir une série
 *   indéfiniment :
 *   une série qu'on peut tenir sans travailler ne récompense pas la
 *   régularité, elle récompense le fait d'ouvrir l'application.
 * - Si RIEN n'a encore été fait aujourd'hui, le décompte démarre à hier. La
 *   version précédente partait systématiquement d'aujourd'hui : un élève avec
 *   douze jours d'affilée derrière lui lisait « 0 » chaque matin jusqu'à sa
 *   première séance — le produit effaçait sa régularité pour la seule raison
 *   que la journée n'était pas finie.
 */
export function computeStreak(sessions: WorkSession[], now: Date = new Date()): number {
  /*
   * UNE SEULE IMPLÉMENTATION, désormais.
   *
   * Ce calcul existait ici ET dans lib/analytics/consistency.ts#currentStreak,
   * avec deux seuils différents — et l'écran Progression affichait les DEUX,
   * à quelques centaines de pixels d'écart, avec deux nombres. Les règles
   * documentées au-dessus (seuil d'une minute cumulée, décompte démarrant à
   * hier tant que la journée n'a rien enregistré) sont inchangées : elles
   * vivent maintenant dans `activeDayKeys` + `currentStreak`, qui les
   * appliquent à l'identique pour la série comme pour la heatmap.
   */
  return currentStreak(sessions, now);
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
