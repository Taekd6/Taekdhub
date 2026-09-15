import { declaredCapacityMinutes, plannableMinutes, workedMinutesOnDay } from "@/lib/capacity";
import { dayKey } from "@/lib/study";
import type { WorkSession } from "@/lib/supabase/types";
import type { Preferences } from "@/lib/storage";

/**
 * CHARGE D'UNE JOURNÉE — « est-ce que ça tient ? », répondu en un mot.
 *
 * Cinq états, et l'écart entre les deux derniers est tout l'intérêt du
 * module : « surchargé » veut dire que le planning mord sur la MARGE (donc
 * que la journée tiendra si rien ne dérape) ; « intenable » veut dire qu'il
 * dépasse la capacité réellement déclarée (donc que la journée ne tiendra
 * pas, quoi qu'il arrive). Les confondre revient à crier au loup à chaque
 * journée un peu dense, jusqu'à ce que l'élève cesse de regarder le signal.
 *
 * Le ratio est exprimé par rapport à la capacité PLANIFIABLE (marge déjà
 * déduite), pas à la capacité déclarée : c'est bien celle-là que le
 * planificateur a le droit de remplir.
 *
 * Fonctions pures.
 */

export type LoadStatus =
  /** Beaucoup de place libre. */
  | "léger"
  /** La journée est remplie sans tension. */
  | "normal"
  /** Elle est pleine, mais dans les clous. */
  | "chargé"
  /** Le planning entame la marge : ça passe si rien ne dérape. */
  | "surchargé"
  /** Il dépasse la capacité déclarée elle-même : ça ne passera pas. */
  | "intenable";

export const LOAD_STATUS_META: Record<LoadStatus, { label: string; tone: "neutral" | "accent" | "warning" | "danger" }> = {
  léger: { label: "Léger", tone: "neutral" },
  normal: { label: "Normal", tone: "neutral" },
  chargé: { label: "Chargé", tone: "accent" },
  surchargé: { label: "Surchargé", tone: "warning" },
  intenable: { label: "Intenable", tone: "danger" },
};

export interface DailyLoad {
  /** "AAAA-MM-JJ". */
  date: string;
  /** Minutes réservées par le planning ce jour-là. */
  plannedMinutes: number;
  /** Ce que le planificateur a le droit de remplir — capacité déclarée moins la marge. */
  capacityMinutes: number;
  /** Capacité déclarée, marge comprise : le plafond réel de la journée. */
  declaredMinutes: number;
  /** `plannedMinutes / capacityMinutes`, borné à 4 pour rester affichable. 0 si la capacité est nulle. */
  ratio: number;
  status: LoadStatus;
  /** Minutes au-delà de la capacité DÉCLARÉE — 0 partout sauf en « intenable ». C'est le chiffre à montrer : « dépassement de 45 min ». */
  overflowMinutes: number;
  /** Minutes déjà travaillées ce jour-là (0 pour un jour à venir) — sert à dire « 2 h 35 faites sur 3 h 30 prévues ». */
  workedMinutes: number;
}

/** Jusqu'à la moitié de la capacité planifiable : la journée est légère. */
const LIGHT_RATIO = 0.5;
/** Au-delà de 85 %, la journée est pleine — même seuil que la « marge presque nulle » de lib/deadlines.ts. */
const NORMAL_RATIO = 0.85;

/**
 * Charge d'un jour donné.
 *
 * `sessions` n'intervient que pour `workedMinutes` (ce qui a RÉELLEMENT été
 * fait) : le statut, lui, porte sur ce qui est PRÉVU. Les deux sont montrés
 * côte à côte plutôt que fondus en un seul chiffre — l'écart entre prévu et
 * réalisé est précisément ce qu'on vient vérifier le soir.
 */
export function computeDailyLoad(
  date: Date,
  plannedMinutes: number,
  preferences: Preferences,
  sessions: WorkSession[] = []
): DailyLoad {
  const capacity = plannableMinutes(preferences, date);
  const declared = declaredCapacityMinutes(preferences, date);
  const planned = Math.max(0, Math.round(plannedMinutes));
  const ratio = capacity > 0 ? Math.min(4, planned / capacity) : planned > 0 ? 4 : 0;

  let status: LoadStatus;
  if (planned > declared) status = "intenable";
  else if (planned > capacity) status = "surchargé";
  else if (capacity === 0) status = "léger";
  else if (ratio > NORMAL_RATIO) status = "chargé";
  else if (ratio > LIGHT_RATIO) status = "normal";
  else status = "léger";

  return {
    date: dayKey(date),
    plannedMinutes: planned,
    capacityMinutes: capacity,
    declaredMinutes: declared,
    ratio,
    status,
    overflowMinutes: Math.max(0, planned - declared),
    workedMinutes: workedMinutesOnDay(sessions, date),
  };
}

/**
 * UNE phrase pour une journée — jamais un verdict sans son chiffre.
 *
 * « Mercredi · chargé » ne dit pas de combien ; « dépassement de 45 min »
 * si. Chaque formulation ci-dessous cite un nombre réellement calculé dans
 * le `DailyLoad` qu'elle reçoit.
 */
export function describeLoad(load: DailyLoad): string {
  if (load.capacityMinutes === 0 && load.plannedMinutes === 0) return "Aucune capacité déclarée ce jour-là.";
  if (load.status === "intenable") return `Dépassement de ${formatShort(load.overflowMinutes)} sur ta capacité du jour.`;
  if (load.status === "surchargé") return `${formatShort(load.plannedMinutes)} prévues pour ${formatShort(load.capacityMinutes)} planifiables : la marge y passe.`;
  if (load.plannedMinutes === 0) return `Rien de prévu — ${formatShort(load.capacityMinutes)} disponibles.`;
  return `${formatShort(load.plannedMinutes)} prévues sur ${formatShort(load.capacityMinutes)} planifiables.`;
}

function formatShort(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
