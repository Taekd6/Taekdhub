"use client";

import { Award, PenLine } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Exercise } from "@/lib/supabase/types";

/**
 * Dire d'où vient l'exercice, sans jamais en dire plus qu'on ne sait.
 *
 * Un élève qui révise doit savoir en un coup d'œil s'il travaille un vrai
 * sujet de concours ou un exercice écrit pour l'app : ce n'est pas le même
 * enjeu, ni le même barème mental. Le badge affiche donc le concours et,
 * seulement s'ils sont réellement connus, la session et l'épreuve.
 *
 * La nuance porte tout le sens : « CCINP · session inconnue » est honnête,
 * « CCINP 2023 » inventé ne l'est pas. Les recueils d'oraux donnent le
 * concours sans dater chaque exercice ; le niveau `concours-partiel` existe
 * exactement pour ce cas et l'interface le montre au lieu de le masquer.
 */
export function ProvenanceBadge({ exercise, className }: { exercise: Exercise; className?: string }) {
  const isConcours = exercise.provenance === "concours-verifie" || exercise.provenance === "concours-partiel";

  if (!isConcours) {
    if (exercise.provenance !== "enseignant") return null;
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md bg-sky-400/12 px-1.5 py-0.5 text-2xs font-medium text-sky-200", className)}>
        <PenLine size={11} /> Cours
      </span>
    );
  }

  // Session et épreuve ne s'affichent que si elles existent réellement.
  const details = [exercise.year ? String(exercise.year) : null, exercise.epreuve].filter(Boolean).join(" · ");
  const verified = exercise.provenance === "concours-verifie";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium",
        verified ? "bg-amber-400/15 text-amber-200" : "bg-amber-400/10 text-amber-200/85",
        className
      )}
      title={
        verified
          ? "Sujet de concours : concours, session, épreuve et numéro vérifiés."
          : "Exercice de concours : concours identifié, session non documentée."
      }
    >
      <Award size={11} />
      <span className="font-semibold tracking-wide">CONCOURS</span>
      <span className="opacity-80">· {exercise.competition}</span>
      {details && <span className="opacity-80">· {details}</span>}
      {!verified && <span className="opacity-60">· session inconnue</span>}
    </span>
  );
}
