"use client";

import { FilterPills } from "@/components/ui/pills";
import { SegmentedControl } from "@/components/ui/segmented";
import { historyPeriodOptions, type HistoryFilters as HistoryFiltersState } from "@/lib/history";
import type { Subject } from "@/lib/supabase/types";

const SHORT_PERIOD: Record<HistoryFiltersState["period"], string> = {
  week: "Cette semaine",
  month: "Ce mois-ci",
  all: "Tout",
};

/**
 * Purement présentationnel — toute la logique de filtrage vit dans lib/history.ts.
 *
 * REFONTE « APPLE » : deux menus déroulants (« Toutes », « Tout ») sont
 * devenus une PÉRIODE en sélecteur segmenté (trois options courtes, toujours
 * visibles) et des PASTILLES de matière. Un menu cache ses options derrière
 * un clic ; les pastilles montrent d'emblée ce qu'on peut filtrer, et combien
 * de séances chaque matière compte — c'est ce qui donne envie de cliquer.
 * Seules les matières qui ont au moins une séance sont proposées.
 */
export function HistoryFilters({
  filters,
  onChange,
  subjects,
}: {
  filters: HistoryFiltersState;
  onChange: (patch: Partial<HistoryFiltersState>) => void;
  /** Matières proposées, avec leur nombre de séances sur la période choisie. */
  subjects: { subject: Subject; count: number }[];
}) {
  return (
    <div className="space-y-3">
      <SegmentedControl
        ariaLabel="Filtrer par période"
        value={filters.period}
        onChange={(value) => onChange({ period: value })}
        // Libellés courts : « Semaine en cours » se coupait en « Semaine en
        // co… » dans un tiers de 390 px. Le libellé long reste celui de lib/history.ts.
        options={historyPeriodOptions.map((option) => ({ value: option.value, label: SHORT_PERIOD[option.value] }))}
      />
      {subjects.length > 1 && (
        <FilterPills
          ariaLabel="Filtrer par matière"
          value={filters.subject}
          onChange={(value) => onChange({ subject: value })}
          options={[
            { value: "Toutes" as const, label: "Toutes les matières" },
            ...subjects.map((entry) => ({ value: entry.subject, label: entry.subject, count: entry.count })),
          ]}
        />
      )}
    </div>
  );
}
