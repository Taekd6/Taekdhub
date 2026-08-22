/**
 * Au-delà de cet horizon, une échéance (DS/khôlle) est trop lointaine pour
 * changer quoi que ce soit d'actionnable aujourd'hui — utilisée à la fois par
 * `lib/deadlines.ts#chapterDeadlineSignals` (qui exclut une échéance trop
 * lointaine du signal) et `lib/recommendation.ts#chapterDeadlineBonus` (qui a
 * besoin de la MÊME valeur pour son calcul d'urgence progressive), donc isolée
 * ici — comme `lib/focus-timer-key.ts` — pour qu'importer cette seule
 * constante n'entraîne jamais tout `lib/deadlines.ts` (et sa dépendance à
 * `lib/storage.ts`) dans le bundle d'un consommateur qui n'a besoin que
 * d'elle (voir la régression de taille détectée et corrigée au sprint
 * "reprendre sa séance" pour le même problème avec `FOCUS_TIMER_PREFIX`).
 */
export const DEADLINE_RELEVANCE_HORIZON_DAYS = 14;
