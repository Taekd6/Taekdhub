"use client";

import Link from "next/link";
import { ArrowRight, NotebookPen } from "lucide-react";
import { cn } from "@/lib/cn";
import { errorLogHref, sourceForGradeKind } from "@/lib/error-log";
import type { ErrorEntry, Grade, GradeKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * POINTS D'ENTRÉE DU CARNET D'ERREURS — de petits liens, posés là où l'on
 * sort d'une épreuve, plutôt qu'un onglet de plus dans la navigation.
 *
 * Isolés ici pour que les écrans existants (hub d'une matière, saisie des
 * notes) ne gagnent qu'une ligne chacun. Ils reçoivent les données en props :
 * aucun d'eux n'appelle `usePrepahubData()`.
 */

/** « Mes erreurs · N » — dans le hub d'une matière, filtré et pré-rempli sur elle. */
export function SubjectErrorsLink({ errors, subject, className }: { errors: ErrorEntry[]; subject: Subject; className?: string }) {
  const count = errors.filter((entry) => entry.subject === subject).length;
  return (
    <Link
      href={errorLogHref({ subject })}
      className={cn("t-meta inline-flex min-h-6 items-center gap-1.5 rounded hover:text-ink max-lg:min-h-11", className)}
    >
      <NotebookPen size={14} aria-hidden /> Mes erreurs · <span className="tabular">{count}</span>
    </Link>
  );
}

/**
 * « Noter les erreurs de ce DS » — juste après la saisie d'une note : c'est
 * le moment où la copie est encore sous les yeux. Pré-remplit matière,
 * source et date de l'épreuve.
 */
export function GradeErrorsLink({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <Link
      href={errorLogHref({ subject: grade.subject, source: sourceForGradeKind(grade.kind), date: grade.date })}
      className={cn("t-meta inline-flex min-h-6 items-center gap-1 text-2xs text-accent hover:underline max-lg:min-h-11", className)}
    >
      Noter les erreurs {GRADE_KIND_PHRASE[grade.kind]} <ArrowRight size={12} aria-hidden />
    </Link>
  );
}

const GRADE_KIND_PHRASE: Record<GradeKind, string> = {
  ds: "de ce DS",
  dm: "de ce DM",
  interro: "de cette interro",
  colle: "de cette colle",
  concours: "de ce concours blanc",
  autre: "de cette épreuve",
};
