"use client";

import { Flag } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Select } from "@/components/ui/input";
import { exerciseStatuses, statusMeta, subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { ExerciseStatus, Mastery, Priority, Subject } from "@/lib/supabase/types";

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

/** Priorité donnée par l'élève — visuellement distincte de la difficulté (couleur différente) pour ne jamais laisser croire qu'il s'agit du même concept. */
export function PriorityBadge({ value }: { value: Priority }) {
  return (
    <span title={`Priorité ${value}/5`}>
      <Badge className="gap-1 bg-rose-400/10 text-rose-200">
        <Flag size={10} /> P{value}
      </Badge>
    </span>
  );
}

/** Degré de maîtrise de l'élève — barre de progression courte, distincte de la difficulté (dots) et de la priorité (badge texte). */
export function MasteryBar({ value }: { value: Mastery }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Maîtrise ${value}%`}>
      <ProgressBar value={value} animated={false} className="h-1.5 w-10 bg-hairline/[0.08]" barClassName="bg-sky-400/80" />
      <span className="text-2xs tabular-nums text-zinc-500">{value}%</span>
    </span>
  );
}

/**
 * Édition rapide de la priorité (Sprint 3A) — 5 boutons, changement
 * instantané au clic (pas de validation ni de champ à confirmer). À utiliser
 * dans les vues où l'espace le permet (détail, focus) ; dans les vues denses
 * (carte, liste), préférer `PriorityBadge` en lecture seule.
 */
export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (value: Priority) => void }) {
  const options: Priority[] = [1, 2, 3, 4, 5];
  return (
    <div className="inline-flex gap-1" role="group" aria-label="Priorité">
      {options.map((option) => (
        <motion.button
          key={option}
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "h-7 w-7 rounded-md text-xs font-semibold transition",
            value === option ? "bg-rose-400/20 text-rose-200" : "bg-hairline/[0.04] text-zinc-500 hover:bg-hairline/[0.08] hover:text-zinc-300"
          )}
        >
          {option}
        </motion.button>
      ))}
    </div>
  );
}

/**
 * Édition rapide de la maîtrise (Sprint 3A) — 5 paliers, changement
 * instantané au clic. Mêmes conditions d'usage que `PriorityPicker` — la
 * version lecture seule pour les vues denses est `MasteryBar`.
 */
export function MasteryPicker({ value, onChange }: { value: Mastery; onChange: (value: Mastery) => void }) {
  const options: Mastery[] = [0, 25, 50, 75, 100];
  return (
    <div className="inline-flex gap-1" role="group" aria-label="Maîtrise">
      {options.map((option) => (
        <motion.button
          key={option}
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "rounded-md px-2 py-1 text-2xs font-semibold tabular-nums transition",
            value === option ? "bg-sky-400/20 text-sky-200" : "bg-hairline/[0.04] text-zinc-500 hover:bg-hairline/[0.08] hover:text-zinc-300"
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
