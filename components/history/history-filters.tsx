"use client";

import { Select } from "@/components/ui/input";
import { historyPeriodOptions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/** Purement présentationnel — toute la logique de filtrage vit dans lib/history.ts. */
export function HistoryFilters({
  filters,
  onChange,
}: {
  filters: HistoryFiltersState;
  onChange: (patch: Partial<HistoryFiltersState>) => void;
}) {
  /*
   * DEUX MENUS DE MÊME LARGEUR, CÔTE À CÔTE.
   *
   * Ils étaient dimensionnés sur leur contenu (`w-auto min-w-[170px]`) : sur
   * un téléphone, le premier passait à la ligne et le second s'affichait plus
   * étroit, en escalier. Deux contrôles de même rang doivent avoir la même
   * chasse — `flex-1` sur une base commune le garantit à toutes les largeurs.
   *
   * Et chacun se nomme : « Filtrer » en tête de rangée ne qualifiait que le
   * premier menu, le second annonçait « Tout » sans dire tout QUOI. Les deux
   * portent désormais un `aria-label` explicite — jusqu'ici, un lecteur
   * d'écran ne lisait que « Toutes » et « Tout », deux boutons sans objet.
   */
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="t-label shrink-0">Filtrer</span>
      <Select
        aria-label="Filtrer par matière"
        value={filters.subject}
        onChange={(event) => onChange({ subject: event.target.value as Subject | "Toutes" })}
        wrapperClassName="min-w-[8.5rem] flex-1 sm:w-auto sm:flex-none sm:min-w-[10.5rem]"
      >
        {["Toutes", ...subjects].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par période"
        value={filters.period}
        onChange={(event) => onChange({ period: event.target.value as HistoryFiltersState["period"] })}
        wrapperClassName="min-w-[8.5rem] flex-1 sm:w-auto sm:flex-none sm:min-w-[10.5rem]"
      >
        {historyPeriodOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
