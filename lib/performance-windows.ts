/**
 * PLAGES DE PERFORMANCE — « à quelles heures je travaille le mieux, d'après
 * moi ».
 *
 * C'est une HYPOTHÈSE QUE L'ÉLÈVE RÈGLE LUI-MÊME, pas une mesure. TaekdHub ne
 * sait pas à quelle heure l'élève est réellement le plus performant : il n'a
 * ni lien entre une séance et ses résultats, ni assez de données pour le
 * déduire (voir l'audit de la planification adaptative). Ces plages servent
 * seulement à SUGGÉRER un ordre pour les tâches déjà retenues par le plan du
 * jour (lib/day-placement.ts) ; elles n'en changent ni la sélection ni les
 * durées.
 *
 * `null` (le défaut) signifie « pas de plages configurées » : le plan du
 * jour s'affiche exactement comme avant. Les valeurs de `STARTER_WINDOWS`
 * ne sont JAMAIS appliquées d'office : l'élève les adopte, les corrige, ou
 * les ignore (components/work/performance-windows-form.tsx).
 *
 * Fonctions pures — aucun localStorage, aucun React. Ce module n'importe rien
 * de lib/storage.ts (qui, lui, importe `normalizePerformanceWindows`).
 */

export type PerformanceLevel = "haute" | "moyenne" | "basse";
export const PERFORMANCE_LEVELS: readonly PerformanceLevel[] = ["haute", "moyenne", "basse"];

export type WindowId = "matin" | "apres-midi" | "soir";
export const WINDOW_IDS: readonly WindowId[] = ["matin", "apres-midi", "soir"];
export const WINDOW_LABEL: Record<WindowId, string> = { matin: "Matin", "apres-midi": "Après-midi", soir: "Soir" };

export interface PerformanceWindow {
  id: WindowId;
  /** "HH:MM", heure locale. */
  start: string;
  /** "HH:MM", heure locale, strictement après `start`. */
  end: string;
  level: PerformanceLevel;
}

/** En dessous, une plage ne peut accueillir aucune séance utile : elle est refusée plutôt que tolérée. */
export const MIN_WINDOW_MINUTES = 30;

/**
 * PROFIL DE DÉPART — une hypothèse courante, pas une vérité universelle. Les
 * trous (12 h-14 h, 18 h-19 h) sont volontaires : repas et trajets. L'élève
 * est invité à le corriger d'après son propre ressenti.
 */
export const STARTER_WINDOWS: readonly PerformanceWindow[] = [
  { id: "matin", start: "08:00", end: "12:00", level: "haute" },
  { id: "apres-midi", start: "14:00", end: "18:00", level: "moyenne" },
  { id: "soir", start: "19:00", end: "22:00", level: "basse" },
];

/** Copie modifiable du profil de départ. */
export function starterWindows(): PerformanceWindow[] {
  return STARTER_WINDOWS.map((window) => ({ ...window }));
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:MM" → minutes depuis minuit, ou `null` si la valeur n'est pas une heure valide. */
export function clockToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = CLOCK.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWindow(raw: unknown): PerformanceWindow | null {
  if (!isRecord(raw)) return null;
  const id = WINDOW_IDS.find((candidate) => candidate === raw.id);
  const level = PERFORMANCE_LEVELS.find((candidate) => candidate === raw.level);
  const start = clockToMinutes(raw.start);
  const end = clockToMinutes(raw.end);
  if (!id || !level || start === null || end === null || end - start < MIN_WINDOW_MINUTES) return null;
  return { id, start: raw.start as string, end: raw.end as string, level };
}

/**
 * Lecture BLINDÉE, sur le modèle des autres `normalize*` de lib/storage.ts.
 *
 * Absent ou illisible ⇒ `null` (pas de plages ⇒ comportement habituel) : une
 * sauvegarde ancienne, tronquée ou éditée à la main ne doit jamais activer un
 * profil que l'élève n'a pas choisi. Une plage valide est conservée, une
 * plage douteuse (identifiant inconnu ou répété, heure illisible, durée
 * trop courte) est écartée, et une plage qui chevauche une plage déjà
 * retenue aussi. Le résultat est trié par heure de début.
 */
export function normalizePerformanceWindows(raw: unknown): PerformanceWindow[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<WindowId>();
  const read: PerformanceWindow[] = [];
  for (const entry of raw) {
    const window = readWindow(entry);
    if (!window || seen.has(window.id)) continue;
    seen.add(window.id);
    read.push(window);
  }
  read.sort((a, b) => clockToMinutes(a.start)! - clockToMinutes(b.start)! || a.id.localeCompare(b.id));
  const kept: PerformanceWindow[] = [];
  for (const window of read) {
    const previous = kept[kept.length - 1];
    if (previous && clockToMinutes(window.start)! < clockToMinutes(previous.end)!) continue;
    kept.push(window);
  }
  return kept.length > 0 ? kept : null;
}

/**
 * Ce qui empêche d'enregistrer ces plages, en phrases pour l'élève. Liste
 * vide ⇒ enregistrable. La saisie est REFUSÉE avec son motif plutôt que
 * corrigée en silence (la normalisation, elle, écarte).
 */
export function performanceWindowIssues(windows: readonly PerformanceWindow[]): string[] {
  const issues: string[] = [];
  for (const window of windows) {
    const start = clockToMinutes(window.start);
    const end = clockToMinutes(window.end);
    if (start === null || end === null) issues.push(`${WINDOW_LABEL[window.id]} : heure illisible.`);
    else if (end - start < MIN_WINDOW_MINUTES) issues.push(`${WINDOW_LABEL[window.id]} : la plage doit durer au moins ${MIN_WINDOW_MINUTES} minutes.`);
  }
  if (issues.length > 0) return issues;
  const sorted = [...windows].sort((a, b) => clockToMinutes(a.start)! - clockToMinutes(b.start)!);
  for (let index = 1; index < sorted.length; index += 1) {
    if (clockToMinutes(sorted[index].start)! < clockToMinutes(sorted[index - 1].end)!) {
      issues.push(`${WINDOW_LABEL[sorted[index - 1].id]} et ${WINDOW_LABEL[sorted[index].id].toLowerCase()} se chevauchent.`);
    }
  }
  return issues;
}
