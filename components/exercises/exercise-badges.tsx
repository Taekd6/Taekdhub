"use client";

import { ProgressBar } from "@/components/ui/progress";
import { Select } from "@/components/ui/input";
import { exerciseStatuses, statusMeta, subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { ExerciseStatus, Mastery, Subject } from "@/lib/supabase/types";

/**
 * Badges partagés entre les vues Cartes, Liste compacte et Focus (Sprint 2B)
 * — pour ne jamais dupliquer leur logique/style entre ces trois endroits.
 */

export function SubjectAvatar({ subject, size = "md" }: { subject: Subject; size?: "sm" | "md" }) {
  const meta = subjectMeta[subject];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold leading-none",
        size === "sm" ? "h-[1.375rem] w-[1.375rem] text-[0.6875rem]" : "h-7 w-7 text-[0.75rem]",
        meta.className
      )}
    >
      {meta.short}
    </span>
  );
}

/** Degré de maîtrise de l'élève — barre de progression courte, distincte de la difficulté (dots). */
export function MasteryBar({ value }: { value: Mastery }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Maîtrise ${value}%`}>
      <ProgressBar value={value} className="w-10" barClassName="bg-sky-400" />
      <span className="tabular text-2xs text-subtle">{value}%</span>
    </span>
  );
}

/**
 * Édition rapide de la maîtrise (Sprint 3A) — 5 paliers, changement
 * instantané au clic. À utiliser dans les vues où l'espace le permet (détail, focus) — la
 * version lecture seule pour les vues denses est `MasteryBar`.
 */
export function MasteryPicker({ value, onChange }: { value: Mastery; onChange: (value: Mastery) => void }) {
  const options: Mastery[] = [0, 25, 50, 75, 100];
  return (
    <div className="inline-flex gap-1" role="group" aria-label="Maîtrise">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "tabular min-h-7 rounded-md border px-2 text-2xs font-medium transition-[background-color,border-color,color,transform] active:scale-95 max-lg:min-h-10",
            value === option
              ? "border-sky-400/35 bg-sky-400/15 text-sky-200"
              : "border-transparent bg-inset text-subtle hover:text-ink"
          )}
        >
          {option}%
        </button>
      ))}
    </div>
  );
}

/** Sélecteur de statut coloré selon `statusMeta`, pour rester immédiatement lisible d'un coup d'œil — reste un contrôle interactif, pas un simple badge. */
export function StatusSelect({
  value,
  onChange,
  className,
}: {
  value: ExerciseStatus;
  onChange: (status: ExerciseStatus) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value as ExerciseStatus)}
      wrapperClassName="w-auto"
      className={cn("rounded-lg px-2.5 py-2 text-xs font-medium", statusMeta[value].className, className)}
    >
      {exerciseStatuses.map((status) => (
        <option key={status}>{status}</option>
      ))}
    </Select>
  );
}
