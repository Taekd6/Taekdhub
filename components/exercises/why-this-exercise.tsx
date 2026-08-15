"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { classifyReason, REASON_TONE_META } from "@/lib/reason-tone";

/**
 * « Pourquoi cet exercice ? » (Micro-sprint « Ah ouais ») — petite affordance
 * discrète (même idiome que "Afficher l'indice"/"Afficher la réponse" dans
 * components/exercises/focus-view.tsx : un simple accordéon inline, jamais un
 * overlay) qui détaille les raisons DÉJÀ produites par
 * `lib/recommendation.ts#recommendExercises` (`ExerciseRecommendation.reasons`).
 *
 * Aucun nouveau score, aucun recalcul : `reasons` est reçu tel quel par ce
 * composant, qui se contente de coloriser chaque raison via
 * `lib/reason-tone.ts#classifyReason` (interprétation visuelle pure, jamais
 * une nouvelle décision). Une raison non fournie ou vide n'affiche rien —
 * jamais de signal inventé pour combler l'absence de donnée fiable.
 */
export function WhyThisExercise({ reasons, className }: { reasons: string[] | undefined; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!reasons || reasons.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring inline-flex items-center gap-1 rounded-lg text-2xs font-medium text-zinc-500 transition hover:text-zinc-300"
      >
        <HelpCircle size={12} /> Pourquoi cet exercice ?
        <ChevronDown size={11} className={cn("transition", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-center gap-2 text-2xs text-zinc-400">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", REASON_TONE_META[classifyReason(reason)].dot)} />
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
