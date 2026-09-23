import { weekdayIndex } from "@/lib/capacity";
import { weeklyTimeBySubject } from "@/lib/week";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * BUDGET HEBDOMADAIRE PAR MATIÈRE — « est-ce que ma semaine ressemble au
 * plan que je me suis fixé ? ».
 *
 * L'objectif hebdomadaire global (lib/week.ts#computeWeeklySummary) répond à
 * « combien », jamais à « où ». Cinq heures de maths et zéro minute
 * d'anglais le remplissent aussi bien que l'inverse ; or l'élève s'est fixé
 * une RÉPARTITION (voir `Preferences.weeklySubjectTargets`, lib/storage.ts),
 * et c'est elle qu'il faut pouvoir vérifier en un coup d'œil le jeudi soir.
 *
 * CE MODULE NE COMPTE PAS LE TEMPS LUI-MÊME. Le temps de la semaine vient de
 * `weeklyTimeBySubject` (lib/week.ts), qui porte la seule définition de
 * « cette semaine » de l'application (lundi 00:00 → maintenant, séances
 * futures exclues). Recompter ici, c'était risquer que l'accueil affiche
 * « 2 h 10 » en anglais et Progression « 2 h 40 » pour la même semaine.
 *
 * Fonctions pures : aucune dépendance à localStorage, React ou au DOM.
 */

/**
 * RYTHME — où en est la matière par rapport à là où elle « devrait » être à
 * ce moment de la semaine.
 *
 *   atteint         le budget de la semaine est rempli.
 *   en avance       nettement au-dessus du rythme attendu.
 *   dans le rythme  à peu près là où il faut — l'écart tient dans la marge.
 *   en retard       nettement en dessous, ET assez tard dans la semaine pour
 *                   que ce soit un fait plutôt qu'un bruit.
 *   trop tôt        en dessous, mais on est lundi ou mardi : rien à conclure.
 */
export type SubjectPace = "atteint" | "en avance" | "dans le rythme" | "en retard" | "trop tôt";

/**
 * Libellé et ton de chaque rythme. « En retard » est en AMBRE, jamais en
 * rouge : c'est un constat sur un plan qu'on s'est fixé soi-même, qu'un
 * week-end suffit à rattraper — pas une alerte. Le rouge reste réservé à ce
 * qui ne tient plus (une échéance intenable, voir lib/workload.ts).
 */
export const SUBJECT_PACE_META: Record<SubjectPace, { label: string; className: string }> = {
  atteint: { label: "atteint", className: "text-emerald-300" },
  "en avance": { label: "en avance", className: "text-emerald-300" },
  "dans le rythme": { label: "dans le rythme", className: "text-muted" },
  "en retard": { label: "en retard", className: "text-amber-300" },
  "trop tôt": { label: "trop tôt pour dire", className: "text-subtle" },
};

/**
 * Nombre de jours ENTIERS écoulés depuis lundi en dessous duquel on ne dit
 * jamais « en retard » — même seuil que lib/week.ts#neglectedSubjects, pour
 * que l'accueil ne se contredise pas d'un bloc à l'autre : avant mercredi, un
 * temps faible est normal pour toutes les matières et ne prouve rien.
 */
export const PACE_MIN_DAYS_ELAPSED = 2;

/**
 * Marge autour du rythme attendu : 10 % du budget, et jamais moins de
 * 20 minutes. Sans plancher, un budget de 75 min basculait de « dans le
 * rythme » à « en retard » pour sept minutes d'écart — soit une séance
 * d'Anki. Sans proportion, 20 min sur un budget de 8 h ne voudraient rien
 * dire.
 */
const PACE_TOLERANCE_RATIO = 0.1;
const PACE_TOLERANCE_MIN_MINUTES = 20;

export interface SubjectTargetProgress {
  subject: Subject;
  /** Budget de la semaine, en minutes (toujours > 0 : les matières à 0 sont exclues). */
  targetMinutes: number;
  /** Temps réellement enregistré cette semaine, en secondes — la valeur brute de lib/week.ts, à formater par `formatSpan`. */
  doneSeconds: number;
  /** Même temps en minutes, arrondi comme `formatSpan` l'affiche (et non tronqué : « 59 min » à l'écran ne doit pas valoir 58 ici). */
  doneMinutes: number;
  /** 0–100, plafonné — même convention que `WeeklySummary.progressPercent`, et 100 seulement quand `pace` vaut « atteint ». */
  percent: number;
  /** Minutes restant à faire pour remplir le budget, jamais négatif. */
  remainingMinutes: number;
  /** Minutes qu'on « devrait » avoir faites à cet instant de la semaine (voir `expectedWeekFraction`). */
  expectedMinutes: number;
  pace: SubjectPace;
}

/**
 * Part de la semaine « due » à cet instant, entre 0 et 1.
 *
 * DEUX CHOIX, tous deux dans le sens de l'indulgence :
 *
 *  1. SEULS LES JOURS TERMINÉS COMPTENT. Le jour en cours n'est pas encore
 *     dû : à 8 h du matin, on n'a pas « pris du retard » sur la journée qui
 *     commence. Lundi, la part due vaut donc 0.
 *
 *  2. LES JOURS NE PÈSENT PAS TOUS PAREIL. Le plan de l'élève met les
 *     exercices de maths, de physique et l'informatique le WEEK-END : une
 *     semaine découpée en septièmes égaux le déclarait « en retard » chaque
 *     samedi matin, alors qu'il était exactement dans son plan. Chaque jour
 *     pèse donc sa capacité déclarée (`Preferences.capacityByWeekday`) :
 *     avec 2 h en semaine et 4 h + 3 h le week-end, le samedi matin n'est
 *     dû que 10 h sur 17, soit 59 % du budget, et non 71 %.
 *
 * Sans poids exploitable (absent, ou tous nuls), retombe sur des septièmes
 * égaux plutôt que sur 0 : « rien n'est jamais dû » serait un mensonge
 * confortable.
 */
export function expectedWeekFraction(now: Date, weights?: readonly number[]): number {
  const daysDone = weekdayIndex(now);
  const usable = Array.isArray(weights) && weights.length === 7 && weights.every((value) => Number.isFinite(value) && value >= 0);
  const total = usable ? weights.reduce((sum, value) => sum + value, 0) : 0;
  if (!usable || total <= 0) return daysDone / 7;
  const due = weights.slice(0, daysDone).reduce((sum, value) => sum + value, 0);
  return due / total;
}

function paceFor(doneMinutes: number, targetMinutes: number, expectedMinutes: number, daysElapsed: number): SubjectPace {
  if (doneMinutes >= targetMinutes) return "atteint";
  const tolerance = Math.max(PACE_TOLERANCE_MIN_MINUTES, targetMinutes * PACE_TOLERANCE_RATIO);
  if (doneMinutes > expectedMinutes + tolerance) return "en avance";
  if (doneMinutes >= expectedMinutes - tolerance) return "dans le rythme";
  return daysElapsed < PACE_MIN_DAYS_ELAPSED ? "trop tôt" : "en retard";
}

/**
 * Suivi de la semaine en cours, matière par matière, dans l'ordre de
 * lib/study.ts#subjects.
 *
 * Une matière dont le budget vaut 0 (ou est absent de `targets`) est EXCLUE,
 * pas affichée à « 0 / 0 » : l'élève a dit qu'il ne la suivait pas, et une
 * ligne vide ne ferait que diluer les autres. Le temps passé dessus reste
 * compté partout ailleurs (total de la semaine, Progression).
 *
 * `weights` : capacité déclarée par jour, du lundi au dimanche (voir
 * `expectedWeekFraction`). Facultatif.
 */
export function computeSubjectTargets(
  sessions: WorkSession[],
  targets: Partial<Record<Subject, number>>,
  now: Date = new Date(),
  weights?: readonly number[]
): SubjectTargetProgress[] {
  const fraction = expectedWeekFraction(now, weights);
  const daysElapsed = weekdayIndex(now);

  return weeklyTimeBySubject(sessions, now)
    .map(({ subject, seconds }) => ({ subject, seconds, target: targets[subject] ?? 0 }))
    .filter((entry) => Number.isFinite(entry.target) && entry.target > 0)
    .map(({ subject, seconds, target }) => {
      const doneMinutes = Math.round(seconds / 60);
      const expectedMinutes = Math.round(target * fraction);
      return {
        subject,
        targetMinutes: target,
        doneSeconds: seconds,
        doneMinutes,
        // 100 n'est affiché qu'une fois le budget RÉELLEMENT rempli : 238 min
        // sur 240 s'arrondissaient à « 100 % » à côté d'une barre pleine qui
        // n'était pas « atteint ».
        percent: doneMinutes >= target ? 100 : Math.min(99, Math.round((seconds / (target * 60)) * 100)),
        remainingMinutes: Math.max(0, target - doneMinutes),
        expectedMinutes,
        pace: paceFor(doneMinutes, target, expectedMinutes, daysElapsed),
      };
    });
}
