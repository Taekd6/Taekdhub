"use client";

import { subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

/**
 * Pastille de matière — l'initiale (voir lib/study.ts#subjectMeta), en
 * BLANC sur un disque au DÉGRADÉ DE MARQUE (refonte « Revolut clair »).
 *
 * Le même dégradé pour toutes les matières, volontairement : l'élève a
 * rejeté l'identité colorée des matières (refonte « Nuit ») — c'est la
 * lettre qui dit « Maths », pas la couleur. Le dégradé, lui, rend la rangée
 * vivante et « touchable », comme les pastilles datées des échéances.
 *
 * Vivait dans components/exercises/exercise-badges.tsx avec les badges de
 * l'ancienne banque d'exercices ; elle sert partout où une matière
 * s'affiche en tête de rangée.
 *
 *   sm  22 px — dans une ligne de texte ;
 *   md  32 px — rangée compacte ;
 *   lg  44 px — rangée de carte-liste (`ListRow`), à côté d'une `DateBadge`.
 */
export function SubjectAvatar({ subject, size = "md" }: { subject: Subject; size?: "sm" | "md" | "lg" }) {
  const meta = subjectMeta[subject];
  return (
    <span
      className={cn(
        "grad-brand grid shrink-0 place-items-center rounded-full font-black leading-none [box-shadow:0_6px_14px_-8px_var(--g1)]",
        size === "sm" && "h-[1.375rem] w-[1.375rem] text-[0.625rem]",
        size === "md" && "h-8 w-8 text-[0.75rem]",
        size === "lg" && "h-11 w-11 text-[0.9375rem]"
      )}
    >
      {meta.short}
    </span>
  );
}
