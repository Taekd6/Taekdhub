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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="t-label mr-1">Filtrer</span>
      <Select
        value={filters.subject}
        onChange={(event) => onChange({ subject: event.target.value as Subject | "Toutes" })}
        wrapperClassName="w-auto min-w-[170px]"
      >
        {["Toutes", ...subjects].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </Select>
      <Select
        value={filters.period}
        onChange={(event) => onChange({ period: event.target.value as HistoryFiltersState["period"] })}
        wrapperClassName="w-auto min-w-[170px]"
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
