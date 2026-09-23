"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dueReviewItems, formatDueDay, nextReviewDay } from "@/lib/spaced-repetition";
import type { ReviewItem } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * « RÉVISIONS DU JOUR · N » — l'entrée de la séance de révision.
 *
 * Posé là où le carnet se lit déjà (l'accueil, /revoir, le hub d'une
 * matière), jamais comme une destination de plus dans la navigation : une
 * révision espacée ne marche que si elle a lieu LE JOUR où elle tombe, et
 * c'est l'accueil qu'on ouvre chaque jour.
 *
 * Trois états, dans cet ordre de fréquence :
 *   — des cartes dues : le compte et un bouton « Réviser » ;
 *   — rien aujourd'hui : une ligne discrète qui dit QUAND sera la prochaine
 *     (« demain · 3 ») — savoir que le système tourne évite d'aller vérifier ;
 *   — carnet vide (ou tout coché) : rien du tout. L'invitation à noter est
 *     déjà juste en dessous.
 *
 * Reçoit le carnet du parent, comme ReviewCapture : jamais de second
 * `usePrepahubData()`.
 */
export function DueToday({
  items,
  subject = null,
  now,
  className,
}: {
  items: ReviewItem[];
  /** Hub d'une matière : ne compte que la sienne, et la séance s'ouvre filtrée. */
  subject?: Subject | null;
  /** Pour les tests visuels ; par défaut, maintenant. */
  now?: Date;
  className?: string;
}) {
  const { due, next } = useMemo(() => {
    const at = now ?? new Date();
    return { due: dueReviewItems(items, at, subject).length, next: nextReviewDay(items, at, subject) };
  }, [items, subject, now]);

  const href = subject ? `/revoir/session?subject=${encodeURIComponent(subject)}` : "/revoir/session";

  if (due === 0 && !next) return null;

  if (due === 0 && next) {
    return (
      <p className={cn("t-meta text-2xs", className)}>
        Aucune révision aujourd&apos;hui · prochaine {formatDueDay(next.day)} (<span className="tabular">{next.count}</span>)
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-panel px-4 py-3", className)}>
      <div className="min-w-0">
        <p className="t-subhead">
          Révisions du jour · <span className="tabular">{due}</span>
        </p>
        <p className="t-meta mt-0.5 text-2xs">
          {due > 1 ? `${due} entrées du carnet à` : "Une entrée du carnet à"} retrouver de tête — quelques minutes.
        </p>
      </div>
      <Link href={href} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}>
        Réviser <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
