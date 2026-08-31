"use client";

import { motion } from "framer-motion";
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
        "grid shrink-0 place-items-center rounded-md font-bold",
        size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-xs",
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
      <ProgressBar value={value} animated={false} className="h-1.5 w-10 bg-hairline/[0.08]" barClassName="bg-sky-400/80" />
      <span className="text-2xs tabular-nums text-muted">{value}%</span>
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
    <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Maîtrise">
      {options.map((option) => (
        <motion.button
          key={option}
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            // 24 px de haut au doigt (mesuré) pour cinq cibles collées :
            // c'est le réglage de maîtrise, on le touche une fois l'exercice
            // fini — `max-lg:` ne change rien à la densité du bureau. La
            // HAUTEUR seulement : cinq largeurs de 44 px ne tiennent pas dans
            // les 246 px de la fiche à 320 px (essayé, la rangée débordait).
            "rounded-md px-2 py-1 text-2xs font-semibold tabular-nums transition max-lg:min-h-11",
            value === option ? "bg-sky-400/20 text-sky-200" : "bg-hairline/[0.04] text-muted hover:bg-hairline/[0.08] hover:text-ink"
          )}
        >
          {option}%
        </motion.button>
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
      className={cn("w-auto rounded-lg px-2.5 py-2 text-xs font-medium", statusMeta[value].className, className)}
    >
      {exerciseStatuses.map((status) => (
        <option key={status}>{status}</option>
      ))}
    </Select>
  );
}
