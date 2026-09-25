"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Meter } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/subject-avatar";
import { cn } from "@/lib/cn";
import { eveningPlan } from "@/lib/evening-minimums";
import { formatSpan } from "@/lib/utils";
import type { Preferences } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * CE SOIR — le minimum fixé pour aujourd'hui, matière par matière.
 *
 * Une barre par matière, le temps fait face au minimum, et ce qu'il reste.
 * Un soir libre (le mardi par défaut) : la carte ne s'affiche pas. Voir
 * lib/evening-minimums.ts.
 */
export function EveningCard({ preferences, sessions, className }: { preferences: Preferences; sessions: WorkSession[]; className?: string }) {
  const plan = eveningPlan(preferences, sessions);
  if (plan.entries.length === 0) return null;

  return (
    <section aria-labelledby="ce-soir-titre" className={cn("surface reveal p-5 sm:p-6", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ce-soir-titre" className="t-title">
          Ce soir
        </h2>
        <Link href="/settings#soirs" className="text-[0.875rem] font-bold text-accent hover:underline">
          Régler
        </Link>
      </div>
      <p className="t-meta mt-1">
        {plan.allMet ? "Minimum du soir atteint. Le reste est du bonus." : `Au moins ${formatSpan(plan.totalMinMinutes * 60)} aujourd'hui.`}
      </p>
      <ul className="mt-4 space-y-4">
        {plan.entries.map((entry, index) => (
          <li key={entry.subject} className="flex items-center gap-3">
            <SubjectAvatar subject={entry.subject} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.9375rem] font-bold text-ink">{entry.subject}</span>
                <span className="tabular shrink-0 text-[0.875rem] font-bold text-ink">
                  {entry.met ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <Check size={14} aria-hidden /> fait
                    </span>
                  ) : (
                    <>
                      {formatSpan(entry.doneMinutes * 60)}
                      <span className="text-subtle"> / {formatSpan(entry.minMinutes * 60)}</span>
                    </>
                  )}
                </span>
              </div>
              <Meter value={entry.percent} index={index} className="mt-2" tone={entry.met ? "success" : "accent"} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
