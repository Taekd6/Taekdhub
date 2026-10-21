import { latestDueInfo, snapshotAgeHours, ANKI_DUE_STALE_HOURS, type AnkiSnapshot } from "@/lib/anki-snapshot";
import type { ExerciseAttempt } from "@/lib/attempts";
import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * ÉTAT DE MES DONNÉES — ce que TaekdHub a reçu, et depuis quand.
 *
 * Le moteur ne peut évaluer que ce qu'on lui donne : sans séance récente, sans
 * résultat d'exercice, sans relevé Anki frais, ses conseils reposent sur du
 * vide. Cet écran le dit en trois lignes, avec UN geste pour y remédier. Ce
 * sont des FAITS (une date, un nombre) et des seuils écrits ici ; aucun score.
 *
 * Fonctions pures.
 */

/** Sans séance depuis plus de ce nombre de jours, la ligne passe à « ancien ». */
export const SESSIONS_STALE_DAYS = 2;
/** Sans tentative d'exercice depuis plus de ce nombre de jours, idem. */
export const ATTEMPTS_STALE_DAYS = 7;

export type HealthStatus = "ok" | "ancien" | "vide";

export interface HealthLine {
  id: "seances" | "exercices" | "anki";
  label: string;
  status: HealthStatus;
  /** Le fait, en une phrase. */
  detail: string;
  /** Le geste qui y remédie, ou `null` quand tout va bien. */
  hint: string | null;
}

/** Jours calendaires entre `from` (AAAA-MM-JJ) et `to` : 0 = même jour. */
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000);
}

export function ageLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function hoursLabel(hours: number): string {
  if (hours < 1) return "il y a moins d'une heure";
  if (hours < 48) return `il y a ${Math.round(hours)} h`;
  return ageLabel(Math.floor(hours / 24));
}

export function computeDataHealth(input: { sessions: WorkSession[]; attempts: ExerciseAttempt[]; ankiSnapshots: AnkiSnapshot[]; now: Date }): HealthLine[] {
  const { sessions, attempts, ankiSnapshots, now } = input;
  const today = dayKey(now);

  const lastSessionDay = sessions.reduce<string | null>((best, session) => {
    const day = dayKey(session.started_at);
    return !best || day > best ? day : best;
  }, null);
  const sessionAge = lastSessionDay ? daysBetween(lastSessionDay, today) : null;
  const sessionLine: HealthLine =
    sessionAge === null
      ? { id: "seances", label: "Séances", status: "vide", detail: "Aucune séance enregistrée.", hint: "Lance le chrono, ou note du temps avec la saisie rapide ou le raccourci de la montre." }
      : {
          id: "seances",
          label: "Séances",
          status: sessionAge > SESSIONS_STALE_DAYS ? "ancien" : "ok",
          detail: `Dernière séance : ${ageLabel(sessionAge)}.`,
          hint: sessionAge > SESSIONS_STALE_DAYS ? "Le plan se base sur des séances anciennes : note ce que tu as fait depuis (saisie rapide ou montre)." : null,
        };

  const lastAttemptDay = attempts.reduce<string | null>((best, attempt) => (!best || attempt.day > best ? attempt.day : best), null);
  const attemptAge = lastAttemptDay ? daysBetween(lastAttemptDay, today) : null;
  const attemptLine: HealthLine =
    attemptAge === null
      ? { id: "exercices", label: "Exercices", status: "vide", detail: "Aucun résultat d'exercice enregistré.", hint: "Sans résultats, le diagnostic ne voit rien : note réussi, partiel ou échec après un exercice (bilan de séance ou montre)." }
      : {
          id: "exercices",
          label: "Exercices",
          status: attemptAge > ATTEMPTS_STALE_DAYS ? "ancien" : "ok",
          detail: `Dernier résultat : ${ageLabel(attemptAge)}.`,
          hint: attemptAge > ATTEMPTS_STALE_DAYS ? "Aucun résultat cette semaine : le diagnostic s'appuie sur des résultats anciens." : null,
        };

  const due = latestDueInfo(ankiSnapshots);
  const ankiHours = due ? snapshotAgeHours(due.takenAt, now) : null;
  const ankiLine: HealthLine =
    ankiHours === null
      ? { id: "anki", label: "Anki", status: "vide", detail: "Aucun relevé Anki.", hint: "Sur ordinateur, ouvre Anki puis lance le relevé depuis la page Anki." }
      : {
          id: "anki",
          label: "Anki",
          status: ankiHours > ANKI_DUE_STALE_HOURS ? "ancien" : "ok",
          detail: `Dernier relevé : ${hoursLabel(ankiHours)}.`,
          hint: ankiHours > ANKI_DUE_STALE_HOURS ? `Au-delà de ${ANKI_DUE_STALE_HOURS} h, le moteur ne s'appuie plus sur les cartes dues : refais un relevé sur ordinateur.` : null,
        };

  return [sessionLine, attemptLine, ankiLine];
}
