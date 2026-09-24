"use client";

import { Meter } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { formatSpan } from "@/lib/utils";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";
import { describeLoad, LOAD_STATUS_META } from "@/lib/workload";
import type { PlannedDay } from "@/lib/planning";

/**
 * UNE JOURNÉE DU PLANNING — « voilà ma journée », pas une ligne de base de
 * données.
 *
 * La charge se lit en TROIS temps, du plus rapide au plus précis : le nom du
 * jour, puis « 2 h 35 / 3 h 30 », puis — seulement si la journée sort de
 * l'ordinaire — une étiquette et une phrase chiffrée. Une journée normale ne
 * porte donc aucun signal : c'est ce qui permet aux deux états qui comptent
 * (surchargé, intenable) de rester visibles.
 *
 * Pas de graphique ni de feu tricolore : un trait (prévu / capacité),
 * des chiffres alignés, et une étiquette là où il y a réellement
 * quelque chose à dire.
 */
export function DayPlan({ day, label, dense = false }: { day: PlannedDay; label: string; dense?: boolean }) {
  const { load } = day;
  const notable = load.status === "surchargé" || load.status === "intenable";
  const meta = LOAD_STATUS_META[load.status];

  return (
    <section className={cn(dense ? "py-2.5" : "py-3.5")}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="t-label min-w-0 truncate">{label}</h3>
        <p className="tabular t-meta shrink-0 whitespace-nowrap">
          {load.plannedMinutes > 0 ? (
            <>
              <span className="text-ink">{formatSpan(load.plannedMinutes * 60)}</span>
              <span> / {formatSpan(load.capacityMinutes * 60)}</span>
            </>
          ) : (
            <span>{formatSpan(load.capacityMinutes * 60)} libres</span>
          )}
        </p>
      </div>

      {/* LA CAPACITÉ, EN UN TRAIT — prévu face à ce que la journée peut
          porter. À l'accent tant que tout va bien : l'orange et le rouge ne
          s'allument que pour les deux états qui demandent une décision, les
          mêmes que l'étiquette plus bas. */}
      {load.capacityMinutes > 0 && (
        <Meter
          value={(load.plannedMinutes / load.capacityMinutes) * 100}
          tone={load.status === "intenable" ? "danger" : load.status === "surchargé" ? "warning" : "accent"}
          className="mt-2"
        />
      )}

      {day.slots.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {day.slots.map((slot) => (
            <li key={`${slot.date}-${slot.workItemId}`} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {slot.title}
                <span className="text-subtle"> · {WORK_ITEM_KIND_META[slot.kind].short}</span>
              </span>
              <span className="tabular shrink-0 whitespace-nowrap text-sm text-muted">{formatSpan(slot.minutes * 60)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-meta mt-1 text-2xs">Rien de prévu.</p>
      )}

      {/* L'étiquette n'apparaît QUE pour les deux états qui demandent une
          décision. « Normal » et « chargé » n'ont rien à signaler : les
          afficher transformerait la semaine en guirlande. */}
      {notable && (
        <p
          className={cn(
            "t-meta mt-1.5 text-2xs",
            meta.tone === "danger" ? "text-rose-300" : meta.tone === "warning" ? "text-amber-300" : undefined
          )}
        >
          {meta.label} — {describeLoad(load)}
        </p>
      )}
    </section>
  );
}
