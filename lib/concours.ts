import type { Exercise, Filiere, Subject } from "@/lib/supabase/types";

/**
 * CATALOGUE DES BANQUES DE CONCOURS.
 *
 * Purement DÉRIVÉ de la banque d'exercices : aucune liste de concours n'est
 * écrite en dur ici. Un concours existe dans ce catalogue si, et seulement
 * si, au moins un exercice non archivé le déclare — donc rien à mettre à jour
 * quand une nouvelle banque est importée, et aucun risque d'annoncer un
 * concours dont on n'a aucun exercice.
 *
 * Les champs affichés (année, épreuve, filières, numéro) ne sont JAMAIS
 * complétés ni devinés : `null` reste `null`, et l'interface dit alors
 * « session inconnue ». C'est la même règle que `ProvenanceBadge`.
 */

/** Une session identifiée d'un concours : une année et une épreuve. L'une ou l'autre peut manquer si la source ne l'établit pas. */
export interface ConcoursSession {
  key: string;
  year: number | null;
  epreuve: string | null;
  total: number;
  mastered: number;
}

export interface ConcoursBank {
  competition: string;
  /** Exercices actifs rattachés à ce concours. */
  total: number;
  mastered: number;
  /** Au moins une tentative enregistrée. */
  attempted: number;
  /** Part d'exercices maîtrisés, 0-100. */
  completionRate: number;
  /** Maîtrise déclarée moyenne, 0-100. */
  averageMastery: number;
  years: number[];
  filieres: Filiere[];
  epreuves: string[];
  subjects: Subject[];
  /** Provenance `concours-verifie` : concours + année + épreuve + numéro tous établis. */
  verified: number;
  /** Provenance `concours-partiel` : le concours est établi, pas le reste. */
  partial: number;
  sessions: ConcoursSession[];
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Regroupe les exercices de concours par banque, puis par session
 * (année × épreuve). Trié par nombre d'exercices décroissant : la banque la
 * plus fournie est celle sur laquelle on peut réellement travailler.
 */
export function computeConcoursCatalogue(exercises: Exercise[]): ConcoursBank[] {
  const byCompetition = new Map<string, Exercise[]>();

  for (const exercise of exercises) {
    if (exercise.archived) continue;
    const competition = exercise.competition?.trim();
    if (!competition) continue;
    const bucket = byCompetition.get(competition);
    if (bucket) bucket.push(exercise);
    else byCompetition.set(competition, [exercise]);
  }

  const banks: ConcoursBank[] = [];

  for (const [competition, items] of byCompetition) {
    const sessions = new Map<string, ConcoursSession>();

    for (const item of items) {
      // Une session est identifiée par le COUPLE année/épreuve : deux
      // épreuves de la même année sont deux sessions distinctes, et une année
      // inconnue ne se confond pas avec une autre année inconnue d'une
      // épreuve différente.
      const key = `${item.year ?? "?"}::${item.epreuve ?? "?"}`;
      const existing = sessions.get(key);
      if (existing) {
        existing.total += 1;
        if (item.status === "maîtrisé") existing.mastered += 1;
      } else {
        sessions.set(key, {
          key,
          year: item.year,
          epreuve: item.epreuve,
          total: 1,
          mastered: item.status === "maîtrisé" ? 1 : 0,
        });
      }
    }

    const mastered = items.filter((item) => item.status === "maîtrisé").length;

    banks.push({
      competition,
      total: items.length,
      mastered,
      attempted: items.filter((item) => item.attempts > 0).length,
      completionRate: percent(mastered, items.length),
      averageMastery: Math.round(items.reduce((sum, item) => sum + item.mastery, 0) / items.length),
      years: [...new Set(items.map((item) => item.year).filter((year): year is number => year !== null))].sort((a, b) => b - a),
      filieres: [...new Set(items.flatMap((item) => item.filieres))].sort(),
      epreuves: [...new Set(items.map((item) => item.epreuve).filter((value): value is string => Boolean(value)))].sort(),
      subjects: [...new Set(items.map((item) => item.subject))].sort(),
      verified: items.filter((item) => item.provenance === "concours-verifie").length,
      partial: items.filter((item) => item.provenance === "concours-partiel").length,
      sessions: [...sessions.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.total - b.total),
    });
  }

  return banks.sort((a, b) => b.total - a.total || a.competition.localeCompare(b.competition, "fr"));
}

/** Totaux tous concours confondus — l'en-tête de l'écran, jamais recalculé ailleurs. */
export function summarizeConcours(banks: ConcoursBank[]) {
  const total = banks.reduce((sum, bank) => sum + bank.total, 0);
  const mastered = banks.reduce((sum, bank) => sum + bank.mastered, 0);
  return {
    banks: banks.length,
    total,
    mastered,
    verified: banks.reduce((sum, bank) => sum + bank.verified, 0),
    completionRate: percent(mastered, total),
  };
}
