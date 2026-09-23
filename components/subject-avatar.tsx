"use client";

import { subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

/**
 * Pastille de matière — une lettre, une teinte (voir lib/study.ts#subjectMeta).
 *
 * Vivait dans components/exercises/exercise-badges.tsx avec les badges de
 * l'ancienne banque d'exercices (maîtrise, statut, difficulté). La banque a
 * été retirée ; cette pastille, elle, sert partout où une matière s'affiche
 * (historique, carnets, notes, objectifs), d'où ce module à part.
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
