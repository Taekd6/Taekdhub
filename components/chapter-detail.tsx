"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import type { ChapterDetail as ChapterDetailData } from "@/lib/next-action";
import { formatDuration } from "@/lib/utils";

const LAST_SESSION_FORMATTER = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * "Progression par chapitre" (Phase 6) — fiche affichée en superposition
 * depuis la page Progression (voir progress-overview.tsx), purement
 * présentationnelle : tous les chiffres viennent de
 * `computeChapterDetail` (lib/next-action.ts), qui compose des moteurs déjà
 * existants (résultats, recommandation). Aucun calcul ici.
 */
export function ChapterDetail({ detail, onClose }: { detail: ChapterDetailData; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { chapter, total, mastered, averageMastery, attemptedCount, results, lastSessionAt, totalSeconds, recommendations } = detail;
  const mainAction = recommendations[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={chapter.label}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-hairline/[0.08] bg-elevated p-6 shadow-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{chapter.subject}</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{chapter.label}</h2>
          </div>
          <button type="button" onClick={onClose} className="focus-ring shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-hairline/[0.045] hover:text-zinc-200" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Maîtrise moyenne</span>
            <span className="font-semibold text-zinc-100">{averageMastery}%</span>
          </div>
          <ProgressBar value={averageMastery} className="mt-2" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              {mastered}/{total}
            </p>
            <p className="text-2xs text-zinc-500">Maîtrisés</p>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              {attemptedCount}/{total}
            </p>
            <p className="text-2xs text-zinc-500">Déjà travaillés</p>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">{formatDuration(totalSeconds)}</p>
            <p className="text-2xs text-zinc-500">Temps consacré</p>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-emerald-400">{results.success}</p>
            <p className="text-2xs text-zinc-500">Réussites</p>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-rose-400">{results.failure}</p>
            <p className="text-2xs text-zinc-500">Échecs</p>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              {lastSessionAt ? LAST_SESSION_FORMATTER.format(new Date(lastSessionAt)) : "—"}
            </p>
            <p className="text-2xs text-zinc-500">Dernière séance</p>
          </div>
        </div>

        <div className="mt-6 border-t border-hairline/[0.06] pt-5">
          <p className="text-sm font-medium text-zinc-200">Que dois-je faire pour améliorer ce chapitre ?</p>
          {mainAction ? (
            <>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-hairline/[0.07] p-3">
                <SubjectAvatar subject={chapter.subject} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{mainAction.exercise.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {mainAction.reasons.map((reason) => (
                      <Badge key={reason} variant="warning">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Link href={`/exercises?focus=${mainAction.exercise.id}`}>
                <Button size="sm" className="mt-3 w-full">
                  Travailler cet exercice <ArrowRight size={14} />
                </Button>
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Rien de signalé pour l&apos;instant — ce chapitre est sous contrôle.</p>
          )}
        </div>
      </div>
    </div>
  );
}
