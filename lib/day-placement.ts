import { classifyCognitiveLoad, COGNITIVE_LABEL, COGNITIVE_LEVELS, type CognitiveContext, type CognitiveLevel, type CognitiveLoad } from "@/lib/cognitive-load";
import { AGENDA_TIERS, DAY_END_HOUR, type DayAgenda, type KeptTask } from "@/lib/day-agenda";
import { clockToMinutes, WINDOW_LABEL, type PerformanceLevel, type PerformanceWindow } from "@/lib/performance-windows";
import { formatMinutesSpan } from "@/lib/utils";

/**
 * PLACEMENT DANS LA JOURNÉE — dans quelle plage suggérer chaque tâche du plan.
 *
 * Ce module NE DÉCIDE PAS de ce qui est fait aujourd'hui : `buildDayAgenda`
 * (lib/day-agenda.ts) a déjà tranché — tâches gardées, réduites, déplacées,
 * budget. Ici, on prend ses tâches GARDÉES, telles quelles, et on suggère
 * UNE PLAGE et UN ORDRE : les tâches exigeantes dans les plages que l'élève
 * a déclarées hautes, les tâches légères dans les plages basses
 * (lib/cognitive-load.ts, lib/performance-windows.ts).
 *
 * GARANTIES, toutes testées (lib/day-placement.test.ts) :
 *
 *   — aucune tâche n'est retirée, ajoutée, raccourcie ni déplacée à demain :
 *     `ordered` contient exactement les tâches de `agenda.kept` ;
 *   — sans plages (`null` ou liste vide), `ordered` reprend l'ordre de
 *     `agenda.kept` et rien n'est annoté : c'est le comportement d'avant ;
 *   — une tâche qui n'a pas trouvé sa plage idéale est SIGNALÉE
 *     (`warnings`), jamais cachée — y compris et surtout une tâche
 *     indispensable, qui reste dans la journée même sans plage ;
 *   — déterministe : l'heure est un paramètre (`ctx.now`), l'ordre final ne
 *     dépend pas de l'ordre d'entrée (clé de tri totale), donc rejouer le
 *     placement donne le même résultat.
 *
 * RÈGLES DE PLACEMENT :
 *
 *   1. Seul le RESTE de la journée compte : les plages sont rognées à
 *      l'heure actuelle et à `DAY_END_HOUR`.
 *   2. On place d'abord les tâches les plus exigeantes (puis palier, puis
 *      poids de Next Move, puis clé), pour qu'elles aient les meilleures
 *      plages avant que des tâches plus légères ne les occupent.
 *   3. Chaque niveau préfère certaines plages, dans cet ordre :
 *        elevee   haute, moyenne, basse
 *        moyenne  moyenne, haute, basse
 *        legere   basse, moyenne, haute
 *      À préférence égale, la plage la plus proche dans la journée.
 *   4. Une tâche tient ENTIÈRE dans une plage (elle n'est pas découpée) : la
 *      plage doit avoir assez de minutes restantes pour sa durée.
 *   5. Sans plage où elle tienne, la tâche reste dans la journée, « hors
 *      plage », à la suite des autres, dans l'ordre du plan d'origine.
 *
 * CE QUE LE PLACEMENT NE PRÉTEND PAS : mesurer la performance de l'élève. Il
 * applique une hypothèse que l'élève règle lui-même. Une plage est
 * « suggérée », jamais imposée ; la prochaine action reste celle de Next Move.
 *
 * Fonctions pures — aucun localStorage, aucun React.
 */

export type PlacementFit =
  /** La plage préférée par le niveau de la tâche. */
  | "ideale"
  /** Une plage qui accueille la tâche, sans être la préférée. */
  | "acceptable"
  /** Aucune plage restante où la tâche tienne entière. */
  | "hors-plage";

export interface TaskPlacement {
  /** `null` : hors plage. */
  window: PerformanceWindow | null;
  fit: PlacementFit;
  /** Une phrase : où, et pourquoi. */
  note: string;
}

export interface PlacedTask {
  /** La tâche du plan, INCHANGÉE (même objet que dans `agenda.kept`). */
  task: KeptTask;
  load: CognitiveLoad;
  /** `null` quand le placement est désactivé (aucune plage configurée). */
  placement: TaskPlacement | null;
}

export interface PlacementWarning {
  key: string;
  title: string;
  /** La tâche est indispensable : elle reste dans la journée quoi qu'il arrive. */
  essential: boolean;
  message: string;
}

export interface DayPlacement {
  /** `false` : aucune plage configurée, `ordered` suit l'ordre du plan. */
  enabled: boolean;
  ordered: PlacedTask[];
  warnings: PlacementWarning[];
  summary: string;
}

const PREFERENCE: Record<CognitiveLevel, readonly PerformanceLevel[]> = {
  elevee: ["haute", "moyenne", "basse"],
  moyenne: ["moyenne", "haute", "basse"],
  legere: ["basse", "moyenne", "haute"],
};

/** La plage qui convient exactement au niveau de la tâche. */
const IDEAL: Record<CognitiveLevel, PerformanceLevel> = { elevee: "haute", moyenne: "moyenne", legere: "basse" };

const STEP = 5;

interface Slot {
  window: PerformanceWindow;
  start: number;
  /** Minutes restantes dans la plage, rognée à l'heure actuelle. */
  left: number;
}

interface Entry {
  task: KeptTask;
  load: CognitiveLoad;
  placement: TaskPlacement | null;
  slotIndex: number;
}

/** Ordre TOTAL : plus exigeante d'abord, puis palier, puis poids, puis clé. Aucune égalité possible entre deux tâches distinctes. */
function byDemand(a: Entry, b: Entry): number {
  return (
    COGNITIVE_LEVELS.indexOf(b.load.level) - COGNITIVE_LEVELS.indexOf(a.load.level) ||
    byPlanOrder(a, b)
  );
}

/** L'ordre du plan d'origine (palier, poids décroissant, clé) — celui de `agendaTasks`. */
function byPlanOrder(a: Entry, b: Entry): number {
  return AGENDA_TIERS.indexOf(a.task.tier) - AGENDA_TIERS.indexOf(b.task.tier) || b.task.score - a.task.score || a.task.key.localeCompare(b.task.key);
}

function describeWindow(window: PerformanceWindow): string {
  return `${WINDOW_LABEL[window.id]} (${window.start}-${window.end}, plage ${window.level})`;
}

export function placeDay(agenda: DayAgenda, windows: readonly PerformanceWindow[] | null | undefined, ctx: CognitiveContext): DayPlacement {
  const entries: Entry[] = agenda.kept.map((task) => ({ task, load: classifyCognitiveLoad(task, ctx), placement: null, slotIndex: -1 }));

  if (!windows || windows.length === 0) {
    return { enabled: false, ordered: entries.map(({ task, load }) => ({ task, load, placement: null })), warnings: [], summary: "" };
  }

  // 1. Le reste de la journée, plage par plage, dans l'ordre chronologique.
  const nowMinutes = Math.ceil((ctx.now.getHours() * 60 + ctx.now.getMinutes()) / STEP) * STEP;
  const dayEnd = DAY_END_HOUR * 60;
  const slots: Slot[] = [...windows]
    .map((window) => ({ window, start: clockToMinutes(window.start) ?? -1, end: clockToMinutes(window.end) ?? -1 }))
    .filter((entry) => entry.start >= 0 && entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.window.id.localeCompare(b.window.id))
    .map((entry) => {
      const start = Math.max(entry.start, nowMinutes);
      return { window: entry.window, start, left: Math.max(0, Math.min(entry.end, dayEnd) - start) };
    })
    .filter((slot) => slot.left > 0);

  // 2-4. Les plus exigeantes d'abord ; chacune prend la meilleure plage où elle tient entière.
  const warnings: PlacementWarning[] = [];
  for (const entry of [...entries].sort(byDemand)) {
    const { task, load } = entry;
    const minutes = task.minutes;
    let chosen = -1;
    for (const level of PREFERENCE[load.level]) {
      chosen = slots.findIndex((slot) => slot.window.level === level && slot.left >= minutes);
      if (chosen >= 0) break;
    }

    if (chosen < 0) {
      entry.placement = {
        window: null,
        fit: "hors-plage",
        note: slots.length === 0 ? "Plus de plage restante aujourd'hui" : `Aucune plage restante n'a ${formatMinutesSpan(minutes)} de libre`,
      };
      warnings.push({
        key: task.key,
        title: task.title,
        essential: task.tier === "indispensable",
        message:
          (task.tier === "indispensable"
            ? "Indispensable, elle reste dans ta journée, mais "
            : "Elle reste dans ton plan, mais ") +
          (slots.length === 0 ? "il n'y a plus de plage restante aujourd'hui : fais-la quand tu peux." : `aucune plage restante n'a ${formatMinutesSpan(minutes)} de libre d'un seul tenant : fais-la quand tu peux, ou ajuste tes plages.`),
      });
      continue;
    }

    const slot = slots[chosen];
    slot.left -= minutes;
    entry.slotIndex = chosen;
    const ideal = slot.window.level === IDEAL[load.level];
    entry.placement = {
      window: slot.window,
      fit: ideal ? "ideale" : "acceptable",
      note: `${COGNITIVE_LABEL[load.level][0].toUpperCase()}${COGNITIVE_LABEL[load.level].slice(1)} : suggérée ${describeWindow(slot.window)}`,
    };
    // Seule une tâche EXIGEANTE hors plage haute mérite un signalement : une tâche plus légère dans une plage plus haute ne perd rien.
    if (load.level === "elevee" && slot.window.level !== "haute") {
      const hasHigh = windows.some((window) => window.level === "haute");
      warnings.push({
        key: task.key,
        title: task.title,
        essential: task.tier === "indispensable",
        message: !hasHigh
          ? `Exigeante, mais aucune plage haute n'est définie : suggérée ${describeWindow(slot.window)}.`
          : `Exigeante, mais aucune plage haute restante n'a ${formatMinutesSpan(minutes)} de libre aujourd'hui : suggérée ${describeWindow(slot.window)}.`,
      });
    }
  }

  // Sortie : plage par plage dans l'ordre de la journée (les plus exigeantes d'abord dans une plage), puis le hors plage dans l'ordre du plan.
  const placed = entries.filter((entry) => entry.slotIndex >= 0).sort((a, b) => a.slotIndex - b.slotIndex || byDemand(a, b));
  const unplaced = entries.filter((entry) => entry.slotIndex < 0).sort(byPlanOrder);
  const ordered = [...placed, ...unplaced].map(({ task, load, placement }) => ({ task, load, placement }));

  const summary =
    entries.length === 0
      ? "Rien à placer."
      : warnings.length === 0
        ? "Chaque tâche a trouvé une plage adaptée."
        : `${warnings.length} tâche${warnings.length > 1 ? "s" : ""} sans plage idéale : voir le détail.`;
  return { enabled: true, ordered, warnings: warnings.sort((a, b) => Number(b.essential) - Number(a.essential) || a.key.localeCompare(b.key)), summary };
}
