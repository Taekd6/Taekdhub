import { doneMinutes } from "@/lib/work-items";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import type { WorkItem, WorkItemKind } from "@/lib/storage";

/**
 * ESTIMATION — ce que l'historique permet de DIRE sur les durées, et
 * strictement rien de plus.
 *
 * Deux services, tous deux facultatifs par construction :
 *
 *   SUGGÉRER    « d'après tes derniers DM de physique : environ 1 h 10 ».
 *   COMPARER    « tu sous-estimes tes travaux de physique de 18 % ».
 *
 * Les deux renvoient `null` quand les données ne suffisent pas, et c'est le
 * point central de ce module : une estimation inventée est pire que pas
 * d'estimation du tout. Un élève qui découvre que « d'après ton historique »
 * reposait sur une seule séance cesse définitivement de croire l'outil.
 *
 * La suggestion reste une SUGGESTION : elle pré-remplit un champ, l'élève la
 * corrige, et TaekdHub ne la réécrit jamais après coup.
 *
 * Fonctions pures.
 */

/** En dessous de ce nombre de travaux terminés comparables, on ne suggère rien. Deux points ne font pas une tendance, mais un seul ne fait rien du tout. */
export const ESTIMATION_MIN_SAMPLES = 2;

export interface EstimationSuggestion {
  /** Minutes suggérées — la MÉDIANE du temps réellement passé sur des travaux comparables. */
  minutes: number;
  /** Combien de travaux terminés ont servi au calcul — affiché tel quel. */
  samples: number;
  /** `true` quand la comparaison a pu se faire à matière ET nature égales, `false` quand seule la nature a pu servir. */
  sameSubject: boolean;
  /** Phrase prête à afficher, qui dit toujours sur quoi elle s'appuie. */
  sentence: string;
}

/** Travaux terminés dont on connaît à la fois l'estimation et le temps réellement passé. */
function measurable(items: WorkItem[], sessions: WorkSession[]): { item: WorkItem; done: number }[] {
  return items
    .filter((item) => item.status === "terminé")
    .map((item) => ({ item, done: doneMinutes(item, sessions) }))
    .filter((entry) => entry.done > 0);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Combien de temps ce genre de travail prend RÉELLEMENT à cet élève.
 *
 * Cherche d'abord à matière et nature égales (« tes DM de physique »), puis
 * se rabat sur la seule nature (« tes DM ») — et le dit, parce que les deux
 * phrases n'ont pas la même valeur. En dessous de `ESTIMATION_MIN_SAMPLES`
 * dans les deux cas : `null`, et l'interface n'affiche aucune suggestion.
 *
 * La MÉDIANE, jamais la moyenne : un DM de six heures fait une fois ne doit
 * pas devenir la norme de tous les suivants.
 */
export function suggestEstimate(
  kind: WorkItemKind,
  subject: Subject | null,
  items: WorkItem[],
  sessions: WorkSession[]
): EstimationSuggestion | null {
  const done = measurable(items, sessions);

  const sameKindAndSubject = done.filter((entry) => entry.item.kind === kind && subject !== null && entry.item.subject === subject);
  if (sameKindAndSubject.length >= ESTIMATION_MIN_SAMPLES) {
    const minutes = Math.round(median(sameKindAndSubject.map((entry) => entry.done)));
    return {
      minutes,
      samples: sameKindAndSubject.length,
      sameSubject: true,
      sentence: `D'après tes ${sameKindAndSubject.length} derniers travaux de ce type en ${subject} : environ ${formatShort(minutes)}.`,
    };
  }

  const sameKind = done.filter((entry) => entry.item.kind === kind);
  if (sameKind.length >= ESTIMATION_MIN_SAMPLES) {
    const minutes = Math.round(median(sameKind.map((entry) => entry.done)));
    return {
      minutes,
      samples: sameKind.length,
      sameSubject: false,
      sentence: `D'après tes ${sameKind.length} derniers travaux de ce type : environ ${formatShort(minutes)}.`,
    };
  }

  // Scénario 8 du cahier des charges : aucune donnée, aucune estimation
  // mensongère. On ne retombe SURTOUT pas sur une valeur générique qu'on
  // présenterait comme issue de l'historique.
  return null;
}

export interface EstimationBias {
  subject: Subject;
  /** Travaux terminés qui ont servi à la mesure. */
  samples: number;
  /** Écart signé, en pourcentage, arrondi : +18 = le travail a pris 18 % de plus que prévu. */
  deviationPercent: number;
  /** Phrase prête à afficher, toujours accompagnée du nombre d'observations. */
  sentence: string;
}

/** En dessous de cet écart, la différence entre estimé et réalisé n'est pas un biais, c'est du bruit. */
export const ESTIMATION_BIAS_THRESHOLD_PERCENT = 10;

/**
 * L'élève sous-estime-t-il, ou surestime-t-il, ses travaux dans une matière ?
 *
 * Mesuré sur les travaux TERMINÉS uniquement : comparer l'estimation d'un
 * travail en cours au temps déjà passé dessus ne compare rien du tout.
 *
 * `null` quand il n'y a pas assez de travaux terminés, ou quand l'écart est
 * sous le seuil de bruit — dans les deux cas, il n'y a rien d'honnête à
 * affirmer. C'est ce `null` qui interdit au bilan hebdomadaire d'écrire
 * « tu sous-estimes tes tâches de physique » sans l'avoir mesuré.
 */
export function computeEstimationBias(
  subject: Subject,
  items: WorkItem[],
  sessions: WorkSession[]
): EstimationBias | null {
  const relevant = measurable(items, sessions).filter((entry) => entry.item.subject === subject && entry.item.estimatedMinutes > 0);
  if (relevant.length < ESTIMATION_MIN_SAMPLES) return null;

  const ratios = relevant.map((entry) => entry.done / entry.item.estimatedMinutes);
  const deviation = Math.round((median(ratios) - 1) * 100);
  if (Math.abs(deviation) < ESTIMATION_BIAS_THRESHOLD_PERCENT) return null;

  return {
    subject,
    samples: relevant.length,
    deviationPercent: deviation,
    // « TYPIQUEMENT », pas « en moyenne » : le calcul ci-dessus est une
    // MÉDIANE de ratios, choisie précisément pour qu'un travail aberrant ne
    // déplace pas le verdict. Dire « en moyenne » nommait un calcul qui n'a
    // pas été fait — et la phrase est reprise telle quelle par le bilan
    // hebdomadaire.
    sentence:
      deviation > 0
        ? `Tu as sous-estimé tes travaux de ${subject} de ${deviation} % typiquement, sur ${relevant.length} travaux terminés.`
        : `Tu as surestimé tes travaux de ${subject} de ${Math.abs(deviation)} % typiquement, sur ${relevant.length} travaux terminés.`,
  };
}

function formatShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
