"use client";

import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { CountUp } from "@/components/ui/count-up";
import { GradientCard } from "@/components/ui/gradient-card";
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

  // La bannière des révisions de l'accueil (components/home/cards.tsx#ReviewBanner) :
  // le dégradé orange → rose, le compte dans un carré de verre, « Go » en
  // pastille blanche. La carte entière est le lien.
  return (
    <GradientCard
      tone="review"
      href={href}
      className={cn("flex items-center gap-3.5 p-[1.125rem]", className)}
      aria-label={`${due} ${due > 1 ? "entrées" : "entrée"} du carnet à revoir aujourd'hui${subject ? ` en ${subject}` : ""}, environ ${due * 2} minutes. Réviser.`}
    >
      <span aria-hidden className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl font-black tabular">
        <CountUp value={due} />
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="t-card-title block">Révisions du jour</span>
        <span className="block truncate text-[0.8125rem] font-bold opacity-80">≈ {due * 2} min, de tête</span>
      </span>
      <span aria-hidden className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#0b0b14]">
        Go <ArrowRight size={14} strokeWidth={2.8} />
      </span>
    </GradientCard>
  );
}
